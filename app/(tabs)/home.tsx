import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bibleGuideSets } from '@/data/bibleGuides';
import { getGuestGuideProgress } from '@/lib/localStore';
import { countdownParts, nextDiscussionDate, type LiveDiscussion } from '@/lib/liveDiscussion';
import { scheduleDiscussionReminder } from '@/lib/notifications';

type Video = { videoId: string; title: string; thumbnail?: string; channelTitle?: string; watchUrl: string; durationSeconds?: number };
type Product = { id: string; name: string; slug: string; images?: {url?: string; transformedUrl?: string}[]; variants?: {unitPrice?: {value?: number; currency?: string}}[]; storefrontUrl: string; pinned?: boolean };

type Progress = { lesson_id?: string | null; progress_percent?: number | null; updated_at?: string | null };

function selectCarouselProducts(incoming: Product[]) {
  const bibleDecoded = incoming.find((product) => /bible[\s-]*decoded/i.test(`${product.name} ${product.slug}`))
    ?? incoming.find((product) => product.pinned);
  const otherProducts = incoming.filter((product) => product !== bibleDecoded);

  for (let index = otherProducts.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [otherProducts[index], otherProducts[randomIndex]] = [otherProducts[randomIndex], otherProducts[index]];
  }

  return bibleDecoded
    ? [bibleDecoded, ...otherProducts.slice(0, 2)]
    : incoming.slice(0, 3);
}

