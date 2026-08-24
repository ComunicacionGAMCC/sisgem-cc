"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const supabaseUrl =
  process.env.NEXT_PUBLIC_HEALTH_SUPABASE_URL ??
  "https://dorilfiowwwxwuoeloel.supabase.co";
const supabasePublishableKey =
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

export type AccessContextData = {
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

type AccessValue = {
  client: SupabaseClient;
  session: Session | null;
  context: AccessContextData | null;
  loading: boolean;
  error: string;
  needsPassword: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setInitialPassword: (password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshContext: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

const AccessContext = createContext<AccessValue | null>(null);

let sharedBrowserClient: SupabaseClient | null = null;

function getBrowserClient() {
  if (sharedBrowserClient) return sharedBrowserClient;
  sharedBrowserClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      flowType: "implicit",
    },
    global: { headers: { "X-Client-Info": "sigem-access-browser" } },
  });
  return sharedBrowserClient;
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getBrowserClient);
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<AccessContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(() => {
    if (typeof window === "undefined") return false;
    const hashType = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type");
    return hashType === "invite" || hashType === "recovery";
  });

  const loadContext = useCallback(async (activeSession: Session | null) => {
    setError("");
    if (!activeSession) {
      setContext(null);
      return;
    }
    const { data, error: contextError } = await client.rpc("access_my_context");
    if (contextError || !data) {
      setContext(null);
      setError(contextError?.message ?? "La cuenta aún no tiene un acceso asignado.");
      return;
    }
    setContext(data as unknown as AccessContextData);
  }, [client]);

  useEffect(() => {
    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadContext(data.session);
      setLoading(false);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      window.setTimeout(() => {
        loadContext(nextSession).finally(() => setLoading(false));
      }, 0);
    });
    return () => subscription.subscription.unsubscribe();
  }, [client, loadContext]);

  async function signIn(email: string, password: string) {
    setLoading(true);
    setError("");
    const { data, error: signInError } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError) {
      setLoading(false);
      throw new Error("Correo o contraseña incorrectos.");
    }
    setSession(data.session);
    await loadContext(data.session);
    setLoading(false);
  }

  async function signOut() {
    await client.auth.signOut();
    setSession(null);
    setContext(null);
    setError("");
  }

  async function setInitialPassword(password: string) {
    if (password.length < 10) throw new Error("Usa una contraseña de al menos 10 caracteres.");
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) throw new Error(updateError.message);
    setNeedsPassword(false);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }

  async function sendPasswordReset(email: string) {
    const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    if (resetError) throw new Error(resetError.message);
  }

  async function refreshContext() {
    const { data } = await client.auth.getSession();
    setSession(data.session);
    await loadContext(data.session);
  }

  const value: AccessValue = {
    client,
    session,
    context,
    loading,
    error,
    needsPassword,
    signIn,
    signOut,
    setInitialPassword,
    sendPasswordReset,
    refreshContext,
    hasPermission: (permission) => context?.permissions.includes(permission) ?? false,
  };

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("AccessProvider no está configurado.");
  return value;
}

