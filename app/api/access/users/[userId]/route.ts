import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError, authorizeRequest, type AccessRole } from "../../../../../db/access-control";
import { getHealthClient } from "../../../../../db/health-index";

export const dynamic = "force-dynamic";

type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  active: boolean;
  roles: AccessRole[];
};

type UserActionBody = {
  action?: "update" | "password" | "set_active";
  email?: string;
  fullName?: string;
  jobTitle?: string;
  password?: string;
  active?: boolean;
  roleCode?: string;
  scopeType?: "global" | "municipal_unit" | "facility";
  scopeId?: string | null;
  scopeLabel?: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function managedDirectory(client: Awaited<ReturnType<typeof authorizeRequest>>["client"]) {
  const { data, error } = await client.rpc("access_list_users");
  if (error) throw new AccessDeniedError(error.message);
  return (data ?? []) as ManagedUser[];
}

function isStrongPassword(password: string) {
  return password.length >= 12 && password.length <= 128
    && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { client } = await authorizeRequest(request, "platform.users.manage");
    const { userId } = await params;
    if (!uuidPattern.test(userId)) {
      return NextResponse.json({ error: "El usuario indicado no es válido." }, { status: 400 });
    }
    const target = (await managedDirectory(client)).find((user) => user.id === userId);
    if (!target) throw new AccessDeniedError("No puedes consultar este usuario.");

    const { data, error } = await getHealthClient().auth.admin.getUserById(userId);
    if (error || !data.user) {
      return NextResponse.json({ error: "No se pudieron consultar los detalles del usuario." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...target,
        createdAt: data.user.created_at,
        lastSignInAt: data.user.last_sign_in_at ?? null,
        emailConfirmedAt: data.user.email_confirmed_at ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudieron consultar los detalles del usuario", error);
    return NextResponse.json({ error: "No se pudieron consultar los detalles." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { client, context } = await authorizeRequest(request, "platform.users.manage");
    if (context.assuranceLevel !== "aal2") {
      throw new AccessDeniedError("Confirma la verificación en dos pasos antes de administrar usuarios.");
    }
    const { userId } = await params;
    if (!uuidPattern.test(userId)) {
      return NextResponse.json({ error: "El usuario indicado no es válido." }, { status: 400 });
    }
    const body = (await request.json()) as UserActionBody;
    const target = (await managedDirectory(client)).find((user) => user.id === userId);
    if (!target) throw new AccessDeniedError("No puedes administrar este usuario.");

    const healthAdmin = getHealthClient();
    if (body.action === "password") {
      const password = body.password ?? "";
      if (!isStrongPassword(password)) {
        return NextResponse.json(
          { error: "La contraseña debe tener entre 12 y 128 caracteres, con letras y números." },
          { status: 400 },
        );
      }
      const { error: passwordError } = await healthAdmin.auth.admin.updateUserById(userId, { password });
      if (passwordError) {
        return NextResponse.json({ error: "No se pudo cambiar la contraseña." }, { status: 400 });
      }
      const { error: auditError } = await client.rpc("access_record_password_change", {
        target_user_id: userId,
      });
      if (auditError) console.error("No se pudo auditar el cambio de contraseña", auditError);
      return NextResponse.json({ updated: true });
    }

    const currentRole = target.roles[0];
    if (!currentRole) {
      return NextResponse.json({ error: "El usuario no tiene un rol administrable." }, { status: 409 });
    }

    if (body.action === "set_active") {
      const nextActive = body.active === true;
      if (!nextActive && userId === context.profile.id) {
        throw new AccessDeniedError("No puedes desactivar tu propia cuenta.");
      }
      if (!nextActive && target.roles.some((role) => role.code === "super_admin")) {
        throw new AccessDeniedError("Las cuentas superadministradoras deben permanecer activas.");
      }

      const { error: authError } = await healthAdmin.auth.admin.updateUserById(userId, {
        ban_duration: nextActive ? "none" : "876000h",
      });
      if (authError) {
        return NextResponse.json({ error: "No se pudo cambiar el estado de la cuenta." }, { status: 400 });
      }
      const { error: profileError } = await client.rpc("access_manage_user", {
        target_user_id: userId,
        target_email: target.email,
        target_full_name: target.fullName,
        target_job_title: target.jobTitle,
        target_active: nextActive,
        target_role_code: currentRole.code,
        target_scope_type: currentRole.scopeType,
        target_scope_id: currentRole.scopeId,
        target_scope_label: currentRole.scopeLabel,
      });
      if (profileError) {
        await healthAdmin.auth.admin.updateUserById(userId, {
          ban_duration: target.active ? "none" : "876000h",
        });
        throw new AccessDeniedError(profileError.message);
      }
      return NextResponse.json({ updated: true, active: nextActive });
    }

    if (body.action !== "update") {
      return NextResponse.json({ error: "Selecciona una acción válida." }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase() ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const jobTitle = body.jobTitle?.trim() || null;
    const roleCode = body.roleCode?.trim() ?? "";
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validEmail || fullName.length < 5 || !roleCode) {
      return NextResponse.json(
        { error: "Nombre completo, correo y tipo de acceso son obligatorios." },
        { status: 400 },
      );
    }
    if (target.roles.some((role) => role.code === "super_admin") && roleCode !== "super_admin") {
      throw new AccessDeniedError("Las cuentas superadministradoras deben conservar su rol.");
    }

    const { data: currentAuth, error: currentAuthError } = await healthAdmin.auth.admin.getUserById(userId);
    if (currentAuthError || !currentAuth.user) {
      return NextResponse.json({ error: "No se pudo consultar la identidad del usuario." }, { status: 404 });
    }
    const previousMetadata = currentAuth.user.user_metadata;
    const { error: authError } = await healthAdmin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: { ...previousMetadata, full_name: fullName },
    });
    if (authError) {
      return NextResponse.json({ error: "No se pudieron actualizar los datos de acceso." }, { status: 400 });
    }

    const { error: profileError } = await client.rpc("access_manage_user", {
      target_user_id: userId,
      target_email: email,
      target_full_name: fullName,
      target_job_title: jobTitle,
      target_active: target.active,
      target_role_code: roleCode,
      target_scope_type: body.scopeType ?? "global",
      target_scope_id: body.scopeId ?? null,
      target_scope_label: body.scopeLabel ?? null,
    });
    if (profileError) {
      const { error: rollbackError } = await healthAdmin.auth.admin.updateUserById(userId, {
        email: target.email,
        email_confirm: true,
        user_metadata: previousMetadata,
      });
      console.error("No se pudo actualizar el perfil administrado", profileError, rollbackError);
      return NextResponse.json({ error: profileError.message }, { status: 409 });
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo administrar el usuario", error);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}
