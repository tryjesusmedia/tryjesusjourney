import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/constants/theme';
import { WHATSAPP_GROUP_URL } from '@/constants/links';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Source = {
  id?: string | number;
  category?: string;
  topic?: string;
  source_title?: string;
  source_url?: string;
  scripture_refs?: string[] | string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
};

const starters = [
  'Why does God allow evil?',
  'How can I know the Bible is trustworthy?',
  'What does the Bible say about the future?',
  'How do I begin a relationship with Jesus?',
];

export default function AskPastorKalScreen() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    (async () => {
      const { data } = await supabase
        .from('pastor_kal_chat_messages')
        .select('id,role,message,sources,created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(40);
      if (data?.length) {
        setMessages(data.map((row: any) => ({ id: String(row.id), role: row.role, text: row.message, sources: row.sources ?? undefined })));
      }
    })();
  }, [session?.user.id]);

  async function saveMessage(message: ChatMessage) {
    if (!session?.user.id || message.id === 'welcome') return;
    await supabase.from('pastor_kal_chat_messages').insert({
      user_id: session.user.id,
      role: message.role,
      message: message.text,
      sources: message.sources ?? [],
    });
  }

  async function send(textOverride?: string) {
    const question = (textOverride ?? input).trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput('');
    setLoading(true);
    saveMessage(userMessage);

    try {
      const history = next.slice(-8).map((m) => ({ role: m.role, content: m.text }));
      const { data, error } = await supabase.functions.invoke('ask-pastor-kal', {
        body: { question, history },
      });
      if (error) throw error;
      if (!data?.answer) throw new Error(data?.error ?? 'No answer returned.');

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.answer,
        sources: Array.isArray(data.sources) ? data.sources : [],
      };
      setMessages((current) => [...current, assistantMessage]);
      saveMessage(assistantMessage);
    } catch (error) {
      Alert.alert(
        'Ask Pastor Kal is not connected yet',
        error instanceof Error ? error.message : 'Deploy the included ask-pastor-kal Edge Function and add the required server secret.',
      );
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PRIVATE · WELCOMING</Text>
        <Text style={styles.title}>Ask Pastor Kal</Text>
        <Text style={styles.subtitle}>Hi, I’m an AI chatbot based on the real Pastor Kal. I’ll thoughtfully answer your questions with Bible-based, Christ-centered guidance that reveals God’s heart.</Text>
        <Text style={[styles.subtitle, styles.contactSubtitle]}>This Pastor Kal is an AI chat bot. If you&apos;d like to contact the real human Pastor Kal, join the WhatsApp family chat <Text accessibilityRole="link" accessibilityLabel="Join the WhatsApp family chat" onPress={() => Linking.openURL(WHATSAPP_GROUP_URL)} style={styles.contactLink}>here</Text>.</Text>
      </View>

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a Bible question…"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.input}
          maxLength={1200}
          onSubmitEditing={() => send()}
        />
        <Pressable disabled={loading || !input.trim()} onPress={() => send()} style={[styles.send, (loading || !input.trim()) && styles.sendDisabled]}>
          <Text style={styles.sendText}>Ask</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {messages.map((message) => (
          <View key={message.id} style={[styles.message, message.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
            <Text style={styles.role}>{message.role === 'user' ? 'YOU' : 'PASTOR KAL AI'}</Text>
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ))}
        {loading ? <View style={[styles.message, styles.assistantMessage, styles.loading]}><ActivityIndicator color={colors.gold} /><Text style={styles.messageText}>Kal is checking his notes...</Text></View> : null}

        {messages.length === 0 ? (
          <View style={styles.starters}>
            <Text style={styles.starterTitle}>START WITH A QUESTION</Text>
            {starters.map((starter) => <Pressable key={starter} onPress={() => send(starter)} style={styles.starter}><Text style={styles.starterText}>{starter}</Text></Pressable>)}
          </View>
        ) : null}

      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},header:{paddingHorizontal:20,paddingTop:52,paddingBottom:14,borderBottomWidth:1,borderBottomColor:colors.border},eyebrow:{color:colors.gold,fontWeight:'900',fontSize:10,letterSpacing:1.8,marginBottom:5},title:{color:colors.text,fontSize:30,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:13,lineHeight:19,marginTop:5},
  chat:{flex:1},chatContent:{padding:16,gap:12,paddingBottom:28},message:{borderRadius:20,padding:16,borderWidth:1},assistantMessage:{backgroundColor:colors.panel,borderColor:colors.border,marginRight:28},userMessage:{backgroundColor:colors.plum,borderColor:'rgba(255,255,255,.12)',marginLeft:28},role:{color:colors.gold,fontSize:9,fontWeight:'900',letterSpacing:1.4,marginBottom:6},messageText:{color:colors.text,fontSize:15,lineHeight:23},loading:{flexDirection:'row',gap:10,alignItems:'center'},
  starters:{gap:8,marginVertical:4},starterTitle:{color:colors.muted,fontSize:10,fontWeight:'900',letterSpacing:1.5},starter:{backgroundColor:colors.panel2,borderRadius:14,padding:13,borderWidth:1,borderColor:colors.border},starterText:{color:colors.ivory,fontWeight:'800'},
  contactSubtitle:{marginTop:10},contactLink:{color:colors.gold,fontWeight:'900',textDecorationLine:'underline'},
  composer:{flexDirection:'row',alignItems:'flex-end',gap:10,padding:12,borderBottomWidth:1,borderBottomColor:colors.border,backgroundColor:'#191419'},input:{flex:1,minHeight:48,maxHeight:120,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,paddingHorizontal:14,paddingVertical:12,color:colors.text,fontSize:15},send:{backgroundColor:colors.gold,borderRadius:16,minHeight:48,paddingHorizontal:18,alignItems:'center',justifyContent:'center'},sendDisabled:{opacity:.45},sendText:{color:colors.charcoal,fontWeight:'900'}
});
