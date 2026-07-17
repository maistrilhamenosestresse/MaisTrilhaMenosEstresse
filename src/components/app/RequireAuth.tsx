"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const isLoginPage = pathname === "/app/login";

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          await supabase.auth.signOut({ scope: "local" });
        }

        if (isLoginPage) {
          setAuthenticated(true);
          return;
        }

        if (!session || error) {
          setAuthenticated(false);
          router.replace("/app/login");
          return;
        }

        setAuthenticated(true);
      } finally {
        setLoading(false);
      }
    };

    void checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (isLoginPage) {
          setAuthenticated(true);
          return;
        }
        setAuthenticated(false);
        router.replace("/app/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
        <p className="text-sm font-medium text-gray-500">Preparando a aventura...</p>
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
