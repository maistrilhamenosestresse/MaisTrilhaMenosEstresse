import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import Svg, { Polyline } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { authenticatedFileUrl, getContracts, signContract, uploadImage } from "../../api";
import { colors } from "../../theme";
import {
  ClientHeader,
  ClientScreen,
  ErrorBanner,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
} from "../ClientUi";

type ContractType = "responsibility" | "insurance";
type Definition = {
  type: ContractType;
  version: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
  acceptance: string;
};

export function ClientContractsScreen({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [expanded, setExpanded] = useState<ContractType | null>("responsibility");
  const [signing, setSigning] = useState<ContractType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      setData(await getContracts(session));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os contratos.");
    }
  };

  useEffect(() => { void refresh(); }, [session]);

  const download = async (type: ContractType) => {
    setBusy(true);
    setError("");
    try {
      const target = `${FileSystem.cacheDirectory}contrato-${type}-${Date.now()}.pdf`;
      const result = await FileSystem.downloadAsync(
        authenticatedFileUrl(`/api/contracts/${type}/pdf`),
        target,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (result.status !== 200) throw new Error("O contrato não pôde ser baixado.");
      if (!(await Sharing.isAvailableAsync())) throw new Error("Compartilhamento indisponível neste aparelho.");
      await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: "Salvar contrato assinado" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao baixar contrato.");
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return <LoadingState label="Carregando termos e contratos…" />;

  return (
    <View style={styles.page}>
      <ClientHeader title="Termos e contratos" subtitle="DOCUMENTOS" onBack={onBack} />
      <ClientScreen>
        <View style={styles.update}>
          <Ionicons name="document-text" size={28} color="#7A5200" />
          <View style={{ flex: 1 }}>
            <Text style={styles.updateTitle}>Mantenha seus documentos atualizados</Text>
            <Text style={styles.updateText}>Leia os termos atuais e assine diretamente na tela. Depois, salve uma cópia em PDF.</Text>
          </View>
        </View>
        <ErrorBanner message={error} />
        {(data?.definitions || []).map((definition: Definition) => {
          const signed = (data?.contracts || []).find(
            (contract: any) =>
              contract.contract_type === definition.type &&
              contract.version === definition.version,
          );
          return (
            <View key={definition.type} style={styles.contract}>
              <TouchableOpacity
                style={styles.contractHeader}
                onPress={() => setExpanded((current) => current === definition.type ? null : definition.type)}
              >
                <View style={[styles.statusIcon, signed && styles.statusSigned]}>
                  <Ionicons name={signed ? "checkmark" : "pencil"} size={21} color={signed ? colors.white : colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contractTitle}>{definition.title}</Text>
                  <Text style={[styles.contractStatus, signed && styles.signedText]}>
                    {signed ? `Assinado em ${new Date(signed.signed_at).toLocaleDateString("pt-BR")}` : "Assinatura necessária"}
                  </Text>
                </View>
                <Ionicons name={expanded === definition.type ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
              </TouchableOpacity>
              {expanded === definition.type ? (
                <View style={styles.body}>
                  <Text style={styles.intro}>{definition.intro}</Text>
                  {definition.sections.map((section) => (
                    <View key={section.title} style={styles.section}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      {section.paragraphs.map((paragraph, index) => (
                        <Text key={index} style={styles.paragraph}>{paragraph}</Text>
                      ))}
                    </View>
                  ))}
                  <Text style={styles.acceptance}>{definition.acceptance}</Text>
                  {signed ? (
                    <SecondaryButton
                      label="Baixar contrato assinado"
                      icon="download"
                      onPress={() => void download(definition.type)}
                    />
                  ) : (
                    <PrimaryButton
                      label="Li e quero assinar"
                      icon="pencil"
                      onPress={() => setSigning(definition.type)}
                      tone="navy"
                    />
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
        {signing ? (
          <SignatureCard
            type={signing}
            session={session}
            busy={busy}
            onCancel={() => setSigning(null)}
            onBusy={setBusy}
            onError={setError}
            onSigned={async () => {
              setSigning(null);
              await refresh();
            }}
          />
        ) : null}
      </ClientScreen>
    </View>
  );
}

function SignatureCard({
  type,
  session,
  busy,
  onCancel,
  onBusy,
  onError,
  onSigned,
}: {
  type: ContractType;
  session: Session;
  busy: boolean;
  onCancel: () => void;
  onBusy: (value: boolean) => void;
  onError: (value: string) => void;
  onSigned: () => Promise<void>;
}) {
  const [strokes, setStrokes] = useState<string[][]>([]);
  const padRef = useRef<View>(null);
  const currentStroke = useRef<string[]>([]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      currentStroke.current = [`${locationX},${locationY}`];
      setStrokes((current) => [...current, currentStroke.current]);
    },
    onPanResponderMove: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      currentStroke.current.push(`${locationX},${locationY}`);
      setStrokes((current) => [...current.slice(0, -1), [...currentStroke.current]]);
    },
    onPanResponderRelease: () => { currentStroke.current = []; },
  }), []);

  const submit = async () => {
    if (!padRef.current || strokes.flat().length < 8) {
      onError("Faça sua assinatura no quadro antes de continuar.");
      return;
    }
    onBusy(true);
    onError("");
    try {
      const uri = await captureRef(padRef, { format: "png", quality: 1, result: "tmpfile" });
      const form = new FormData();
      form.append("file", { uri, name: `assinatura-${type}.png`, type: "image/png" } as unknown as Blob);
      form.append("folder", "signatures");
      const uploaded = await uploadImage(session, form);
      await signContract(session, type, uploaded.publicUrl);
      await onSigned();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Não foi possível registrar a assinatura.");
    } finally {
      onBusy(false);
    }
  };

  return (
    <View style={styles.signatureCard}>
      <Text style={styles.signatureTitle}>Assine no quadro abaixo</Text>
      <Text style={styles.signatureHelp}>Use o dedo. A linha acompanha exatamente o ponto tocado.</Text>
      <View ref={padRef} collapsable={false} style={styles.pad} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%">
          {strokes.map((points, index) => (
            <Polyline key={index} points={points.join(" ")} fill="none" stroke={colors.navy950} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
        <View pointerEvents="none" style={styles.signatureLine} />
      </View>
      <TouchableOpacity onPress={() => setStrokes([])}><Text style={styles.clear}>Limpar assinatura</Text></TouchableOpacity>
      <PrimaryButton label="Confirmar e assinar" icon="checkmark-circle" onPress={() => void submit()} loading={busy} tone="success" />
      <SecondaryButton label="Cancelar" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  update: { borderRadius: 23, backgroundColor: "#FFF2C9", padding: 16, flexDirection: "row", gap: 12 },
  updateTitle: { color: "#694700", fontSize: 14, fontWeight: "900" },
  updateText: { color: "#89640D", fontSize: 11, lineHeight: 17, marginTop: 4 },
  contract: { borderRadius: 23, backgroundColor: colors.white, overflow: "hidden" },
  contractHeader: { minHeight: 86, padding: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  statusIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center" },
  statusSigned: { backgroundColor: colors.success },
  contractTitle: { color: colors.navy950, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  contractStatus: { color: colors.orange, fontSize: 9, fontWeight: "800", marginTop: 4 },
  signedText: { color: colors.success },
  body: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DDE5EA", padding: 16, gap: 14 },
  intro: { color: colors.text, fontSize: 12, lineHeight: 19, fontWeight: "700" },
  section: { gap: 7 },
  sectionTitle: { color: colors.navy950, fontSize: 13, fontWeight: "900" },
  paragraph: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  acceptance: { color: colors.text, fontSize: 11, lineHeight: 18, fontWeight: "800", borderRadius: 16, backgroundColor: "#EAF0F5", padding: 12 },
  signatureCard: { borderRadius: 25, backgroundColor: colors.white, padding: 16, gap: 12 },
  signatureTitle: { color: colors.navy950, fontSize: 18, fontWeight: "900" },
  signatureHelp: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  pad: { height: 190, borderRadius: 18, backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: "#BCC8D2", overflow: "hidden" },
  signatureLine: { position: "absolute", left: 26, right: 26, bottom: 39, height: 1, backgroundColor: "#B7C3CC" },
  clear: { color: colors.orange, textAlign: "right", fontSize: 11, fontWeight: "900" },
});
