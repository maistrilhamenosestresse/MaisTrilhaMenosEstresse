import * as SecureStore from "expo-secure-store";
import { createClient, type Session } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { appConfig, assertMobileConfig } from "./config";

const storage = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      return Promise.resolve(typeof window !== "undefined" ? window.localStorage.getItem(key) : null);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

assertMobileConfig();

export const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function requestEmailCode(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (appConfig.variant === "participant") {
    const response = await fetch(`${appConfig.apiUrl}/api/auth/client-eligibility`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const eligibility = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(eligibility.error || "Não foi possível verificar seu acesso.");
    }
    if (!eligibility.registered) {
      throw new Error("Não encontramos uma compra vinculada a este e-mail.");
    }
    if (!eligibility.eligible) {
      throw new Error("A Área do Aventureiro ainda não está liberada para este cadastro.");
    }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string) {
  const normalizedEmail = normalizeEmail(email);
  const cleanToken = token.replace(/\D/g, "");
  const types = ["email", "magiclink", "signup"] as const;
  let lastError: Error | null = null;

  for (const type of types) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanToken,
      type,
    });
    if (!error && data.session) {
      if (appConfig.variant === "guide") {
        const response = await fetch(`${appConfig.apiUrl}/api/auth/admin-eligibility`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
        });
        if (!response.ok) {
          await supabase.auth.signOut();
          throw new Error("Este e-mail não possui acesso de guia ou administrador.");
        }
      }
      return data.session;
    }
    lastError = error;
  }

  throw lastError || new Error("Código inválido ou expirado.");
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}
