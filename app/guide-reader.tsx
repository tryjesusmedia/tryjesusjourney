import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { getBibleGuideSet, guideNumberFromUrl, guideUrl } from '@/data/bibleGuides';
import { bibleGatewayReference } from '@/data/bible';
import { getGuestGuideProgress, saveGuestGuideProgress } from '@/lib/localStore';

const MIN_TEXT_SIZE = 1;
const MAX_TEXT_SIZE = 40;

const readerCleanupScript = `
  (() => {
    const style = document.createElement('style');
    style.id = 'tjm-native-guide-cleanup';
    style.textContent = '.site-header,.guide-reader-toolbar,.lesson-return,#listenButton,.listen-button,.guide-audio-speed,footer,.site-footer{display:none!important}';
    (document.head || document.documentElement).appendChild(style);

    const removeFooters = (root = document) => {
      if (root instanceof Element && root.matches('footer,.site-footer')) root.remove();
      root.querySelectorAll?.('footer,.site-footer').forEach((footer) => footer.remove());
    };
    removeFooters();
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => removeFooters(node)));
    }).observe(document.documentElement, { childList: true, subtree: true });
  })();
  true;
`;

const readerReadyScript = `
  (() => {
    document.querySelectorAll('.completion-actions a').forEach((link) => {
      if (/return to bible guides|previous (guide|lesson)/i.test(link.textContent || '')) link.remove();
    });
    const stored = Number.parseInt(localStorage.getItem('tjm-guide-text-size') || '5', 10);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'guide-ready', textSize: Number.isInteger(stored) ? stored : 5 }));
  })();
  true;
`;

