import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Pill, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { api } from "@/src/api";
import { fmtDate, fmtRelative } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, LoadingSkeleton, PrimaryButton, SectionHeader, StatusBadge } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, flex: 1 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  heroCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroBadge: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: c.eventMedication + "22", alignItems: "center", justifyContent: "center" },
  heroName: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  heroSub: { fontSize: font.md, color: c.muted, marginTop: 4 },
  doseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider },
}));

const KIND_LABEL_STATUS: Record<string, string> = { taken: "Tomado", not_taken: "Não tomado", pending: "Pendente" };

export default function MedicationDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [med, setMed] = useState<any>(null);
  const [today, setToday] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [m, doses, a] = await Promise.all([
        api(`/medications/${id}`),
        api("/medications/doses/today"),
        api("/medications/adherence?days=30"),
      ]);
      setMed(m); setToday((doses as any[]).filter(d => d.source_id === id)); setAdherence(a);
    } catch {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mark = async (dose: any, status: "taken" | "not_taken") => {
    try {
      await api("/medications/doses/mark", {
        method: "POST", body: JSON.stringify({ medication_id: dose.source_id, scheduled_at: dose.scheduled_at, status }),
      });
      Toast.show({ type: "success", text1: "Dose registrada como tomada" });
      load();
    } catch (e: any) { Toast.show({ type: "error", text1: e?.message }); }
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title} numberOfLines={1}>{med?.name || "Medicamento"}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }}>
        {loading || !med ? <LoadingSkeleton /> : (
          <>
            <Card>
              <View style={s.heroCard}>
                <View style={s.heroBadge}><Pill size={28} color={colors.eventMedication} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroName}>{med.name}</Text>
                  <Text style={s.heroSub}>{med.dosage} {med.unit} · {med.route}</Text>
                </View>
              </View>
              <View style={{ marginTop: spacing.md, gap: 6 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.md }}>Horários: <Text style={{ fontWeight: "700" }}>{(med.times || []).join(", ")}</Text></Text>
                <Text style={{ color: colors.onSurface, fontSize: font.md }}>{med.continuous_use ? "Uso contínuo" : `Início ${fmtDate(med.start_date)}${med.end_date ? ` · Fim ${fmtDate(med.end_date)}` : ""}`}</Text>
                {med.instructions ? <Text style={{ color: colors.muted, fontSize: font.base }}>{med.instructions}</Text> : null}
                {med.prescriber ? <Text style={{ color: colors.muted, fontSize: font.sm }}>Prescrito por {med.prescriber}</Text> : null}
              </View>
            </Card>

            <SectionHeader title="Doses de hoje" />
            <Card>
              {today.length === 0 ? <Text style={{ color: colors.muted, fontSize: font.base }}>Nenhuma dose para hoje.</Text> :
                today.map((d, i) => (
                  <View key={i} style={[s.doseRow, i === 0 && { borderTopWidth: 0 }]}>
                    <View>
                      <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>{d.time}</Text>
                      <Text style={{ color: colors.muted, fontSize: font.sm }}>
                        {KIND_LABEL_STATUS[d.status]}{d.recorded_at ? ` · ${d.recorded_at.slice(11, 16)}` : ""}
                      </Text>
                    </View>
                    {d.status === "pending" ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <PrimaryButton title="Tomei" icon={Check} variant="success" fullWidth={false} onPress={() => mark(d, "taken")} />
                        <PrimaryButton title="Não" icon={X} variant="secondary" fullWidth={false} onPress={() => mark(d, "not_taken")} />
                      </View>
                    ) : (
                      <StatusBadge label={KIND_LABEL_STATUS[d.status]} color={d.status === "taken" ? colors.success : colors.error} />
                    )}
                  </View>
                ))
              }
            </Card>

            {adherence ? (
              <>
                <SectionHeader title="Adesão (30 dias)" />
                <Card>
                  <Text style={{ fontSize: font.xxl, fontWeight: "800", color: colors.brandPrimary }}>{adherence.percentage}%</Text>
                  <Text style={{ color: colors.muted, fontSize: font.base }}>{adherence.taken} de {adherence.total} doses tomadas</Text>
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
