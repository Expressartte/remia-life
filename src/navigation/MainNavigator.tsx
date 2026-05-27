import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import MorningStackNavigator from './MorningStackNavigator';
import JournalStackNavigator from './JournalStackNavigator';
import InsightsScreen from '../screens/insights/InsightsScreen';
import NightScreen from '../screens/night/NightScreen';

import { Colors, FontSize, FontWeight, MIN_TOUCH } from '../styles/theme';
import { MainTabParamList } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: keyof MainTabParamList;
  label: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
}

const TAB_CONFIG: TabConfig[] = [
  {
    name: 'Morning',
    label: 'Mañana',
    icon: 'sunny-outline',
    iconActive: 'sunny',
  },
  {
    name: 'Journal',
    label: 'Diario',
    icon: 'book-outline',
    iconActive: 'book',
  },
  {
    name: 'Insights',
    label: 'Insights',
    icon: 'stats-chart-outline',
    iconActive: 'stats-chart',
  },
  {
    name: 'Night',
    label: 'Noche',
    icon: 'moon-outline',
    iconActive: 'moon',
  },
];

function TabIcon({
  icon,
  iconActive,
  focused,
  color,
}: {
  icon: IoniconsName;
  iconActive: IoniconsName;
  focused: boolean;
  color: string;
}) {
  return (
    <View style={styles.iconWrapper}>
      {focused && <View style={styles.iconGlow} />}
      <Ionicons
        name={focused ? iconActive : icon}
        size={22}
        color={color}
      />
    </View>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      {TAB_CONFIG.map(({ name, label, icon, iconActive }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={
            name === 'Morning'
              ? MorningStackNavigator
              : name === 'Journal'
              ? JournalStackNavigator
              : name === 'Insights'
              ? InsightsScreen
              : NightScreen
          }
          options={{
            tabBarLabel: ({ color }) => (
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>{label}</Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icon}
                iconActive={iconActive}
                focused={focused}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    // Web necesita más altura para que el label no quede cortado
    height: Platform.OS === 'ios' ? 84 : Platform.OS === 'web' ? 64 : 68,
    paddingTop: Platform.OS === 'web' ? 6 : 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : Platform.OS === 'web' ? 8 : 12,
  },
  tabItem: {
    minHeight: MIN_TOUCH,
    // En web aseguramos que el contenido no se corte
    ...(Platform.OS === 'web' ? { overflow: 'visible' } : {}),
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
    // En web evitar truncado
    ...(Platform.OS === 'web' ? { lineHeight: 14, paddingBottom: 2 } : {}),
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  iconGlow: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryDim,
  },
});
