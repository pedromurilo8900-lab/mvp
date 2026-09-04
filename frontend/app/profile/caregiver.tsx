import { Users } from "lucide-react-native";
import { Text, View } from "react-native";

import { SubPage } from "@/src/subpage";
import { font, spacing, useTheme } from "@/src/theme";
import { Card, EmptyState, PrimaryButton } from "@/src/ui";

export default function CaregiverScreen() {
  const { colors } = useTheme();
  return (
    <SubPage title="Acesso do cuidador">
      <Card>
        <Text style={{ color: colors.onSurface, fontSize: font.md, fontWeight: "700", marginBottom: spacing.xs }}>Compartilhe o acompanhamento</Text>
        <Text style={{ color: colors.muted, fontSize: font.base }}>
          Um cuidador autorizado poderá acessar a mesma agenda e registrar em seu nome. As ações são auditadas.
        </Text>
      </Card>
      <EmptyState icon={Users} title="Nenhum cuidador autorizado" hint="Você poderá convidar um cuidador por e-mail." />
      <PrimaryButton title="Convidar cuidador" onPress={() => {}} />
    </SubPage>
  );
}
