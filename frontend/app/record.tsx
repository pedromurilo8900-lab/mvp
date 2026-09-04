import { useLocalSearchParams, useRouter } from "expo-router";
import { Activity, ArrowLeft, Droplet, Ruler, StickyNote, Weight } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { api } from "@/src/api";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card, PrimaryButton } from "@/src/ui";

const KINDS = [
  { key: "weight", label: "Peso", icon: Weight, unit: "kg" },
  { key: "blood_pressure", label: "Pressão arterial", icon: Activity, unit: "mmHg" },
  { key: "glucose", label: "Glicemia", icon: Droplet, unit: "mg/dL" },
  { key: "abdominal", label: "Circunferência abdominal", icon: Ruler, unit: "cm" },
  { key: "symptoms", label: "Sintomas", icon: StickyNote, unit: "" },
] as const;

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface, flex: 1 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.lg },
  kindCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 2, borderColor: c.border, alignItems: "center", gap: 8, minHeight: 100 },
  kindCardActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  kindLabel: { color: c.onSurface, fontSize: font.md, fontWeight: "700", textAlign: "center" },
  label: { fontSize: font.base, color: c.onSurface, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: font.lg, color: c.onSurface, minHeight: 56 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
}));

const CTX_OPTIONS = [
  { key: "fasting", label: "Jejum" },
  { key: "before_meal", label: "Antes da refeição" },
  { key: "after_meal", label: "Após refeição" },
  { key: "other", label: "Outro" },
];

export default function RecordScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<string>((params.kind as string) || "weight");

  const [weight, setWeight] = useState("");
  const [sys, setSys] = useState(""); const [dia, setDia] = useState("");
  const [glucose, setGlucose] = useState(""); const [ctx, setCtx] = useState("");
  const [abdominal, setAbdominal] = useState("");
  const [symptoms, setSymptoms] = useState(""); const [intensity, setIntensity] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const submit = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (kind === "weight" && weight) {
        await api("/measurements", { method: "POST", body: JSON.stringify({ patient_id: "", kind: "weight", value: { weight: parseFloat(weight.replace(",", ".")) }, unit: "kg", recorded_at: now }) });
      } else if (kind === "blood_pressure" && sys && dia) {
        await api("/measurements", { method: "POST", body: JSON.stringify({ patient_id: "", kind: "blood_pressure", value: { systolic: parseInt(sys), diastolic: parseInt(dia) }, unit: "mmHg", recorded_at: now }) });
      } else if (kind === "glucose" && glucose) {
        await api("/measurements", { method: "POST", body: JSON.stringify({ patient_id: "", kind: "glucose", value: { glucose: parseInt(glucose) }, unit: "mg/dL", context: ctx || null, recorded_at: now }) });
      } else if (kind === "abdominal" && abdominal) {
        await api("/measurements", { method: "POST", body: JSON.stringify({ patient_id: "", kind: "abdominal", value: { abdominal: parseFloat(abdominal.replace(",", ".")) }, unit: "cm", recorded_at: now }) });
      } else if (kind === "symptoms" && symptoms) {
        await api("/symptoms", { method: "POST", body: JSON.stringify({ patient_id: "", text: symptoms, tags, intensity, recorded_at: now }) });
      } else {
        Toast.show({ type: "error", text1: "Preencha os campos" }); setSaving(false); return;
      }
      Toast.show({ type: "success", text1: "Registro salvo com sucesso" });
      router.back();
    } catch (e: any) {
      Toast.show({ type: "error", text1: "Erro ao salvar", text2: e?.message });
    } finally { setSaving(false); }
  };

  const CommonSymptoms = ["Tontura", "Dor de cabeça", "Falta de ar", "Fadiga", "Náusea"];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>Registrar agora</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <View style={s.kindGrid}>
          {KINDS.map(k => (
            <Pressable key={k.key} testID={`record-kind-${k.key}`} onPress={() => setKind(k.key)} style={[s.kindCard, kind === k.key && s.kindCardActive]}>
              <k.icon size={32} color={kind === k.key ? colors.brandPrimary : colors.onSurface} />
              <Text style={s.kindLabel}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {kind === "weight" && (
            <View><Text style={s.label}>Peso (kg)</Text>
              <TextInput testID="record-weight-input" value={weight} onChangeText={setWeight} style={s.input} keyboardType="decimal-pad" placeholder="72,5" placeholderTextColor={colors.muted} />
            </View>
          )}
          {kind === "blood_pressure" && (
            <>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}><Text style={s.label}>Sistólica</Text>
                  <TextInput testID="record-sys-input" value={sys} onChangeText={setSys} style={s.input} keyboardType="number-pad" placeholder="120" placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 1 }}><Text style={s.label}>Diastólica</Text>
                  <TextInput testID="record-dia-input" value={dia} onChangeText={setDia} style={s.input} keyboardType="number-pad" placeholder="80" placeholderTextColor={colors.muted} />
                </View>
              </View>
              {sys && dia ? <Text style={{ color: colors.brandPrimary, fontSize: font.xl, fontWeight: "700", textAlign: "center" }}>{sys}/{dia} mmHg</Text> : null}
            </>
          )}
          {kind === "glucose" && (
            <>
              <View><Text style={s.label}>Glicemia (mg/dL)</Text>
                <TextInput testID="record-glucose-input" value={glucose} onChangeText={setGlucose} style={s.input} keyboardType="number-pad" placeholder="105" placeholderTextColor={colors.muted} />
              </View>
              <View><Text style={s.label}>Contexto (opcional)</Text>
                <View style={s.chipRow}>
                  {CTX_OPTIONS.map(o => (
                    <Pressable key={o.key} onPress={() => setCtx(ctx === o.key ? "" : o.key)} style={[s.chip, ctx === o.key && s.chipActive]}>
                      <Text style={{ color: ctx === o.key ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}
          {kind === "abdominal" && (
            <View><Text style={s.label}>Circunferência abdominal (cm)</Text>
              <TextInput testID="record-abd-input" value={abdominal} onChangeText={setAbdominal} style={s.input} keyboardType="decimal-pad" placeholder="98,0" placeholderTextColor={colors.muted} />
            </View>
          )}
          {kind === "symptoms" && (
            <>
              <View><Text style={s.label}>Descreva o sintoma</Text>
                <TextInput testID="record-symptom-input" value={symptoms} onChangeText={setSymptoms} style={[s.input, { height: 120, textAlignVertical: "top" }]} multiline placeholder="Ex: Dor de cabeça leve pela manhã..." placeholderTextColor={colors.muted} />
              </View>
              <View><Text style={s.label}>Sintomas comuns</Text>
                <View style={s.chipRow}>
                  {CommonSymptoms.map(t => (
                    <Pressable key={t} onPress={() => toggleTag(t)} style={[s.chip, tags.includes(t) && s.chipActive]}>
                      <Text style={{ color: tags.includes(t) ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View><Text style={s.label}>Intensidade (1–10)</Text>
                <View style={s.chipRow}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <Pressable key={n} onPress={() => setIntensity(intensity === n ? null : n)} style={[s.chip, intensity === n && s.chipActive, { minWidth: 44, alignItems: "center" }]}>
                      <Text style={{ color: intensity === n ? colors.onBrandPrimary : colors.onSurface, fontWeight: "700" }}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}

          <PrimaryButton testID="record-save-btn" title="Salvar registro" onPress={submit} loading={saving} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
