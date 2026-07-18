import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { currentSession, signOut, supabase } from "./src/auth";
import { appConfig } from "./src/config";
import { getActiveOperation, pruneStorage } from "./src/storage";
import type { ActiveOperation } from "./src/types";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { OperationScreen } from "./src/screens/OperationScreen";
import { ClientApp } from "./src/client/ClientApp";
import { colors } from "./src/theme";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<ActiveOperation | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const [storedSession, storedOperation] = await Promise.all([
        currentSession(),
        getActiveOperation(),
        pruneStorage(),
      ]);
      setSession(storedSession);
      setActive(storedOperation);
      setReady(true);
    })();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await signOut();
    setSession(null);
  };

  if (!ready) return <View style={styles.loading} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={session ? "dark" : "light"} />
      <SafeAreaView style={[styles.safe, !session && styles.darkSafe]} edges={["top", "bottom"]}>
        {!session ? (
          <LoginScreen onLogin={setSession} />
        ) : appConfig.variant === "participant" ? (
          <ClientApp session={session} active={active} onActive={setActive} onLogout={() => void logout()} />
        ) : active ? (
          <OperationScreen session={session} initial={active} onExit={() => setActive(null)} />
        ) : (
          <HomeScreen session={session} onActive={setActive} onLogout={() => void logout()} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  darkSafe: { backgroundColor: colors.navy950 },
  loading: { flex: 1, backgroundColor: colors.navy950 },
});
