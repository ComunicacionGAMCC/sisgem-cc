import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const HEALTH_SUPABASE_URL =
  process.env.NEXT_PUBLIC_HEALTH_SUPABASE_URL ??
  process.env.HEALTH_SUPABASE_URL ??
  "https://dorilfiowwwxwuoeloel.supabase.co";

export const HEALTH_SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_HEALTH_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_weZEzBf2Uie-hpZWJXGA2A_wel4u7bL";

export type AccessRole = {
  code: string;
  name: string;
  module: "platform" | "sigem" | "health";
  scopeType: "global" | "municipal_unit" | "facility";
  scopeId: string | null;
  scopeLabel: string | null;
};

export type AccessContext = {
  profile: {
    id: string;
    email: string;
    fullName: string;
    jobTitle: string | null;
    active: boolean;
  };
  roles: AccessRole[];
  permissions: string[];
  mfaRequired: boolean;
  assuranceLevel: "aal1" | "aal2";
};

export class AccessDeniedError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AccessDeniedError";
    this.status = status;
  }
}

export function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}

export function createUserScopedHealthClient(token: string): SupabaseClient {
  return createClient(HEALTH_SUPABASE_URL, HEALTH_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Client-Info": "sigem-access-server",
      },
    },
  });
}

export async function authorizeRequest(
  request: NextRequest,
  requiredPermission?: string,
) {
  const token = bearerToken(request);
  if (!token) throw new AccessDeniedError("Debes iniciar sesión.", 401);

  const client = createUserScopedHealthClient(token);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) {
    throw new AccessDeniedError("La sesión venció. Vuelve a iniciar sesión.", 401);
  }

  const { data, error } = await client.rpc("access_my_context");
  if (error || !data) {
    throw new AccessDeniedError(error?.message ?? "La cuenta no tiene acceso activo.");
  }
  const context = data as unknown as AccessContext;

  if (requiredPermission && !context.permissions.includes(requiredPermission)) {
    throw new AccessDeniedError("No tienes permiso para realizar esta acción.");
  }

  return { token, client, context, user: userData.user };
}

export function scopedMunicipalUnitIds(context: AccessContext) {
  const sigemRoles = context.roles.filter((role) => role.module === "sigem" || role.module === "platform");
  if (sigemRoles.some((role) => role.scopeType === "global")) return null;
  return sigemRoles
    .filter((role) => role.scopeType === "municipal_unit" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function hasCabinetAgendaAccess(context: AccessContext) {
  if (
    context.permissions.includes("platform.users.manage")
    || context.permissions.includes("sigem.users.manage")
  ) return true;

  const hasSigemRole = context.roles.some((role) => role.module === "sigem");
  if (hasSigemRole && /gabinete/i.test(context.profile.jobTitle ?? "")) return true;

  return context.roles.some((role) => (
    role.module === "sigem"
    && role.scopeType === "municipal_unit"
    && /gabinete/i.test(role.scopeLabel ?? "")
  ));
}

export function requireCabinetAgendaAccess(context: AccessContext) {
  if (!hasCabinetAgendaAccess(context)) {
    throw new AccessDeniedError("La agenda del alcalde está reservada para Secretaría de Gabinete.");
  }
}
