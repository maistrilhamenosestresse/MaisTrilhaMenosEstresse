import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../auth";
import { colors } from "../../theme";
import { ClientScreen, EmptyState, LoadingState, formatCurrency } from "../ClientUi";
import type { ClientRoute, ProductRecord } from "../types";

export function ClientStoreScreen({ navigate }: { navigate: (route: ClientRoute) => void }) {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("active", true)
        .gt("stock", 0)
        .order("created_at", { ascending: false });
      setProducts((data || []) as ProductRecord[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase())),
    [products, search],
  );

  if (loading) return <LoadingState label="Abrindo a Loja Mais Trilha…" />;

  return (
    <ClientScreen>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}><Ionicons name="bag-handle" size={25} color={colors.orange} /></View>
        <View>
          <Text style={styles.eyebrow}>EQUIPAMENTOS</Text>
          <Text style={styles.title}>Loja Mais Trilha</Text>
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={19} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar equipamentos…"
          placeholderTextColor="#81909E"
          style={styles.searchInput}
        />
      </View>

      {filtered.length ? (
        <View style={styles.grid}>
          {filtered.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.product}
              onPress={() => navigate({ name: "product-checkout", product })}
            >
              <View style={styles.imageWrap}>
                {product.image ? (
                  <Image source={{ uri: product.image }} style={styles.image} />
                ) : <Ionicons name="cube-outline" size={38} color="#AAB7C2" />}
                <View style={styles.plus}><Ionicons name="add" size={20} color={colors.white} /></View>
              </View>
              <Text style={styles.category} numberOfLines={1}>{product.category}</Text>
              <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.price}>{formatCurrency(product.price)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : <EmptyState icon="cube-outline" title="Nenhum produto encontrado" text="Tente outra busca ou volte em breve." />}
    </ClientScreen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  titleIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.orange, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  title: { color: colors.navy950, fontSize: 26, fontWeight: "900", marginTop: 2 },
  search: { minHeight: 50, borderRadius: 16, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  product: { width: "48%", minHeight: 235, borderRadius: 23, backgroundColor: colors.white, padding: 12 },
  imageWrap: { height: 130, borderRadius: 18, backgroundColor: "#E8EDF1", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  plus: { position: "absolute", right: 8, bottom: 8, width: 32, height: 32, borderRadius: 13, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  category: { color: colors.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase", marginTop: 9 },
  name: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "900", marginTop: 3, minHeight: 32 },
  price: { color: colors.orange, fontSize: 14, fontWeight: "900", marginTop: 5 },
});
