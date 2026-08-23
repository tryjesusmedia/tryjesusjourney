import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton } from '@/components/ui';
import { bibleGuideSets, guideNumberFromUrl, guideSetProgress, type BibleGuideSetId } from '@/data/bibleGuides';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getGuestGuideProgress, type GuestProgress } from '@/lib/localStore';

type SavedGuideProgress = GuestProgress & { guideId: BibleGuideSetId };

export default function JourneyScreen() {
  const { session, guest } = useAuth();
  const [saved, setSaved] = useState<Partial<Record<BibleGuideSetId, SavedGuideProgress>>>({});
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    setReady(false);
    const next: Partial<Record<BibleGuideSetId, SavedGuideProgress>> = {};

    if (session) {
      const result = await supabase.from('guide_progress').select('guide_id,lesson_id,progress_percent,updated_at').in('guide_id', bibleGuideSets.map((guideSet) => guideSet.id));
      for (const row of result.data ?? []) {
        const guideId = row.guide_id as BibleGuideSetId;
        next[guideId] = { guideId, lessonUrl: row.lesson_id, progressPercent: row.progress_percent ?? 0, updatedAt: row.updated_at };
      }
    } else if (guest) {
      const guestProgress = await Promise.all(bibleGuideSets.map(async (guideSet) => ({ guideSet, progress: await getGuestGuideProgress(guideSet.id) })));
      for (const { guideSet, progress } of guestProgress) {
        if (progress) next[guideSet.id] = { ...progress, guideId: guideSet.id };
      }
    }

    setSaved(next);
    setReady(true);
  }, [guest, session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cards = useMemo(() => bibleGuideSets.map((guideSet) => {
    const progress = saved[guideSet.id];
    return { guideSet, progress, percent: guideSetProgress(guideSet, progress?.lessonUrl, progress?.progressPercent), guideNumber: guideNumberFromUrl(guideSet, progress?.lessonUrl) };
  }), [saved]);

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Bible Guides</Text>
    <Text style={styles.subtitle}>Choose one of your two guide journeys. Your progress is saved separately for each set.</Text>

    {cards.map(({ guideSet, progress, percent, guideNumber }) => <Card key={guideSet.id} style={styles.card}>
      <Eyebrow>{guideSet.eyebrow}</Eyebrow>
      <Text style={styles.cardTitle}>{guideSet.title}</Text>
      <Text style={styles.body}>{guideSet.description}</Text>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{ready ? `${percent}% complete` : 'Loading progress…'}</Text>
        {progress ? <Text style={styles.guideLabel}>Guide {guideNumber} of {guideSet.guideCount}</Text> : null}
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${ready ? percent : 0}%` }]} /></View>
      <GoldButton title={progress ? 'Continue Where I Left Off' : `Begin ${guideSet.title}`} onPress={() => router.push({ pathname: '/guide-reader', params: { set: guideSet.id } })} />
    </Card>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},content:{padding:20,paddingTop:52,paddingBottom:110,gap:16},title:{color:colors.text,fontSize:30,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:14,lineHeight:21,marginBottom:4},card:{backgroundColor:colors.plum,padding:20},cardTitle:{color:colors.text,fontSize:24,fontWeight:'900',lineHeight:30,marginBottom:7},body:{color:colors.ivory,fontSize:14,lineHeight:21,marginBottom:16},progressRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:7},progressLabel:{color:colors.gold,fontSize:12,fontWeight:'900'},guideLabel:{color:colors.muted,fontSize:12,fontWeight:'700'},progressTrack:{height:8,borderRadius:8,backgroundColor:colors.panel2,overflow:'hidden',marginBottom:18},progressFill:{height:'100%',backgroundColor:colors.gold},
});
