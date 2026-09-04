import { UserPlus } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuth } from "@/src/auth";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/ui";

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface, marginBottom: spacing.sm },
  label: { fontSize: font.base, color: c.onSurface, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: font.md, color: c.onSurface, minHeight: 56,
  },
}));

export default function RegisterScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birth, setBirth] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !email || !password) { Toast.show({ type: "error", text1: "Preencha todos os campos" }); return; }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), birth || undefined);
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Falha no cadastro", text2: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Criar conta</Text>
        <View><Text style={s.label}>Nome completo</Text>
          <TextInput testID="register-name-input" value={name} onChangeText={setName} style={s.input} placeholder="Seu nome" placeholderTextColor={colors.muted} />
        </View>
        <View><Text style={s.label}>Data de nascimento (AAAA-MM-DD)</Text>
          <TextInput testID="register-birth-input" value={birth} onChangeText={setBirth} style={s.input} placeholder="1955-01-30" placeholderTextColor={colors.muted} />
        </View>
        <View><Text style={s.label}>E-mail</Text>
          <TextInput testID="register-email-input" value={email} onChangeText={setEmail} style={s.input} keyboardType="email-address" autoCapitalize="none" placeholder="seu@email.com" placeholderTextColor={colors.muted} />
        </View>
        <View><Text style={s.label}>Senha</Text>
          <TextInput testID="register-password-input" value={password} onChangeText={setPassword} style={s.input} secureTextEntry placeholder="Mínimo 6 caracteres" placeholderTextColor={colors.muted} />
        </View>
        <PrimaryButton testID="register-submit-button" title="Criar minha conta" onPress={submit} loading={loading} icon={UserPlus} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
