import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { chronologicalBiblePlan, chronologicalPlanMeta, chronologicalReadings, type ChronologicalChapterTask, type ChronologicalReading } from '@/data/chronologicalBiblePlan';
import { loadChronologicalProgress, saveChronologicalProgress, type ChronologicalProgress } from '@/lib/chronologicalProgress';
import {
  createChronologicalPost,
  createChronologicalPrinciple,
  createChronologicalReply,
  emptyChronologicalCommunity,
  loadChronologicalCommunityData,
  type ChronologicalCommunityData,
  type ChronologicalPost,
  type ChronologicalPrinciple,
} from '@/lib/chronologicalJourney';

type ViewName = 'Readings' | 'Progress' | 'Members';
const views: ViewName[] = ['Readings', 'Progress', 'Members'];

export default function ChronologicalPlanScreen() {
  const insets = useSafeAreaInsets();
  const { session, signInGoogle } = useAuth();
  const listRef = useRef<SectionList<ChronologicalReading>>(null);
  const pendingScroll = useRef<{ sectionIndex: number; itemIndex: number; retries: number } | null>(null);
  const pathname = usePathname();
  const [progress, setProgress] = useState<ChronologicalProgress>({ completed: [], lastIndex: 0 });
  const [community, setCommunity] = useState<ChronologicalCommunityData>(emptyChronologicalCommunity);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ViewName>('Readings');
  const [expandedReadingId, setExpandedReadingId] = useState<string | null>(null);
  const [principleBody, setPrincipleBody] = useState('');
  const [crossRefs, setCrossRefs] = useState('');
  const [postBody, setPostBody] = useState('');
  const [selectedPrincipleId, setSelectedPrincipleId] = useState('');
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const isMainBibleTab = pathname === '/bible';

  const completedSet = useMemo(() => new Set(progress.completed), [progress.completed]);
  const sections = useMemo(() => chronologicalBiblePlan.map((section) => ({ title: section.title, data: section.readings })), []);
  const completedTaskCount = useMemo(() => chronologicalReadings.filter((reading) => reading.bibleTasks.every((task) => completedSet.has(task.progressIndex))).length, [completedSet]);
  const percent = Math.round((completedSet.size / chronologicalPlanMeta.chapterCount) * 100);
  const next = chronologicalReadings.find((reading) => reading.bibleTasks.some((task) => !completedSet.has(task.progressIndex))) ?? chronologicalReadings[chronologicalReadings.length - 1];
  const nextPrinciple = community.principles.reduce((max, principle) => Math.max(max, principle.principle_number), 0) + 1;

  const load = useCallback(async () => {
    setReady(false);
    try {
      const [nextProgress, nextCommunity] = await Promise.all([
        loadChronologicalProgress(session?.user.id),
        session ? loadChronologicalCommunityData(session.user.id) : Promise.resolve(emptyChronologicalCommunity),
      ]);
      setProgress(nextProgress);
      setCommunity(nextCommunity);
    } catch (caught) {
      Alert.alert('Could not sync the reading plan', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setReady(true);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function authenticate() {
    try {
      setBusy(true);
      await signInGoogle();
    } catch (caught) {
      Alert.alert('Sign in did not finish', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleChapter(reading: ChronologicalReading, chapter: ChronologicalChapterTask) {
    if (!session) { await authenticate(); return; }
    const completed = completedSet.has(chapter.progressIndex)
      ? progress.completed.filter((index) => index !== chapter.progressIndex)
      : [...progress.completed, chapter.progressIndex];
    const nextProgress = { completed, lastIndex: reading.index };
    setProgress(nextProgress);
    try {
      await saveChronologicalProgress(nextProgress, session.user.id);
    } catch (caught) {
      setProgress(progress);
      Alert.alert('Could not sync chapter progress', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  function scrollToReading(reading: ChronologicalReading) {
    const sectionIndex = sections.findIndex((section) => section.data.some((item) => item.index === reading.index));
    const itemIndex = sectionIndex >= 0 ? sections[sectionIndex].data.findIndex((item) => item.index === reading.index) : -1;
    if (sectionIndex < 0 || itemIndex < 0) return;
    pendingScroll.current = { sectionIndex, itemIndex, retries: 0 };
    setTimeout(() => listRef.current?.scrollToLocation({ animated: true, sectionIndex, itemIndex, viewPosition: 0, viewOffset: 8 }), 100);
  }

  async function openReading(reading: ChronologicalReading, shouldScroll = false) {
    const nextProgress = { ...progress, lastIndex: reading.index };
    setProgress(nextProgress);
    setExpandedReadingId((current) => shouldScroll ? reading.id : current === reading.id ? null : reading.id);
    if (shouldScroll) scrollToReading(reading);
    if (session) await saveChronologicalProgress(nextProgress, session.user.id);
  }

  async function savePrinciple(reading: ChronologicalReading) {
    if (!session) { await authenticate(); return; }
    if (!principleBody.trim()) return;
    const references = Array.from(new Set(crossRefs.split(/[^0-9]+/).filter(Boolean).map(Number))).sort((a, b) => a - b);
    const unknown = references.filter((number) => !community.principles.some((principle) => principle.principle_number === number));
    if (unknown.length) {
      Alert.alert('Check cross-references', `These principles do not exist yet: ${unknown.map((number) => `#${number}`).join(', ')}`);
      return;
    }
    try {
      setBusy(true);
      const created = await createChronologicalPrinciple(reading.id, principleBody.trim(), references);
      setCommunity((current) => ({ ...current, principles: [...current.principles, created].sort((left, right) => left.principle_number - right.principle_number) }));
      setPrincipleBody('');
      setCrossRefs('');
    } catch (caught) {
      Alert.alert('Could not save principle', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function authorDetails() {
    const metadata = session?.user.user_metadata ?? {};
    return {
      name: metadata.full_name || metadata.name || session?.user.email?.split('@')[0] || 'Try Jesus member',
      avatar: metadata.avatar_url || metadata.picture || undefined,
    };
  }

  async function shareFinding() {
    if (!session) { await authenticate(); return; }
    if (!postBody.trim()) return;
    const principle = community.principles.find((item) => item.id === selectedPrincipleId);
    const reading = chronologicalReadings[progress.lastIndex] ?? chronologicalReadings[0];
    const author = authorDetails();
    try {
      setBusy(true);
      const created = await createChronologicalPost({ userId: session.user.id, readingId: principle?.reading_id ?? reading.id, body: postBody.trim(), authorName: author.name, authorAvatarUrl: author.avatar, principle });
      setCommunity((current) => ({ ...current, posts: [created, ...current.posts] }));
      setPostBody('');
      setSelectedPrincipleId('');
    } catch (caught) {
      Alert.alert('Could not share finding', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function replyTo(post: ChronologicalPost) {
    if (!session) { await authenticate(); return; }
    const body = replyBodies[post.id]?.trim();
    if (!body) return;
    const author = authorDetails();
    try {
      const created = await createChronologicalReply({ postId: post.id, userId: session.user.id, body, authorName: author.name, authorAvatarUrl: author.avatar });
      setCommunity((current) => ({ ...current, replies: [...current.replies, created] }));
      setReplyBodies((current) => ({ ...current, [post.id]: '' }));
    } catch (caught) {
      Alert.alert('Could not add reply', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  function sharePrinciple(principle: ChronologicalPrinciple) {
    setSelectedPrincipleId(principle.id);
    setView('Members');
  }

  if (!ready) return <View style={styles.center}><Text style={styles.muted}>Syncing your reading journey…</Text></View>;

  return <View style={[styles.page, { paddingTop: insets.top }]}>
    <View style={styles.topBar}>
      {!isMainBibleTab ? <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.back()}><Text style={styles.back}>‹ Bible</Text></Pressable> : <View />}
      <Text style={styles.topTitle}>Chronological Bible</Text>
      <Text style={[styles.sync, !session && styles.syncGuest]}>{session ? '● Synced' : 'View only'}</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {views.map((name) => <Pressable key={name} onPress={() => setView(name)} style={[styles.tab, view === name && styles.tabActive]}><Text style={[styles.tabText, view === name && styles.tabTextActive]}>{name}</Text></Pressable>)}
    </ScrollView>

    {view === 'Readings' ? <SectionList
      ref={listRef}
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      onScrollToIndexFailed={(info) => {
        const pending = pendingScroll.current;
        if (!pending || pending.retries >= 3) return;
        pending.retries += 1;
        listRef.current?.getScrollResponder()?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
        setTimeout(() => listRef.current?.scrollToLocation({ animated: true, sectionIndex: pending.sectionIndex, itemIndex: pending.itemIndex, viewPosition: 0, viewOffset: 8 }), 150);
      }}
      ListHeaderComponent={<View style={styles.readingHeader}>
        <Text style={styles.title}>Bible in Chronological Order</Text>
        <Text style={styles.subtitle}>Read one chapter at a time as the biblical story unfolds in historical sequence.</Text>
        {!session ? <Card style={styles.guestBanner}><Text style={styles.guestTitle}>Google sign-in is optional</Text><Text style={styles.guestNote}>You may explore every reading now. Chapter progress, numbered principles, cross-references, and discussions can only be saved and synced after you sign in.</Text><GoldButton title="Sign In to Save & Sync" loading={busy} onPress={authenticate} /></Card> : null}
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
        <Text style={styles.progressText}>{completedSet.size} of {chronologicalPlanMeta.chapterCount} chapters complete • {completedTaskCount} reading tasks • {percent}%</Text>
        <Card style={styles.continueCard}><Eyebrow>CONTINUE READING</Eyebrow><Text style={styles.continueRef}>{next.title}</Text><Text style={styles.continuePassage}>{next.reference}</Text><GoldButton title="Show Next Reading Task" onPress={() => openReading(next, true)} /></Card>
      </View>}
      renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
      renderItem={({ item }) => {
        const done = item.bibleTasks.every((task) => completedSet.has(task.progressIndex));
        const expanded = expandedReadingId === item.id;
        const principles = community.principles.filter((principle) => principle.reading_id === item.id);
        return <View style={[styles.reading, done && styles.readingDone]}>
          <Pressable onPress={() => openReading(item)}>
            <View style={styles.readingTitleRow}><Text style={styles.taskNumber}>{item.number}</Text><View style={styles.readingCopy}><Text style={styles.reference}>{item.title}</Text><Text style={styles.passage}>{item.reference}</Text>{item.partCount > 1 ? <Text style={styles.partLabel}>PART {item.partNumber} OF {item.partCount} · ORIGINAL ASSIGNMENT {item.sourceNumber}</Text> : null}<Text style={[styles.readLink, done && styles.completeText]}>{done ? '✓ All chapters complete' : expanded ? 'Hide chapters ↑' : 'Show chapters ↓'}</Text></View></View>
          </Pressable>
          {expanded ? <View style={styles.expandedContent}>
            <View style={styles.chapterList}>{item.bibleTasks.map((chapter) => <ChapterTaskRow key={chapter.progressIndex} chapter={chapter} checked={completedSet.has(chapter.progressIndex)} onToggle={() => toggleChapter(item, chapter)} />)}</View>
            <PrinciplesPanel canSave={Boolean(session)} principles={principles} nextPrinciple={nextPrinciple} principleBody={principleBody} crossRefs={crossRefs} busy={busy} onSignIn={authenticate} onPrincipleBody={setPrincipleBody} onCrossRefs={setCrossRefs} onSave={() => savePrinciple(item)} onShare={sharePrinciple} />
          </View> : null}
        </View>;
      }}
      ListFooterComponent={<View style={styles.footer}><OutlineButton title="Return to Bible Guides" onPress={() => router.replace('/(tabs)/journey')} /></View>}
    /> : null}

    {view === 'Progress' ? <ProgressView completedChapters={completedSet.size} completedTasks={completedTaskCount} community={community} onOpenReading={(readingId) => { const reading = chronologicalReadings.find((item) => item.id === readingId); if (reading) { setView('Readings'); setExpandedReadingId(reading.id); setTimeout(() => scrollToReading(reading), 100); } }} onShare={sharePrinciple} /> : null}
    {view === 'Members' ? <MembersView canSave={Boolean(session)} community={community} selectedPrincipleId={selectedPrincipleId} postBody={postBody} replyBodies={replyBodies} busy={busy} onSignIn={authenticate} onSelectPrinciple={setSelectedPrincipleId} onPostBody={setPostBody} onShare={shareFinding} onReplyBody={(postId, body) => setReplyBodies((current) => ({ ...current, [postId]: body }))} onReply={replyTo} /> : null}
  </View>;
}

function ChapterTaskRow({ chapter, checked, onToggle }: { chapter: ChronologicalChapterTask; checked: boolean; onToggle: () => void }) {
  return <View style={styles.chapterRow}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`Mark ${chapter.label} complete`} onPress={onToggle} style={[styles.checkBox, checked && styles.checkBoxDone]}><Text style={styles.checkMark}>{checked ? '✓' : ''}</Text></Pressable>
    <Pressable onPress={() => Linking.openURL(chapter.url)} style={styles.chapterButton}><Text style={styles.chapterText}>{chapter.label}</Text><Text style={styles.chapterArrow}>›</Text></Pressable>
  </View>;
}

function PrinciplesPanel(props: { canSave: boolean; principles: ChronologicalPrinciple[]; nextPrinciple: number; principleBody: string; crossRefs: string; busy: boolean; onSignIn: () => void; onPrincipleBody: (body: string) => void; onCrossRefs: (refs: string) => void; onSave: () => void; onShare: (principle: ChronologicalPrinciple) => void }) {
  if (!props.canSave) return <Card style={styles.principleCard}><Eyebrow>YOUR PRIVATE DISCOVERY</Eyebrow><Text style={styles.cardTitle}>Save numbered principles and cross-references</Text><Text style={styles.body}>Sign in with Google when you want to save your own notes, connect them to earlier principles, and choose what to share with Members.</Text><GoldButton title="Sign In to Save Principles" onPress={props.onSignIn} /></Card>;
  return <Card style={styles.principleCard}>
    <Eyebrow>YOUR PRIVATE DISCOVERY</Eyebrow><Text style={styles.cardTitle}>What principles do you see in this reading?</Text><Text style={styles.number}>PRINCIPLE #{props.nextPrinciple}</Text>
    <TextInput value={props.principleBody} onChangeText={props.onPrincipleBody} placeholder="Write the principle in your own words…" placeholderTextColor={colors.muted} multiline maxLength={2000} style={[styles.input, styles.multiline]} />
    <TextInput value={props.crossRefs} onChangeText={props.onCrossRefs} placeholder="Cross-reference earlier numbers: 12, 19, 42" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} />
    <GoldButton title="Save Principle" loading={props.busy} onPress={props.onSave} />
    {props.principles.map((principle) => <View key={principle.id} style={styles.savedPrinciple}><Text style={styles.number}>PRINCIPLE #{principle.principle_number}</Text><Text style={styles.body}>{principle.body}</Text>{principle.cross_reference_numbers.length ? <Text style={styles.meta}>RELATED: {principle.cross_reference_numbers.map((number) => `#${number}`).join(', ')}</Text> : null}<OutlineButton title="Share with Members" onPress={() => props.onShare(principle)} /></View>)}
  </Card>;
}

function ProgressView({ completedChapters, completedTasks, community, onOpenReading, onShare }: { completedChapters: number; completedTasks: number; community: ChronologicalCommunityData; onOpenReading: (readingId: string) => void; onShare: (principle: ChronologicalPrinciple) => void }) {
  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Eyebrow>YOUR READING JOURNEY</Eyebrow><Text style={styles.title}>Progress & principles</Text><View style={styles.stats}><Card style={styles.stat}><Text style={styles.statNumber}>{Math.round(completedChapters / chronologicalPlanMeta.chapterCount * 100)}%</Text><Text style={styles.meta}>COMPLETE</Text></Card><Card style={styles.stat}><Text style={styles.statNumber}>{community.principles.length}</Text><Text style={styles.meta}>PRINCIPLES</Text></Card></View><Card><Text style={styles.cardTitle}>{completedChapters} of {chronologicalPlanMeta.chapterCount} chapters</Text><Text style={styles.body}>{completedTasks} of {chronologicalPlanMeta.readingCount} numbered reading tasks are fully complete.</Text></Card><Text style={styles.sectionTitle}>My principle index</Text>{community.principles.length ? community.principles.map((principle) => <Card key={principle.id}><Text style={styles.number}>PRINCIPLE #{principle.principle_number}</Text><Text style={styles.body}>{principle.body}</Text>{principle.cross_reference_numbers.length ? <Text style={styles.meta}>RELATED: {principle.cross_reference_numbers.map((number) => `#${number}`).join(', ')}</Text> : null}<View style={styles.smallActions}><OutlineButton title="Open Reading" onPress={() => onOpenReading(principle.reading_id)} /><OutlineButton title="Share" onPress={() => onShare(principle)} /></View></Card>) : <Card><Text style={styles.body}>Your numbered principles will appear here after you sign in and save your first note.</Text></Card>}<View style={{ height: 40 }} /></ScrollView>;
}

function MembersView({ canSave, community, selectedPrincipleId, postBody, replyBodies, busy, onSignIn, onSelectPrinciple, onPostBody, onShare, onReplyBody, onReply }: { canSave: boolean; community: ChronologicalCommunityData; selectedPrincipleId: string; postBody: string; replyBodies: Record<string, string>; busy: boolean; onSignIn: () => void; onSelectPrinciple: (id: string) => void; onPostBody: (body: string) => void; onShare: () => void; onReplyBody: (postId: string, body: string) => void; onReply: (post: ChronologicalPost) => void }) {
  if (!canSave) return <ScrollView style={styles.scroll} contentContainerStyle={styles.content}><Eyebrow>LEARN FROM ONE ANOTHER</Eyebrow><Text style={styles.title}>Members discussion</Text><Card><Text style={styles.cardTitle}>Sign in to join Members</Text><Text style={styles.body}>You can read the complete chronological plan without an account. Google sign-in is required only when you want to save or share a principle, ask a question, or reply.</Text><GoldButton title="Sign In to Join" loading={busy} onPress={onSignIn} /></Card></ScrollView>;
  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Eyebrow>LEARN FROM ONE ANOTHER</Eyebrow><Text style={styles.title}>Members discussion</Text><Text style={styles.subtitle}>Your principles remain private until you deliberately share one here.</Text><Card style={styles.principleCard}><Text style={styles.cardTitle}>Share a finding</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Pressable onPress={() => onSelectPrinciple('')} style={[styles.chip, !selectedPrincipleId && styles.chipActive]}><Text style={[styles.chipText, !selectedPrincipleId && styles.chipTextActive]}>No principle</Text></Pressable>{community.principles.map((principle) => <Pressable key={principle.id} onPress={() => onSelectPrinciple(principle.id)} style={[styles.chip, selectedPrincipleId === principle.id && styles.chipActive]}><Text style={[styles.chipText, selectedPrincipleId === principle.id && styles.chipTextActive]}>#{principle.principle_number}</Text></Pressable>)}</ScrollView><TextInput value={postBody} onChangeText={onPostBody} placeholder="Observation or question for Members…" placeholderTextColor={colors.muted} multiline maxLength={2000} style={[styles.input, styles.multiline]} /><GoldButton title="Post to Members" loading={busy} onPress={onShare} /></Card>{community.posts.length ? community.posts.map((post) => { const postReplies = community.replies.filter((reply) => reply.post_id === post.id); return <Card key={post.id}><Text style={styles.rowTitle}>{post.author_name || 'Try Jesus member'}</Text><Text style={styles.meta}>{new Date(post.created_at).toLocaleDateString()}</Text>{post.principle_number ? <View style={styles.sharedPrinciple}><Text style={styles.number}>PRINCIPLE #{post.principle_number}</Text><Text style={styles.body}>{post.principle_body}</Text></View> : null}<Text style={styles.body}>{post.body}</Text>{postReplies.map((reply) => <View key={reply.id} style={styles.reply}><Text style={styles.rowTitle}>{reply.author_name}</Text><Text style={styles.body}>{reply.body}</Text></View>)}<TextInput value={replyBodies[post.id] ?? ''} onChangeText={(body) => onReplyBody(post.id, body)} placeholder="Add to the discussion…" placeholderTextColor={colors.muted} maxLength={1000} style={styles.input} /><OutlineButton title="Reply" onPress={() => onReply(post)} /></Card>; }) : <Card><Text style={styles.body}>No findings have been shared yet. You can begin the conversation.</Text></Card>}<View style={{ height: 40 }} /></ScrollView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.charcoal},scroll:{flex:1},content:{padding:18,gap:14,paddingBottom:80},
  topBar:{minHeight:52,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.border},back:{color:colors.gold,fontWeight:'900',fontSize:14},topTitle:{color:colors.text,fontWeight:'900',fontSize:15},sync:{color:colors.green,fontSize:9,fontWeight:'800'},syncGuest:{color:colors.gold},
  tabs:{paddingHorizontal:12,paddingVertical:10,gap:7},tab:{paddingHorizontal:15,paddingVertical:10,borderRadius:999,backgroundColor:colors.panel},tabActive:{backgroundColor:colors.gold},tabText:{color:colors.muted,fontSize:10,fontWeight:'800'},tabTextActive:{color:colors.charcoal},
  list:{paddingHorizontal:20,paddingBottom:40},readingHeader:{gap:12,paddingTop:8,paddingBottom:6},title:{color:colors.text,fontSize:30,fontWeight:'900',lineHeight:36},subtitle:{color:colors.muted,fontSize:14,lineHeight:21},
  guestBanner:{borderColor:colors.gold,backgroundColor:colors.panel2},guestTitle:{color:colors.text,fontSize:17,fontWeight:'900',marginBottom:6},guestNote:{color:colors.muted,fontSize:12,lineHeight:18,marginBottom:12},
  progressTrack:{height:8,borderRadius:8,backgroundColor:colors.panel2,overflow:'hidden',marginTop:4},progressFill:{height:'100%',backgroundColor:colors.gold},progressText:{color:colors.ivory,fontSize:12,fontWeight:'700'},
  continueCard:{backgroundColor:colors.plum},continueRef:{color:colors.text,fontSize:18,fontWeight:'800',lineHeight:24},continuePassage:{color:colors.muted,fontSize:13,fontWeight:'700',marginTop:4,marginBottom:14},
  sectionTitle:{color:colors.gold,fontSize:18,fontWeight:'900',marginTop:22,marginBottom:10,lineHeight:24},reading:{padding:14,borderRadius:16,backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,marginBottom:9},readingDone:{borderColor:colors.green},readingTitleRow:{flexDirection:'row',gap:12,alignItems:'flex-start'},taskNumber:{width:30,height:30,borderRadius:10,backgroundColor:colors.plum,color:colors.gold,fontWeight:'900',textAlign:'center',textAlignVertical:'center'},readingCopy:{flex:1},reference:{color:colors.text,fontSize:15,fontWeight:'800',lineHeight:21},passage:{color:colors.ivory,fontSize:13,fontWeight:'700',marginTop:3},partLabel:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:.7,marginTop:5},readLink:{color:colors.gold,fontSize:12,fontWeight:'800',marginTop:6},completeText:{color:colors.green},expandedContent:{marginTop:12,gap:14},
  chapterList:{gap:8},chapterRow:{flexDirection:'row',alignItems:'center',gap:9},checkBox:{width:28,height:28,borderRadius:9,borderWidth:1,borderColor:colors.gold,alignItems:'center',justifyContent:'center',flexShrink:0},checkBoxDone:{backgroundColor:colors.green,borderColor:colors.green},checkMark:{color:colors.charcoal,fontWeight:'900'},chapterButton:{minHeight:48,flex:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:colors.panel2,borderRadius:12,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:colors.border},chapterText:{color:colors.ivory,fontSize:14,fontWeight:'800',flex:1},chapterArrow:{color:colors.gold,fontSize:24,lineHeight:24},
  principleCard:{backgroundColor:colors.panel2,padding:16},cardTitle:{color:colors.text,fontSize:20,fontWeight:'900',lineHeight:26,marginBottom:7},body:{color:colors.ivory,fontSize:13,lineHeight:21,marginBottom:12},number:{color:colors.gold,fontSize:10,fontWeight:'900',letterSpacing:1.2,marginBottom:8},input:{borderWidth:1,borderColor:colors.border,borderRadius:13,backgroundColor:colors.panel,color:colors.text,padding:13,fontSize:13,marginBottom:10},multiline:{minHeight:110,textAlignVertical:'top'},savedPrinciple:{marginTop:12,padding:13,borderRadius:13,backgroundColor:colors.panel},meta:{color:colors.muted,fontSize:10,lineHeight:15,marginBottom:10},
  stats:{flexDirection:'row',gap:10},stat:{flex:1},statNumber:{color:colors.gold,fontSize:34,fontWeight:'900'},smallActions:{gap:8},chips:{gap:8,paddingVertical:10},chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:999,backgroundColor:colors.panel},chipActive:{backgroundColor:colors.gold},chipText:{color:colors.ivory,fontSize:10,fontWeight:'900'},chipTextActive:{color:colors.charcoal},rowTitle:{color:colors.text,fontSize:12,fontWeight:'900',lineHeight:17},sharedPrinciple:{padding:12,borderLeftWidth:3,borderLeftColor:colors.gold,backgroundColor:colors.panel2,marginVertical:10},reply:{marginTop:8,padding:12,borderRadius:12,backgroundColor:colors.panel2},
  footer:{paddingTop:24},muted:{color:colors.muted}
});
