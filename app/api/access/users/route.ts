import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, AccessDeniedError } from "../../../../db/access-control";
import { getHealthClient } from "../../../../db/health-index";

export const dynamic = "force-dynamic";

type ManagedUserBody = {
  email?: string;
  fullName?: string;
  jobTitle?: string;
  password?: string;
  roleCode?: string;
  scopeType?: "global" | "municipal_unit" | "facility";
  scopeId?: string | null;
  scopeLabel?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { client, context } = await authorizeRequest(request);
    if (context.assuranceLevel !== "aal2") {
      throw new AccessDeniedError("Confirma la verificación en dos pasos antes de crear usuarios.");
    }

    const body = (await request.json()) as ManagedUserBody;
    const email = body.email?.trim().toLowerCase() ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const password = body.password ?? "";
    const roleCode = body.roleCode?.trim() ?? "";
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const validPassword = password.length >= 12 && password.length <= 128
      && /[A-Za-z]/.test(password) && /\d/.test(password);

    if (!validEmail || fullName.length < 5 || !roleCode) {
      return NextResponse.json(
        { error: "Nombre completo, correo y tipo de acceso son obligatorios." },
        { status: 400 },
      );
    }
    if (!validPassword) {
      return NextResponse.json(
        { error: "La contraseña debe tener entre 12 y 128 caracteres, con letras y números." },
        { status: 400 },
      );
    }

    const { data: catalogData, error: catalogError } = await client.rpc("access_roles_catalog");
    const catalog = (catalogData ?? []) as Array<{ code: string }>;
    if (catalogError || !catalog.some((role) => role.code === roleCode)) {
      throw new AccessDeniedError("No puedes asignar el tipo de acceso seleccionado.");
    }

    const healthAdmin = getHealthClient();
    const { data: created, error: createError } = await healthAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) {
      const alreadyExists = createError?.message.toLowerCase().includes("already")
        || createError?.message.toLowerCase().includes("registered");
      return NextResponse.json(
        { error: alreadyExists ? "Ya existe una cuenta con ese correo." : "No se pudo crear la cuenta." },
        { status: 400 },
      );
    }

    const { data: assignment, error: assignmentError } = await client.rpc(
      "access_register_invited_user",
      {
        target_user_id: created.user.id,
        target_email: email,
        target_full_name: fullName,
        target_role_code: roleCode,
        target_scope_type: body.scopeType ?? "global",
        target_scope_id: body.scopeId ?? null,
        target_scope_label: body.scopeLabel ?? null,
        target_job_title: body.jobTitle?.trim() || null,
      },
    );
    if (assignmentError) {
      const { error: rollbackError } = await healthAdmin.auth.admin.deleteUser(created.user.id);
      console.error("No se pudo asignar el rol al usuario creado", assignmentError, rollbackError);
      return NextResponse.json(
        { error: "No se pudo asignar el acceso. La cuenta no fue conservada." },
        { status: 409 },
      );
    }

    return NextResponse.json({ user: assignment, email }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo crear el usuario", error);
    return NextResponse.json({ error: "No se pudo crear el acceso." }, { status: 500 });
  }
}
