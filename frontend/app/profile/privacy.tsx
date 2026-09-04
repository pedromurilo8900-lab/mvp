import { Text } from "react-native";
import { SubPage } from "@/src/subpage";
import { font, spacing, useTheme } from "@/src/theme";
import { Card } from "@/src/ui";

export default function PrivacyScreen() {
  const { colors } = useTheme();
  return (
    <SubPage title="Privacidade e segurança">
      <Card>
        <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700", marginBottom: spacing.xs }}>Seus dados estão protegidos</Text>
        <Text style={{ color: colors.muted, fontSize: font.base }}>
          Aderimos aos princípios da LGPD com criptografia em trânsito, autenticação segura e logs de auditoria em alterações relevantes. Informações clínicas sensíveis não são exibidas em telas bloqueadas sem sua autorização.
        </Text>
      </Card>
    </SubPage>
  );
}
