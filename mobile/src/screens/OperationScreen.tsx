import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Battery from "expo-battery";
import * as Crypto from "expo-crypto";
import type { Session } from "@supabase/supabase-js";
import QRCode from "react-native-qrcode-svg";
import { createTrailMessage, type MemberStatus, type TrailEventType } from "@maistrilha/trail-core";
import { getOperation, submitReport, updateOperation } from "../api";
import { signTrailMessage } from "../crypto";
import { currentPosition, startTrailLocation, stopTrailLocation } from "../location";
import { TrailMeshRuntime } from "../mesh";
import { downloadOfflineMap, routeBounds } from "../offlineMap";
import { requestTrailPermissions } from "../permissions";
import { saveMeshMessage, setActiveOperation } from "../storage";
import { colors } from "../theme";
import type { ActiveOperation, LatestLocation, OperationMember } from "../types";
import { TrailMap } from "../components/TrailMap";
import { StatusPill } from "../components/StatusPill";
import { createInviteCode } from "../invite";
import { shareOperationInvite } from "./HomeScreen";
import { demoModeMessage, isExpoGo } from "../runtimeCapabilities";
import { initializeSafetyNotifications, notifySafetyAlert } from "../notifications";

export function OperationScreen({
  session,
  initial,
  onExit,
}: {
  session: Session;
  initial: ActiveOperation;
  onExit: () => void;
}) {
  const [active, setActive] = useState(initial);
  const [details, setDetails] = useState<Record<string, any>>({
    operation: initial.operation,
    members: [initial.member],
    locations: [],
    reports: [],
    trailRoute: initial.trailRoute,
    mapPack: initial.mapPack,
    pois: initial.pois || [],
  });
  const [mesh, setMesh] = useState({ peers: 0, relayed: 0, status: "iniciando", online: true });
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState("");
  const [inviteVisible, setInviteVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [mapProgress, setMapProgress] = useState<number | null>(null);
  const runtimeRef = useRef<TrailMeshRuntime | null>(null);
  const notifiedUrgentRef = useRef(new Set<string>());
  const isGuide = ["guide", "assistant_guide", "sweeper"].includes(active.member.role);

  const refresh = async () => {
    try {
      const result = await getOperation(session, String(active.operation.id));
      setDetails(result);
      if (isGuide) {
        const urgentMembers = ((result.members || []) as OperationMember[])
          .filter((member) => ["sos", "help_requested", "rest_requested"].includes(member.last_status));
        const nextUrgentKeys = new Set<string>();
        for (const member of urgentMembers) {
          const key = `${member.id}:${member.last_status}`;
          nextUrgentKeys.add(key);
          if (!notifiedUrgentRef.current.has(key)) {
            void notifySafetyAlert({
              title: member.last_status === "sos" ? "SOS na trilha" : "Participante precisa de atenção",
              body: `${member.display_name}: ${memberStatusLabel(member.last_status)}`,
              operationId: String(active.operation.id),
              memberId: member.id,
            });
          }
        }
        notifiedUrgentRef.current = nextUrgentKeys;
      }
      if (result.currentMember) {
        const memberDirectory = Object.fromEntries(
          (result.members || [])
            .filter((member: OperationMember) => member.signing_public_key)
            .map((member: OperationMember) => [member.id, member.signing_public_key as string]),
        );
        const updated = {
          ...active,
          operation: result.operation,
          member: result.currentMember,
          memberDirectory,
          mapPack: result.mapPack,
          pois: result.pois,
          trailRoute: result.trailRoute,
        };
        setActive(updated);
        runtimeRef.current?.updateActive(updated);
        await setActiveOperation(updated);
      }
      setMesh((current) => ({ ...current, online: true }));
    } catch {
      setMesh((current) => ({ ...current, online: false }));
    }
  };

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        await initializeSafetyNotifications();
        await requestTrailPermissions();
        await startTrailLocation(Number(active.operation.settings?.location_interval_seconds || 15));
        const runtime = new TrailMeshRuntime(active, session);
        runtimeRef.current = runtime;
        runtime.subscribe((state) => mounted && setMesh({
          peers: state.peers,
          relayed: state.relayed,
          status: state.status,
          online: state.status !== "offline",
        }));
        await runtime.start();
        await refresh();
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : "Falha ao iniciar segurança.");
      } finally {
        if (mounted) setStarting(false);
      }
    };
    void start();
    const refreshTimer = setInterval(() => void refresh(), 10_000);
    return () => {
      mounted = false;
      clearInterval(refreshTimer);
      void runtimeRef.current?.stop();
    };
  }, []);

  const sendStatus = async (eventType: TrailEventType, status: MemberStatus, payload: Record<string, unknown> = {}) => {
    setError("");
    try {
      const [position, batteryLevel] = await Promise.all([currentPosition(), Battery.getBatteryLevelAsync()]);
      const unsigned = createTrailMessage({
        messageId: Crypto.randomUUID(),
        operationId: String(active.operation.id),
        senderMemberId: active.member.id,
        originDeviceId: active.deviceId,
        eventType,
        maxHops: Number(active.operation.settings?.max_hops || 8),
        position: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy || undefined,
        },
        batteryPercent: Math.round(batteryLevel * 100),
        status,
        payload,
      });
      const message = await signTrailMessage(unsigned, active.signingPrivateKey);
      await saveMeshMessage(message, "local");
      const updated = { ...active, member: { ...active.member, last_status: status } };
      setActive(updated);
      await setActiveOperation(updated);
      await runtimeRef.current?.pump();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao enviar estado.");
    }
  };

  const leave = () => {
    Alert.alert("Sair da operação?", "O monitoramento será encerrado neste aparelho.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => void (async () => {
          await runtimeRef.current?.stop();
          await stopTrailLocation();
          await setActiveOperation(null);
          onExit();
        })(),
      },
    ]);
  };

  const changeOperationStatus = async (status: string) => {
    try {
      const result = await updateOperation(session, String(active.operation.id), { status });
      const updated = { ...active, operation: result.operation };
      setActive(updated);
      setDetails((current) => ({ ...current, operation: result.operation }));
      await setActiveOperation(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao alterar operação.");
    }
  };

  const downloadMap = async () => {
    const bounds = routeBounds(details.trailRoute);
    if (!bounds) {
      setError("Cadastre o arquivo GPX desta trilha antes de baixar o mapa.");
      return;
    }
    setMapProgress(0);
    try {
      await downloadOfflineMap({
        operationId: String(active.operation.id),
        mapStyle: details.mapPack?.style_url || "https://demotiles.maplibre.org/style.json",
        bounds,
        minZoom: details.mapPack?.min_zoom || 10,
        maxZoom: details.mapPack?.max_zoom || 17,
        onProgress: setMapProgress,
      });
      setMapProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao baixar mapa.");
      setMapProgress(null);
    }
  };

  if (starting) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={styles.loadingTitle}>Ativando segurança offline…</Text>
        <Text style={styles.loadingText}>GPS, Bluetooth e mapa estão sendo preparados.</Text>
      </View>
    );
  }

  const members = (details.members || []) as OperationMember[];
  const locations = (details.locations || []) as LatestLocation[];
  const urgent = members.filter((member) => ["sos", "help_requested", "rest_requested"].includes(member.last_status));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{isGuide ? "CENTRAL DE CAMPO" : "TRILHA PROTEGIDA"}</Text>
          <Text style={styles.title}>{details.operation?.name || active.operation.name}</Text>
        </View>
        <TouchableOpacity onPress={leave}><Text style={styles.exit}>Sair</Text></TouchableOpacity>
      </View>

      <StatusPill peers={mesh.peers} online={mesh.online} relayed={mesh.relayed} />

      {isExpoGo ? (
        <View style={styles.demoNotice}>
          <Text style={styles.demoNoticeTitle}>Teste no iPhone</Text>
          <Text style={styles.demoNoticeText}>{demoModeMessage}</Text>
        </View>
      ) : null}

      {urgent.length ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Atenção necessária</Text>
          {urgent.map((member) => (
            <Text key={member.id} style={styles.alertText}>• {member.display_name}: {memberStatusLabel(member.last_status)}</Text>
          ))}
        </View>
      ) : null}

      <TrailMap
        route={details.trailRoute}
        members={members}
        locations={locations}
        mapStyle={details.mapPack?.style_url}
      />

      <View style={styles.mapActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={downloadMap}>
          <Text style={styles.secondaryText}>
            {mapProgress === null ? "Baixar mapa offline" : mapProgress >= 100 ? "Mapa baixado" : `Baixando ${Math.round(mapProgress)}%`}
          </Text>
        </TouchableOpacity>
        {isGuide && active.joinToken ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setInviteVisible(true)}>
            <Text style={styles.secondaryText}>Convidar grupo</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!isGuide ? (
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Como você está?</Text>
          <View style={styles.actionGrid}>
            <Action label="Estou bem" color={colors.success} onPress={() => void sendStatus("status", "ok")} />
            <Action label="Quero descansar" color="#C88719" onPress={() => void sendStatus("rest", "rest_requested")} />
            <Action label="Preciso de ajuda" color={colors.warning} onPress={() => void sendStatus("help", "help_requested")} />
            <Action
              label="SOS"
              color={colors.danger}
              onPress={() => Alert.alert("Enviar SOS?", "O alerta será repetido de celular em celular até chegar ao guia.", [
                { text: "Cancelar", style: "cancel" },
                { text: "ENVIAR SOS", style: "destructive", onPress: () => void sendStatus("sos", "sos", { requiresImmediateResponse: true }) },
              ])}
            />
          </View>
          <TouchableOpacity style={styles.reportButton} onPress={() => setReportVisible(true)}>
            <Text style={styles.reportButtonText}>Registrar ocorrência</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.guideCard}>
            <Text style={styles.sectionTitle}>Controle da operação</Text>
            <View style={styles.operationButtons}>
              <Action label="Check-in" color={colors.navy800} onPress={() => void changeOperationStatus("check_in")} />
              <Action label="Iniciar" color={colors.success} onPress={() => void changeOperationStatus("active")} />
              <Action label="Pausar" color="#C88719" onPress={() => void changeOperationStatus("paused")} />
              <Action label="Concluir" color={colors.orange} onPress={() => void changeOperationStatus("completed")} />
            </View>
          </View>
          <MemberList members={members} locations={locations} />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <InviteModal active={active} visible={inviteVisible} onClose={() => setInviteVisible(false)} />
      <ReportModal
        session={session}
        operationId={String(active.operation.id)}
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
      />
    </ScrollView>
  );
}

