import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { getCurrentClient, rechargeWallet } from "../../api";
import { colors } from "../../theme";
import { ClientHeader, ClientScreen, ErrorBanner, PrimaryButton, formatCurrency } from "../ClientUi";

export function ClientRechargeScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getCurrentClient(session).then((result) => setClientId(String(result.client.id)));
  }, [session]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const value = Number(amount.replace(",", "."));
      const checkout = await rechargeWallet(session, { amount: value, clientId, method: "infinitepay" });
      if (!checkout.redirectUrl) throw new Error("O provedor não retornou o checkout.");
      await WebBrowser.openBrowserAsync(checkout.redirectUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: colors.orange,
      });
      onBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao iniciar recarga.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <ClientHeader title="Recarregar carteira" subtitle="SALDO" onBack={onBack} />
      <ClientScreen>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>VALOR DA RECARGA</Text>
          <Text style={styles.currency}>R$</Text>
          <TextInput
            value={amount}
            onChangeText={(value) => setAmount(value.replace(/[^\d,]/g, ""))}
            keyboardType="decimal-pad"
            style={styles.amount}
            placeholder="50,00"
            placeholderTextColor="#7890A4"
          />
          <Text style={styles.preview}>{formatCurrency(Number(amount.replace(",", ".")) || 0)}</Text>
        </View>
        <Text style={styles.info}>O pagamento será processado pela InfinitePay. O saldo entra somente após a confirmação oficial do pagamento.</Text>
        <ErrorBanner message={error} />
        <PrimaryButton
          label="Continuar para pagamento"
          icon="card"
          onPress={submit}
          loading={busy}
          disabled={!clientId || Number(amount.replace(",", ".")) < 5}
          tone="orange"
        />
      </ClientScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  hero: { borderRadius: 28, backgroundColor: colors.navy950, padding: 22, alignItems: "center" },
  heroLabel: { color: "#9CB6C8", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  currency: { color: "#BFD0DD", fontSize: 14, fontWeight: "900", marginTop: 15 },
  amount: { minWidth: 220, color: colors.white, fontSize: 46, fontWeight: "900", textAlign: "center", paddingVertical: 4 },
  preview: { color: "#F7B98E", fontSize: 12, fontWeight: "800" },
  info: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 10 },
});
