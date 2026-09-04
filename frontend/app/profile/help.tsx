import { Text } from "react-native";
import { SubPage } from "@/src/subpage";
import { font, spacing, useTheme } from "@/src/theme";
import { Card } from "@/src/ui";

export default function HelpScreen() {
  const { colors } = useTheme();
  return (
    <SubPage title="Ajuda">
      <Card>
        <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700", marginBottom: spacing.xs }}>Como usar o Calen Health</Text>
        <Text style={{ color: colors.muted, fontSize: font.base, marginBottom: spacing.md }}>
          Use o botão “Registrar agora” na tela inicial para anotar suas medidas. Marque cada dose como tomada tocando em Tomei — o calendário será atualizado automaticamente.
        </Text>
        <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700", marginBottom: spacing.xs }}>Suporte</Text>
        <Text style={{ color: colors.muted, fontSize: font.base }}>Em caso de dúvidas, entre em contato com sua clínica ou cuidador.</Text>
      </Card>
    </SubPage>
  );
}
