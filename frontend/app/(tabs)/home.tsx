import { useFocusEffect, useRouter } from "expo-router";
import { AlertTriangle, Bell, Calendar as CalIcon, ChevronRight, Pill, Plus, Syringe, TestTube, Weight } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fmtDate, fmtDateLong, fmtRelative } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton, SectionHeader, StatusBadge, eventColor, eventLabel } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { fontSize: font.xl, fontWeight: "800", color: c.onSurface },
  date: { fontSize: font.base, color: c.muted, marginTop: 2 },
  bellBtn: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.surfaceSecondary,
    borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center",
  },
  bellBadge: {
    position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4,
    borderRadius: 10, backgroundColor: c.error, alignItems: "center", justifyContent: "center",
  },
  cta: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: c.brandPrimary,
    borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  ctaText: { color: c.onBrandPrimary, fontSize: font.lg, fontWeight: "700", flex: 1 },
  sectionWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  hCard: {
    width: 260, marginRight: spacing.sm, backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: c.border, gap: 6,
  },
  hCardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  hCardTitle: { fontSize: font.md, fontWeight: "700", color: c.onSurface },
  hCardSub: { fontSize: font.base, color: c.onSurface },
  hCardMeta: { fontSize: font.sm, color: c.muted },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progBar: { height: 10, borderRadius: 5, backgroundColor: c.surfaceTertiary, overflow: "hidden", marginTop: 6 },
  progFill: { height: "100%", backgroundColor: c.success },
  measureRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
}));

const KIND_LABEL: Record<string, string> = { weight: "Peso", blood_pressure: "Pressão arterial", glucose: "Glicemia", abdominal: "Circ. abdominal", imc: "IMC", height: "Altura" };
function measurementDisplay(m: any) {
  if (m.kind === "blood_pressure") return `${m.value.systolic}/${m.value.diastolic} ${m.unit}`;
  const k = Object.keys(m.value).find(x => x !== "auto");
  return `${m.value[k as string]} ${m.unit}`;
}

