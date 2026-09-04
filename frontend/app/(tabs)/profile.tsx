import { useRouter } from "expo-router";
import { Bell, ChevronRight, HelpCircle, LogOut, Moon, Shield, Sun, User as UserIcon, Users } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { age } from "@/src/format";
import { font, makeStyles, radius, setColorScheme, spacing, useTheme } from "@/src/theme";
import { Card, PrimaryButton, SectionHeader } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: c.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: c.divider,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { flex: 1, color: c.onSurface, fontSize: font.md, fontWeight: "600" },
  themeSeg: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  themeBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 2,
    borderColor: c.border, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6,
  },
  themeBtnActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
}));

export default function ProfileScreen() {
  const s = useStyles();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const rows = [
    { icon: Users, label: "Acesso do cuidador", action: () => router.push("/profile/caregiver") },
    { icon: Bell, label: "Notificações", action: () => router.push("/profile/notifications") },
    { icon: Shield, label: "Privacidade e segurança", action: () => router.push("/profile/privacy") },
    { icon: HelpCircle, label: "Ajuda", action: () => router.push("/profile/help") },
  ];

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={s.title}>Perfil</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.md }}>
        <Card>
          <View style={s.profileRow}>
            <View style={s.avatar}><UserIcon size={40} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "800" }}>{user?.name || "Usuário"}</Text>
              <Text style={{ color: colors.muted, fontSize: font.base }}>
                {age(user?.birth_date) ? `${age(user?.birth_date)} anos` : ""}{user?.email ? ` · ${user.email}` : ""}
              </Text>
            </View>
          </View>
        </Card>

        <SectionHeader title="Aparência" />
        <Card>
          <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: "600" }}>Tema do aplicativo</Text>
          <View style={s.themeSeg}>
            <Pressable testID="theme-light" onPress={() => setColorScheme("light")} style={[s.themeBtn, scheme === "light" && s.themeBtnActive]}>
              <Sun size={20} color={colors.onSurface} /><Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>Claro</Text>
            </Pressable>
            <Pressable testID="theme-dark" onPress={() => setColorScheme("dark")} style={[s.themeBtn, scheme === "dark" && s.themeBtnActive]}>
              <Moon size={20} color={colors.onSurface} /><Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>Escuro</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setColorScheme(null)} style={{ paddingVertical: spacing.sm, marginTop: 4 }}>
            <Text style={{ color: colors.brandPrimary, fontSize: font.sm, fontWeight: "600" }}>Seguir sistema</Text>
          </Pressable>
        </Card>

        <SectionHeader title="Conta" />
        <Card>
          {rows.map((r, i) => (
            <Pressable key={r.label} testID={`profile-row-${r.label}`} onPress={r.action} style={[s.row, i === 0 && { borderTopWidth: 0 }]}>
              <View style={s.rowIcon}><r.icon size={20} color={colors.brandPrimary} /></View>
              <Text style={s.rowLabel}>{r.label}</Text>
              <ChevronRight size={20} color={colors.muted} />
            </Pressable>
          ))}
        </Card>

        <PrimaryButton testID="logout-btn" title="Sair" onPress={logout} icon={LogOut} variant="danger" />
      </ScrollView>
    </View>
  );
}