export function AccessGate({ onBack }: { onBack: () => void }) {
  const access = useAccess();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mfaMode, setMfaMode] = useState<"idle" | "challenge" | "enroll">("idle");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    if (!access.session || !access.context?.mfaRequired || access.context.assuranceLevel === "aal2") return;
    access.client.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp.find((factor) => factor.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMfaMode("challenge");
      }
    });
  }, [access.client, access.context, access.session]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      await access.signIn(email, password);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      await access.setInitialPassword(newPassword);
      setMessage("Contraseña guardada correctamente.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo guardar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startEnrollment() {
    setSubmitting(true);
    setMessage("");
    try {
      const { data, error } = await access.client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SIGEM Cuatro Cañadas",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setMfaMode("enroll");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo activar la seguridad.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const { error } = await access.client.auth.mfa.challengeAndVerify({
        factorId,
        code: verificationCode.trim(),
      });
      if (error) throw error;
      await access.client.auth.refreshSession();
      await access.refreshContext();
      setMfaMode("idle");
    } catch {
      setMessage("El código no es válido o ya venció.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    if (!email.includes("@")) {
      setMessage("Escribe primero tu correo institucional.");
      return;
    }
    setSubmitting(true);
    try {
      await access.sendPasswordReset(email);
      setMessage("Enviamos un enlace seguro a tu correo.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo enviar el enlace.");
    } finally {
      setSubmitting(false);
    }
  }

  if (access.loading) {
    return <div className="accessGate"><div className="accessCard accessLoading">Verificando acceso seguro…</div></div>;
  }

  if (!access.session) {
    return (
      <div className="accessGate">
        <section className="accessCard">
          <button className="accessBack" onClick={onBack}>← Volver al portal ciudadano</button>
          <div className="accessBrand"><img src="/escudo-gamcc.png" alt="GAMCC" /><span><b>Acceso institucional</b><small>SIGEM · Hospital Municipal</small></span></div>
          <span className="accessKicker">ÁREA PROTEGIDA</span>
          <h1>Bienvenido al sistema municipal</h1>
          <p>Ingresa con las credenciales enviadas a tu correo. Tus opciones se habilitarán según tu cargo y área.</p>
          <form className="accessForm" onSubmit={submitLogin}>
            <label>Correo institucional<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
            <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={8} /></label>
            {message && <p className="accessMessage" role="status">{message}</p>}
            <button className="accessPrimary" type="submit" disabled={submitting}>{submitting ? "Ingresando…" : "Ingresar de forma segura"}</button>
            <button className="accessLink" type="button" onClick={resetPassword} disabled={submitting}>Olvidé mi contraseña</button>
          </form>
          <small className="accessPrivacy">Acceso auditado. No compartas tus credenciales ni códigos de verificación.</small>
        </section>
      </div>
    );
  }

  if (access.needsPassword) {
    return (
      <div className="accessGate"><section className="accessCard compact">
        <span className="accessKicker">PRIMER INGRESO</span><h1>Crea tu contraseña</h1>
        <p>Usa al menos 10 caracteres y evita datos fáciles de adivinar.</p>
        <form className="accessForm" onSubmit={submitPassword}>
          <label>Nueva contraseña<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={10} required /></label>
          {message && <p className="accessMessage">{message}</p>}
          <button className="accessPrimary" disabled={submitting}>{submitting ? "Guardando…" : "Guardar contraseña"}</button>
        </form>
      </section></div>
    );
  }

  if (!access.context) {
    return (
      <div className="accessGate"><section className="accessCard compact">
        <span className="accessKicker">CUENTA SIN ASIGNACIÓN</span><h1>Acceso pendiente</h1>
        <p>{access.error || "Un administrador debe asignarte un cargo y un área antes de ingresar."}</p>
        <button className="accessPrimary" onClick={access.signOut}>Cerrar sesión</button>
      </section></div>
    );
  }

  if (access.context.mfaRequired && access.context.assuranceLevel !== "aal2") {
    return (
      <div className="accessGate"><section className="accessCard compact mfaCard">
        <span className="accessKicker">VERIFICACIÓN EN DOS PASOS</span>
        <h1>Protege tu acceso</h1>
        {mfaMode === "idle" && <><p>Por tu nivel de acceso debes vincular una aplicación autenticadora antes de continuar.</p><button className="accessPrimary" onClick={startEnrollment} disabled={submitting}>Activar verificación</button></>}
        {mfaMode === "enroll" && <><p>Escanea este código con Google Authenticator, Microsoft Authenticator o una aplicación compatible.</p>{qrCode && <img className="mfaQr" src={qrCode} alt="Código QR para activar verificación" />}</>}
        {mfaMode === "challenge" && <p>Escribe el código de seis dígitos de tu aplicación autenticadora.</p>}
        {(mfaMode === "enroll" || mfaMode === "challenge") && <form className="accessForm" onSubmit={verifyMfa}><label>Código de seguridad<input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>{message && <p className="accessMessage">{message}</p>}<button className="accessPrimary" disabled={submitting || verificationCode.length !== 6}>{submitting ? "Verificando…" : "Verificar y continuar"}</button></form>}
        <button className="accessLink" onClick={access.signOut}>Usar otra cuenta</button>
      </section></div>
    );
  }

  return null;
}

type RoleCatalog = {
  code: string;
  name: string;
  module: "platform" | "sigem" | "health";
  description: string;
  requiresMfa: boolean;
};

type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  active: boolean;
  roles: AccessRole[];
};

type MunicipalUnit = { id: string; code: string; name: string };

