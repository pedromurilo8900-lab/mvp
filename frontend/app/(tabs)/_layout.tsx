import { Tabs, useRouter } from "expo-router";
import { CalendarDays, Home, LineChart, Pill, User } from "lucide-react-native";
import { useEffect } from "react";

import { useAuth } from "@/src/auth";
import { font, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login");
  }, [user, loading, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Início", tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendário", tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} /> }} />
      <Tabs.Screen name="medications" options={{ title: "Medicamentos", tabBarIcon: ({ color, size }) => <Pill size={size} color={color} /> }} />
      <Tabs.Screen name="evolution" options={{ title: "Evolução", tabBarIcon: ({ color, size }) => <LineChart size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tabs>
  );
}
