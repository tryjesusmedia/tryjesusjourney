import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { ReminderPickerModal } from '@/components/ReminderPickerModal';
import { colors } from '@/constants/theme';
import { WHATSAPP_GROUP_URL } from '@/constants/links';
import { countdownParts, localDiscussionLabel, nextDiscussionDate, type LiveDiscussion } from '@/lib/liveDiscussion';
import { scheduleDiscussionReminder } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export default function LiveScreen() {
  const [discussion, setDiscussion] = useState<LiveDiscussion | null>(null);
  const [now, setNow] = useState(new Date());
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    supabase.from('live_discussions').select('*').eq('active', true).limit(1).maybeSingle().then(({ data }) => data && setDiscussion(data));
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const next = useMemo(() => discussion ? nextDiscussionDate(discussion, now) : null, [discussion, now]);
  const cd = useMemo(() => next ? countdownParts(next, now) : null, [next, now]);

  async function remind(minutes: number) {
    setReminderOpen(false);
    if (!next) return;
    try {
      await scheduleDiscussionReminder(next, minutes);
      Alert.alert('Reminder set', 'Your phone will remind you before the next live discussion.');
    } catch (caught) {
      Alert.alert('Could not set reminder', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {discussion && next && cd ? (
        <Card>
          <Eyebrow>NEXT LIVE DISCUSSION</Eyebrow>
          <Text style={styles.title}>{localDiscussionLabel(next)}</Text>
          <Text style={styles.note}>Shown in your local time zone</Text>
          <View style={styles.countdown}>
            {[['DAYS', cd.days], ['HRS', cd.hours], ['MIN', cd.minutes], ['SEC', cd.seconds]].map(([label, value]) => (
              <View key={String(label)} style={styles.timeBox}>
                <Text style={styles.timeNum}>{String(value).padStart(2, '0')}</Text>
                <Text style={styles.timeLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.buttons}>
            <GoldButton title="Enter Zoom Call Here" onPress={() => Linking.openURL(discussion.zoom_url)} />
            <OutlineButton title="Remind Me" onPress={() => setReminderOpen(true)} />
          </View>
        </Card>
      ) : <Text style={styles.loading}>Loading the next discussion…</Text>}
      <Card style={styles.whatsappCard}>
        <Eyebrow>FELLOWSHIP BETWEEN LIVE DISCUSSIONS</Eyebrow>
        <Text style={styles.invitationTitle}>Join the Try Jesus Media WhatsApp group</Text>
        <Text style={styles.invitationBody}>Fellowship with others in this community, ask Bible questions, request prayer, share insights, and keep the conversation going between our live Zoom discussions.</Text>
        <GoldButton title="Join the WhatsApp Group" onPress={() => Linking.openURL(WHATSAPP_GROUP_URL)} />
      </Card>
      <ReminderPickerModal visible={reminderOpen} onRequestClose={() => setReminderOpen(false)} onSelect={remind} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.charcoal },
  content: { padding: 20, paddingTop: 52, paddingBottom: 110, gap: 18 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', lineHeight: 31 },
  note: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  countdown: { flexDirection: 'row', gap: 8, marginVertical: 18 },
  timeBox: { flex: 1, backgroundColor: colors.panel2, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  timeNum: { color: colors.gold, fontSize: 24, fontWeight: '900' },
  timeLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '800' },
  buttons: { gap: 10 },
  whatsappCard: { backgroundColor: colors.panel2, borderColor: colors.gold },
  invitationTitle: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: '900', marginBottom: 9 },
  invitationBody: { color: colors.ivory, fontSize: 16, lineHeight: 24, marginBottom: 17 },
  loading: { color: colors.muted },
});