export function AccessManagement() {
  const access = useAccess();
  const [roles, setRoles] = useState<RoleCatalog[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [units, setUnits] = useState<MunicipalUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [unitId, setUnitId] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);

  const canManageSigem = access.hasPermission("sigem.users.manage");
  useEffect(() => {
    if (!access.session) return;
    let active = true;
    const token = access.session.access_token;
    async function fetchDirectory() {
      const [{ data: rolesData }, { data: usersData }, unitsResponse] = await Promise.all([
        access.client.rpc("access_roles_catalog"),
        access.client.rpc("access_list_users"),
        canManageSigem
          ? fetch("/api/access/scopes", { headers: { Authorization: `Bearer ${token}` } })
          : Promise.resolve(null),
      ]);
      if (!active) return;
      const nextRoles = (rolesData ?? []) as RoleCatalog[];
      setRoles(nextRoles);
      setRoleCode((current) => current || nextRoles[0]?.code || "");
      setUsers((usersData ?? []) as ManagedUser[]);
      if (unitsResponse?.ok) {
        const result = (await unitsResponse.json()) as { units: MunicipalUnit[] };
        if (active) setUnits(result.units);
      }
      if (active) setLoading(false);
    }
    fetchDirectory();
    return () => { active = false; };
  }, [access.client, access.session, canManageSigem, refreshIndex]);

  const selectedRole = roles.find((role) => role.code === roleCode);
  const requiresUnit = selectedRole?.module === "sigem" && !["sigem_admin", "super_admin"].includes(roleCode);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!access.session) return;
    const form = new FormData(event.currentTarget);
    const unit = units.find((item) => item.id === unitId);
    if (requiresUnit && !unit) {
      setMessage("Selecciona el área municipal correspondiente.");
      return;
    }
    setMessage("");
    const response = await fetch("/api/access/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access.session.access_token}`,
      },
      body: JSON.stringify({
        email: form.get("email"),
        fullName: form.get("fullName"),
        jobTitle: form.get("jobTitle"),
        roleCode,
        scopeType: requiresUnit ? "municipal_unit" : "global",
        scopeId: requiresUnit ? unit?.id : null,
        scopeLabel: requiresUnit ? `${unit?.code} · ${unit?.name}` : null,
      }),
    });
    const result = (await response.json()) as { error?: string; email?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo crear el acceso.");
      return;
    }
    setMessage(`Invitación enviada a ${result.email}.`);
    event.currentTarget.reset();
    setUnitId("");
    setLoading(true);
    setRefreshIndex((value) => value + 1);
  }

  return (
    <div className="accessModule moduleView">
      <section className="accessModuleHero">
        <div><span>CONTROL DE IDENTIDADES</span><h2>Usuarios, cargos y accesos</h2><p>Cada persona recibe únicamente los permisos de su función y área.</p></div>
        <div className="accessSecurityBadge"><b>2FA</b><span>Seguridad reforzada<small>Administración auditada</small></span></div>
      </section>
      <div className="accessModuleGrid">
        <section className="panel accessInvitePanel">
          <header><span>NUEVO ACCESO</span><h3>Invitar a un funcionario</h3><p>La persona recibirá un enlace para crear su contraseña.</p></header>
          <form onSubmit={invite}>
            <label>Nombre completo<input name="fullName" required minLength={5} /></label>
            <div className="accessFormGrid"><label>Correo institucional<input name="email" type="email" required /></label><label>Cargo<input name="jobTitle" required /></label></div>
            <label>Tipo de acceso<select value={roleCode} onChange={(event) => { setRoleCode(event.target.value); setUnitId(""); }} required>{roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></label>
            {selectedRole && <p className="roleDescription">{selectedRole.description}{selectedRole.requiresMfa ? " · Requiere verificación en dos pasos." : ""}</p>}
            {requiresUnit && <label>Área o unidad municipal<select value={unitId} onChange={(event) => setUnitId(event.target.value)} required><option value="">Seleccionar área…</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>}
            {message && <p className="accessMessage" role="status">{message}</p>}
            <button className="accessPrimary" disabled={loading || !roleCode}>Enviar invitación segura</button>
          </form>
        </section>
        <section className="panel accessUsersPanel">
          <header><span>DIRECTORIO ACTIVO</span><h3>Usuarios administrados</h3><p>{users.length} cuenta{users.length === 1 ? "" : "s"} visible{users.length === 1 ? "" : "s"} según tu ámbito.</p></header>
          {loading && <p className="accessEmpty">Cargando directorio…</p>}
          {!loading && users.map((user) => <article key={user.id}><span className="userInitials">{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span><div><strong>{user.fullName}</strong><small>{user.jobTitle || user.email}</small><div className="userRoles">{user.roles.map((role) => <em key={`${role.code}-${role.scopeId ?? "global"}`}>{role.name}{role.scopeLabel ? ` · ${role.scopeLabel}` : ""}</em>)}</div></div><b className={user.active ? "active" : "inactive"}>{user.active ? "Activo" : "Inactivo"}</b></article>)}
          {!loading && !users.length && <p className="accessEmpty">Aún no hay usuarios asignados en este ámbito.</p>}
        </section>
      </div>
    </div>
  );
}
