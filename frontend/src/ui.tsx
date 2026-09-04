import { LucideIcon } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

import { font, makeStyles, radius, spacing, useTheme } from "./theme";

// PRIMARY BUTTON --------------------------------------------------------------
type PBProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  icon?: LucideIcon;
  testID?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
};
export function PrimaryButton({ title, onPress, loading, disabled, variant = "primary", icon: Icon, testID, style, fullWidth = true }: PBProps) {
  const { colors } = useTheme();
  const bg =
    variant === "secondary" ? colors.surfaceTertiary :
    variant === "danger" ? colors.error :
    variant === "success" ? colors.success :
    variant === "ghost" ? "transparent" : colors.brandPrimary;
  const fg =
    variant === "secondary" ? colors.onSurfaceTertiary :
    variant === "danger" ? colors.onError :
    variant === "success" ? colors.onSuccess :
    variant === "ghost" ? colors.brandPrimary : colors.onBrandPrimary;
  const border = variant === "ghost" ? colors.brandPrimary : "transparent";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: colors.brandTertiary }}
      style={({ pressed }) => [
        {
          backgroundColor: bg, borderColor: border, borderWidth: variant === "ghost" ? 2 : 0,
          height: 56, borderRadius: radius.md,
          alignItems: "center", justifyContent: "center", flexDirection: "row",
          paddingHorizontal: spacing.lg, gap: spacing.xs,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {Icon ? <Icon size={20} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: font.md, fontWeight: "600" }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// CARD ------------------------------------------------------------------------
export const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: c.border,
  },
}));

export function Card({ children, style, testID, onPress }: { children: React.ReactNode; style?: ViewStyle; testID?: string; onPress?: () => void }) {
  const s = useCardStyles();
  const Cmp: any = onPress ? Pressable : View;
  return <Cmp testID={testID} onPress={onPress} style={[s.card, style]}>{children}</Cmp>;
}

// SECTION HEADER -------------------------------------------------------------
export function SectionHeader({ title, action, actionLabel }: { title: string; action?: () => void; actionLabel?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
      <Text style={{ fontSize: font.xl, fontWeight: "700", color: colors.onSurface }}>{title}</Text>
      {action ? (
        <Pressable onPress={action} hitSlop={12}>
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "600" }}>{actionLabel || "Ver todos"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// EMPTY STATE -----------------------------------------------------------------
export function EmptyState({ icon: Icon, title, hint, action, actionLabel, testID }: { icon?: LucideIcon; title: string; hint?: string; action?: () => void; actionLabel?: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: spacing.lg, gap: spacing.sm }}>
      {Icon ? <Icon size={48} color={colors.muted} /> : null}
      <Text style={{ fontSize: font.lg, fontWeight: "700", color: colors.onSurface, textAlign: "center" }}>{title}</Text>
      {hint ? <Text style={{ fontSize: font.base, color: colors.muted, textAlign: "center" }}>{hint}</Text> : null}
      {action ? <PrimaryButton title={actionLabel || "Adicionar"} onPress={action} fullWidth={false} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

// ERROR STATE -----------------------------------------------------------------
export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: spacing.lg, gap: spacing.sm }}>
      <Text style={{ fontSize: font.lg, fontWeight: "700", color: colors.onSurface }}>Não foi possível carregar seus dados.</Text>
      <Text style={{ fontSize: font.base, color: colors.muted, textAlign: "center" }}>{message || "Verifique sua conexão e tente novamente."}</Text>
      {onRetry ? <PrimaryButton title="Tentar novamente" onPress={onRetry} fullWidth={false} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

// LOADING SKELETON -----------------------------------------------------------
export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }} />
      ))}
    </View>
  );
}

// BADGES ---------------------------------------------------------------------
export function StatusBadge({ label, color, testID }: { label: string; color: string; testID?: string }) {
  return (
    <View testID={testID} style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color + "22", borderWidth: 1, borderColor: color }}>
      <Text style={{ color, fontWeight: "700", fontSize: font.sm }}>{label}</Text>
    </View>
  );
}

// EVENT COLORS ---------------------------------------------------------------
export function eventColor(type: string, colors: ReturnType<typeof useTheme>["colors"]) {
  switch (type) {
    case "appointment": return colors.eventConsultation;
    case "medication": return colors.eventMedication;
    case "vaccine": return colors.eventVaccine;
    case "exam": return colors.eventExam;
    default: return colors.muted;
  }
}
export function eventLabel(type: string): string {
  return { appointment: "Consulta", medication: "Medicamento", vaccine: "Vacina", exam: "Exame" }[type as string] || type;
}
