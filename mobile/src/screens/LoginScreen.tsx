import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { signIn } from "../auth";
import { appConfig } from "../config";
import { colors } from "../theme";

export function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const session = await signIn(email, password);
      if (!session) throw new Error("Não foi possível iniciar a sessão.");
      onLogin(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <View style={styles.mark}><Text style={styles.markText}>MT</Text></View>
        <Text style={styles.eyebrow}>{appConfig.variant === "guide" ? "CENTRAL DO GUIA" : "APP DO PARTICIPANTE"}</Text>
        <Text style={styles.title}>Segurança que acompanha cada passo.</Text>
        <Text style={styles.subtitle}>Mapa, grupo e pedidos de ajuda continuam ativos mesmo sem internet.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>E-mail</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={styles.input}
          placeholder="voce@email.com"
        />
        <Text style={styles.label}>Senha</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          style={styles.input}
          placeholder="Sua senha"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Entrar com segurança</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy950, justifyContent: "center", padding: 22 },
  hero: { marginBottom: 28 },
  mark: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  markText: { color: colors.white, fontSize: 22, fontWeight: "900" },
  eyebrow: { color: "#92B9D1", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  title: { color: colors.white, fontSize: 34, lineHeight: 39, fontWeight: "900", marginTop: 10 },
  subtitle: { color: "#B6C7D5", fontSize: 15, lineHeight: 22, marginTop: 12 },
  card: { backgroundColor: colors.white, borderRadius: 30, padding: 22 },
  label: { color: colors.text, fontWeight: "800", fontSize: 12, marginBottom: 7, marginTop: 4 },
  input: { backgroundColor: colors.background, borderRadius: 16, padding: 15, marginBottom: 14, color: colors.text, fontSize: 16 },
  button: { backgroundColor: colors.orange, borderRadius: 18, minHeight: 56, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  error: { color: colors.danger, marginBottom: 8, fontWeight: "700" },
});
