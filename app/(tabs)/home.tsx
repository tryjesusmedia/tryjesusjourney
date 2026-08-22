import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getGuestProgress } from '@/lib/localStore';
import { countdownParts, nextDiscussionDate, type LiveDiscussion } from '@/lib/liveDiscussion';
import { scheduleDiscussionReminder } from '@/lib/notifications';

type Video = { videoId: string; title: string; thumbnail?: string; channelTitle?: string; watchUrl: string };
type Product = { id: string; name: string; slug: string; images?: {url?: string; transformedUrl?: string}[]; variants?: {unitPrice?: {value?: number; currency?: string}}[]; storefrontUrl: string; pinned?: boolean };

type Progress = { lesson_id?: string | null; progress_percent?: number | null };

export default function HomeScreen() {
  const { session, guest } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [discussion, setDiscussion] = useState<LiveDiscussion | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    const [videoResult, productsResult, discussionResult] = await Promise.all([
      supabase.functions.invoke('random-youtube-video', { body: {} }),
      supabase.functions.invoke('random-fourthwall-products', { body: {} }),
      supabase.from('live_discussions').select('*').eq('active', true).limit(1).maybeSingle(),
    ]);
    if (videoResult.data && !videoResult.error) setVideo(videoResult.data as Video);
    if (productsResult.data?.products && !productsResult.error) setProducts(productsResult.data.products as Product[]);
    if (discussionResult.data) setDiscussion(discussionResult.data as LiveDiscussion);
    if (session) {
      const p = await supabase.from('guide_progress').select('lesson_id,progress_percent').eq('guide_id', 'main-bible-journey').maybeSingle();
      setProgress(p.data ?? null);
    } else if (guest) {
      const p = await getGuestProgress();
      setProgress(p ? { lesson_id: p.lessonUrl, progress_percent: p.progressPercent } : null);
    }
  }, [session, guest]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const next = useMemo(() => discussion ? nextDiscussionDate(discussion, now) : null, [discussion, now]);
  const cd = useMemo(() => next ? countdownParts(next, now) : null, [next, now]);

  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  async function remind(minutes: number) {
    if (!next) return;
    try { await scheduleDiscussionReminder(next, minutes); Alert.alert('Reminder set', 'Your phone will remind you before the next live discussion.'); }
    catch (e) { Alert.alert('Could not set reminder', e instanceof Error ? e.message : 'Please try again.'); }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl tintColor={colors.gold} refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.header}><View><Text style={styles.brand}>TRY JESUS</Text><Text style={styles.media}>THE JOURNEY</Text></View><Image source={require('@/assets/logo.png')} style={styles.mark} /></View>

      <Card style={styles.hero}>
        <Eyebrow>{progress ? 'CONTINUE YOUR JOURNEY' : 'BEGIN YOUR JOURNEY'}</Eyebrow>
        <Text style={styles.heroTitle}>{progress ? 'Pick up where you left off.' : 'Your next discovery is waiting.'}</Text>
        <Text style={styles.body}>{progress ? `${Math.round(progress.progress_percent ?? 0)}% through your current guide. Your place is saved.` : 'Explore the Bible privately, ask honest questions, and follow the evidence wherever it leads.'}</Text>
        <GoldButton title={progress ? 'Continue My Bible Guide' : 'Begin My Bible Guides'} onPress={() => router.push('/(tabs)/journey')} />
      </Card>

      <Card style={styles.askCard}>
        <Eyebrow>ASK WITHOUT EMBARRASSMENT</Eyebrow>
        <Text style={styles.sectionTitle}>Ask Pastor Kal</Text>
        <Text style={styles.body}>Ask a Bible question privately. The AI searches Pastor Kal's approved Try Jesus Media knowledge base and shows the material behind its answer.</Text>
        <GoldButton title="Ask a Bible Question" onPress={() => router.push('/(tabs)/ask')} />
      </Card>

      {discussion && next && cd ? <Card>
        <Eyebrow>NEXT LIVE DISCUSSION</Eyebrow>
        <Text style={styles.sectionTitle}>Thursday • 8:00 PM Eastern</Text>
        <View style={styles.countdown}>
          {[['DAYS', cd.days], ['HRS', cd.hours], ['MIN', cd.minutes], ['SEC', cd.seconds]].map(([label, value]) => <View key={String(label)} style={styles.timeBox}><Text style={styles.timeNum}>{String(value).padStart(2, '0')}</Text><Text style={styles.timeLabel}>{label}</Text></View>)}
        </View>
        <View style={styles.row}><GoldButton title="Join Discussion" onPress={() => Linking.openURL(discussion.zoom_url)} /><OutlineButton title="Remind Me" onPress={() => Alert.alert('Choose a reminder', 'When should we remind you?', [
          { text: '24 hours before', onPress: () => remind(1440) }, { text: '1 hour before', onPress: () => remind(60) }, { text: '15 minutes before', onPress: () => remind(15) }, { text: 'At start time', onPress: () => remind(0) }, { text: 'Cancel', style: 'cancel' },
        ])} /></View>
      </Card> : null}

      {video ? <Card>
        <Eyebrow>SOMETHING WORTH THINKING ABOUT</Eyebrow>
        {video.thumbnail ? <Image source={{uri: video.thumbnail}} style={styles.videoImage} /> : null}
        <Text style={styles.sectionTitle}>{video.title}</Text>
        <Text style={styles.meta}>{video.channelTitle ?? 'Try Jesus Media'}</Text>
        <View style={styles.row}><GoldButton title="Watch Now" onPress={() => Linking.openURL(video.watchUrl)} /><OutlineButton title="Choose Another" onPress={async () => { const r = await supabase.functions.invoke('random-youtube-video', {body:{}}); if (r.data) setVideo(r.data as Video); }} /></View>
      </Card> : null}

      {products.length ? <View>
        <Eyebrow>CONTINUE YOUR JOURNEY</Eyebrow>
        <Text style={styles.sectionTitle}>Programs & resources selected for you.</Text>
        <View style={styles.productList}>{products.slice(0,3).map((p, i) => {
          const img = p.images?.[0]?.transformedUrl ?? p.images?.[0]?.url;
          const price = p.variants?.[0]?.unitPrice;
          return <Card key={p.id ?? p.slug} style={styles.productCard}>
            {img ? <Image source={{uri: img}} style={styles.productImage} /> : null}
            <Text style={styles.pin}>{i === 0 || p.pinned ? 'FEATURED PROGRAM' : 'RESOURCE'}</Text>
            <Text style={styles.productName}>{p.name}</Text>
            {price?.value != null ? <Text style={styles.meta}>{price.currency ?? 'USD'} ${Number(price.value).toFixed(2)}</Text> : null}
            <OutlineButton title="View on Fourthwall" onPress={() => Linking.openURL(p.storefrontUrl)} />
          </Card>;
        })}</View>
      </View> : null}
      <View style={{height: 24}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},content:{padding:20,paddingTop:52,gap:18},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4},brand:{color:colors.ivory,fontWeight:'900',fontSize:20,letterSpacing:.5},media:{color:colors.gold,fontWeight:'800',fontSize:11,letterSpacing:2.2},mark:{width:56,height:56},
  hero:{backgroundColor:colors.plum,padding:24},askCard:{backgroundColor:colors.panel2},heroTitle:{color:colors.text,fontSize:30,fontWeight:'800',lineHeight:36,marginBottom:10},body:{color:colors.ivory,fontSize:15,lineHeight:23,marginBottom:18},sectionTitle:{color:colors.text,fontSize:21,fontWeight:'800',lineHeight:27,marginBottom:8},meta:{color:colors.muted,fontSize:13,marginBottom:14},
  countdown:{flexDirection:'row',gap:8,marginVertical:16},timeBox:{flex:1,backgroundColor:colors.panel2,borderRadius:14,paddingVertical:12,alignItems:'center'},timeNum:{color:colors.gold,fontSize:24,fontWeight:'900'},timeLabel:{color:colors.muted,fontSize:9,letterSpacing:1.5,fontWeight:'800'},
  row:{gap:10,marginTop:10},videoImage:{width:'100%',aspectRatio:16/9,borderRadius:16,marginBottom:14,backgroundColor:colors.plum},productList:{gap:12,marginTop:12},productCard:{padding:14},productImage:{width:'100%',aspectRatio:1.6,borderRadius:14,backgroundColor:colors.plum,marginBottom:12},pin:{color:colors.gold,fontSize:10,fontWeight:'900',letterSpacing:1.4,marginBottom:5},productName:{color:colors.text,fontSize:17,fontWeight:'800',marginBottom:5}
});
