import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { authenticatedFileUrl, findAlbumFaces, getAlbum } from "../../api";
import { colors } from "../../theme";
import {
  ClientHeader,
  ClientScreen,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PrimaryButton,
} from "../ClientUi";

export function ClientAlbumScreen({
  session,
  agendaId,
  title,
  onBack,
}: {
  session: Session;
  agendaId: string;
  title: string;
  onBack: () => void;
}) {
  const [photos, setPhotos] = useState<Array<{ aws_url: string }>>([]);
  const [matches, setMatches] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getAlbum(session, agendaId)
      .then((result) => setPhotos(result.photos || []))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Não foi possível carregar o álbum."))
      .finally(() => setLoading(false));
  }, [agendaId, session]);

  const sharePhoto = async (url: string, index: number) => {
    setBusy(true);
    setError("");
    try {
      const target = `${FileSystem.cacheDirectory}mais-trilha-foto-${index + 1}-${Date.now()}.jpg`;
      const result = await FileSystem.downloadAsync(url, target);
      if (result.status !== 200) throw new Error("Falha ao baixar a foto.");
      await Sharing.shareAsync(result.uri, { mimeType: "image/jpeg", dialogTitle: "Salvar ou compartilhar foto" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar a foto.");
    } finally {
      setBusy(false);
    }
  };

  const shareAlbum = async () => {
    setBusy(true);
    setError("");
    try {
      const target = `${FileSystem.cacheDirectory}album-mais-trilha-${agendaId}.zip`;
      const result = await FileSystem.downloadAsync(
        authenticatedFileUrl(`/api/album/${agendaId}/download`),
        target,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (result.status !== 200) throw new Error("O álbum completo não pôde ser baixado.");
      await Sharing.shareAsync(result.uri, { mimeType: "application/zip", dialogTitle: "Salvar álbum completo" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao baixar o álbum.");
    } finally {
      setBusy(false);
    }
  };

  const findMyPhotos = async () => {
    setBusy(true);
    setError("");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error("Permita a câmera para usar a busca facial.");
      const capture = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        cameraType: ImagePicker.CameraType.front,
        quality: 0.7,
      });
      if (capture.canceled || !capture.assets[0]?.uri) return;
      const resized = await ImageManipulator.manipulateAsync(
        capture.assets[0].uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!resized.base64) throw new Error("Não foi possível preparar a selfie.");
      const result = await findAlbumFaces(session, agendaId, `data:image/jpeg;base64,${resized.base64}`);
      setMatches(result.matches || []);
      if (!result.matches?.length) setError("Nenhuma foto sua foi encontrada neste álbum.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao procurar suas fotos.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Revelando as fotos da trilha…" />;

  return (
    <View style={styles.page}>
      <ClientHeader title="Álbum da trilha" subtitle={title} onBack={onBack} />
      <ClientScreen>
        <View style={styles.hero}>
          <Ionicons name="images" size={33} color="#FFD4B8" />
          <Text style={styles.heroTitle}>{matches !== null ? `${matches.length} fotos encontradas` : `${photos.length} fotos disponíveis`}</Text>
          <Text style={styles.heroText}>Encontre suas fotos com uma selfie, baixe uma imagem ou salve o álbum completo.</Text>
        </View>
        <ErrorBanner message={error} />
        {photos.length ? (
          <>
            <PrimaryButton label="Baixar álbum completo" icon="download" onPress={() => void shareAlbum()} loading={busy} tone="navy" />
            <PrimaryButton label="Achar minhas fotos com IA" icon="sparkles" onPress={() => void findMyPhotos()} loading={busy} />
            {matches !== null ? (
              <TouchableOpacity style={styles.showAll} onPress={() => setMatches(null)}>
                <Text style={styles.showAllText}>Mostrar todas as fotos</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.grid}>
              {(matches !== null ? matches.map((aws_url) => ({ aws_url })) : photos).map((photo, index) => (
                <TouchableOpacity key={`${photo.aws_url}:${index}`} style={styles.photo} onPress={() => void sharePhoto(photo.aws_url, index)} disabled={busy}>
                  <Image source={{ uri: photo.aws_url }} style={styles.image} />
                  <View style={styles.download}><Ionicons name="download" size={17} color={colors.white} /></View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : <EmptyState icon="images-outline" title="Álbum ainda vazio" text="As fotos públicas aparecerão aqui quando forem enviadas pela equipe." />}
      </ClientScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  hero: { borderRadius: 25, backgroundColor: colors.navy950, padding: 19, alignItems: "center" },
  heroTitle: { color: colors.white, fontSize: 18, fontWeight: "900", marginTop: 8 },
  heroText: { color: "#B6C7D5", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: "48.7%", aspectRatio: 1, borderRadius: 20, backgroundColor: "#DDE5EA", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  download: { position: "absolute", right: 8, bottom: 8, width: 34, height: 34, borderRadius: 13, backgroundColor: "rgba(4,25,44,0.82)", alignItems: "center", justifyContent: "center" },
  showAll: { alignItems: "center", paddingVertical: 4 },
  showAllText: { color: colors.orange, fontSize: 11, fontWeight: "900" },
});
