import React from 'react';
import { router, Tabs } from 'expo-router';
import { Pressable, Text, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

const Icon = ({ label, color }: { label: string; color: ColorValue }) => <Text accessibilityElementsHidden style={{ color, fontSize: 22 }}>{label}</Text>;
const BackToMore = () => <Pressable accessibilityRole="button" accessibilityLabel="Back to More" onPress={() => router.navigate('/(tabs)/more')} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, width: 76 }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: colors.gold, fontSize: 14 }}>‹ More</Text></Pressable>;

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const label = (title: string, color: ColorValue) => <Text style={{ color, fontWeight: '700', fontSize: 13, lineHeight: 17, textAlign: 'center', paddingHorizontal: 3 }}>{title}</Text>;
  const detailOptions = (title: string) => ({ href: null, title, headerShown: true, headerLeft: BackToMore, headerTitle: () => <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{title}</Text> });

  return (
    <Tabs initialRouteName="bible" backBehavior="history" screenOptions={{
      headerShown: false,
      headerStyle: { backgroundColor: colors.charcoal },
      headerTintColor: colors.text,
      headerShadowVisible: false,
      tabBarActiveTintColor: colors.gold,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        backgroundColor: '#191419', borderTopColor: colors.border,
        height: 82 + bottom + Math.max(0, fontScale - 1) * 36,
        paddingBottom: 10 + bottom, paddingTop: 8,
      },
      tabBarLabelPosition: 'below-icon',
    }}>
      <Tabs.Screen name="bible" options={{ title: 'Chronological Bible', tabBarLabel: ({ color }) => label('Chronological\nBible', color), tabBarIcon: ({ color }) => <Icon label="▣" color={color} /> }} />
      <Tabs.Screen name="programs" options={{ title: 'Bible Decoded', tabBarLabel: ({ color }) => label('Bible\nDecoded', color), tabBarIcon: ({ color }) => <Icon label="◇" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarLabel: ({ color }) => label('More', color), tabBarIcon: ({ color }) => <Icon label="•••" color={color} /> }} />
      <Tabs.Screen name="home" options={{ href: null }} />
      <Tabs.Screen name="journey" options={detailOptions('Bible guides')} />
      <Tabs.Screen name="ask" options={detailOptions('Ask Pastor Kal AI')} />
      <Tabs.Screen name="live" options={detailOptions('Weekly Bible discussion')} />
      <Tabs.Screen name="videos" options={detailOptions('YouTube')} />
      <Tabs.Screen name="journal" options={detailOptions('Prayer journal')} />
    </Tabs>
  );
}