export default function HomeScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false); setLoading(true);
      const d = await api("/home/summary");
      setData(d);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const firstName = user?.name?.split(" ")[0] || "";
  const today = new Date().toISOString();

  const NextCard = ({ icon: Icon, title, subtitle, meta, color, onPress, testID }: any) => (
    <Pressable testID={testID} onPress={onPress} style={s.hCard}>
      <View style={s.hCardHeader}>
        <Icon size={20} color={color} />
        <Text style={[s.hCardTitle, { color }]}>{title}</Text>
      </View>
      <Text style={s.hCardSub}>{subtitle}</Text>
      {meta ? <Text style={s.hCardMeta}>{meta}</Text> : null}
    </Pressable>
  );

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text testID="home-greeting" style={s.hello}>Olá, {firstName}</Text>
            <Text style={s.date}>{fmtDateLong(today)}</Text>
          </View>
          <Pressable testID="home-notifications-btn" onPress={() => router.push("/notifications")} style={s.bellBtn}>
            <Bell size={24} color={colors.onSurface} />
            {data?.unread_notifications > 0 ? (
              <View style={s.bellBadge}><Text style={{ color: colors.onError, fontSize: 11, fontWeight: "700" }}>{data.unread_notifications}</Text></View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} refreshControl={undefined}>
        <Pressable testID="home-register-now-btn" onPress={() => router.push("/record")} style={s.cta}>
          <Plus size={28} color={colors.onBrandPrimary} />
          <Text style={s.ctaText}>Registrar agora</Text>
          <ChevronRight size={24} color={colors.onBrandPrimary} />
        </Pressable>

        {loading ? <LoadingSkeleton /> : error ? <ErrorState onRetry={load} /> : data ? (
          <>
            <View style={s.sectionWrap}>
              <SectionHeader title="Próximos" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 0 }}>
              {data.next.medication ? (
                <NextCard testID="home-next-medication" icon={Pill} color={colors.eventMedication}
                  title="Próximo medicamento"
                  subtitle={`${data.next.medication.title} · ${data.next.medication.metadata?.dosage || ""} ${data.next.medication.metadata?.unit || ""}`}
                  meta={`${fmtDate(data.next.medication.date)} · ${data.next.medication.time}`}
                  onPress={() => router.push({ pathname: "/medication/[id]", params: { id: data.next.medication.source_id } } as any)}
                />
              ) : null}
              {data.next.appointment ? (
                <NextCard testID="home-next-appointment" icon={CalIcon} color={colors.eventConsultation}
                  title="Próxima consulta"
                  subtitle={`${data.next.appointment.title} · ${data.next.appointment.subtitle}`}
                  meta={`${fmtDate(data.next.appointment.date)} · ${data.next.appointment.time} ${data.next.appointment.metadata?.location ? "· " + data.next.appointment.metadata.location : ""}`}
                  onPress={() => router.push("/(tabs)/calendar")}
                />
              ) : null}
              {data.next.exam_or_vaccine ? (
                <NextCard testID="home-next-exam-or-vaccine"
                  icon={data.next.exam_or_vaccine.type === "vaccine" ? Syringe : TestTube}
                  color={data.next.exam_or_vaccine.type === "vaccine" ? colors.eventVaccine : colors.eventExam}
                  title={data.next.exam_or_vaccine.type === "vaccine" ? "Próxima vacina" : "Próximo exame"}
                  subtitle={data.next.exam_or_vaccine.title}
                  meta={`${fmtDate(data.next.exam_or_vaccine.date)}${data.next.exam_or_vaccine.time ? " · " + data.next.exam_or_vaccine.time : ""}`}
                  onPress={() => router.push("/(tabs)/calendar")}
                />
              ) : null}
              {!data.next.medication && !data.next.appointment && !data.next.exam_or_vaccine ? (
                <View style={{ paddingHorizontal: spacing.lg }}>
                  <Text style={{ color: colors.muted, fontSize: font.base }}>Nenhum compromisso próximo.</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={s.sectionWrap}>
              <SectionHeader title="Resumo do dia" />
              <Card testID="home-summary-card">
                <View style={s.summaryRow}>
                  <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "600" }}>Medicamentos</Text>
                  <Text testID="home-summary-doses" style={{ color: colors.onSurface, fontSize: font.md }}>
                    {data.day_summary.medications.taken} de {data.day_summary.medications.total} doses tomadas
                  </Text>
                </View>
                <View style={s.progBar}>
                  <View style={[s.progFill, { width: `${data.day_summary.medications.total ? (data.day_summary.medications.taken / data.day_summary.medications.total) * 100 : 0}%` }]} />
                </View>
                <View style={[s.summaryRow, { marginTop: spacing.md }]}>
                  <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "600" }}>Próxima consulta</Text>
                  <Text style={{ color: colors.muted, fontSize: font.base }}>
                    {data.day_summary.next_appointment ? `${fmtDate(data.day_summary.next_appointment.date)} · ${data.day_summary.next_appointment.time}` : "Nenhuma agendada"}
                  </Text>
                </View>
                <View style={[s.summaryRow, { marginTop: spacing.md }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={18} color={colors.warning} />
                    <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "600" }}>Risco de queda</Text>
                  </View>
                  <StatusBadge testID="home-fall-risk-badge"
                    label={data.day_summary.fall_risk ? { low: "Baixo", moderate: "Moderado", high: "Alto" }[data.day_summary.fall_risk.level as string] : "Sem avaliação"}
                    color={data.day_summary.fall_risk ? ({ low: colors.success, moderate: colors.warning, high: colors.error } as any)[data.day_summary.fall_risk.level] : colors.muted}
                  />
                </View>
              </Card>
            </View>

            <View style={s.sectionWrap}>
              <SectionHeader title="Últimos registros" action={() => router.push("/(tabs)/evolution")} />
              <Card>
                {data.latest_measurements.length === 0 ? (
                  <EmptyState icon={Weight} title="Ainda não há registros" hint="Adicione sua primeira medida para começar." action={() => router.push("/record")} actionLabel="Registrar" />
                ) : data.latest_measurements.map((m: any, i: number) => (
                  <View key={m.id} style={[s.measureRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                    <View>
                      <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "600" }}>{KIND_LABEL[m.kind] || m.kind}</Text>
                      <Text style={{ color: colors.muted, fontSize: font.sm }}>
                        {fmtRelative(m.recorded_at)} · {m.actor_type === "professional" ? "Registrado pelo médico" : "Registrado por você"}
                      </Text>
                    </View>
                    <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700" }}>{measurementDisplay(m)}</Text>
                  </View>
                ))}
              </Card>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
