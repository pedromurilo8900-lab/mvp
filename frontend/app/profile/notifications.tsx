import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SubPage } from "@/src/subpage";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Card } from "@/src/ui";

const OPTIONS = [
  { key: "medications", label: "Medicamentos" },
  { key: "appointments", label: "Consultas" },
  { key: "exams", label: "Exames" },
  { key: "vaccines", label: "Vacinas" },
  { key: "reminders", label: "Lembretes gerais" },
];

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: c.divider },
  toggle: { width: 52, height: 32, borderRadius: 16, backgroundColor: c.surfaceTertiary, padding: 2, justifyContent: "center" },
  toggleActive: { backgroundColor: c.brandPrimary },
  knob: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff" },
}));

export default function NotifSettings() {
  const s = useStyles();
  const { colors } = useTheme();
  const [state, setState] = useState<Record<string, boolean>>({ medications: true, appointments: true, exams: true, vaccines: true, reminders: false });
  return (
    <SubPage title="Notificações">
      <Card>
        {OPTIONS.map((o, i) => (
          <View key={o.key} style={[s.row, i === 0 && { borderTopWidth: 0 }]}>
            <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "600" }}>{o.label}</Text>
            <Pressable testID={`notif-toggle-${o.key}`} onPress={() => setState(x => ({ ...x, [o.key]: !x[o.key] }))} style={[s.toggle, state[o.key] && s.toggleActive]}>
              <View style={[s.knob, { alignSelf: state[o.key] ? "flex-end" : "flex-start" }]} />
            </Pressable>
          </View>
        ))}
      </Card>
    </SubPage>
  );
}
