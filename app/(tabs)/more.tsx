import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { TRY_JESUS_MEDIA_STORE_URL, WHATSAPP_GROUP_URL } from '@/constants/links';
import { supabase } from '@/lib/supabase';
import { prepareChronologicalDetach } from '@/lib/chronologicalDetach';
import { preserveLegacyCloudData } from '@/lib/legacyCloudData';
import { LiveDiscussionOffer } from '@/components/LiveDiscussionOffer';
import { YouTubeOffer } from '@/components/YouTubeOffer';

const ACCOUNT_DELETION_URL = 'https://tryjesusmedia.com/account-deletion/';
const PRIVACY_URL = 'https://tryjesusmedia.com/privacy.html';

export default function MoreScreen() {
  const { session, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

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
        [{ text: 'Done', onPress: () => router.replace('/(tabs)/home') }],
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

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Eyebrow>TRY JESUS MEDIA</Eyebrow><Text style={styles.title}>Your journey, your pace.</Text>
    <YouTubeOffer />
    <LiveDiscussionOffer />
    <Card style={styles.whatsappCard}><Text style={styles.cardTitle}>WhatsApp Group</Text><Text style={styles.body}>Ask questions, share what&apos;s on your heart, and keep the conversation going with the Try Jesus Media family.</Text><GoldButton title="Join the WhatsApp Group" onPress={() => Linking.openURL(WHATSAPP_GROUP_URL)} /></Card>
    <Card style={styles.askCard}><Text style={styles.cardTitle}>Ask Pastor Kal AI</Text><Text style={styles.body}>Ask Bible questions privately and receive thoughtful, Christ-centered guidance from the Pastor Kal AI chatbot.</Text><GoldButton title="Ask Pastor Kal" onPress={() => router.push('/(tabs)/ask')} /></Card>
    <Card><Text style={styles.cardTitle}>Try Jesus Media Store</Text><Text style={styles.body}>Explore programs, resources, apparel, and ministry merchandise.</Text><OutlineButton title="Open the Store" onPress={() => Linking.openURL(TRY_JESUS_MEDIA_STORE_URL)} /></Card>
    <Card>
      <Text style={styles.cardTitle}>Questions &amp; Privacy</Text>
      <Text style={styles.body}>Question submissions and ministry support can be sent to info@tryjesusmedia.com. Prayer Journal entries and Bible Guide progress stay privately on this phone.</Text>
      <OutlineButton title="Email Try Jesus Media" onPress={() => Linking.openURL('mailto:info@tryjesusmedia.com')} />
      <View style={styles.buttonSpacer} />
      <OutlineButton title="Read Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
      {session ? <><Text style={styles.deletionNote}>You can permanently delete your Google-linked sync account and its online data here. Your latest Chron Bible progress will first be kept on this phone.</Text><OutlineButton title={deleting ? 'Saving Copy and Deleting…' : 'Delete Sync Account and Online Data'} disabled={deleting} onPress={confirmDeletion} /></> : null}
      <Text accessibilityRole="link" onPress={() => Linking.openURL(ACCOUNT_DELETION_URL)} style={styles.deletionHelp}>Account deletion help</Text>
    </Card>
    <Card><Text style={styles.cardTitle}>Members</Text><Text style={styles.body}>Open the Try Jesus Media members welcome page.</Text><GoldButton title="Open Members Page" onPress={() => Linking.openURL('https://tryjesusmedia.com/welcome/')} /></Card>
    <Text accessibilityRole="link" onPress={() => Linking.openURL('https://faithcraft.agency/')} style={styles.poweredBy}>Powered by FaithCraft.Agency</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { padding: 20, paddingTop: 52, gap: 14, paddingBottom: 100 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 8 },
  whatsappCard: { backgroundColor: colors.panel2 },
  askCard: { backgroundColor: colors.panel2 },
  cardTitle: { color: colors.gold, fontSize: 18, fontWeight: '900', marginBottom: 9 },
  body: { color: colors.ivory, lineHeight: 22, marginBottom: 16 },
  deletionNote: { color: '#ffb9b3', fontSize: 12, lineHeight: 18, marginTop: 18, marginBottom: 10 },
  deletionHelp: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: 14, textAlign: 'center', textDecorationLine: 'underline' },
  buttonSpacer: { height: 10 },
  poweredBy: { color: colors.gold, fontSize: 13, fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 14 },
});
