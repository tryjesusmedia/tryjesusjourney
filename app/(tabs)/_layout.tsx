import React from 'react';
import { Tabs } from 'expo-router';
import { Linking, Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { BIBLE_DECODED_URL } from '@/constants/links';

const Icon = ({ label, color }: { label: string; color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{label}</Text>;

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.gold,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        backgroundColor: '#191419',
        borderTopColor: colors.border,
        height: 70 + bottom,
        paddingBottom: 10 + bottom,
        paddingTop: 8,
      },
      tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({color}) => <Icon label="✦" color={color} /> }} />
      <Tabs.Screen name="bible" options={{ title: 'Bible', tabBarIcon: ({color}) => <Icon label="▣" color={color} /> }} />
      <Tabs.Screen
        name="programs"
        options={{ title: 'Bible Decoded', tabBarIcon: ({color}) => <Icon label="◇" color={color} /> }}
        listeners={{ tabPress: (event) => { event.preventDefault(); void Linking.openURL(BIBLE_DECODED_URL); } }}
      />
      <Tabs.Screen name="journey" options={{ title: 'Guides', tabBarIcon: ({color}) => <Icon label="☷" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({color}) => <Icon label="•••" color={color} /> }} />
      <Tabs.Screen name="ask" options={{ href: null }} />
      <Tabs.Screen name="live" options={{ href: null }} />
      <Tabs.Screen name="videos" options={{ href: null }} />
      <Tabs.Screen name="journal" options={{ href: null }} />
    </Tabs>
  );
}
