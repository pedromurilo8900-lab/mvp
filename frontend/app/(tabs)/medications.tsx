import { useFocusEffect, useRouter } from "expo-router";
import { Check, Pill, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { api } from "@/src/api";
import { fmtRelative } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton, SectionHeader, StatusBadge } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 4, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  segActive: { backgroundColor: c.surfaceSecondary },
  segText: { fontSize: font.base, fontWeight: "600", color: c.muted },
  segTextActive: { color: c.onSurface },
  doseCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  doseRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  doseTime: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, minWidth: 68 },
  doseInfo: { flex: 1 },
  doseName: { fontSize: font.lg, fontWeight: "700", color: c.onSurface },
  doseMeta: { fontSize: font.sm, color: c.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
}));

const FILTERS = [
  { key: "today", label: "Hoje" },
  { key: "all", label: "Todos" },
  { key: "adherence", label: "Adesão" },
] as const;

export default function MedicationsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<"today" | "all" | "adherence">("today");
  const [doses, setDoses] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false); setLoading(true);
      const [d, m, a] = await Promise.all([
        api("/medications/doses/today"),
        api("/medications"),
        api("/medications/adherence?days=30"),
      ]);
      setDoses(d as any[]); setMeds(m as any[]); setAdherence(a);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mark = async (dose: any, status: "taken" | "not_taken") => {
    try {
      await api("/medications/doses/mark", {
        method: "POST",
        body: JSON.stringify({ medication_id: dose.source_id, scheduled_at: dose.scheduled_at, status }),
      });
      Toast.show({ type: "success", text1: status === "taken" ? "Dose registrada como tomada" : "Marcada como não tomada" });
      load();
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Erro ao registrar", text2: e?.message });
    }
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={s.title}>Medicamentos</Text>
      </View>

      <View style={s.segment}>
        {FILTERS.map(f => (
          <Pressable key={f.key} testID={`med-filter-${f.key}`} onPress={() => setFilter(f.key)} style={[s.segItem, filter === f.key && s.segActive]}>
            <Text style={[s.segText, filter === f.key && s.segTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {loading ? <LoadingSkeleton /> : error ? <ErrorState onRetry={load} /> : (
          <>
            {filter === "today" && (
              doses.length === 0 ? (
                <EmptyState icon={Pill} title="Nenhuma dose para hoje" hint="Seus medicamentos aparecerão aqui." />
              ) : doses.map((d) => (
                <Card key={d.id} testID={`dose-${d.source_id}-${d.time}`} style={s.doseCard}>
                  <View style={s.doseRow}>
                    <Text style={s.doseTime}>{d.time}</Text>
                    <View style={s.doseInfo}>
                      <Text style={s.doseName}>{d.title}</Text>
                      <Text style={s.doseMeta}>{d.metadata.dosage} {d.metadata.unit} · {d.metadata.route}</Text>
                    </View>
                    <StatusBadge
                      label={d.status === "taken" ? "Tomado" : d.status === "not_taken" ? "Não tomado" : "Pendente"}
                      color={d.status === "taken" ? colors.success : d.status === "not_taken" ? colors.error : colors.warning}
                    />
                  </View>
                  {d.status === "pending" ? (
                    <View style={s.actions}>
                      <PrimaryButton testID={`dose-taken-${d.source_id}-${d.time}`} title="Tomei" onPress={() => mark(d, "taken")} icon={Check} variant="success" />
                      <PrimaryButton title="Não tomei" onPress={() => mark(d, "not_taken")} icon={X} variant="secondary" />
                    </View>
                  ) : (
                    <Text style={{ marginTop: spacing.sm, color: colors.muted, fontSize: font.sm }}>
                      {d.status === "taken" ? `Tomado às ${d.recorded_at?.slice(11, 16) || d.time}` : "Registrado como não tomado"}
                    </Text>
                  )}
                </Card>
              ))
            )}

            {filter === "all" && (
              meds.length === 0 ? (
                <EmptyState icon={Pill} title="Nenhum medicamento ativo" hint="Quando um medicamento for adicionado ao seu tratamento, ele aparecerá aqui." />
              ) : meds.map(m => (
                <Card key={m.id} testID={`med-card-${m.id}`} style={s.doseCard} onPress={() => router.push({ pathname: "/medication/[id]", params: { id: m.id } } as any)}>
                  <Text style={s.doseName}>{m.name} {m.dosage} {m.unit}</Text>
                  <Text style={s.doseMeta}>{m.route} · {m.times.join(", ")}</Text>
                  <Text style={s.doseMeta}>{m.continuous_use ? "Uso contínuo" : `Até ${m.end_date}`}</Text>
                </Card>
              ))
            )}

            {filter === "adherence" && adherence && (
              <View style={{ paddingHorizontal: spacing.lg }}>
                <SectionHeader title={`Adesão nos últimos ${adherence.days} dias`} />
                <Card>
                  <Text style={{ fontSize: font.xxl, fontWeight: "800", color: colors.brandPrimary }}>{adherence.percentage}%</Text>
                  <Text style={{ color: colors.muted, fontSize: font.base, marginTop: 4 }}>
                    {adherence.taken} de {adherence.total} doses tomadas
                  </Text>
                </Card>
                <View style={{ marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  {adherence.per_day.map((d: any) => {
                    const rate = d.total ? d.taken / d.total : 0;
                    const bg = d.total === 0 ? colors.surfaceTertiary : rate === 1 ? colors.success : rate >= 0.5 ? colors.warning : colors.error;
                    return (
                      <View key={d.date} style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{d.date.slice(8, 10)}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success }} /><Text style={{ color: colors.muted, fontSize: font.sm }}>Todas tomadas ✓</Text></View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.warning }} /><Text style={{ color: colors.muted, fontSize: font.sm }}>Parcial</Text></View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error }} /><Text style={{ color: colors.muted, fontSize: font.sm }}>Não tomada ×</Text></View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
