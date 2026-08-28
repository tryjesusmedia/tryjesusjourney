import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { WHATSAPP_GROUP_URL } from '@/constants/links';
import { supabase } from '@/lib/supabase';

const ACCOUNT_DELETION_URL = 'https://tryjesusmedia.com/account-deletion/';

export default function MoreScreen() {
  const { session, guest, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  async function exit() {
    await signOut();
    router.replace('/login');
  }

  async function deleteAccount() {
    if (!session || deleting) return;
    setDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: true },
      });
      if (error) throw error;
      if (!data?.deleted) throw new Error('The deletion service did not confirm completion.');

      await signOut();
      Alert.alert(
        'Account deleted',
        'Your Try Jesus account and its associated app data have been permanently deleted.',
        [{ text: 'Done', onPress: () => router.replace('/login') }],
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
      'This permanently deletes your account, synced progress, Prayer Journal, Pastor Kal chat history, principles, cross-references, and discussion activity. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Final confirmation',
            'Delete your Try Jesus account and all associated app data permanently?',
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
    <Card style={styles.whatsappCard}><Text style={styles.cardTitle}>WhatsApp Group</Text><Text style={styles.body}>Ask questions, share what&apos;s on your heart, and keep the conversation going with the Try Jesus Media family.</Text><GoldButton title="Join the WhatsApp Group" onPress={() => Linking.openURL(WHATSAPP_GROUP_URL)} /></Card>
    <Card><Text style={styles.cardTitle}>Account</Text><Text style={styles.body}>{session ? `Signed in as ${session.user.email ?? 'member'}. Your progress and Prayer Journal can sync across devices.` : 'Guest mode keeps progress on this device. Sign in with Google later to enable cross-device sync.'}</Text>{guest ? <GoldButton title="Sign In to Sync My Journey" onPress={() => router.replace('/login')} /> : null}<OutlineButton title={session ? 'Sign Out' : 'Exit Guest Mode'} onPress={exit} />{session ? <><Text style={styles.deletionNote}>Deleting your account permanently removes the account and its associated app data.</Text><OutlineButton title={deleting ? 'Deleting Account…' : 'Delete My Account and Data'} disabled={deleting} onPress={confirmDeletion} /><Text style={styles.deletionHelp} onPress={() => Linking.openURL(ACCOUNT_DELETION_URL)}>Account deletion help</Text></> : null}</Card>
    <Card><Text style={styles.cardTitle}>Try Jesus Media Store</Text><Text style={styles.body}>Explore programs, resources, apparel, and ministry merchandise.</Text><OutlineButton title="Fourthwall Store" onPress={() => Linking.openURL('https://try-jesus-new-york-shop.fourthwall.com/')} /></Card>
    <Card><Text style={styles.cardTitle}>Questions & Privacy</Text><Text style={styles.body}>Question submissions and ministry support can be sent to info@tryjesusmedia.com. Private Prayer Journal entries are visible only through the signed-in user&apos;s row-level security policies.</Text><OutlineButton title="Email Try Jesus Media" onPress={() => Linking.openURL('mailto:info@tryjesusmedia.com')} /></Card>
    <Card><Text style={styles.cardTitle}>Members</Text><Text style={styles.body}>Open the Try Jesus Media members welcome page.</Text><GoldButton title="Open Members Page" onPress={() => Linking.openURL('https://tryjesusmedia.com/welcome/')} /></Card>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { padding: 20, paddingTop: 52, gap: 14, paddingBottom: 100 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 8 },
  whatsappCard: { backgroundColor: colors.panel2 },
  cardTitle: { color: colors.gold, fontSize: 18, fontWeight: '900', marginBottom: 9 },
  body: { color: colors.ivory, lineHeight: 22, marginBottom: 16 },
  deletionNote: { color: '#ffb9b3', fontSize: 12, lineHeight: 18, marginTop: 18, marginBottom: 10 },
  deletionHelp: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: 14, textAlign: 'center', textDecorationLine: 'underline' },
});
