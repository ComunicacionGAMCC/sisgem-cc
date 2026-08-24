import { createClient } from "@supabase/supabase-js";

function createHealthClient() {
  const supabaseUrl = process.env.HEALTH_SUPABASE_URL;
  const secretKey = process.env.HEALTH_SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "HEALTH_SUPABASE_URL y HEALTH_SUPABASE_SECRET_KEY no están configuradas para este entorno.",
    );
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "sigem-health-server" },
    },
  });
}

let client: ReturnType<typeof createHealthClient> | null = null;

export function getHealthClient() {
  if (!client) client = createHealthClient();
  return client;
}
