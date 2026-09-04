import { useRouter } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fmtRelative } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, LoadingSkeleton, SectionHeader } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface, flex: 1 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  itemRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider },
  dot: { position: "absolute", left: -4, top: 18, width: 10, height: 10, borderRadius: 5, backgroundColor: c.brandPrimary },
}));

export default function NotificationsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/notifications")); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    try { await api("/notifications/mark-read", { method: "POST", body: JSON.stringify({}) }); load(); } catch {}
  };

  const today = new Date().toDateString();
  const todays = items.filter(x => new Date(x.created_at).toDateString() === today);
  const older = items.filter(x => new Date(x.created_at).toDateString() !== today);

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>Notificações</Text>
        <Pressable onPress={markAll}><Text style={{ color: colors.brandPrimary, fontWeight: "600" }}>Marcar todas</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }}>
        {loading ? <LoadingSkeleton /> : items.length === 0 ? (
          <EmptyState icon={Bell} title="Sem notificações" hint="Você será avisado sobre medicamentos, consultas e exames." />
        ) : (
          <>
            {todays.length > 0 && <><SectionHeader title="Hoje" /><Card>{todays.map((n, i) => (
              <View key={n.id} style={[s.itemRow, i === 0 && { borderTopWidth: 0 }]}>
                {!n.read ? <View style={s.dot} /> : null}
                <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700" }}>{n.title}</Text>
                <Text style={{ color: colors.muted, fontSize: font.base }}>{n.message}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 4 }}>{fmtRelative(n.created_at)}</Text>
              </View>
            ))}</Card></>}
            {older.length > 0 && <><SectionHeader title="Anteriores" /><Card>{older.map((n, i) => (
              <View key={n.id} style={[s.itemRow, i === 0 && { borderTopWidth: 0 }]}>
                {!n.read ? <View style={s.dot} /> : null}
                <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700" }}>{n.title}</Text>
                <Text style={{ color: colors.muted, fontSize: font.base }}>{n.message}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 4 }}>{fmtRelative(n.created_at)}</Text>
              </View>
            ))}</Card></>}
          </>
        )}
      </ScrollView>
    </View>
  );
}
