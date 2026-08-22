import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '@/constants/theme';
import { router } from 'expo-router';
import { GoldButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getGuestProgress, saveGuestProgress } from '@/lib/localStore';

const START_URL = 'https://tryjesusmedia.com/welcome/';
const GUIDE_ID = 'main-bible-journey';

export default function JourneyScreen() {
  const { session, guest } = useAuth();
  const [url, setUrl] = useState(START_URL);
  const [savedPercent, setSavedPercent] = useState(0);
  const [ready, setReady] = useState(false);
  const lastSaved = useRef(0);
  const webRef = useRef<WebView>(null);
  const restored = useRef(false);

  useEffect(() => {
    (async () => {
      if (session) {
        const r = await supabase.from('guide_progress').select('lesson_id,progress_percent').eq('guide_id', GUIDE_ID).maybeSingle();
        if (r.data?.lesson_id) setUrl(r.data.lesson_id);
        setSavedPercent(r.data?.progress_percent ?? 0);
      } else if (guest) {
        const p = await getGuestProgress();
        if (p?.lessonUrl) setUrl(p.lessonUrl);
        setSavedPercent(p?.progressPercent ?? 0);
      }
      setReady(true);
    })();
  }, [session, guest]);

  async function persist(nextUrl: string, percent: number) {
    if (Date.now() - lastSaved.current < 1200) return;
    lastSaved.current = Date.now();
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    if (session) {
      const { error } = await supabase.from('guide_progress').upsert({
        user_id: session.user.id, guide_id: GUIDE_ID, lesson_id: nextUrl,
        progress_percent: bounded, completed: bounded >= 99, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,guide_id' });
      if (error) console.warn(error.message);
    } else if (guest) {
      await saveGuestProgress({ lessonUrl: nextUrl, progressPercent: bounded, updatedAt: new Date().toISOString() });
    }
  }

  if (!ready) return <View style={styles.center}><Text style={styles.text}>Opening your saved place…</Text></View>;

  return <View style={styles.page}>
    <View style={styles.top}>
      <Text style={styles.title}>Bible Guides</Text><Text style={styles.sub}>Your place is saved as you read.</Text>
      <View style={styles.planCard}>
        <Text style={styles.planEyebrow}>BIBLE IN CHRONOLOGICAL ORDER</Text>
        <Text style={styles.planTitle}>Read the story in the order it unfolded.</Text>
        <Text style={styles.planCopy}>Move from the beginning through Israel, Jesus, the early church, and Revelation with synced progress.</Text>
        <GoldButton title="Open Chronological Plan" onPress={() => router.push('/chronological')} />
      </View>
    </View>
    <WebView
      ref={webRef}
      source={{ uri: url }}
      style={styles.web}
      onNavigationStateChange={(nav) => {
        if (nav.url !== url) { restored.current = false; setSavedPercent(0); }
        setUrl(nav.url);
        persist(nav.url, nav.url === url ? savedPercent : 0);
      }}
      onScroll={(e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        const denominator = Math.max(1, contentSize.height - layoutMeasurement.height);
        const pct = (contentOffset.y / denominator) * 100;
        persist(url, pct);
      }}
      scrollEventThrottle={500}
      onLoadEnd={() => {
        if (!restored.current && savedPercent > 1) {
          restored.current = true;
          const fraction = Math.max(0, Math.min(1, savedPercent / 100));
          webRef.current?.injectJavaScript(`(function(){var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);window.scrollTo(0,Math.max(0,h*${fraction}));true;})();`);
        }
      }}
      onError={() => Alert.alert('Guide unavailable', 'Check your internet connection and try again.')}
    />
  </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.charcoal,paddingTop:48},top:{paddingHorizontal:20,paddingBottom:12},title:{color:colors.text,fontSize:26,fontWeight:'900'},sub:{color:colors.muted,marginTop:3},planCard:{backgroundColor:colors.plum,borderRadius:18,borderWidth:1,borderColor:colors.border,padding:16,marginTop:14},planEyebrow:{color:colors.gold,fontSize:10,fontWeight:'900',letterSpacing:1.5,marginBottom:5},planTitle:{color:colors.text,fontSize:18,fontWeight:'900',marginBottom:5},planCopy:{color:colors.ivory,fontSize:13,lineHeight:19,marginBottom:12},web:{flex:1,backgroundColor:colors.ivory},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.charcoal},text:{color:colors.ivory}});
