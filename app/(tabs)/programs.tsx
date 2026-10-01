import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eyebrow, GoldButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { BIBLE_DECODED_URL } from '@/constants/links';

export default function BibleDecodedScreen() {
  const insets = useSafeAreaInsets();
  async function openProgram() {
    try { await Linking.openURL(BIBLE_DECODED_URL); }
    catch { Alert.alert('Could not open Bible Decoded', 'Please check your connection and try again.'); }
  }
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}>
      <Eyebrow>UNDERSTAND WHAT YOU READ</Eyebrow>
      <Text style={styles.title}>Bible Decoded</Text>
      <Text style={styles.lead}>Open your Bible.{ '\n' }Discover more.</Text>
      <Text style={styles.body}>Learn simple ways to understand Scripture with six guided lessons from Pastor Kal—the real human.</Text>
      <GoldButton title="Explore Bible Decoded" onPress={openProgram} />
      <Text style={styles.note}>Optional paid program. View current pricing or sign in to your course on our website.</Text>
      <View style={styles.includes}>
        <Text style={styles.sectionTitle}>A little guidance. A deeper understanding.</Text>
        {['Six video lessons at your pace', 'Workbooks to put learning into practice', 'A personal Study Lab to keep using'].map((text) => <View key={text} style={styles.benefit}><Text style={styles.check}>✓</Text><Text style={styles.benefitText}>{text}</Text></View>)}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { padding: 24, paddingBottom: 36 },
  title: { color: colors.gold, fontSize: 20, fontWeight: '700', marginBottom: 28 },
  lead: { color: colors.text, fontSize: 36, lineHeight: 43, fontWeight: '800', marginBottom: 20 },
  body: { color: colors.ivory, fontSize: 19, lineHeight: 29, marginBottom: 28 },
  note: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 14 },
  includes: { marginTop: 36, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 28, gap: 18 },
  sectionTitle: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: '700', marginBottom: 4 },
  benefit: { flexDirection: 'row', gap: 14 }, check: { color: colors.gold, fontSize: 20 },
  benefitText: { flex: 1, color: colors.ivory, fontSize: 18, lineHeight: 27 },
});
