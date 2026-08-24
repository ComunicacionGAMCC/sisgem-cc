import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, AccessDeniedError } from "../../../../db/access-control";
import { getHealthClient } from "../../../../db/health-index";

export const dynamic = "force-dynamic";

type InvitationBody = {
  email?: string;
  fullName?: string;
  jobTitle?: string;
  roleCode?: string;
  scopeType?: "global" | "municipal_unit" | "facility";
  scopeId?: string | null;
  scopeLabel?: string | null;
};

function invitationRedirectUrl() {
  const base = process.env.AUTH_REDIRECT_URL ?? "https://sisgem-cc.vercel.app";
  return `${base.replace(/\/$/, "")}/`;
}

export async function POST(request: NextRequest) {
  try {
    const { client, context } = await authorizeRequest(request);
    if (context.assuranceLevel !== "aal2") {
      throw new AccessDeniedError("Confirma la verificación en dos pasos antes de invitar usuarios.");
    }

    const body = (await request.json()) as InvitationBody;
    const email = body.email?.trim().toLowerCase() ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const roleCode = body.roleCode?.trim() ?? "";
    if (!email.includes("@") || fullName.length < 5 || !roleCode) {
      return NextResponse.json(
        { error: "Nombre completo, correo y tipo de acceso son obligatorios." },
        { status: 400 },
      );
    }

    const { data: catalogData, error: catalogError } = await client.rpc("access_roles_catalog");
    const catalog = (catalogData ?? []) as Array<{ code: string }>;
    if (catalogError || !catalog.some((role) => role.code === roleCode)) {
      throw new AccessDeniedError("No puedes asignar el tipo de acceso seleccionado.");
    }

    const { data: invitation, error: invitationError } = await getHealthClient().auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName },
        redirectTo: invitationRedirectUrl(),
      },
    );
    if (invitationError || !invitation.user) {
      const message = invitationError?.message.toLowerCase().includes("already")
        ? "Ya existe una cuenta con ese correo."
        : invitationError?.message ?? "No se pudo enviar la invitación.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await client.rpc(
      "access_register_invited_user",
      {
        target_user_id: invitation.user.id,
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
      console.error("La identidad fue invitada, pero no se pudo asignar el rol", assignmentError);
      return NextResponse.json(
        { error: "La invitación se creó, pero el acceso requiere revisión del superadministrador." },
        { status: 409 },
      );
    }

    return NextResponse.json({ invitation: assignment, email }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo invitar al usuario", error);
    return NextResponse.json({ error: "No se pudo crear el acceso." }, { status: 500 });
  }
}
