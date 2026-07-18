import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { currentSession, signOut } from "./src/auth";
import { getActiveOperation, pruneStorage } from "./src/storage";
import type { ActiveOperation } from "./src/types";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { OperationScreen } from "./src/screens/OperationScreen";
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
  }, []);

  if (!ready) return <View style={styles.loading} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={active ? "dark" : "light"} />
      <SafeAreaView style={[styles.safe, !session && styles.darkSafe]} edges={["top", "bottom"]}>
        {!session ? (
          <LoginScreen onLogin={setSession} />
        ) : active ? (
          <OperationScreen session={session} initial={active} onExit={() => setActive(null)} />
        ) : (
          <HomeScreen
            session={session}
            onActive={setActive}
            onLogout={() => void (async () => {
              await signOut();
              setSession(null);
            })()}
          />
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
