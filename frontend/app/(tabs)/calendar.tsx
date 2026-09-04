import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { MONTHS_PT, WEEKDAYS_PT, fmtDateShort } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { ErrorState, LoadingSkeleton, eventColor, eventLabel } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  monthLabel: { fontSize: font.xl, fontWeight: "700", color: c.onSurface },
  navBtn: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 4, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  segActive: { backgroundColor: c.surfaceSecondary },
  segText: { fontSize: font.base, fontWeight: "600", color: c.muted },
  segTextActive: { color: c.onSurface },
  weekRow: { flexDirection: "row", paddingHorizontal: spacing.lg, marginBottom: 4 },
  weekCell: { flex: 1, alignItems: "center" },
  weekText: { color: c.muted, fontSize: font.sm, fontWeight: "600" },
  grid: { paddingHorizontal: spacing.lg, gap: 4 },
  dayCell: {
    flex: 1, aspectRatio: 0.8, borderRadius: radius.sm, backgroundColor: c.surfaceSecondary,
    borderWidth: 1, borderColor: c.border, padding: 4, gap: 2,
  },
  dayCellSelected: { borderColor: c.brandPrimary, borderWidth: 2 },
  dayCellToday: { backgroundColor: c.brandTertiary },
  dayCellOther: { opacity: 0.35 },
  dayNum: { fontSize: font.sm, fontWeight: "700", color: c.onSurface },
  tag: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, alignSelf: "stretch" },
  tagText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: font.sm, color: c.muted },
  dayDetailHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  eventRow: {
    marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 4, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
}));

function formatMonth(d: Date) {
  return `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
}
function toKey(d: Date) { return d.toISOString().slice(0, 10); }
function daysInMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startDay = first.getDay();
  const start = new Date(first); start.setDate(1 - startDay);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export default function CalendarScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState<string>(toKey(new Date()));
  const [mode, setMode] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false); setLoading(true);
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      const start = new Date(first); start.setDate(1 - first.getDay());
      const end = new Date(last); end.setDate(last.getDate() + (6 - last.getDay()));
      const data = await api<any[]>(`/calendar/events?start=${toKey(start)}&end=${toKey(end)}`);
      setEvents(data);
    } catch { setError(true); } finally { setLoading(false); }
  }, [anchor]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const grid = useMemo(() => daysInMonthGrid(anchor), [anchor]);
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of events) {
      const arr = m.get(e.date) || []; arr.push(e); m.set(e.date, arr);
    }
    return m;
  }, [events]);
  const todayKey = toKey(new Date());

  const dayEvents = byDay.get(selected) || [];

  const changeMonth = (delta: number) => {
    const d = new Date(anchor); d.setMonth(d.getMonth() + delta); setAnchor(d);
  };

  const rows: Date[][] = [];
  for (let i = 0; i < 6; i++) rows.push(grid.slice(i * 7, i * 7 + 7));

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={s.title}>Calendário</Text>
        <View style={s.monthNav}>
          <Pressable testID="cal-prev-month" onPress={() => changeMonth(-1)} style={s.navBtn}><ChevronLeft size={20} color={colors.onSurface} /></Pressable>
          <Text testID="cal-month-label" style={s.monthLabel}>{formatMonth(anchor)}</Text>
          <Pressable testID="cal-next-month" onPress={() => changeMonth(1)} style={s.navBtn}><ChevronRight size={20} color={colors.onSurface} /></Pressable>
        </View>
      </View>

      <View style={s.segment}>
        {(["month", "week"] as const).map(m => (
          <Pressable key={m} testID={`cal-mode-${m}`} onPress={() => setMode(m)} style={[s.segItem, mode === m && s.segActive]}>
            <Text style={[s.segText, mode === m && s.segTextActive]}>{m === "month" ? "Mensal" : "Semanal"}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={s.weekRow}>
          {WEEKDAYS_PT.map(w => <View key={w} style={s.weekCell}><Text style={s.weekText}>{w}</Text></View>)}
        </View>
        <View style={s.grid}>
          {(mode === "week" ? [rows.find(r => r.some(d => toKey(d) === selected)) || rows[0]] : rows).map((row, ri) => (
            <View key={ri} style={{ flexDirection: "row", gap: 4 }}>
              {row.map((d) => {
                const key = toKey(d);
                const isOther = d.getMonth() !== anchor.getMonth();
                const isSelected = key === selected;
                const isToday = key === todayKey;
                const dayEvts = byDay.get(key) || [];
                return (
                  <Pressable key={key} testID={`cal-day-${key}`} onPress={() => setSelected(key)}
                    style={[s.dayCell, isToday && s.dayCellToday, isSelected && s.dayCellSelected, isOther && s.dayCellOther]}>
                    <Text style={s.dayNum}>{d.getDate()}</Text>
                    {dayEvts.slice(0, 3).map((e, i) => (
                      <View key={i} style={[s.tag, { backgroundColor: eventColor(e.type, colors) }]}>
                        <Text style={s.tagText} numberOfLines={1}>
                          {e.type === "medication" ? `${e.time} ${e.title}` : e.title.slice(0, 12)}
                        </Text>
                      </View>
                    ))}
                    {dayEvts.length > 3 ? <Text style={{ fontSize: 10, color: colors.muted }}>+{dayEvts.length - 3}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={s.legend}>
          {[
            { t: "appointment", label: "Consulta" },
            { t: "medication", label: "Medicamento" },
            { t: "vaccine", label: "Vacina" },
            { t: "exam", label: "Exame" },
          ].map(x => (
            <View key={x.t} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: eventColor(x.t, colors) }]} />
              <Text style={s.legendLabel}>{x.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.dayDetailHeader}>
          <Text style={{ fontSize: font.xl, fontWeight: "700", color: colors.onSurface }}>{fmtDateShort(selected)}</Text>
          <Text style={{ fontSize: font.sm, color: colors.muted, marginTop: 4 }}>{dayEvents.length} {dayEvents.length === 1 ? "compromisso" : "compromissos"}</Text>
        </View>

        {loading ? <LoadingSkeleton /> : error ? <ErrorState onRetry={load} /> :
          dayEvents.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: font.base, textAlign: "center", padding: spacing.lg }}>
              Nenhum compromisso neste dia.
            </Text>
          ) : dayEvents.map((e) => (
            <Pressable key={e.id} testID={`cal-event-${e.id}`} onPress={() => {
              if (e.type === "medication") router.push({ pathname: "/medication/[id]", params: { id: e.source_id, scheduledAt: e.scheduled_at } } as any);
            }} style={[s.eventRow, { borderLeftColor: eventColor(e.type, colors) }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: "600" }}>{e.time || "--:--"} · {eventLabel(e.type)}</Text>
                <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700" }}>{e.title}</Text>
                {e.subtitle ? <Text style={{ color: colors.muted, fontSize: font.sm }}>{e.subtitle}</Text> : null}
                {e.type === "medication" && e.status !== "pending" ? (
                  <Text style={{ color: e.status === "taken" ? colors.success : colors.error, fontSize: font.sm, fontWeight: "700", marginTop: 4 }}>
                    {e.status === "taken" ? "✓ Tomado" : "× Não tomado"}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  );
}
