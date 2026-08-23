import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/constants/theme';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function MoreScreen(){
  const { session, guest, signOut }=useAuth();
  async function exit(){await signOut();router.replace('/login');}
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Eyebrow>TRY JESUS MEDIA</Eyebrow><Text style={styles.title}>Your journey, your pace.</Text>
    <Card><Text style={styles.cardTitle}>Ask Pastor Kal</Text><Text style={styles.body}>Ask this AI chatbot any Bible question in a private, welcoming space, and save your conversations so you can revisit them anytime.</Text><GoldButton title="Ask Pastor Kal" onPress={()=>router.push('/(tabs)/ask')}/></Card>
    <Card><Text style={styles.cardTitle}>Bible in Chronological Order</Text><Text style={styles.body}>Read the Bible in historical sequence and continue from your saved place.</Text><OutlineButton title="Open Chronological Bible" onPress={()=>router.push('/(tabs)/bible')}/></Card>
    <Card><Text style={styles.cardTitle}>Prayer Journal</Text><Text style={styles.body}>Keep your private prayers and reflections alongside your Bible journey.</Text><OutlineButton title="Open Prayer Journal" onPress={()=>router.push('/(tabs)/journal')}/></Card>
    <Card><Text style={styles.cardTitle}>Account</Text><Text style={styles.body}>{session ? `Signed in as ${session.user.email ?? 'member'}. Your progress and Prayer Journal can sync across devices.` : 'Guest mode keeps progress on this device. Sign in with Google later to enable cross-device sync.'}</Text>{guest?<GoldButton title="Sign In to Sync My Journey" onPress={()=>router.replace('/login')}/>:null}<OutlineButton title={session?'Sign Out':'Exit Guest Mode'} onPress={exit}/></Card>
    <Card><Text style={styles.cardTitle}>Try Jesus Media Store</Text><Text style={styles.body}>Explore programs, resources, apparel, and ministry merchandise.</Text><OutlineButton title="Fourthwall Store" onPress={()=>Linking.openURL('https://try-jesus-new-york-shop.fourthwall.com/')}/></Card>
    <Card><Text style={styles.cardTitle}>Questions & Privacy</Text><Text style={styles.body}>Question submissions and ministry support can be sent to info@tryjesusmedia.com. Private Prayer Journal entries are visible only through the signed-in user's row-level security policies.</Text><OutlineButton title="Email Try Jesus Media" onPress={()=>Linking.openURL('mailto:info@tryjesusmedia.com')}/></Card>
    <Card><Text style={styles.cardTitle}>Members</Text><Text style={styles.body}>Open the Try Jesus Media members welcome page.</Text><GoldButton title="Open Members Page" onPress={()=>Linking.openURL('https://tryjesusmedia.com/welcome/')}/></Card>
  </ScrollView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.charcoal},content:{padding:20,paddingTop:52,gap:14,paddingBottom:100},title:{color:colors.text,fontSize:30,fontWeight:'900',marginBottom:8},cardTitle:{color:colors.gold,fontSize:18,fontWeight:'900',marginBottom:9},body:{color:colors.ivory,lineHeight:22,marginBottom:16}});
