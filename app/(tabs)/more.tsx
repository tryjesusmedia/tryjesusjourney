import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { TRY_JESUS_MEDIA_STORE_URL, WHATSAPP_GROUP_URL } from '@/constants/links';
import { supabase } from '@/lib/supabase';
import { prepareChronologicalDetach } from '@/lib/chronologicalDetach';
import { preserveLegacyCloudData } from '@/lib/legacyCloudData';


const ACCOUNT_DELETION_URL = 'https://tryjesusmedia.com/account-deletion/';
const PRIVACY_URL = 'https://tryjesusmedia.com/privacy.html';

export default function MoreScreen() {
  const { session, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const insets = useSafeAreaInsets();

  async function deleteAccount() {
    if (!session || deleting) return;
    setDeleting(true);

    try {
      await preserveLegacyCloudData(session.user.id, { requireAll: true });
      await prepareChronologicalDetach(session.user.id, { requireFreshRemoteCopy: true });
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: true },
      });
      if (error) throw error;
      if (!data?.deleted) throw new Error('The deletion service did not confirm completion.');

      await signOut();
      Alert.alert(
        'Account deleted',
        'Your online sync account and its data were permanently deleted. Your Chron Bible progress remains as a local-only copy on this phone.',
        [{ text: 'Done', onPress: () => router.replace('/(tabs)/bible') }],
      );
    } catch (caught) {
      Alert.alert(
        'Could not delete the account',
        caught instanceof Error
          ? caught.message
          : 'Please try again or use the account-deletion page for help.',
      );
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeletion() {
    Alert.alert(
      'Delete your account and data?',
      'First, the latest Chron Bible progress will be saved on this phone. Then this permanently deletes the Google-linked sync account and its online data. The local copy will remain, but the deleted sync account cannot be restored. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Final confirmation',
            'Delete your Google-linked Try Jesus sync account and all associated online data permanently?',
            [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Delete permanently', style: 'destructive', onPress: deleteAccount },
            ],
          ),
        },
      ],
    );
  }

  async function openLink(url: string) {
    try { await Linking.openURL(url); }
    catch { Alert.alert('Could not open this link', 'Please check your connection and try again.'); }
  }

  const perks = [
    { title: 'Bible guides', description: 'Explore questions about Jesus and Bible prophecy.', action: () => router.push('/(tabs)/journey') },
    { title: 'Weekly Zoom discussion', description: 'Thursdays at 8 PM Eastern. Join or set a reminder.', action: () => router.push('/(tabs)/live') },
    { title: 'WhatsApp family', description: 'Ask questions and stay connected during the week.', action: () => openLink(WHATSAPP_GROUP_URL) },
    { title: 'Ask Pastor Kal AI', description: 'Get help with a Bible question from our AI guide.', action: () => router.push('/(tabs)/ask') },
    { title: 'YouTube', description: 'Bible conversations and our latest episodes.', action: () => router.push('/(tabs)/videos') },
    { title: 'Prayer journal', description: 'Keep your prayers and reflections on this phone.', action: () => router.push('/(tabs)/journal') },
    { title: 'Talk with a pastor', description: 'Book a free personal conversation.', action: () => openLink('https://calendly.com/kalroller/tryjesusmedia') },
    { title: 'Try Jesus Media store', description: 'Browse faith resources, clothing, and gifts.', action: () => openLink(TRY_JESUS_MEDIA_STORE_URL) },
  ];

  return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}>
    <Eyebrow>MORE FROM TRY JESUS MEDIA</Eyebrow>
    <Text style={styles.title}>Additional perks</Text>
    <Text style={styles.subtitle}>Find guidance, encouragement, and community.</Text>
    <View style={styles.perks}>
      {perks.map((perk) => <Pressable key={perk.title} accessibilityRole="button" onPress={perk.action} style={({ pressed }) => [styles.perk, pressed && styles.pressed]}>
        <View style={styles.perkCopy}><Text style={styles.cardTitle}>{perk.title}</Text><Text style={styles.body}>{perk.description}</Text></View>
        <Text style={styles.chevron} accessibilityElementsHidden>›</Text>
      </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: accountOpen }} onPress={() => setAccountOpen(!accountOpen)} style={styles.accountToggle}>
      <Text style={styles.accountTitle}>Account &amp; help</Text><Text style={styles.chevron}>{accountOpen ? '−' : '+'}</Text>
    </Pressable>
    {accountOpen ? <Card style={styles.accountCard}>
      <OutlineButton title="Email Try Jesus Media" onPress={() => openLink('mailto:info@tryjesusmedia.com')} />
      <OutlineButton title="Privacy policy" onPress={() => openLink(PRIVACY_URL)} />
      <OutlineButton title="Members page" onPress={() => openLink('https://tryjesusmedia.com/welcome/')} />
      {session ? <><Text style={styles.deletionNote}>Delete your online sync account and its data. A copy of your ChronBible progress will stay on this phone.</Text><OutlineButton title={deleting ? 'Saving copy and deleting…' : 'Delete sync account and online data'} disabled={deleting} onPress={confirmDeletion} /></> : null}
      <Text accessibilityRole="link" onPress={() => openLink(ACCOUNT_DELETION_URL)} style={styles.deletionHelp}>Account deletion help</Text>
    </Card> : null}
    <Text accessibilityRole="link" onPress={() => openLink('https://faithcraft.agency/')} style={styles.poweredBy}>Powered by FaithCraft.Agency</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { padding: 24, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 32, lineHeight: 39, fontWeight: '800', marginBottom: 12 },
  subtitle: { color: colors.muted, fontSize: 18, lineHeight: 27, marginBottom: 28 },
  perks: { borderTopWidth: 1, borderTopColor: colors.border },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: colors.border },
  perkCopy: { flex: 1 },
  cardTitle: { color: colors.ivory, fontSize: 20, lineHeight: 27, fontWeight: '700', marginBottom: 5 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  chevron: { color: colors.gold, fontSize: 26 },
  pressed: { opacity: 0.65 },
  accountToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24, gap: 16 },
  accountTitle: { color: colors.ivory, fontSize: 18, fontWeight: '700' },
  accountCard: { gap: 14 },
  deletionNote: { color: '#ffb9b3', fontSize: 15, lineHeight: 23, marginTop: 10 },
  deletionHelp: { color: colors.gold, fontSize: 16, paddingVertical: 12, textDecorationLine: 'underline' },
  poweredBy: { color: colors.muted, fontSize: 14, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 24 },
});
