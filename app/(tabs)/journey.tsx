import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton } from '@/components/ui';
import { bibleGuideSets, guideNumberFromUrl, guideSetProgress, type BibleGuideSetId } from '@/data/bibleGuides';
import { getGuestGuideProgress, type GuestProgress } from '@/lib/localStore';

type SavedGuideProgress = GuestProgress & { guideId: BibleGuideSetId };

export default function JourneyScreen() {
  const [saved, setSaved] = useState<Partial<Record<BibleGuideSetId, SavedGuideProgress>>>({});
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<BibleGuideSetId, boolean>>>({});

  const load = useCallback(async () => {
    setReady(false);
    const next: Partial<Record<BibleGuideSetId, SavedGuideProgress>> = {};

    const localProgress = await Promise.all(bibleGuideSets.map(async (guideSet) => ({ guideSet, progress: await getGuestGuideProgress(guideSet.id) })));
    for (const { guideSet, progress } of localProgress) {
      if (progress) next[guideSet.id] = { ...progress, guideId: guideSet.id };
    }

    setSaved(next);
    setReady(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cards = useMemo(() => bibleGuideSets.map((guideSet) => {
    const progress = saved[guideSet.id];
    return { guideSet, progress, percent: guideSetProgress(guideSet, progress?.lessonUrl, progress?.progressPercent), guideNumber: guideNumberFromUrl(guideSet, progress?.lessonUrl) };
  }), [saved]);

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Bible Guides</Text>
    <Text style={styles.subtitle}>Choose one of your two guide journeys. Your progress is saved separately for each set.</Text>

    {cards.map(({ guideSet, progress, percent, guideNumber }) => {
      const open = Boolean(expanded[guideSet.id]);
      const toggle = () => setExpanded((current) => ({ ...current, [guideSet.id]: !current[guideSet.id] }));
      return <Card key={guideSet.id} style={styles.card}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Eyebrow>{guideSet.eyebrow}</Eyebrow>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle}>{guideSet.title}</Text>
          <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
        </View>
        <Text style={styles.body}>{guideSet.description}</Text>
      </Pressable>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{ready ? `${percent}% complete` : 'Loading progress…'}</Text>
        {progress ? <Text style={styles.guideLabel}>Guide {guideNumber} of {guideSet.guideCount}</Text> : null}
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${ready ? percent : 0}%` }]} /></View>
      <GoldButton title={open ? 'Hide Guides' : 'See Guides'} onPress={toggle} />
      {open ? <View style={styles.guideList}>
        {guideSet.guides.map((guide) => (
          <Pressable
            key={guide.number}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/guide-reader', params: { set: guideSet.id, guide: String(guide.number) } })}
            style={({ pressed }) => [styles.guideItem, pressed && styles.guideItemPressed]}
          >
            <View style={styles.guideIndex}><Text style={styles.guideIndexText}>{String(guide.number).padStart(2, '0')}</Text></View>
            <Text style={styles.guideTitle}>{guide.title}</Text>
            <Text style={styles.guideArrow}>›</Text>
          </Pressable>
        ))}
      </View> : null}
    </Card>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},content:{padding:20,paddingTop:52,paddingBottom:110,gap:16},title:{color:colors.text,fontSize:30,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:14,lineHeight:21,marginBottom:4},card:{backgroundColor:colors.plum,padding:20},cardHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},cardTitle:{color:colors.text,fontSize:24,fontWeight:'900',lineHeight:30,marginBottom:7,flex:1},chevron:{color:colors.gold,fontSize:28,fontWeight:'500',lineHeight:30},body:{color:colors.ivory,fontSize:14,lineHeight:21,marginBottom:16},progressRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:7},progressLabel:{color:colors.gold,fontSize:12,fontWeight:'900'},guideLabel:{color:colors.muted,fontSize:12,fontWeight:'700'},progressTrack:{height:8,borderRadius:8,backgroundColor:colors.panel2,overflow:'hidden',marginBottom:18},progressFill:{height:'100%',backgroundColor:colors.gold},guideList:{marginTop:16,gap:9},guideItem:{minHeight:62,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.panel2,borderWidth:1,borderColor:colors.border,borderRadius:14,paddingHorizontal:12,paddingVertical:10},guideItemPressed:{opacity:.75},guideIndex:{width:34,height:34,borderRadius:17,backgroundColor:colors.gold,alignItems:'center',justifyContent:'center'},guideIndexText:{color:colors.charcoal,fontSize:11,fontWeight:'900'},guideTitle:{color:colors.ivory,fontSize:14,lineHeight:19,fontWeight:'800',flex:1},guideArrow:{color:colors.gold,fontSize:27,lineHeight:30},
});
