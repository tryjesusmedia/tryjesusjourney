import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getGuestJournal, saveGuestJournal, type GuestJournal } from '@/lib/localStore';

type Entry = { id: string | number; title?: string | null; body: string; created_at?: string; createdAt?: string };

export default function JournalScreen(){
  const insets = useSafeAreaInsets();
  const { session, guest } = useAuth();
  const [entries,setEntries]=useState<Entry[]>([]); const [open,setOpen]=useState(false); const [title,setTitle]=useState(''); const [body,setBody]=useState('');
  const load=useCallback(async()=>{ if(session){const r=await supabase.from('journal_entries').select('*').order('created_at',{ascending:false}); setEntries(r.data??[]);} else if(guest){setEntries(await getGuestJournal());}},[session,guest]);
  useFocusEffect(useCallback(()=>{load();},[load]));
  async function save(){if(!body.trim()) return; if(session){const r=await supabase.from('journal_entries').insert({user_id:session.user.id,title:title.trim()||'Reflection',body:body.trim()}); if(r.error){Alert.alert('Could not save',r.error.message);return;}} else {const current=await getGuestJournal();const next:GuestJournal={id:String(Date.now()),title:title.trim()||'Reflection',body:body.trim(),createdAt:new Date().toISOString()};await saveGuestJournal([next,...current]);} setTitle('');setBody('');setOpen(false);load();}
  async function remove(item:Entry){if(session){await supabase.from('journal_entries').delete().eq('id',item.id);}else{const current=await getGuestJournal();await saveGuestJournal(current.filter(e=>e.id!==String(item.id)));}load();}
  return <View style={[styles.page,{paddingTop:insets.top+12}]}><View style={styles.header}><View><Pressable accessibilityRole="button" hitSlop={10} onPress={()=>router.replace('/(tabs)/bible')} style={styles.backButton}><Text style={styles.back}>‹ Bible</Text></Pressable><Eyebrow>PRIVATE</Eyebrow><Text style={styles.title}>Prayer Journal</Text></View><Pressable style={styles.plus} onPress={()=>setOpen(true)}><Text style={styles.plusText}>＋</Text></Pressable></View>
    <FlatList data={entries} keyExtractor={i=>String(i.id)} contentContainerStyle={{gap:12,paddingBottom:100}} ListEmptyComponent={<Card><Text style={styles.empty}>Your prayers and reflections will appear here. Write what is on your heart or what you want to remember.</Text><GoldButton title="Write My First Prayer" onPress={()=>setOpen(true)} /></Card>} renderItem={({item})=><Card><Text style={styles.entryTitle}>{item.title||'Reflection'}</Text><Text style={styles.entryBody}>{item.body}</Text><Pressable onPress={()=>Alert.alert('Delete entry?','This cannot be undone.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>remove(item)}])}><Text style={styles.delete}>Delete</Text></Pressable></Card>} />
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}><View style={styles.modal}><Text style={styles.modalTitle}>New Prayer Journal Entry</Text><TextInput value={title} onChangeText={setTitle} placeholder="Title (optional)" placeholderTextColor={colors.muted} style={styles.input}/><TextInput value={body} onChangeText={setBody} placeholder="What is on your heart?" placeholderTextColor={colors.muted} multiline style={[styles.input,styles.bodyInput]}/><View style={{gap:10}}><GoldButton title="Save to My Prayer Journal" onPress={save}/><OutlineButton title="Cancel" onPress={()=>setOpen(false)}/></View></View></Modal>
  </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.charcoal,padding:20},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:18},backButton:{alignSelf:'flex-start',minHeight:44,justifyContent:'center'},back:{color:colors.gold,fontWeight:'800',fontSize:15},title:{color:colors.text,fontSize:25,fontWeight:'900'},plus:{width:46,height:46,borderRadius:23,backgroundColor:colors.gold,alignItems:'center',justifyContent:'center'},plusText:{fontSize:24,color:colors.charcoal,fontWeight:'900'},empty:{color:colors.ivory,lineHeight:22,marginBottom:16},entryTitle:{color:colors.gold,fontSize:15,fontWeight:'900',marginBottom:8},entryBody:{color:colors.ivory,lineHeight:22},delete:{color:colors.red,marginTop:16,fontWeight:'700'},modal:{flex:1,backgroundColor:colors.charcoal,padding:24,paddingTop:50},modalTitle:{color:colors.text,fontSize:28,fontWeight:'900',marginBottom:20},input:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:15,padding:15,color:colors.text,fontSize:16,marginBottom:12},bodyInput:{height:220,textAlignVertical:'top'}});
