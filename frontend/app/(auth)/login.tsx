import { Activity, HeartPulse } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuth } from "@/src/auth";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  logoBadge: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  logoTitle: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  subtitle: { fontSize: font.base, color: c.muted, marginBottom: spacing.lg },
  label: { fontSize: font.base, color: c.onSurface, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: font.md, color: c.onSurface,
    minHeight: 56,
  },
  linkRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  linkText: { color: c.brandPrimary, fontSize: font.base, fontWeight: "600" },
  demoCard: {
    marginTop: spacing.lg, backgroundColor: c.brandTertiary, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: c.brandPrimary,
  },
  demoTitle: { color: c.onBrandTertiary, fontWeight: "700", fontSize: font.base, marginBottom: 4 },
  demoText: { color: c.onBrandTertiary, fontSize: font.sm },
}));

export default function LoginScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("joao.silva@calenhealth.demo");
  const [password, setPassword] = useState("calen2026");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Toast.show({ type: "error", text1: "Preencha e-mail e senha" }); return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Falha no login", text2: e?.message || "Verifique os dados" });
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]} keyboardShouldPersistTaps="handled">
        <View style={s.logoRow}>
          <View style={s.logoBadge}><HeartPulse size={32} color={colors.onBrandPrimary} /></View>
          <View>
            <Text style={s.logoTitle}>Calen Health</Text>
            <Text style={{ color: colors.muted, fontSize: font.base }}>Sua saúde, organizada</Text>
          </View>
        </View>
        <Text style={s.subtitle}>Acesse sua conta para acompanhar medicamentos, consultas e sua evolução.</Text>

        <View>
          <Text style={s.label}>E-mail</Text>
          <TextInput
            testID="login-email-input"
            value={email} onChangeText={setEmail}
            style={s.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            placeholder="seu@email.com" placeholderTextColor={colors.muted}
          />
        </View>
        <View>
          <Text style={s.label}>Senha</Text>
          <TextInput
            testID="login-password-input"
            value={password} onChangeText={setPassword}
            style={s.input} secureTextEntry autoCapitalize="none"
            placeholder="Sua senha" placeholderTextColor={colors.muted}
          />
        </View>

        <PrimaryButton testID="login-submit-button" title="Entrar" onPress={submit} loading={loading} icon={Activity} />

        <View style={s.linkRow}>
          <Pressable onPress={() => Toast.show({ type: "info", text1: "Recuperação de acesso", text2: "Em breve. Contate o suporte da sua clínica." })}>
            <Text style={s.linkText}>Esqueci minha senha</Text>
          </Pressable>
          <Pressable testID="go-to-register-button" onPress={() => import("expo-router").then(({ router }) => router.push("/(auth)/register"))}>
            <Text style={s.linkText}>Criar conta</Text>
          </Pressable>
        </View>

        <View style={s.demoCard}>
          <Text style={s.demoTitle}>Conta demonstrativa</Text>
          <Text style={s.demoText}>E-mail: joao.silva@calenhealth.demo</Text>
          <Text style={s.demoText}>Senha: calen2026</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
