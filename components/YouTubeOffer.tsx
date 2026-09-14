import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { TRY_JESUS_MEDIA_SECOND_YOUTUBE_URL, TRY_JESUS_MEDIA_YOUTUBE_URL } from '@/constants/links';
import { supabase } from '@/lib/supabase';

type Video = {
  videoId: string;
  title: string;
  thumbnail?: string;
  channelTitle?: string;
  watchUrl: string;
};

export function YouTubeOffer() {
  const carousel = useRef<FlatList<Video>>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setFocused(true);
    setLoading(true);
    void supabase.functions.invoke('random-youtube-video', { body: {} }).then(({ data, error }) => {
      if (!active) return;
      if (!error && data) {
        const incoming = Array.isArray(data.videos) ? data.videos : [data];
        setVideos((incoming as Video[]).slice(0, 3));
        setIndex(0);
      }
      setLoading(false);
    });
    return () => {
      active = false;
      setFocused(false);
    };
  }, []));

  useEffect(() => {
    carousel.current?.scrollToOffset({ offset: 0, animated: false });
  }, [videos]);

  useEffect(() => {
    if (!focused || videos.length < 2 || !width) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % videos.length;
        carousel.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [focused, videos.length, width]);

  return (
    <View>
      <Eyebrow>NEW FROM OUR TWO CHANNELS</Eyebrow>
      <Text style={styles.title}>YouTube Channels</Text>
      <Text style={styles.body}>Watch the latest three episodes from Try Jesus Media&apos;s two YouTube channels.</Text>

      {loading && videos.length === 0 ? (
        <Card style={styles.stateCard}><ActivityIndicator color={colors.gold} /><Text style={styles.stateText}>Loading the latest episodes…</Text></Card>
      ) : videos.length ? (
        <>
          <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
            <FlatList
              ref={carousel}
              data={videos}
              keyExtractor={(video) => video.videoId}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={videos.length > 1}
              onMomentumScrollEnd={(event) => { if (width) setIndex(Math.round(event.nativeEvent.contentOffset.x / width)); }}
              renderItem={({ item }) => (
                <View style={{ width: width || undefined }}>
                  <Card style={styles.videoCard}>
                    {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.image} accessibilityLabel="YouTube episode thumbnail" /> : null}
                    <Text style={styles.videoTitle}>{item.title}</Text>
                    <Text style={styles.meta}>{item.channelTitle ?? 'Try Jesus Media'}</Text>
                    <GoldButton title="Watch Episode" onPress={() => Linking.openURL(item.watchUrl)} />
                  </Card>
                </View>
              )}
            />
          </View>
          <View style={styles.dots}>{videos.map((video, videoIndex) => <View key={video.videoId} style={[styles.dot, index === videoIndex && styles.activeDot]} />)}</View>
        </>
      ) : (
        <Card style={styles.stateCard}><Text style={styles.stateText}>The latest episodes could not be loaded. You can still open either channel below.</Text></Card>
      )}

      <View style={styles.channelButtons}>
        <OutlineButton title="Try Jesus Media Channel" onPress={() => Linking.openURL(TRY_JESUS_MEDIA_YOUTUBE_URL)} />
        <OutlineButton title="Second YouTube Channel" onPress={() => Linking.openURL(TRY_JESUS_MEDIA_SECOND_YOUTUBE_URL)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: '900', marginBottom: 6 },
  body: { color: colors.ivory, fontSize: 15, lineHeight: 23, marginBottom: 14 },
  videoCard: { padding: 14 },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, marginBottom: 14, backgroundColor: colors.plum },
  videoTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900', marginBottom: 6 },
  meta: { color: colors.muted, fontSize: 13, marginBottom: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  activeDot: { width: 18, backgroundColor: colors.gold },
  channelButtons: { gap: 9, marginTop: 12 },
  stateCard: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: colors.ivory, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
