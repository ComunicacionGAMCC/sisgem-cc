import { createClient, type User } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.HEALTH_SUPABASE_URL;
const secretKey = process.env.HEALTH_SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error("Faltan las credenciales privadas de Supabase Salud.");
}

const input = process.argv.slice(2);
if (input.length !== 4) {
  throw new Error("Indica exactamente dos pares: correo y nombre completo.");
}

const requestedUsers = [
  { email: input[0].trim().toLowerCase(), fullName: input[1].trim() },
  { email: input[2].trim().toLowerCase(), fullName: input[3].trim() },
];

for (const user of requestedUsers) {
  if (!/^\S+@\S+\.\S+$/.test(user.email) || !user.fullName) {
    throw new Error("Cada superadministrador necesita un correo válido y un nombre.");
  }
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUser(email: string): Promise<User | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
}

const results: Array<{ email: string; invitation: "sent" | "existing"; role: string }> = [];

for (const requested of requestedUsers) {
  let authUser = await findUser(requested.email);
  let invitation: "sent" | "existing" = "existing";

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(requested.email, {
      redirectTo: "https://sisgem-cc.vercel.app/?access=1",
      data: { full_name: requested.fullName },
    });
    if (error) throw error;
    authUser = data.user;
    invitation = "sent";
  }

  if (!authUser) throw new Error(`No se pudo resolver la identidad de ${requested.email}.`);

  const { data, error } = await supabase.rpc("access_bootstrap_super_admin", {
    target_user_id: authUser.id,
    target_email: requested.email,
    target_full_name: requested.fullName,
  });
  if (error) throw error;

  results.push({
    email: requested.email,
    invitation,
    role: typeof data === "object" && data && "role" in data ? String(data.role) : "super_admin",
  });
}

console.log(JSON.stringify(results));
