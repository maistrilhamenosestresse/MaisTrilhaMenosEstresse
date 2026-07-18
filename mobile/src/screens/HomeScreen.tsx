import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { Session } from "@supabase/supabase-js";
import { createOperation, joinOperation, listOperations } from "../api";
import { appConfig } from "../config";
import { generateGroupKey, generateSigningIdentity } from "../crypto";
import { getDeviceId } from "../device";
import { createInviteCode, parseInviteCode } from "../invite";
import { setActiveOperation } from "../storage";
import { colors } from "../theme";
import type { ActiveOperation } from "../types";

export function HomeScreen({
  session,
  onActive,
  onLogout,
}: {
  session: Session;
  onActive: (operation: ActiveOperation) => void;
  onLogout: () => void;
}) {
  const [operations, setOperations] = useState<Record<string, any>[]>([]);
  const [agendas, setAgendas] = useState<Record<string, any>[]>([]);
  const [agendaId, setAgendaId] = useState("");
  const [invite, setInvite] = useState("");
  const [scanner, setScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isGuide = appConfig.variant === "guide";

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await listOperations(session);
      setOperations(result.operations || []);
      setAgendas(result.availableAgendas || []);
      if (!agendaId && result.availableAgendas?.[0]?.id) setAgendaId(result.availableAgendas[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao carregar operações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const create = async () => {
    if (!agendaId) return;
    setBusy(true);
    setError("");
    try {
      const deviceId = await getDeviceId();
      const identity = await generateSigningIdentity();
      const groupKey = generateGroupKey();
      const result = await createOperation(session, {
        agendaId,
        deviceId,
        signingPublicKey: identity.signingPublicKey,
        sessionKeyFingerprint: groupKey.slice(0, 16),
      });
      const active: ActiveOperation = {
        operation: result.operation,
        member: result.member,
        joinToken: result.joinToken,
        groupKey,
        deviceId,
        memberDirectory: { [result.member.id]: identity.signingPublicKey },
        ...identity,
      };
      await setActiveOperation(active);
      onActive(active);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  };

  const join = async (raw = invite) => {
    setBusy(true);
    setError("");
    try {
      const parsed = parseInviteCode(raw);
      const deviceId = await getDeviceId();
      const identity = await generateSigningIdentity();
      const result = await joinOperation(session, parsed.operationId, {
        joinToken: parsed.joinToken,
        deviceId,
        platform: Platform.OS,
        signingPublicKey: identity.signingPublicKey,
        role: isGuide ? "assistant_guide" : "participant",
      });
      const active: ActiveOperation = {
        operation: result.operation,
        member: result.member,
        mapPack: result.mapPack,
        pois: result.pois,
        trailRoute: result.trailRoute,
        groupKey: parsed.groupKey,
        deviceId,
        memberDirectory: result.memberDirectory || { [result.member.id]: identity.signingPublicKey },
        ...identity,
      };
      await setActiveOperation(active);
      setScanner(false);
      onActive(active);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Convite inválido.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <View>
          <Text style={styles.eyebrow}>{isGuide ? "OPERAÇÕES DE CAMPO" : "MINHA TRILHA"}</Text>
          <Text style={styles.title}>{isGuide ? "Central do guia" : "Entre no grupo"}</Text>
        </View>
        <TouchableOpacity onPress={onLogout}><Text style={styles.logout}>Sair</Text></TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          {isGuide ? "Crie a rede antes do encontro." : "O convite conecta você ao guia e ao grupo."}
        </Text>
        <Text style={styles.heroText}>
          Baixe o mapa e permita localização e aparelhos próximos ainda com internet.
        </Text>
      </View>

      {isGuide ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nova operação</Text>
          <Text style={styles.label}>Trilha agendada</Text>
          <View style={styles.agendaList}>
            {agendas.map((agenda) => (
              <TouchableOpacity
                key={agenda.id}
                onPress={() => setAgendaId(agenda.id)}
                style={[styles.agenda, agendaId === agenda.id && styles.agendaSelected]}
              >
                <Text style={styles.agendaTitle}>{agenda.title}</Text>
                <Text style={styles.agendaMeta}>{formatDate(agenda.date)} · {agenda.distance_km || "—"} km</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primary} onPress={create} disabled={busy || !agendaId}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Criar operação segura</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Convite da operação</Text>
          <Text style={styles.cardText}>Cole o código enviado pelo guia ou leia o QR Code.</Text>
          <TextInput
            value={invite}
            onChangeText={setInvite}
            autoCapitalize="none"
            multiline
            placeholder="MT1..."
            style={styles.inviteInput}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondary} onPress={() => setScanner(true)}>
              <Text style={styles.secondaryText}>Ler QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primarySmall} onPress={() => void join()} disabled={busy}>
              <Text style={styles.primaryText}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Operações vinculadas</Text>
        {loading ? <ActivityIndicator color={colors.orange} /> : operations.length ? operations.map((operation) => (
          <View key={operation.id} style={styles.operation}>
            <View style={[styles.operationDot, { backgroundColor: statusColor(operation.status) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.operationTitle}>{operation.name}</Text>
              <Text style={styles.operationMeta}>{statusLabel(operation.status)}</Text>
            </View>
          </View>
        )) : <Text style={styles.empty}>Nenhuma operação vinculada ainda.</Text>}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScannerModal
        visible={scanner}
        onClose={() => setScanner(false)}
        onRead={(code) => void join(code)}
      />
    </ScrollView>
  );
}

function ScannerModal({ visible, onClose, onRead }: { visible: boolean; onClose(): void; onRead(code: string): void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const canScan = useMemo(() => permission?.granted, [permission]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.scannerPage}>
        {canScan ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => onRead(data)}
          />
        ) : (
          <TouchableOpacity style={styles.primary} onPress={requestPermission}>
            <Text style={styles.primaryText}>Permitir câmera</Text>
          </TouchableOpacity>
        )}
        <View style={styles.scanFrame} pointerEvents="none" />
        <TouchableOpacity style={styles.closeScanner} onPress={onClose}>
          <Text style={styles.primaryText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export async function shareOperationInvite(active: ActiveOperation) {
  if (!active.joinToken) throw new Error("Gere um novo convite antes de compartilhar.");
  const code = createInviteCode({
    operationId: String(active.operation.id),
    joinToken: active.joinToken,
    groupKey: active.groupKey,
  });
  await Share.share({
    title: "Convite Mais Trilha",
    message: `Entre na operação ${active.operation.name} pelo app Mais Trilha:\n\n${code}`,
  });
  return code;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}
function statusLabel(status: string) {
  return ({ planned: "Planejada", check_in: "Check-in", active: "Em andamento", paused: "Pausada", completed: "Concluída", cancelled: "Cancelada" } as Record<string, string>)[status] || status;
}
function statusColor(status: string) {
  if (status === "active") return colors.success;
  if (status === "cancelled") return colors.danger;
  if (status === "completed") return colors.navy800;
  return colors.orange;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 28, paddingBottom: 60, gap: 16 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  title: { color: colors.navy950, fontSize: 30, fontWeight: "900", marginTop: 4 },
  logout: { color: colors.muted, fontWeight: "800" },
  hero: { backgroundColor: colors.navy950, borderRadius: 28, padding: 22 },
  heroTitle: { color: colors.white, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  heroText: { color: "#B7C9D7", marginTop: 10, lineHeight: 20 },
  card: { backgroundColor: colors.white, borderRadius: 26, padding: 18, gap: 12 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  cardText: { color: colors.muted, lineHeight: 20 },
  label: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  agendaList: { gap: 8, maxHeight: 260 },
  agenda: { borderWidth: 1, borderColor: "#DDE5EA", borderRadius: 17, padding: 13 },
  agendaSelected: { borderColor: colors.orange, backgroundColor: "#FFF7F1" },
  agendaTitle: { color: colors.text, fontWeight: "900" },
  agendaMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  inviteInput: { minHeight: 100, textAlignVertical: "top", borderRadius: 16, backgroundColor: colors.background, padding: 14, color: colors.text },
  primary: { minHeight: 54, borderRadius: 17, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primarySmall: { minHeight: 52, borderRadius: 17, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", flex: 1 },
  primaryText: { color: colors.white, fontWeight: "900" },
  secondary: { minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: colors.navy900, alignItems: "center", justifyContent: "center", flex: 1 },
  secondaryText: { color: colors.navy900, fontWeight: "900" },
  buttonRow: { flexDirection: "row", gap: 10 },
  operation: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDE5EA" },
  operationDot: { width: 10, height: 10, borderRadius: 5 },
  operationTitle: { color: colors.text, fontWeight: "900" },
  operationMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.muted },
  error: { color: colors.danger, textAlign: "center", fontWeight: "800" },
  scannerPage: { flex: 1, backgroundColor: colors.navy950, alignItems: "center", justifyContent: "center", padding: 30 },
  scanFrame: { width: 260, height: 260, borderWidth: 3, borderColor: colors.orange, borderRadius: 30 },
  closeScanner: { position: "absolute", bottom: 55, backgroundColor: colors.navy950, borderRadius: 18, paddingHorizontal: 28, paddingVertical: 15 },
});