function Action({ label, color, onPress }: { label: string; color: string; onPress(): void }) {
  return (
    <TouchableOpacity style={[styles.action, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function MemberList({ members, locations }: { members: OperationMember[]; locations: LatestLocation[] }) {
  const latest = useMemo(() => new Map(locations.map((location) => [location.member_id, location])), [locations]);
  return (
    <View style={styles.guideCard}>
      <Text style={styles.sectionTitle}>Grupo · {members.length}</Text>
      {members.map((member) => {
        const location = latest.get(member.id);
        const age = location ? Math.round((Date.now() - Date.parse(location.client_created_at)) / 60_000) : null;
        return (
          <View key={member.id} style={styles.member}>
            <View style={[styles.memberDot, { backgroundColor: memberColor(member.last_status) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member.display_name}</Text>
              <Text style={styles.memberMeta}>{memberStatusLabel(member.last_status)} · {age === null ? "sem posição" : age < 1 ? "agora" : `${age} min`}</Text>
            </View>
            <Text style={styles.battery}>{member.battery_percent ?? "—"}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function InviteModal({ active, visible, onClose }: { active: ActiveOperation; visible: boolean; onClose(): void }) {
  const code = active.joinToken ? createInviteCode({
    operationId: String(active.operation.id),
    joinToken: active.joinToken,
    groupKey: active.groupKey,
  }) : "";
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.sectionTitle}>Convite do grupo</Text>
          <Text style={styles.modalText}>Cada participante lê este QR antes da saída.</Text>
          {code ? <QRCode value={code} size={240} backgroundColor={colors.white} color={colors.navy950} /> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={() => void shareOperationInvite(active)}>
            <Text style={styles.primaryText}>Compartilhar convite</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeText}>Fechar</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ReportModal({
  session,
  operationId,
  visible,
  onClose,
}: {
  session: Session;
  operationId: string;
  visible: boolean;
  onClose(): void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const position = await currentPosition();
      await submitReport(session, operationId, {
        reportType: "incident",
        severity: "attention",
        title,
        description,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        clientCreatedAt: new Date().toISOString(),
      });
      setTitle("");
      setDescription("");
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.sectionTitle}>Registrar ocorrência</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Título" style={styles.input} />
          <TextInput value={description} onChangeText={setDescription} placeholder="O que aconteceu?" style={[styles.input, { minHeight: 110 }]} multiline />
          <TouchableOpacity style={styles.primaryButton} onPress={send} disabled={!title.trim() || busy}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Salvar relatório</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeText}>Cancelar</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function memberStatusLabel(status: string) {
  return ({
    ok: "Tudo bem",
    rest_requested: "Quer descansar",
    help_requested: "Pediu ajuda",
    sos: "SOS",
    off_route: "Fora da rota",
    disconnected: "Sem contato",
    finished: "Concluiu",
  } as Record<string, string>)[status] || status;
}
function memberColor(status: string) {
  if (status === "sos") return colors.danger;
  if (status === "help_requested") return colors.warning;
  if (status === "rest_requested") return "#C88719";
  return colors.success;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 24, paddingBottom: 60, gap: 14 },
  loadingPage: { flex: 1, backgroundColor: colors.navy950, alignItems: "center", justifyContent: "center", padding: 30 },
  loadingTitle: { color: colors.white, fontSize: 20, fontWeight: "900", marginTop: 20 },
  loadingText: { color: "#B7C9D7", marginTop: 8, textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  title: { color: colors.navy950, fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 3 },
  exit: { color: colors.danger, fontWeight: "900" },
  alertCard: { backgroundColor: "#FFF0F0", borderWidth: 1, borderColor: "#F4B8B8", borderRadius: 22, padding: 16 },
  alertTitle: { color: colors.danger, fontSize: 16, fontWeight: "900" },
  alertText: { color: "#752323", marginTop: 6, fontWeight: "700" },
  demoNotice: { backgroundColor: "#EAF3FB", borderWidth: 1, borderColor: "#B8D5EC", borderRadius: 20, padding: 15 },
  demoNoticeTitle: { color: colors.navy950, fontSize: 15, fontWeight: "900" },
  demoNoticeText: { color: colors.navy800, fontSize: 12, lineHeight: 18, marginTop: 4 },
  mapActions: { flexDirection: "row", gap: 8 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.navy900, borderRadius: 16, padding: 13, alignItems: "center" },
  secondaryText: { color: colors.navy900, fontWeight: "900", textAlign: "center", fontSize: 12 },
  actionCard: { backgroundColor: colors.white, borderRadius: 26, padding: 17, gap: 13 },
  guideCard: { backgroundColor: colors.white, borderRadius: 26, padding: 17, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  operationButtons: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  action: { width: "48%", minHeight: 62, borderRadius: 18, alignItems: "center", justifyContent: "center", padding: 8 },
  actionText: { color: colors.white, fontWeight: "900", textAlign: "center" },
  reportButton: { backgroundColor: colors.background, borderRadius: 16, padding: 15, alignItems: "center" },
  reportButtonText: { color: colors.navy900, fontWeight: "900" },
  member: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDE5EA" },
  memberDot: { width: 11, height: 11, borderRadius: 6 },
  memberName: { color: colors.text, fontWeight: "900" },
  memberMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  battery: { color: colors.muted, fontWeight: "800" },
  error: { color: colors.danger, fontWeight: "800", textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(7,24,41,0.82)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, alignItems: "center", gap: 16 },
  modalText: { color: colors.muted, textAlign: "center" },
  primaryButton: { width: "100%", minHeight: 54, borderRadius: 17, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.white, fontWeight: "900" },
  closeText: { color: colors.muted, fontWeight: "800", padding: 8 },
  input: { width: "100%", backgroundColor: colors.background, borderRadius: 16, padding: 14, color: colors.text, textAlignVertical: "top" },
});
