import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import {
  conflictPlan,
  createConflictPost,
  createConflictPrinciple,
  createConflictReply,
  isConflictReadingComplete,
  loadConflictMemberData,
  saveConflictProgress,
  saveConflictSettings,
  type ConflictMemberData,
  type ConflictPost,
  type ConflictPrinciple,
  type ConflictProgress,
  type ConflictReading,
} from '@/lib/conflictJourney';

type ViewName = 'Readings' | 'Journey' | 'Progress' | 'Members';
const views: ViewName[] = ['Readings', 'Journey', 'Progress', 'Members'];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function guestMemberData(): ConflictMemberData {
  return {
    settings: { start_date: isoDate(new Date()), schedule_mode: 'pace', last_reading_id: conflictPlan.readings[0].id },
    progress: [],
    principles: [],
    posts: [],
    replies: [],
  };
}

export default function ConflictJourneyScreen() {
  const insets = useSafeAreaInsets();
  const { session, signInGoogle } = useAuth();
  const [data, setData] = useState<ConflictMemberData | null>(null);
  const [guestBrowsing, setGuestBrowsing] = useState(false);
  const [view, setView] = useState<ViewName>('Readings');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openBook, setOpenBook] = useState('PP');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [principleBody, setPrincipleBody] = useState('');
  const [crossRefs, setCrossRefs] = useState('');
  const [postBody, setPostBody] = useState('');
  const [selectedPrincipleId, setSelectedPrincipleId] = useState('');
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});

  const progressMap = useMemo(() => new Map((data?.progress ?? []).map((row) => [row.reading_id, row])), [data?.progress]);
  const reading = conflictPlan.readings[currentIndex];
  const completed = useMemo(() => conflictPlan.readings.filter((item) => isConflictReadingComplete(item, progressMap.get(item.id))).length, [progressMap]);

  const load = useCallback(async () => {
    if (!session) {
      setData(guestBrowsing ? guestMemberData() : null);
      return;
    }
    try {
      setError('');
      const next = await loadConflictMemberData(session.user.id);
      setGuestBrowsing(false);
      setData(next);
      const nextProgress = new Map(next.progress.map((row) => [row.reading_id, row]));
      const savedIndex = next.settings.last_reading_id ? conflictPlan.readings.findIndex((item) => item.id === next.settings.last_reading_id) : -1;
      const firstIncomplete = conflictPlan.readings.findIndex((item) => !isConflictReadingComplete(item, nextProgress.get(item.id)));
      const index = savedIndex >= 0 && !isConflictReadingComplete(conflictPlan.readings[savedIndex], nextProgress.get(conflictPlan.readings[savedIndex].id)) ? savedIndex : firstIncomplete >= 0 ? firstIncomplete : conflictPlan.readings.length - 1;
      setCurrentIndex(index);
      setOpenBook(conflictPlan.readings[index].code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the shared reading journey.');
    }
  }, [guestBrowsing, session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function authenticate() {
    try { setBusy(true); await signInGoogle(); }
    catch (caught) { Alert.alert('Sign in did not finish', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  function goToReading(index: number) {
    const safe = Math.max(0, Math.min(index, conflictPlan.readings.length - 1));
    setCurrentIndex(safe);
    setOpenBook(conflictPlan.readings[safe].code);
    setView('Readings');
    if (session && data) saveConflictSettings(session.user.id, { ...data.settings, last_reading_id: conflictPlan.readings[safe].id }).then((settings) => setData((current) => current ? { ...current, settings } : current)).catch(() => {});
  }

  async function toggleProgress(field: 'bible_complete' | 'commentary_complete') {
    if (!session || !data) return;
    const previous = progressMap.get(reading.id) ?? { reading_id: reading.id, bible_complete: false, commentary_complete: false };
    const next = { ...previous, [field]: !previous[field] };
    setData({ ...data, progress: [...data.progress.filter((row) => row.reading_id !== reading.id), next] });
    try {
      const saved = await saveConflictProgress(session.user.id, reading, next);
      setData((current) => current ? { ...current, progress: [...current.progress.filter((row) => row.reading_id !== reading.id), saved] } : current);
    } catch (caught) {
      setData(data);
      Alert.alert('Could not sync progress', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  async function openReading(kind: 'bible' | 'commentary', url: string) {
    if (!data) return;
    if (session) {
      const previous = progressMap.get(reading.id) ?? { reading_id: reading.id, bible_complete: false, commentary_complete: false };
      const field = kind === 'bible' ? 'bible_opened_at' : 'commentary_opened_at';
      const next: ConflictProgress = { ...previous, [field]: previous[field] ?? new Date().toISOString() };
      saveConflictProgress(session.user.id, reading, next).then((saved) => setData((current) => current ? { ...current, progress: [...current.progress.filter((row) => row.reading_id !== reading.id), saved] } : current)).catch(() => {});
    }
    await Linking.openURL(url);
  }

  async function savePrinciple() {
    if (!data || !principleBody.trim()) return;
    const references = Array.from(new Set(crossRefs.split(/[^0-9]+/).filter(Boolean).map(Number))).sort((a, b) => a - b);
    const unknown = references.filter((number) => !data.principles.some((principle) => principle.principle_number === number));
    if (unknown.length) { Alert.alert('Check cross-references', `These principles do not exist yet: ${unknown.map((number) => `#${number}`).join(', ')}`); return; }
    try {
      setBusy(true);
      const created = await createConflictPrinciple(reading.id, principleBody.trim(), references);
      setData({ ...data, principles: [...data.principles, created].sort((a, b) => a.principle_number - b.principle_number) });
      setPrincipleBody(''); setCrossRefs('');
    } catch (caught) { Alert.alert('Could not save principle', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  function authorDetails() {
    const metadata = session?.user.user_metadata ?? {};
    return { name: metadata.full_name || metadata.name || session?.user.email?.split('@')[0] || 'Try Jesus member', avatar: metadata.avatar_url || metadata.picture || undefined };
  }

  async function shareFinding() {
    if (!session || !data || !postBody.trim()) return;
    const principle = data.principles.find((item) => item.id === selectedPrincipleId);
    const author = authorDetails();
    try {
      setBusy(true);
      const created = await createConflictPost({ userId: session.user.id, readingId: principle?.reading_id ?? reading.id, body: postBody.trim(), authorName: author.name, authorAvatarUrl: author.avatar, principle });
      setData({ ...data, posts: [created, ...data.posts] });
      setPostBody(''); setSelectedPrincipleId('');
    } catch (caught) { Alert.alert('Could not share finding', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function replyTo(post: ConflictPost) {
    if (!session || !data) return;
    const body = replyBodies[post.id]?.trim();
    if (!body) return;
    const author = authorDetails();
    try {
      const created = await createConflictReply({ postId: post.id, userId: session.user.id, body, authorName: author.name, authorAvatarUrl: author.avatar });
      setData({ ...data, replies: [...data.replies, created] });
      setReplyBodies((current) => ({ ...current, [post.id]: '' }));
    } catch (caught) { Alert.alert('Could not add reply', caught instanceof Error ? caught.message : 'Please try again.'); }
  }

  if (!session && !guestBrowsing) return <ScrollView contentContainerStyle={[styles.authPage, { paddingTop: insets.top + 40 }]}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.authEyebrow}>GOOGLE SIGN-IN IS OPTIONAL</Text><Text style={styles.authTitle}>The Bible & Conflict of the Ages Journey</Text><Text style={styles.authBody}>Explore the complete journey without an account. Sign in with Google only when you want your progress, numbered principles, cross-references, and member discussions saved and synced with tryjesusmedia.com.</Text><GoldButton title="Continue with Google" loading={busy} onPress={authenticate} /><OutlineButton title="Explore Without Saving" onPress={() => { setData(guestMemberData()); setGuestBrowsing(true); }} /><Text style={styles.authNote}>Progress can only be saved after you sign in.</Text></ScrollView>;

  if (!data) return <View style={[styles.center, { paddingTop: insets.top }]}><Text style={styles.loading}>{error || 'Syncing your journey…'}</Text>{error ? <OutlineButton title="Try Again" onPress={load} /> : null}</View>;

  const readingProgress = progressMap.get(reading.id);
  return <View style={[styles.page, { paddingTop: insets.top }]}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Bible</Text></Pressable><Text style={styles.headerTitle}>Bible & Conflict</Text><Text style={[styles.sync, !session && styles.syncGuest]}>{session ? '● Synced' : 'View only'}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{views.map((name) => <Pressable key={name} onPress={() => setView(name)} style={[styles.tab, view === name && styles.tabActive]}><Text style={[styles.tabText, view === name && styles.tabTextActive]}>{name}</Text></Pressable>)}</ScrollView>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!session ? <Card style={styles.guestBanner}><Text style={styles.guestTitle}>Viewing without an account</Text><Text style={styles.guestNote}>You can explore every reading. Progress, principles, cross-references, and discussion activity are saved only after you sign in.</Text><GoldButton title="Sign In to Save" loading={busy} onPress={authenticate} /></Card> : null}
      {view === 'Readings' ? <ReadingsView canSave={Boolean(session)} onSignIn={authenticate} reading={reading} index={currentIndex} progress={readingProgress} principles={data.principles.filter((item) => item.reading_id === reading.id)} nextPrinciple={data.principles.reduce((max, item) => Math.max(max, item.principle_number), 0) + 1} completed={completed} principleBody={principleBody} crossRefs={crossRefs} busy={busy} onPrincipleBody={setPrincipleBody} onCrossRefs={setCrossRefs} onSavePrinciple={savePrinciple} onOpen={openReading} onToggle={toggleProgress} onPrevious={() => goToReading(currentIndex - 1)} onNext={() => goToReading(currentIndex + 1)} /> : null}
      {view === 'Journey' ? <JourneyView progressMap={progressMap} openBook={openBook} setOpenBook={setOpenBook} goToReading={goToReading} /> : null}
      {view === 'Progress' ? <ProgressView data={data} progressMap={progressMap} completed={completed} goToReading={goToReading} onShare={(principle) => { setSelectedPrincipleId(principle.id); setView('Members'); }} /> : null}
      {view === 'Members' ? <MembersView canSave={Boolean(session)} onSignIn={authenticate} data={data} selectedPrincipleId={selectedPrincipleId} postBody={postBody} replyBodies={replyBodies} busy={busy} onSelectPrinciple={setSelectedPrincipleId} onPostBody={setPostBody} onShare={shareFinding} onReplyBody={(postId, body) => setReplyBodies((current) => ({ ...current, [postId]: body }))} onReply={replyTo} /> : null}
      <View style={{ height: 40 }} />
    </ScrollView>
  </View>;
}

function CheckRow({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}><View style={[styles.checkBox, checked && styles.checkBoxDone]}><Text style={styles.checkMark}>{checked ? '✓' : ''}</Text></View><Text style={styles.checkLabel}>{label}</Text></Pressable>;
}

function ReadingsView(props: { canSave: boolean; onSignIn: () => void; reading: ConflictReading; index: number; progress?: ConflictProgress; principles: ConflictPrinciple[]; nextPrinciple: number; completed: number; principleBody: string; crossRefs: string; busy: boolean; onPrincipleBody: (value: string) => void; onCrossRefs: (value: string) => void; onSavePrinciple: () => void; onOpen: (kind: 'bible' | 'commentary', url: string) => void; onToggle: (field: 'bible_complete' | 'commentary_complete') => void; onPrevious: () => void; onNext: () => void }) {
  const { reading, progress } = props;
  return <>
    <Eyebrow>READING {reading.day} OF {conflictPlan.readings.length}</Eyebrow><Text style={styles.title}>{reading.title}</Text><Text style={styles.subtitle}>Scripture comes first. The companion reading follows the same supplied pairing.</Text>
    <View style={styles.readingNav}><OutlineButton title="‹ Previous" onPress={props.onPrevious} disabled={props.index === 0} /><Text style={styles.percent}>{Math.round(props.completed / conflictPlan.readings.length * 100)}%</Text><OutlineButton title="Next ›" onPress={props.onNext} disabled={props.index === conflictPlan.readings.length - 1} /></View>
    <Card style={styles.scriptureCard}><Eyebrow>THE BIBLE · READ FIRST</Eyebrow><Text style={styles.scriptureRef}>{reading.bibleReference || 'No Scripture passage listed'}</Text><Text style={styles.body}>{reading.bibleReference ? 'Choose one chapter at a time. Each link opens only that chapter or its assigned verses on Bible Gateway (KJV).' : 'This source entry contains only a companion assignment.'}</Text>{reading.bibleTasks.length ? <View style={styles.taskList}>{reading.bibleTasks.map((task) => <GoldButton key={`${task.book}-${task.chapter}`} title={task.label} onPress={() => props.onOpen('bible', task.url)} />)}</View> : <Text style={styles.review}>△ {reading.reviewNote ?? 'No Scripture reading was supplied.'}</Text>}{reading.bibleReference ? props.canSave ? <CheckRow checked={Boolean(progress?.bible_complete)} label="Scripture complete" onPress={() => props.onToggle('bible_complete')} /> : <OutlineButton title="Sign In to Save Progress" onPress={props.onSignIn} /> : null}</Card>
    <Card><Eyebrow>CONFLICT OF THE AGES · COMPANION</Eyebrow><Text style={styles.cardTitle}>{reading.commentaryBook}</Text><Text style={styles.body}>{reading.commentaryCitation || 'No companion reading was listed.'}</Text>{reading.commentaryTasks.length ? <View style={styles.taskList}>{reading.commentaryTasks.map((task) => <OutlineButton key={`${task.paragraphId}`} title={task.label} onPress={() => props.onOpen('commentary', task.url)} />)}</View> : null}{reading.commentaryCitation ? props.canSave ? <CheckRow checked={Boolean(progress?.commentary_complete)} label="Companion complete" onPress={() => props.onToggle('commentary_complete')} /> : <OutlineButton title="Sign In to Save Progress" onPress={props.onSignIn} /> : null}{reading.reviewNote ? <Text style={styles.review}>△ {reading.reviewNote}</Text> : null}</Card>
    {props.canSave ? <Card style={styles.principleCard}><Eyebrow>YOUR PRIVATE DISCOVERY</Eyebrow><Text style={styles.cardTitle}>What principles do you see after this reading?</Text><Text style={styles.number}>PRINCIPLE #{props.nextPrinciple}</Text><TextInput value={props.principleBody} onChangeText={props.onPrincipleBody} placeholder="In my own words…" placeholderTextColor={colors.muted} multiline maxLength={2000} style={[styles.input, styles.multiline]} /><TextInput value={props.crossRefs} onChangeText={props.onCrossRefs} placeholder="Related numbers: 12, 19, 42" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} /><GoldButton title="Save Principle" loading={props.busy} onPress={props.onSavePrinciple} />{props.principles.map((principle) => <View key={principle.id} style={styles.savedPrinciple}><Text style={styles.number}>PRINCIPLE #{principle.principle_number}</Text><Text style={styles.body}>{principle.body}</Text></View>)}</Card> : <Card style={styles.principleCard}><Eyebrow>YOUR PRIVATE DISCOVERY</Eyebrow><Text style={styles.cardTitle}>Save numbered principles and cross-references</Text><Text style={styles.body}>Sign in with Google when you want to save your own discoveries and connect them across readings.</Text><GoldButton title="Sign In to Save Principles" onPress={props.onSignIn} /></Card>}
  </>;
}

function JourneyView({ progressMap, openBook, setOpenBook, goToReading }: { progressMap: Map<string, ConflictProgress>; openBook: string; setOpenBook: (code: string) => void; goToReading: (index: number) => void }) {
  return <><Eyebrow>THE COMPLETE STORY</Eyebrow><Text style={styles.title}>Your journey</Text><Text style={styles.subtitle}>All 265 supplied pairings, in their original order.</Text>{conflictPlan.books.map((book) => { const readings = conflictPlan.readings.filter((item) => item.code === book.code); const complete = readings.filter((item) => isConflictReadingComplete(item, progressMap.get(item.id))).length; const open = openBook === book.code; return <Card key={book.code} style={styles.bookCard}><Pressable onPress={() => setOpenBook(open ? '' : book.code)} style={styles.bookHeader}><View style={styles.bookBadge}><Text style={styles.bookBadgeText}>{book.code}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{book.title}</Text><Text style={styles.meta}>{complete}/{readings.length} complete</Text></View><Text style={styles.gold}>{open ? '−' : '+'}</Text></Pressable>{open ? readings.map((item) => <Pressable key={item.id} onPress={() => goToReading(item.day - 1)} style={styles.journeyRow}><Text style={[styles.journeyCheck, isConflictReadingComplete(item, progressMap.get(item.id)) && styles.journeyCheckDone]}>{isConflictReadingComplete(item, progressMap.get(item.id)) ? '✓' : ''}</Text><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Reading {item.day} · {item.title}</Text><Text style={styles.meta}>{item.bibleReference || item.commentaryCitation}</Text></View></Pressable>) : null}</Card>; })}</>;
}

function ProgressView({ data, progressMap, completed, goToReading, onShare }: { data: ConflictMemberData; progressMap: Map<string, ConflictProgress>; completed: number; goToReading: (index: number) => void; onShare: (principle: ConflictPrinciple) => void }) {
  return <><Eyebrow>EVERY DISCOVERY IN ONE PLACE</Eyebrow><Text style={styles.title}>Progress & principles</Text><View style={styles.stats}><Card style={styles.stat}><Text style={styles.statNumber}>{Math.round(completed / conflictPlan.readings.length * 100)}%</Text><Text style={styles.meta}>JOURNEY COMPLETE</Text></Card><Card style={styles.stat}><Text style={styles.statNumber}>{data.principles.length}</Text><Text style={styles.meta}>PRINCIPLES</Text></Card></View>{conflictPlan.books.map((book) => { const readings = conflictPlan.readings.filter((item) => item.code === book.code); const count = readings.filter((item) => isConflictReadingComplete(item, progressMap.get(item.id))).length; return <View key={book.code} style={styles.progressRow}><Text style={styles.rowTitle}>{book.shortTitle}</Text><Text style={styles.meta}>{count}/{readings.length}</Text></View>; })}<Text style={styles.sectionTitle}>My principle index</Text>{data.principles.length ? data.principles.map((principle) => { const index = conflictPlan.readings.findIndex((item) => item.id === principle.reading_id); return <Card key={principle.id}><Text style={styles.number}>PRINCIPLE #{principle.principle_number} · READING {index + 1}</Text><Text style={styles.body}>{principle.body}</Text>{principle.cross_reference_numbers.length ? <Text style={styles.meta}>RELATED: {principle.cross_reference_numbers.map((number) => `#${number}`).join(', ')}</Text> : null}<View style={styles.smallActions}><OutlineButton title="Open Reading" onPress={() => goToReading(index)} /><OutlineButton title="Share" onPress={() => onShare(principle)} /></View></Card>; }) : <Card><Text style={styles.body}>Your numbered principles will appear here.</Text></Card>}</>;
}

function MembersView({ canSave, onSignIn, data, selectedPrincipleId, postBody, replyBodies, busy, onSelectPrinciple, onPostBody, onShare, onReplyBody, onReply }: { canSave: boolean; onSignIn: () => void; data: ConflictMemberData; selectedPrincipleId: string; postBody: string; replyBodies: Record<string, string>; busy: boolean; onSelectPrinciple: (id: string) => void; onPostBody: (body: string) => void; onShare: () => void; onReplyBody: (postId: string, body: string) => void; onReply: (post: ConflictPost) => void }) {
  if (!canSave) return <><Eyebrow>LEARN FROM ONE ANOTHER</Eyebrow><Text style={styles.title}>Members discussion</Text><Card><Text style={styles.cardTitle}>Sign in to join Members</Text><Text style={styles.body}>You can explore the full reading plan without an account. Google sign-in is required only when you want to share a finding, ask a question, or reply.</Text><GoldButton title="Sign In to Join" onPress={onSignIn} /></Card></>;
  return <><Eyebrow>LEARN FROM ONE ANOTHER</Eyebrow><Text style={styles.title}>Members discussion</Text><Text style={styles.subtitle}>Your principles stay private until you deliberately share one here.</Text><Card style={styles.principleCard}><Text style={styles.cardTitle}>Share a finding</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}><Pressable onPress={() => onSelectPrinciple('')} style={[styles.chip, !selectedPrincipleId && styles.chipActive]}><Text style={styles.chipText}>No principle</Text></Pressable>{data.principles.map((principle) => <Pressable key={principle.id} onPress={() => onSelectPrinciple(principle.id)} style={[styles.chip, selectedPrincipleId === principle.id && styles.chipActive]}><Text style={styles.chipText}>#{principle.principle_number}</Text></Pressable>)}</ScrollView><TextInput value={postBody} onChangeText={onPostBody} placeholder="Observation or question for members…" placeholderTextColor={colors.muted} multiline maxLength={2000} style={[styles.input, styles.multiline]} /><GoldButton title="Post to Members" loading={busy} onPress={onShare} /></Card>{data.posts.length ? data.posts.map((post) => { const postReplies = data.replies.filter((reply) => reply.post_id === post.id); return <Card key={post.id}><Text style={styles.rowTitle}>{post.author_name || 'Try Jesus member'}</Text><Text style={styles.meta}>{new Date(post.created_at).toLocaleDateString()}</Text>{post.principle_number ? <View style={styles.sharedPrinciple}><Text style={styles.number}>PRINCIPLE #{post.principle_number}</Text><Text style={styles.body}>{post.principle_body}</Text></View> : null}<Text style={styles.body}>{post.body}</Text>{postReplies.map((reply) => <View key={reply.id} style={styles.reply}><Text style={styles.rowTitle}>{reply.author_name}</Text><Text style={styles.body}>{reply.body}</Text></View>)}<TextInput value={replyBodies[post.id] ?? ''} onChangeText={(body) => onReplyBody(post.id, body)} placeholder="Add to the discussion…" placeholderTextColor={colors.muted} maxLength={1000} style={styles.input} /><OutlineButton title="Reply" onPress={() => onReply(post)} /></Card>; }) : <Card><Text style={styles.body}>No findings have been shared yet. You can begin the conversation.</Text></Card>}</>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},scroll:{flex:1},content:{padding:18,gap:14,paddingBottom:80},center:{flex:1,backgroundColor:colors.charcoal,alignItems:'center',justifyContent:'center',padding:30,gap:18},loading:{color:colors.muted,textAlign:'center'},
  header:{minHeight:52,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.border},back:{color:colors.gold,fontWeight:'900',fontSize:14},headerTitle:{color:colors.text,fontWeight:'900',fontSize:15},sync:{color:colors.green,fontSize:9,fontWeight:'800'},syncGuest:{color:colors.gold},
  tabs:{paddingHorizontal:12,paddingVertical:10,gap:7},tab:{paddingHorizontal:15,paddingVertical:10,borderRadius:999,backgroundColor:colors.panel},tabActive:{backgroundColor:colors.gold},tabText:{color:colors.muted,fontSize:10,fontWeight:'800'},tabTextActive:{color:colors.charcoal},
  title:{color:colors.text,fontSize:34,fontWeight:'900',lineHeight:39},subtitle:{color:colors.muted,fontSize:13,lineHeight:20,marginBottom:5},sectionTitle:{color:colors.text,fontSize:24,fontWeight:'900',marginTop:18},cardTitle:{color:colors.text,fontSize:21,fontWeight:'900',lineHeight:27,marginBottom:7},body:{color:colors.ivory,fontSize:13,lineHeight:21,marginBottom:12},meta:{color:colors.muted,fontSize:10,lineHeight:15},gold:{color:colors.gold,fontSize:28,fontWeight:'900'},muted:{color:colors.muted},
  readingNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},percent:{color:colors.gold,fontWeight:'900'},scriptureCard:{backgroundColor:colors.plum,padding:22},scriptureRef:{color:colors.text,fontSize:31,fontWeight:'900',lineHeight:37,marginBottom:12},taskList:{gap:8,marginBottom:6},review:{color:'#ffb9b3',fontSize:11,lineHeight:17,marginTop:14},checkRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:14},checkBox:{width:27,height:27,borderRadius:8,borderWidth:1,borderColor:colors.gold,alignItems:'center',justifyContent:'center'},checkBoxDone:{backgroundColor:colors.green,borderColor:colors.green},checkMark:{color:colors.charcoal,fontWeight:'900'},checkLabel:{color:colors.ivory,fontSize:12,fontWeight:'800'},
  principleCard:{backgroundColor:colors.panel2},number:{color:colors.gold,fontSize:10,fontWeight:'900',letterSpacing:1.2,marginBottom:8},input:{borderWidth:1,borderColor:colors.border,borderRadius:13,backgroundColor:colors.panel,color:colors.text,padding:13,fontSize:13,marginBottom:10},multiline:{minHeight:120,textAlignVertical:'top'},savedPrinciple:{marginTop:12,padding:13,borderRadius:13,backgroundColor:colors.panel},
  bookCard:{padding:0,overflow:'hidden'},bookHeader:{padding:16,flexDirection:'row',alignItems:'center',gap:12},bookBadge:{width:44,height:44,borderRadius:22,backgroundColor:colors.plum,alignItems:'center',justifyContent:'center'},bookBadgeText:{color:colors.gold,fontWeight:'900'},journeyRow:{padding:13,borderTopWidth:1,borderTopColor:colors.border,flexDirection:'row',alignItems:'center',gap:10},journeyCheck:{width:28,height:28,borderWidth:1,borderColor:colors.border,borderRadius:8,textAlign:'center',textAlignVertical:'center',color:colors.charcoal},journeyCheckDone:{backgroundColor:colors.green,borderColor:colors.green},rowTitle:{color:colors.text,fontSize:12,fontWeight:'900',lineHeight:17},
  stats:{flexDirection:'row',gap:10},stat:{flex:1},statNumber:{color:colors.gold,fontSize:34,fontWeight:'900'},progressRow:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border,flexDirection:'row',justifyContent:'space-between'},smallActions:{gap:8},
  chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:999,backgroundColor:colors.panel},chipActive:{backgroundColor:colors.gold},chipText:{color:colors.ivory,fontSize:10,fontWeight:'900'},sharedPrinciple:{padding:12,borderLeftWidth:3,borderLeftColor:colors.gold,backgroundColor:colors.panel2,marginVertical:10},reply:{marginTop:8,padding:12,borderRadius:12,backgroundColor:colors.panel2},
  guestBanner:{borderColor:colors.gold,backgroundColor:colors.panel2},guestTitle:{color:colors.text,fontSize:17,fontWeight:'900',marginBottom:6},guestNote:{color:colors.muted,fontSize:12,lineHeight:18,marginBottom:12},
  authPage:{flexGrow:1,backgroundColor:colors.charcoal,padding:26,justifyContent:'center',gap:12},authEyebrow:{color:colors.gold,fontSize:11,fontWeight:'900',letterSpacing:1.8,marginTop:30},authTitle:{color:colors.text,fontSize:39,fontWeight:'900',lineHeight:44,marginTop:12},authBody:{color:colors.muted,fontSize:15,lineHeight:23,marginVertical:6},authNote:{color:colors.gold,fontSize:11,fontWeight:'800',textAlign:'center'},
});
