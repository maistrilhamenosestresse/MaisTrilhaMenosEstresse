import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { getCurrentClient, updateCurrentClient, uploadImage } from "../../api";
import { colors } from "../../theme";
import { ClientHeader, ClientScreen, ErrorBanner, LoadingState, PrimaryButton } from "../ClientUi";
import type { ClientRecord } from "../types";

export function ClientProfileEditScreen({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const [form, setForm] = useState<ClientRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getCurrentClient(session).then((result) => setForm(result.client as ClientRecord));
  }, [session]);

  if (!form) return <LoadingState label="Carregando seus dados…" />;

  const setField = (field: keyof ClientRecord, value: string) => {
    setForm((current) => current ? { ...current, [field]: value } : current);
  };

  const choosePhoto = async () => {
    setPhotoBusy(true);
    setError("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Permita o acesso às fotos para escolher sua imagem.");
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const edited = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: 1024, height: 1024 } }],
        { compress: 0.86, format: ImageManipulator.SaveFormat.JPEG },
      );
      const data = new FormData();
      data.append("folder", "app-profiles");
      data.append("file", {
        uri: edited.uri,
        name: "perfil.jpg",
        type: "image/jpeg",
      } as any);
      const uploaded = await uploadImage(session, data);
      const updated = await updateCurrentClient(session, { photo_url: uploaded.publicUrl });
      setForm(updated.client as ClientRecord);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao atualizar a foto.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await updateCurrentClient(session, {
        full_name: form.full_name,
        rg: form.rg || "",
        birth_date: form.birth_date || "",
        phone: form.phone || "",
        emergency_contact_name: form.emergency_contact_name || "",
        emergency_contact_phone: form.emergency_contact_phone || "",
        health_notes: form.health_notes || "",
        image_authorization: form.image_authorization === true,
      });
      setForm(result.client as ClientRecord);
      onBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar os dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.page}>
      <ClientHeader title="Dados pessoais" subtitle="PERFIL" onBack={onBack} />
      <ClientScreen>
        <View style={styles.photoArea}>
          <View style={styles.photo}>
            {form.photo_url ? (
              <Image source={{ uri: form.photo_url }} style={styles.photoImage} />
            ) : <Ionicons name="person" size={44} color={colors.white} />}
          </View>
          <TouchableOpacity style={styles.photoButton} onPress={choosePhoto} disabled={photoBusy}>
            <Ionicons name="camera" size={18} color={colors.white} />
            <Text style={styles.photoButtonText}>{photoBusy ? "Preparando…" : "Editar e recortar foto"}</Text>
          </TouchableOpacity>
        </View>

        <ErrorBanner message={error} />
        <Field label="Nome completo" value={form.full_name || ""} onChangeText={(value) => setField("full_name", value)} />
        <Field label="E-mail" value={form.email || ""} editable={false} />
        <Field label="Telefone" value={form.phone || ""} onChangeText={(value) => setField("phone", value)} keyboardType="phone-pad" />
        <Field label="RG" value={form.rg || ""} onChangeText={(value) => setField("rg", value)} />
        <Field label="Nascimento (AAAA-MM-DD)" value={form.birth_date || ""} onChangeText={(value) => setField("birth_date", value)} />
        <Field label="Contato de emergência" value={form.emergency_contact_name || ""} onChangeText={(value) => setField("emergency_contact_name", value)} />
        <Field label="Telefone de emergência" value={form.emergency_contact_phone || ""} onChangeText={(value) => setField("emergency_contact_phone", value)} keyboardType="phone-pad" />
        <Field label="Saúde, alergias e observações" value={form.health_notes || ""} onChangeText={(value) => setField("health_notes", value)} multiline />
        <PrimaryButton label="Salvar alterações" icon="checkmark" onPress={save} loading={saving} tone="navy" />
      </ClientScreen>
    </View>
  );
}

function Field({
  label,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; multiline?: boolean }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#8997A3"
        style={[styles.input, multiline && styles.multiline, props.editable === false && styles.readonly]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  photoArea: { alignItems: "center", gap: 12 },
  photo: { width: 108, height: 108, borderRadius: 38, backgroundColor: colors.navy900, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoImage: { width: "100%", height: "100%" },
  photoButton: { borderRadius: 16, backgroundColor: colors.orange, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 15, paddingVertical: 11 },
  photoButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  label: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginLeft: 3 },
  input: { minHeight: 52, borderRadius: 16, backgroundColor: colors.white, color: colors.text, fontSize: 14, paddingHorizontal: 14 },
  multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: "top" },
  readonly: { backgroundColor: "#E8EDF1", color: colors.muted },
});
