import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { requestEmailCode, verifyEmailCode } from "../auth";
import { appConfig } from "../config";
import { colors } from "../theme";

export function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const requestCode = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await requestEmailCode(email);
      setStep("code");
      setMessage("Código enviado. Confira também a caixa de spam.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao enviar o código.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const session = await verifyEmailCode(email, code);
      onLogin(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <View style={styles.mark}><Text style={styles.markText}>MT</Text></View>
        <Text style={styles.eyebrow}>
          {appConfig.variant === "guide" ? "CENTRAL DO GUIA" : "APP DO AVENTUREIRO"}
        </Text>
        <Text style={styles.title}>Segurança que acompanha cada passo.</Text>
        <Text style={styles.subtitle}>
          {appConfig.variant === "guide"
            ? "Monitore o grupo, receba alertas e coordene a trilha."
            : "Loja, trilhas, carteira, mapa e proteção do grupo em um só aplicativo."}
        </Text>
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
          editable={step === "email" && !loading}
        />

        {step === "code" ? (
          <>
            <Text style={styles.label}>Código de 8 dígitos</Text>
            <TextInput
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 8))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              style={[styles.input, styles.codeInput]}
              placeholder="00000000"
              maxLength={8}
            />
          </>
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (loading || !email.includes("@") || (step === "code" && code.length !== 8)) && styles.disabled]}
          onPress={step === "email" ? requestCode : verifyCode}
          disabled={loading || !email.includes("@") || (step === "code" && code.length !== 8)}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {step === "email" ? "Receber código por e-mail" : "Confirmar e entrar"}
            </Text>
          )}
        </TouchableOpacity>

        {step === "code" ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setStep("email");
              setCode("");
              setError("");
              setMessage("");
            }}
          >
            <Text style={styles.backText}>Alterar e-mail</Text>
          </TouchableOpacity>
        ) : null}
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
  codeInput: { textAlign: "center", fontSize: 24, fontWeight: "900", letterSpacing: 8 },
  button: { backgroundColor: colors.orange, borderRadius: 18, minHeight: 56, alignItems: "center", justifyContent: "center", marginTop: 8 },
  disabled: { opacity: 0.55 },
  buttonText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  error: { color: colors.danger, marginBottom: 8, fontWeight: "700" },
  message: { color: colors.success, marginBottom: 8, fontWeight: "700" },
  backButton: { alignItems: "center", paddingTop: 16, paddingBottom: 4 },
  backText: { color: colors.navy900, fontWeight: "800" },
});
