import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { getBibleGuideSet, guideNumberFromUrl, guideUrl } from '@/data/bibleGuides';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getGuestGuideProgress, saveGuestGuideProgress } from '@/lib/localStore';

export default function GuideReaderScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ set?: string }>();
  const guideSet = useMemo(() => getBibleGuideSet(params.set), [params.set]);
  const { session, guest } = useAuth();
  const [url, setUrl] = useState(guideUrl(guideSet));
  const [savedPercent, setSavedPercent] = useState(0);
  const [ready, setReady] = useState(false);
  const lastSaved = useRef(0);

  useEffect(() => {
    (async () => {
      if (session) {
        const result = await supabase.from('guide_progress').select('lesson_id,progress_percent').eq('guide_id', guideSet.id).maybeSingle();
        if (result.data?.lesson_id) setUrl(guideUrl(guideSet, guideNumberFromUrl(guideSet, result.data.lesson_id)));
        setSavedPercent(result.data?.progress_percent ?? 0);
      } else if (guest) {
        const progress = await getGuestGuideProgress(guideSet.id);
        if (progress?.lessonUrl) setUrl(guideUrl(guideSet, guideNumberFromUrl(guideSet, progress.lessonUrl)));
        setSavedPercent(progress?.progressPercent ?? 0);
      }
      setReady(true);
    })();
  }, [guest, guideSet, session]);

  async function persist(nextUrl: string, percent: number, force = false) {
    if (!nextUrl.toLowerCase().includes(`/${guideSet.path}/guide`)) return;
    if (!force && Date.now() - lastSaved.current < 1200) return;
    lastSaved.current = Date.now();
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    const lessonNumber = guideNumberFromUrl(guideSet, nextUrl);
    const lessonStartUrl = guideUrl(guideSet, lessonNumber);
    if (session) {
      const { error } = await supabase.from('guide_progress').upsert({ user_id: session.user.id, guide_id: guideSet.id, lesson_id: lessonStartUrl, progress_percent: bounded, completed: lessonNumber === guideSet.guideCount && bounded >= 99, updated_at: new Date().toISOString() }, { onConflict: 'user_id,guide_id' });
      if (error) console.warn(error.message);
    } else if (guest) {
      await saveGuestGuideProgress(guideSet.id, { lessonUrl: lessonStartUrl, progressPercent: bounded, updatedAt: new Date().toISOString() });
    }
  }

  if (!ready) return <View style={styles.center}><Text style={styles.text}>Opening your saved place…</Text></View>;

  return <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹ Bible Guides</Text></Pressable>
      <View style={styles.headerCopy}><Text style={styles.title}>{guideSet.title}</Text><Text style={styles.guideNumber}>Guide {guideNumberFromUrl(guideSet, url)} of {guideSet.guideCount}</Text></View>
    </View>
    <WebView
      source={{ uri: url }}
      style={styles.web}
      onNavigationStateChange={(navigation) => {
        const changedLesson = guideNumberFromUrl(guideSet, navigation.url) !== guideNumberFromUrl(guideSet, url);
        if (changedLesson) setSavedPercent(0);
        setUrl(navigation.url);
        persist(navigation.url, changedLesson ? 0 : savedPercent, changedLesson);
      }}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        persist(url, (contentOffset.y / Math.max(1, contentSize.height - layoutMeasurement.height)) * 100);
      }}
      onError={() => Alert.alert('Guide unavailable', 'Check your internet connection and try again.')}
    />
  </View>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},header:{paddingHorizontal:18,paddingBottom:12},backButton:{alignSelf:'flex-start',minHeight:44,justifyContent:'center',marginBottom:4},back:{color:colors.gold,fontSize:15,fontWeight:'900'},headerCopy:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:12},title:{color:colors.text,fontSize:22,fontWeight:'900',flex:1},guideNumber:{color:colors.muted,fontSize:12,fontWeight:'800'},web:{flex:1,backgroundColor:colors.ivory},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.charcoal},text:{color:colors.ivory},
});
