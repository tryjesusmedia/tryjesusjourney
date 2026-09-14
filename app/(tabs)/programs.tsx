import React from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Eyebrow, GoldButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { BIBLE_DECODED_URL } from '@/constants/links';

export default function BibleDecodedScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Eyebrow>FEATURED PROGRAM</Eyebrow>
      <Text style={styles.title}>Bible Decoded</Text>
      <Card style={styles.card}>
        <Text style={styles.offer}>Discounted from $97 to $37 for only the next 100 customers.</Text>
        <Text style={styles.body}>What if the Bible contains layers of meaning you&apos;ve never noticed before? Discover simple study techniques that can help Scripture come alive, reveal powerful connections, and turn ordinary Bible reading into an eye-opening journey of discovery.</Text>
        <GoldButton title="Open Bible Decoded" onPress={() => Linking.openURL(BIBLE_DECODED_URL)} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { padding: 20, paddingTop: 52, paddingBottom: 110 },
  title: { color: colors.text, fontSize: 32, lineHeight: 39, fontWeight: '900', marginBottom: 18 },
  card: { backgroundColor: colors.panel2, borderColor: colors.gold, padding: 22 },
  offer: { color: colors.gold, fontSize: 23, lineHeight: 30, fontWeight: '900', marginBottom: 14 },
  body: { color: colors.ivory, fontSize: 16, lineHeight: 25, marginBottom: 20 },
});
