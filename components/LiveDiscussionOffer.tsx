import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { ReminderPickerModal } from '@/components/ReminderPickerModal';
import { colors } from '@/constants/theme';
import { countdownParts, localDiscussionLabel, nextDiscussionDate, type LiveDiscussion } from '@/lib/liveDiscussion';
import { scheduleDiscussionReminder } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export function LiveDiscussionOffer() {
  const [discussion, setDiscussion] = useState<LiveDiscussion | null>(null);
  const [now, setNow] = useState(new Date());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setFocused(true);
    setNow(new Date());
    void supabase.from('live_discussions').select('*').eq('active', true).limit(1).maybeSingle().then(({ data }) => {
      if (active && data) setDiscussion(data as LiveDiscussion);
    });
    return () => {
      active = false;
      setFocused(false);
    };
  }, []));

  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [focused]);

  const next = useMemo(() => discussion ? nextDiscussionDate(discussion, now) : null, [discussion, now]);
  const countdown = useMemo(() => next ? countdownParts(next, now) : null, [next, now]);

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
    <>
      <Card>
        <Eyebrow>WEEKLY ZOOM CALL</Eyebrow>
        {discussion && next && countdown ? (
          <>
            <Text style={styles.title}>{localDiscussionLabel(next)}</Text>
            <Text style={styles.note}>Shown in your local time zone</Text>
            <View style={styles.countdown}>
              {[['DAYS', countdown.days], ['HRS', countdown.hours], ['MIN', countdown.minutes], ['SEC', countdown.seconds]].map(([label, value]) => (
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
          </>
        ) : <Text style={styles.loading}>Loading the next live discussion…</Text>}
      </Card>
      <ReminderPickerModal visible={reminderOpen} onRequestClose={() => setReminderOpen(false)} onSelect={remind} />
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  countdown: { flexDirection: 'row', gap: 8, marginVertical: 18 },
  timeBox: { flex: 1, backgroundColor: colors.panel2, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  timeNum: { color: colors.gold, fontSize: 24, fontWeight: '900' },
  timeLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '800' },
  buttons: { gap: 10 },
  loading: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
});
