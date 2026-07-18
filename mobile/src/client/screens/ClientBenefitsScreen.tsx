import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";
import { ClientHeader, ClientScreen } from "../ClientUi";

export function ClientBenefitsScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.page}>
      <ClientHeader title="Seus benefícios" subtitle="VANTAGENS" onBack={onBack} />
      <ClientScreen>
        <View style={styles.hero}>
          <Ionicons name="gift" size={38} color="#FFD4B8" />
          <Text style={styles.heroTitle}>Quanto mais você explora, mais vantagens conquista.</Text>
          <Text style={styles.heroText}>Compras iniciadas pelo aplicativo geram pontos depois que o pagamento é confirmado.</Text>
        </View>
        <Benefit icon="star" color="#A66C00" background="#FFF1BD" title="Pontos de aventura" text="Acumule 1 ponto por real efetivamente pago e use 100 pontos como R$ 1,00 em novas compras." />
        <Benefit icon="wallet" color="#187653" background="#DFF4EA" title="Saldo de benefícios" text="Use o saldo disponível no carrinho de trilhas e na loja. Você sempre escolhe se deseja utilizar." />
        <Benefit icon="ribbon" color="#315E96" background="#E3EDF8" title="Passaporte e níveis" text="Colecione trilhas concluídas, distância percorrida e selos de conquistas." />
        <Benefit icon="images" color="#9B4B18" background="#FFE7D6" title="Álbuns inteligentes" text="Acesse fotos públicas das trilhas compradas e encontre suas imagens com reconhecimento facial." />
        <Benefit icon="shield-checkmark" color="#315E96" background="#E3EDF8" title="Segurança conectada" text="Entre na operação do guia para compartilhar localização, pedir ajuda e receber suporte mesmo quando a internet oscilar." />
      </ClientScreen>
    </View>
  );
}

function Benefit({ icon, color, background, title, text }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: background }]}><Ionicons name={icon} size={24} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  hero: { borderRadius: 27, backgroundColor: colors.navy950, padding: 20 },
  heroTitle: { color: colors.white, fontSize: 20, lineHeight: 26, fontWeight: "900", marginTop: 12 },
  heroText: { color: "#B6C7D5", fontSize: 11, lineHeight: 17, marginTop: 7 },
  card: { borderRadius: 22, backgroundColor: colors.white, padding: 15, flexDirection: "row", gap: 12 },
  icon: { width: 49, height: 49, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  title: { color: colors.navy950, fontSize: 14, fontWeight: "900" },
  text: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
});
