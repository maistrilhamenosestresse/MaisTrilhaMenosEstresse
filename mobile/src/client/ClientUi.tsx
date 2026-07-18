import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

export function ClientScreen({
  children,
  contentContainerStyle,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function ClientHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={colors.navy950} />
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={styles.eyebrow}>{subtitle}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  tone = "orange",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: "orange" | "navy" | "danger" | "success";
}) {
  const background = tone === "navy"
    ? colors.navy900
    : tone === "danger"
      ? colors.danger
      : tone === "success"
        ? colors.success
        : colors.orange;
  return (
    <TouchableOpacity
      style={[styles.primary, { backgroundColor: background }, (loading || disabled) && styles.disabled]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={colors.white} /> : null}
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity style={styles.secondary} onPress={onPress}>
      {icon ? <Ionicons name={icon} size={18} color={colors.navy900} /> : null}
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator size="large" color={colors.orange} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = "leaf-outline",
  title,
  text,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function formatCurrency(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Data a confirmar";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: 16, paddingBottom: 116, gap: 15 },
  header: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDE5EA" },
  backButton: { width: 40, height: 40, borderRadius: 15, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.orange, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
  headerTitle: { color: colors.navy950, fontSize: 19, fontWeight: "900", marginTop: 2 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 17, shadowColor: colors.navy950, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  primary: { minHeight: 54, borderRadius: 17, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "900", textAlign: "center" },
  disabled: { opacity: 0.5 },
  secondary: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: "#C7D2DD", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { color: colors.navy900, fontSize: 14, fontWeight: "900" },
  state: { minHeight: 260, alignItems: "center", justifyContent: "center", padding: 28 },
  stateText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 9 },
  emptyIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: "#E8EDF1", alignItems: "center", justifyContent: "center", marginBottom: 13 },
  emptyTitle: { color: colors.navy950, fontSize: 18, fontWeight: "900", textAlign: "center" },
  errorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 16, borderWidth: 1, borderColor: "#F3B7B7", backgroundColor: "#FFF0F0", padding: 13 },
  errorText: { flex: 1, color: "#812D2D", fontSize: 12, lineHeight: 18, fontWeight: "700" },
});
