import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { colors } from '@/constants/theme';
import { GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { bibleGatewayUrl, chronologicalBiblePlan, chronologicalReadings, expandReadingChapters, type ChronologicalReading } from '@/data/chronologicalBiblePlan';
import { loadChronologicalProgress, saveChronologicalProgress, type ChronologicalProgress } from '@/lib/chronologicalProgress';

export default function ChronologicalPlanScreen() {
  const { session } = useAuth();
  const pathname = usePathname();
  const [progress, setProgress] = useState<ChronologicalProgress>({ completed: [], lastIndex: 0 });
  const [ready, setReady] = useState(false);
  const [expandedReadingId, setExpandedReadingId] = useState<number | null>(null);
  const isMainBibleTab = pathname === '/bible';

  const load = useCallback(async () => {
    setReady(false);
    setProgress(await loadChronologicalProgress(session?.user.id));
    setReady(true);
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const completedSet = useMemo(() => new Set(progress.completed), [progress.completed]);
  const percent = Math.round((completedSet.size / chronologicalReadings.length) * 100);
  const next = chronologicalReadings.find((r) => !completedSet.has(r.id)) ?? chronologicalReadings[chronologicalReadings.length - 1];

  async function toggle(reading: ChronologicalReading) {
    const completed = completedSet.has(reading.id)
      ? progress.completed.filter((id) => id !== reading.id)
      : [...progress.completed, reading.id];
    const nextProgress = { completed, lastIndex: reading.id };
    setProgress(nextProgress);
    await saveChronologicalProgress(nextProgress, session?.user.id);
  }

  async function openReading(reading: ChronologicalReading) {
    const nextProgress = { ...progress, lastIndex: reading.id };
    setProgress(nextProgress);
    setExpandedReadingId((current) => current === reading.id ? null : reading.id);
    await saveChronologicalProgress(nextProgress, session?.user.id);
  }

  if (!ready) return <View style={styles.center}><Text style={styles.muted}>Loading your reading place…</Text></View>;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        {!isMainBibleTab ? <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable> : null}
        <Text style={styles.title}>Bible in Chronological Order</Text>
        <Text style={styles.subtitle}>Follow the biblical story in historical sequence. Your progress is saved.</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
        <Text style={styles.progressText}>{completedSet.size} of {chronologicalReadings.length} readings complete • {percent}%</Text>
        <View style={styles.continueCard}>
          <Text style={styles.eyebrow}>CONTINUE READING</Text>
          <Text style={styles.continueRef}>{next.reference}</Text>
          <GoldButton title="Show Next Reading" onPress={() => openReading(next)} />
        </View>
      </View>

      <SectionList
        sections={chronologicalBiblePlan.map((s) => ({ title: s.title, data: s.readings }))}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const done = completedSet.has(item.id);
          const expanded = expandedReadingId === item.id;
          const chapters = expanded ? expandReadingChapters(item.reference) : [];
          return (
            <View style={[styles.reading, done && styles.readingDone]}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => toggle(item)} style={[styles.check, done && styles.checkDone]}>
                <Text style={styles.checkText}>{done ? '✓' : ''}</Text>
              </Pressable>
              <View style={styles.readingCopy}>
                <Pressable onPress={() => openReading(item)}>
                  <Text style={[styles.reference, done && styles.referenceDone]}>{item.reference}</Text>
                  <Text style={styles.readLink}>{expanded ? 'Hide chapters ↑' : 'Show chapters ↓'}</Text>
                </Pressable>
                {expanded ? <View style={styles.chapterList}>
                  {chapters.map((chapter) => (
                    <Pressable key={chapter} onPress={() => Linking.openURL(bibleGatewayUrl(chapter))} style={styles.chapterButton}>
                      <Text style={styles.chapterText}>{chapter}</Text>
                      <Text style={styles.chapterArrow}>›</Text>
                    </Pressable>
                  ))}
                </View> : null}
              </View>
            </View>
          );
        }}
        ListFooterComponent={<View style={styles.footer}><OutlineButton title="Return to Bible Guides" onPress={() => router.replace('/(tabs)/journey')} /></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.charcoal},
  header:{paddingHorizontal:20,paddingTop:52,paddingBottom:18},back:{color:colors.gold,fontWeight:'800',fontSize:16,marginBottom:14},title:{color:colors.text,fontSize:30,fontWeight:'900',lineHeight:36},subtitle:{color:colors.muted,fontSize:14,lineHeight:21,marginTop:7},
  progressTrack:{height:8,borderRadius:8,backgroundColor:colors.panel2,overflow:'hidden',marginTop:18},progressFill:{height:'100%',backgroundColor:colors.gold},progressText:{color:colors.ivory,fontSize:12,fontWeight:'700',marginTop:8},
  continueCard:{backgroundColor:colors.plum,borderWidth:1,borderColor:colors.border,borderRadius:20,padding:18,marginTop:18},eyebrow:{color:colors.gold,fontSize:10,fontWeight:'900',letterSpacing:1.8,marginBottom:6},continueRef:{color:colors.text,fontSize:18,fontWeight:'800',lineHeight:24,marginBottom:14},
  list:{paddingHorizontal:20,paddingBottom:40},sectionTitle:{color:colors.gold,fontSize:18,fontWeight:'900',marginTop:22,marginBottom:10,lineHeight:24},reading:{flexDirection:'row',gap:12,alignItems:'flex-start',padding:14,borderRadius:16,backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,marginBottom:9},readingDone:{opacity:.72},check:{width:28,height:28,borderRadius:9,borderWidth:1,borderColor:colors.gold,alignItems:'center',justifyContent:'center',marginTop:1},checkDone:{backgroundColor:colors.gold},checkText:{color:colors.charcoal,fontWeight:'900'},readingCopy:{flex:1},reference:{color:colors.text,fontSize:15,fontWeight:'800',lineHeight:21},referenceDone:{textDecorationLine:'line-through',color:colors.muted},readLink:{color:colors.gold,fontSize:12,fontWeight:'800',marginTop:6},chapterList:{gap:8,marginTop:12},chapterButton:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:colors.panel2,borderRadius:12,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:colors.border},chapterText:{color:colors.ivory,fontSize:14,fontWeight:'800'},chapterArrow:{color:colors.gold,fontSize:24,lineHeight:24},footer:{paddingTop:24},muted:{color:colors.muted}
});