export default function HomeScreen() {
  const { session, guest } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discussion, setDiscussion] = useState<LiveDiscussion | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [productIndex, setProductIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const productCarousel = useRef<FlatList<Product>>(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoCarouselWidth, setVideoCarouselWidth] = useState(0);
  const videoCarousel = useRef<FlatList<Video>>(null);

  const load = useCallback(async () => {
    const [videoResult, productsResult, discussionResult] = await Promise.all([
      supabase.functions.invoke('random-youtube-video', { body: {} }),
      supabase.functions.invoke('random-fourthwall-products', { body: {} }),
      supabase.from('live_discussions').select('*').eq('active', true).limit(1).maybeSingle(),
    ]);
    if (videoResult.data && !videoResult.error) {
      const nextVideos = Array.isArray(videoResult.data.videos) ? videoResult.data.videos : [videoResult.data];
      setVideos((nextVideos as Video[]).slice(0, 3));
      setVideoIndex(0);
    }
    if (productsResult.data?.products && !productsResult.error) {
      setProducts(selectCarouselProducts(productsResult.data.products as Product[]));
      setProductIndex(0);
    }
    if (discussionResult.data) setDiscussion(discussionResult.data as LiveDiscussion);
    if (session) {
      const result = await supabase.from('guide_progress').select('lesson_id,progress_percent,updated_at').in('guide_id', bibleGuideSets.map((guideSet) => guideSet.id)).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      setProgress(result.data ?? null);
    } else if (guest) {
      const savedGuides = (await Promise.all(bibleGuideSets.map((guideSet) => getGuestGuideProgress(guideSet.id)))).filter((item) => item != null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const latest = savedGuides[0];
      setProgress(latest ? { lesson_id: latest.lessonUrl, progress_percent: latest.progressPercent, updated_at: latest.updatedAt } : null);
    }
  }, [session, guest]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    productCarousel.current?.scrollToOffset({ offset: 0, animated: false });
  }, [products]);
  useEffect(() => {
    if (products.length < 2 || carouselWidth === 0) return;
    const timer = setInterval(() => {
      setProductIndex((current) => {
        const nextIndex = (current + 1) % products.length;
        productCarousel.current?.scrollToOffset({ offset: nextIndex * carouselWidth, animated: true });
        return nextIndex;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [carouselWidth, products.length]);
  useEffect(() => {
    videoCarousel.current?.scrollToOffset({ offset: 0, animated: false });
  }, [videos]);
  useEffect(() => {
    if (videos.length < 2 || videoCarouselWidth === 0) return;
    const timer = setInterval(() => {
      setVideoIndex((current) => {
        const nextIndex = (current + 1) % videos.length;
        videoCarousel.current?.scrollToOffset({ offset: nextIndex * videoCarouselWidth, animated: true });
        return nextIndex;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [videoCarouselWidth, videos.length]);

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
        <GoldButton title={progress ? 'Continue My Bible Guides' : 'Begin My Bible Guides'} onPress={() => router.push('/(tabs)/journey')} />
      </Card>

      {products.length ? <View>
        <Eyebrow>CONTINUE YOUR JOURNEY</Eyebrow>
        <Text style={styles.sectionTitle}>Programs & resources selected for you.</Text>
        <View onLayout={(event) => setCarouselWidth(event.nativeEvent.layout.width)}>
          <FlatList
            ref={productCarousel}
            data={products}
            keyExtractor={(product) => product.id ?? product.slug}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={products.length > 1}
            onMomentumScrollEnd={(event) => {
              if (carouselWidth) setProductIndex(Math.round(event.nativeEvent.contentOffset.x / carouselWidth));
            }}
            renderItem={({ item: product, index }) => {
              const image = product.images?.[0]?.transformedUrl ?? product.images?.[0]?.url;
              const price = product.variants?.[0]?.unitPrice;
              return <View style={{ width: carouselWidth || undefined }}>
                <Card style={styles.productCard}>
                  {image ? <Image source={{uri: image}} style={styles.productImage} /> : null}
                  <Text style={styles.pin}>{index === 0 ? 'FEATURED PROGRAM' : 'RESOURCE'}</Text>
                  <Text style={styles.productName}>{product.name}</Text>
                  {price?.value != null ? <Text style={styles.meta}>{price.currency ?? 'USD'} ${Number(price.value).toFixed(2)}</Text> : null}
                  <OutlineButton title="View on Fourthwall" onPress={() => Linking.openURL(product.storefrontUrl)} />
                </Card>
              </View>;
            }}
          />
        </View>
        <View style={styles.carouselDots}>
          {products.map((product, index) => <View key={product.id ?? product.slug} style={[styles.carouselDot, productIndex === index && styles.carouselDotActive]} />)}
        </View>
      </View> : null}

      {videos.length ? <View>
        <Eyebrow>SOMETHING WORTH THINKING ABOUT</Eyebrow>
        <Text style={styles.sectionTitle}>Long-form videos from Try Jesus Media.</Text>
        <View onLayout={(event) => setVideoCarouselWidth(event.nativeEvent.layout.width)}>
          <FlatList
            ref={videoCarousel}
            data={videos}
            keyExtractor={(video) => video.videoId}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={videos.length > 1}
            onMomentumScrollEnd={(event) => {
              if (videoCarouselWidth) setVideoIndex(Math.round(event.nativeEvent.contentOffset.x / videoCarouselWidth));
            }}
            renderItem={({ item: video }) => <View style={{ width: videoCarouselWidth || undefined }}>
              <Card style={styles.videoCard}>
                {video.thumbnail ? <Image source={{uri: video.thumbnail}} style={styles.videoImage} /> : null}
                <Text style={styles.sectionTitle}>{video.title}</Text>
                <Text style={styles.meta}>{video.channelTitle ?? 'Try Jesus Media'}</Text>
                <GoldButton title="Watch Now" onPress={() => Linking.openURL(video.watchUrl)} />
              </Card>
            </View>}
          />
        </View>
        <View style={styles.carouselDots}>
          {videos.map((video, index) => <View key={video.videoId} style={[styles.carouselDot, videoIndex === index && styles.carouselDotActive]} />)}
        </View>
      </View> : null}

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

      <View style={{height: 24}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},content:{padding:20,paddingTop:52,gap:18},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4},brand:{color:colors.ivory,fontWeight:'900',fontSize:20,letterSpacing:.5},media:{color:colors.gold,fontWeight:'800',fontSize:11,letterSpacing:2.2},mark:{width:56,height:56},
  hero:{backgroundColor:colors.plum,padding:24},askCard:{backgroundColor:colors.panel2},heroTitle:{color:colors.text,fontSize:30,fontWeight:'800',lineHeight:36,marginBottom:10},body:{color:colors.ivory,fontSize:15,lineHeight:23,marginBottom:18},sectionTitle:{color:colors.text,fontSize:21,fontWeight:'800',lineHeight:27,marginBottom:8},meta:{color:colors.muted,fontSize:13,marginBottom:14},
  countdown:{flexDirection:'row',gap:8,marginVertical:16},timeBox:{flex:1,backgroundColor:colors.panel2,borderRadius:14,paddingVertical:12,alignItems:'center'},timeNum:{color:colors.gold,fontSize:24,fontWeight:'900'},timeLabel:{color:colors.muted,fontSize:9,letterSpacing:1.5,fontWeight:'800'},
  row:{gap:10,marginTop:10},videoCard:{padding:14},videoImage:{width:'100%',aspectRatio:16/9,borderRadius:16,marginBottom:14,backgroundColor:colors.plum},productCard:{padding:14},productImage:{width:'100%',aspectRatio:1.6,borderRadius:14,backgroundColor:colors.plum,marginBottom:12},pin:{color:colors.gold,fontSize:10,fontWeight:'900',letterSpacing:1.4,marginBottom:5},productName:{color:colors.text,fontSize:17,fontWeight:'800',marginBottom:5},carouselDots:{flexDirection:'row',justifyContent:'center',gap:7,marginTop:10},carouselDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.border},carouselDotActive:{width:18,backgroundColor:colors.gold}
});
