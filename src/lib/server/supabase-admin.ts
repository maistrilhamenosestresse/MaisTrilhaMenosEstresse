import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/server/env";

export function createSupabaseAdmin() {
  return createClient(
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
