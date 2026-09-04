import { useFocusEffect, useRouter } from "expo-router";
import { AlertTriangle, Plus } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fmtDate, fmtRelative } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton, SectionHeader, StatusBadge } from "@/src/ui";

const FILTERS = [
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "blood_pressure", label: "Pressão", unit: "mmHg" },
  { key: "glucose", label: "Glicemia", unit: "mg/dL" },
  { key: "abdominal", label: "Circ. abd.", unit: "cm" },
  { key: "imc", label: "IMC", unit: "kg/m²" },
  { key: "fall_risk", label: "Risco queda", unit: "" },
] as const;

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingVertical: spacing.sm },
  chip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { color: c.onSurface, fontSize: font.sm, fontWeight: "600" },
  chipTextActive: { color: c.onBrandPrimary },
  legend: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  historyRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
}));

function measurementValue(m: any, kind: string): number {
  if (kind === "blood_pressure") return m.value.systolic;
  const k = Object.keys(m.value).find(x => x !== "auto");
  return Number(m.value[k as string]);
}

export default function EvolutionScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<typeof FILTERS[number]["key"]>("weight");
  const [items, setItems] = useState<any[]>([]);
  const [fallRisk, setFallRisk] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false); setLoading(true);
      if (filter === "fall_risk") setFallRisk(await api<any[]>("/fall-risk"));
      else setItems(await api<any[]>(`/measurements?kind=${filter}`));
    } catch { setError(true); } finally { setLoading(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const chartData = useMemo(() => {
    if (filter === "fall_risk") return { primary: [], secondary: [] };
    const sorted = [...items].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).slice(-40);
    const primary = sorted.map((m) => ({ value: measurementValue(m, filter), dataPointColor: m.actor_type === "professional" ? colors.chartMedical : colors.chartPatient, actor: m.actor_type, recorded_at: m.recorded_at, raw: m }));
    let secondary: any[] = [];
    if (filter === "blood_pressure") secondary = sorted.map((m) => ({ value: m.value.diastolic, dataPointColor: colors.warning }));
    return { primary, secondary };
  }, [items, filter, colors]);

  const currentFilter = FILTERS.find(f => f.key === filter)!;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={s.title}>Minha evolução</Text>
        <PrimaryButton title="Registrar" onPress={() => router.push("/record")} icon={Plus} fullWidth={false} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {FILTERS.map(f => (
          <Pressable key={f.key} testID={`evo-chip-${f.key}`} onPress={() => setFilter(f.key)} style={[s.chip, filter === f.key && s.chipActive]}>
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100, padding: spacing.lg, gap: spacing.md }}>
        {loading ? <LoadingSkeleton /> : error ? <ErrorState onRetry={load} /> : filter === "fall_risk" ? (
          fallRisk.length === 0 ? <EmptyState icon={AlertTriangle} title="Sem avaliações" hint="As avaliações aparecerão aqui." /> : (
            <>
              <Card>
                <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: "600" }}>Resultado atual</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                  <StatusBadge label={({ low: "Baixo", moderate: "Moderado", high: "Alto" } as any)[fallRisk[0].level]}
                    color={({ low: colors.success, moderate: colors.warning, high: colors.error } as any)[fallRisk[0].level]} />
                  <Text style={{ color: colors.muted, fontSize: font.sm }}>{fmtDate(fallRisk[0].date)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 6 }}>Por {fallRisk[0].actor_name}</Text>
                {fallRisk[0].notes ? <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: 8 }}>{fallRisk[0].notes}</Text> : null}
              </Card>
              <SectionHeader title="Histórico" />
              <Card>
                {fallRisk.map((r, i) => (
                  <View key={r.id} style={[s.historyRow, i === 0 && { borderTopWidth: 0 }]}>
                    <View>
                      <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700" }}>{fmtDate(r.date)}</Text>
                      <Text style={{ color: colors.muted, fontSize: font.sm }}>{r.actor_name || "—"}</Text>
                    </View>
                    <StatusBadge label={({ low: "Baixo", moderate: "Moderado", high: "Alto" } as any)[r.level]}
                      color={({ low: colors.success, moderate: colors.warning, high: colors.error } as any)[r.level]} />
                  </View>
                ))}
              </Card>
            </>
          )
        ) : items.length === 0 ? (
          <EmptyState title="Ainda não há registros" hint="Adicione sua primeira medida para começar a acompanhar sua evolução." action={() => router.push("/record")} actionLabel="Registrar" />
        ) : (
          <>
            <Card testID={`evo-chart-${filter}`}>
              <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: "600" }}>{currentFilter.label} · {currentFilter.unit}</Text>
              <View style={{ marginTop: spacing.sm }}>
                <LineChart
                  data={chartData.primary}
                  data2={filter === "blood_pressure" ? chartData.secondary : undefined}
                  color1={colors.chartMedical}
                  color2={colors.warning}
                  thickness={3}
                  hideRules
                  spacing={20}
                  initialSpacing={10}
                  yAxisTextStyle={{ color: colors.muted, fontSize: 11 }}
                  xAxisColor={colors.border}
                  yAxisColor={colors.border}
                  height={180}
                  isAnimated
                  focusEnabled
                  showDataPointOnFocus
                  showTextOnFocus
                  showStripOnFocus
                />
              </View>
              <View style={s.legend}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={[s.legendDot, { backgroundColor: colors.chartMedical }]} /><Text style={{ color: colors.muted, fontSize: font.sm }}>Registro médico</Text></View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={[s.legendDot, { backgroundColor: colors.chartPatient }]} /><Text style={{ color: colors.muted, fontSize: font.sm }}>Você/cuidador</Text></View>
                {filter === "blood_pressure" ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={[s.legendDot, { backgroundColor: colors.warning }]} /><Text style={{ color: colors.muted, fontSize: font.sm }}>Diastólica</Text></View> : null}
              </View>
            </Card>
            <SectionHeader title="Histórico" />
            <Card>
              {items.slice(0, 20).map((m, i) => (
                <View key={m.id} style={[s.historyRow, i === 0 && { borderTopWidth: 0 }]}>
                  <View>
                    <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700" }}>
                      {filter === "blood_pressure" ? `${m.value.systolic}/${m.value.diastolic}` : measurementValue(m, filter)} {m.unit}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: font.sm }}>
                      {fmtRelative(m.recorded_at)} · {m.actor_type === "professional" ? "Registrado pelo médico" : "Registrado por você"}
                    </Text>
                  </View>
                  <View style={[s.legendDot, { backgroundColor: m.actor_type === "professional" ? colors.chartMedical : colors.chartPatient, width: 10, height: 10 }]} />
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