export default function GuideReaderScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ set?: string; guide?: string }>();
  const guideSet = useMemo(() => getBibleGuideSet(params.set), [params.set]);
  const requestedGuide = useMemo(() => {
    const parsed = Number(params.guide);
    return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, guideSet.guideCount)) : null;
  }, [guideSet.guideCount, params.guide]);
  const [url, setUrl] = useState(guideUrl(guideSet, requestedGuide ?? 1));
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [textSize, setTextSize] = useState(5);
  const lastSaved = useRef(0);
  const latestPercent = useRef(0);
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      const progress = await getGuestGuideProgress(guideSet.id);
      const savedGuide = progress?.lessonUrl ? guideNumberFromUrl(guideSet, progress.lessonUrl) : 1;
      const nextGuide = requestedGuide ?? savedGuide;
      const nextPercent = nextGuide === savedGuide ? progress?.progressPercent ?? 0 : 0;
      setUrl(guideUrl(guideSet, nextGuide));
      latestPercent.current = nextPercent;
      setReady(true);
    })();
  }, [guideSet, requestedGuide]);

  async function persist(nextUrl: string, percent: number, force = false) {
    if (!nextUrl.toLowerCase().includes(`/${guideSet.path}/guide`)) return;
    if (!force && Date.now() - lastSaved.current < 1200) return;
    lastSaved.current = Date.now();
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    const lessonNumber = guideNumberFromUrl(guideSet, nextUrl);
    const lessonStartUrl = guideUrl(guideSet, lessonNumber);
    await saveGuestGuideProgress(guideSet.id, { lessonUrl: lessonStartUrl, progressPercent: bounded, updatedAt: new Date().toISOString() });
  }

  const currentGuide = guideNumberFromUrl(guideSet, url);
  const currentTitle = guideSet.guides.find((guide) => guide.number === currentGuide)?.title ?? guideSet.title;

  function returnToBibleGuides() {
    setMenuOpen(false);
    router.replace('/(tabs)/journey');
  }

  function internalBibleReference(nextUrl: string) {
    const gatewayReference = bibleGatewayReference(nextUrl);
    if (gatewayReference) return gatewayReference;
    try {
      const parsed = new URL(nextUrl);
      if (/(^|\.)tryjesusmedia\.com$/iu.test(parsed.hostname) && /^\/bible-reader\/?$/iu.test(parsed.pathname)) {
        return parsed.searchParams.get('reference')?.trim() || null;
      }
    } catch {
      // Ignore malformed navigation URLs.
    }
    return null;
  }

  function handleReadingLink(nextUrl: string) {
    const reference = internalBibleReference(nextUrl);
    if (reference) {
      setMenuOpen(false);
      router.push({
        pathname: '/bible-reader' as never,
        params: {
          reference,
          planId: 'bible-guides',
          readingId: `${guideSet.id}:guide-${currentGuide}`,
        },
      });
      return true;
    }
    try {
      const hostname = new URL(nextUrl).hostname;
      if (/(^|\.)(egwwritings\.org|whiteestate\.org)$/iu.test(hostname)) {
        void Linking.openURL(nextUrl);
        return true;
      }
    } catch {
      // Let the WebView decide how to handle other malformed URLs.
    }
    return false;
  }

  function startOver() {
    latestPercent.current = 0;
    persist(url, 0, true);
    webRef.current?.injectJavaScript("document.getElementById('restartLesson')?.click(); true;");
  }

  function changeTextSize(delta: number) {
    setTextSize((current) => {
      const next = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, current + delta));
      const action = delta > 0 ? 'increase' : 'decrease';
      const percentage = 80 + (next - 1) * 5;
      webRef.current?.injectJavaScript(`
        (() => {
          const button = document.querySelector('[data-text-size="${action}"]');
          if (button instanceof HTMLButtonElement && !button.disabled) {
            button.click();
          } else {
            localStorage.setItem('tjm-guide-text-size', '${next}');
            document.body.style.setProperty('--tjm-guide-scale', '${percentage / 100}');
            document.documentElement.dataset.guideTextSize = '${next}';
            document.documentElement.dataset.guideTextEnlarged = '${percentage > 100}';
          }
          const applied = Number.parseInt(document.documentElement.dataset.guideTextSize || '${next}', 10);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'guide-ready', textSize: applied }));
        })();
        true;
      `);
      return next;
    });
  }

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; textSize?: number };
      if (message.type === 'guide-ready' && Number.isInteger(message.textSize)) {
        setTextSize(Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, message.textSize ?? 5)));
      }
    } catch {
      // Ignore messages not produced by the guide-reader customization.
    }
  }

  if (!ready) return <View style={styles.center}><Text style={styles.text}>Opening your saved place…</Text></View>;

  return <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
    <View style={styles.header}>
      <View style={styles.headerTopline}>
        <Pressable accessibilityRole="button" onPress={startOver} style={styles.headerButton}><Text style={styles.headerButtonText}>Start Over</Text></Pressable>
        <View style={styles.textControls} accessibilityRole="adjustable" accessibilityLabel={`Text size ${textSize} of ${MAX_TEXT_SIZE}`}>
          <Pressable accessibilityRole="button" accessibilityLabel="Decrease text size" disabled={textSize === MIN_TEXT_SIZE} onPress={() => changeTextSize(-1)} style={styles.sizeButton}><Text style={styles.sizeButtonText}>A−</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Increase text size" disabled={textSize === MAX_TEXT_SIZE} onPress={() => changeTextSize(1)} style={styles.sizeButton}><Text style={styles.sizeButtonText}>A+</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Bible guide menu" accessibilityState={{ expanded: menuOpen }} onPress={() => setMenuOpen((open) => !open)} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable>
      </View>
      <View style={styles.headerCopy}><View style={styles.titleCopy}><Text style={styles.title}>{currentTitle}</Text><Text style={styles.setTitle}>{guideSet.title}</Text></View><Text style={styles.guideNumber}>Guide {currentGuide} of {guideSet.guideCount}</Text></View>
      {menuOpen ? <View style={styles.menu}>
        <Pressable accessibilityRole="button" onPress={returnToBibleGuides} style={styles.menuItem}><Text style={styles.menuItemText}>Return to Bible Guides</Text></Pressable>
      </View> : null}
    </View>
    <WebView
      ref={webRef}
      source={{ uri: url }}
      style={styles.web}
      injectedJavaScriptBeforeContentLoaded={readerCleanupScript}
      injectedJavaScript={readerReadyScript}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={(request) => {
        if (handleReadingLink(request.url)) return false;
        if (/tryjesusmedia\.com\/welcome\/?#bible-guides/i.test(request.url)) {
          returnToBibleGuides();
          return false;
        }
        return true;
      }}
      setSupportMultipleWindows={false}
      onNavigationStateChange={(navigation) => {
        const changedLesson = guideNumberFromUrl(guideSet, navigation.url) !== guideNumberFromUrl(guideSet, url);
        if (changedLesson) {
          latestPercent.current = 0;
        }
        setUrl(navigation.url);
        persist(navigation.url, changedLesson ? 0 : latestPercent.current, changedLesson);
      }}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const percent = (contentOffset.y / Math.max(1, contentSize.height - layoutMeasurement.height)) * 100;
        latestPercent.current = Math.max(0, Math.min(100, percent));
        persist(url, latestPercent.current);
      }}
      onError={() => Alert.alert('Guide unavailable', 'Check your internet connection and try again.')}
    />
  </View>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},header:{position:'relative',zIndex:10,elevation:10,paddingHorizontal:18,paddingBottom:12},headerTopline:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8,marginBottom:7},headerButton:{minHeight:38,borderWidth:1,borderColor:colors.gold,borderRadius:10,paddingHorizontal:11,alignItems:'center',justifyContent:'center'},headerButtonText:{color:colors.ivory,fontSize:12,fontWeight:'900'},textControls:{flexDirection:'row',gap:6},sizeButton:{width:42,minHeight:38,borderRadius:10,backgroundColor:colors.panel2,alignItems:'center',justifyContent:'center'},sizeButtonText:{color:colors.gold,fontSize:14,fontWeight:'900'},menuButton:{width:44,minHeight:40,borderRadius:10,backgroundColor:colors.gold,alignItems:'center',justifyContent:'center',marginLeft:'auto'},menuIcon:{color:colors.charcoal,fontSize:21,fontWeight:'900'},headerCopy:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12},titleCopy:{flex:1},title:{color:colors.text,fontSize:20,fontWeight:'900',lineHeight:25},setTitle:{color:colors.muted,fontSize:11,fontWeight:'800',marginTop:3},guideNumber:{color:colors.gold,fontSize:11,fontWeight:'900'},menu:{position:'absolute',zIndex:20,elevation:20,top:52,right:18,width:230,backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:14,padding:7},menuItem:{minHeight:46,justifyContent:'center',paddingHorizontal:12},menuItemText:{color:colors.ivory,fontSize:14,fontWeight:'800'},web:{flex:1,backgroundColor:colors.ivory},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.charcoal},text:{color:colors.ivory},
});
