import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { usePathname } from 'expo-router';
import { colors } from '@/constants/theme';
import { chronologicalReadings, type ChronologicalReading } from '@/data/chronologicalBiblePlan';

import { badgeSvg, getBadge, type ReadingBadge } from '@/lib/readingBadges';

const readingById = new Map(chronologicalReadings.map(reading => [reading.id, reading]));
const readingComplete = (reading: ChronologicalReading, completed: ReadonlySet<number>) => reading.bibleTasks.length > 0 && reading.bibleTasks.every(task => completed.has(task.progressIndex));

export const READING_BADGE_SIZE = 64;
const BadgeViewerContext = createContext<(badge: ReadingBadge) => void>(() => {});

const BadgeArt = React.memo(function BadgeArt({ badge, size }: { badge: ReadingBadge; size: number }) {
  const xml = useMemo(() => badgeSvg(badge), [badge]);
  return <SvgXml xml={xml} width={size} height={size} accessible={false} />;
});

export function ReadingBadgeButton({ reading, gallery = false }: { reading: ChronologicalReading; gallery?: boolean }) {
  const open = useContext(BadgeViewerContext);
  const badge = getBadge(reading.id);
  if (!badge) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Earned badge: ${badge.label}. Reading ${reading.number}: ${badge.title}.`}
      accessibilityHint="Open full-screen badge"
      onPress={() => open(badge)}
      style={({ pressed }) => [styles.badgeButton, gallery ? styles.galleryBadge : styles.titleBadge, pressed && styles.pressed]}
    >
      <BadgeArt badge={badge} size={READING_BADGE_SIZE} />
      <Text style={styles.badgeNumber}>Reading {reading.number}</Text>
    </Pressable>
  );
}

export function EarnedReadingBadges({ completed }: { completed: ReadonlySet<number> }) {
  const earned = chronologicalReadings.filter(reading => readingComplete(reading, completed));
  return (
    <View style={styles.collection}>
      <Text style={styles.collectionTitle}>Earned badges · {earned.length}</Text>
      {earned.length ? <View style={styles.gallery}>{earned.map(reading => <ReadingBadgeButton key={reading.id} reading={reading} gallery />)}</View> : (
        <Text style={styles.empty}>Complete all the items in a reading to earn its badge. Your badges will appear here.</Text>
      )}
    </View>
  );
}

export function ReadingBadgeProvider({ children, completed, ready, accountIdentity }: { children: React.ReactNode; completed: ReadonlySet<number>; ready: boolean; accountIdentity: string }) {
  const pathname = usePathname();
  const identity = `${accountIdentity}:${pathname}`;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ReadingBadge | null>(null);
  const [openedIdentity, setOpenedIdentity] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [animation] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const badgeSize = Math.max(64, Math.min(width - 32, height * 0.6));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);

  // Clear the viewer as soon as a completion is revoked or its account unloads.
  if (selected) {
    const reading = readingById.get(selected.id);
    if (openedIdentity !== identity || !ready || !reading || !readingComplete(reading, completed)) setSelected(null);
  }
  useEffect(() => {
    if (!selected) return;
    closing.current = false;
    animation.setValue(0);
    Animated.timing(animation, { toValue: 1, duration: reduceMotion ? 0 : 220, useNativeDriver: true }).start();
    return () => animation.stopAnimation();
  }, [animation, reduceMotion, selected]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(animation, { toValue: 0, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setSelected(null);
      closing.current = false;
    });
  }, [animation, reduceMotion]);
  const open = useCallback((badge: ReadingBadge) => {
    const reading = readingById.get(badge.id);
    if (ready && reading && readingComplete(reading, completed)) {
      setOpenedIdentity(identity);
      setSelected(badge);
    }
  }, [completed, identity, ready]);

  return (
    <BadgeViewerContext.Provider value={open}>
      {children}
      <Modal visible={Boolean(selected)} transparent statusBarTranslucent presentationStyle="overFullScreen" animationType="none" onRequestClose={close}>
        {selected ? (
          <Animated.View accessibilityViewIsModal style={[styles.backdrop, { opacity: animation }]}>
            <ScrollView contentContainerStyle={[styles.viewerScroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Shrink ${selected.label} badge`} onPress={close} style={styles.viewerButton}>
                <Animated.View style={{ transform: [{ scale: animation.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : READING_BADGE_SIZE / badgeSize, 1] }) }] }}>
                  <BadgeArt badge={selected} size={badgeSize} />
                </Animated.View>
                <Text style={styles.viewerNumber}>READING {selected.day} · {selected.book}</Text>
                <Text style={styles.viewerTitle}>{selected.title}</Text>
                <Text style={styles.viewerReference}>{selected.reference}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={close} style={styles.closeButton}><Text style={styles.closeText}>Close badge</Text></Pressable>
            </ScrollView>
          </Animated.View>
        ) : null}
      </Modal>
    </BadgeViewerContext.Provider>
  );
}

const styles = StyleSheet.create({
  collection: { gap: 16 },
  collectionTitle: { color: colors.gold, fontSize: 18, lineHeight: 25, fontWeight: '800' },
  empty: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 22, alignItems: 'flex-start' },
  badgeButton: { alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 3, borderRadius: 12 },
  galleryBadge: { width: '30%', minWidth: 80 },
  titleBadge: { width: 88, flexShrink: 0 },
  badgeNumber: { color: colors.gold, fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, backgroundColor: colors.charcoal },
  viewerScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  viewerButton: { width: '100%', alignItems: 'center', gap: 12 },
  viewerNumber: { color: colors.gold, fontSize: 16, lineHeight: 22, fontWeight: '900', letterSpacing: 1 },
  viewerTitle: { color: colors.ivory, fontSize: 19, lineHeight: 27, textAlign: 'center' },
  viewerReference: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  closeButton: { paddingHorizontal: 22, paddingVertical: 14, marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.gold },
  closeText: { color: colors.ivory, fontSize: 17, fontWeight: '800' },
});
