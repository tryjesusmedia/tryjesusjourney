import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Card, Eyebrow, GoldButton, OutlineButton } from '@/components/ui';
import { colors } from '@/constants/theme';

export default function BibleScreen() {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Eyebrow>EXPLORE SCRIPTURE</Eyebrow>
    <Text style={styles.title}>Bible</Text>
    <Text style={styles.subtitle}>Choose how you want to study, continue your progress, or record what is on your heart.</Text>

    <Card style={styles.primaryCard}>
      <Eyebrow>BIBLE GUIDES</Eyebrow>
      <Text style={styles.cardTitle}>Get to Know Jesus & Bible Prophecy</Text>
      <Text style={styles.body}>Continue either guide set from your saved place and see your progress separately.</Text>
      <GoldButton title="Open My Bible Guides" onPress={() => router.push('/(tabs)/journey')} />
    </Card>

    <Card>
      <Eyebrow>READ IN HISTORICAL SEQUENCE</Eyebrow>
      <Text style={styles.cardTitle}>Bible in Chronological Order</Text>
      <Text style={styles.body}>Follow the biblical story chapter by chapter and save completed readings.</Text>
      <OutlineButton title="Open Chronological Bible" onPress={() => router.push('/chronological')} />
    </Card>

    <Card>
      <Eyebrow>PRIVATE</Eyebrow>
      <Text style={styles.cardTitle}>Prayer Journal</Text>
      <Text style={styles.body}>Keep your prayers and reflections beside your Bible journey.</Text>
      <OutlineButton title="Open Prayer Journal" onPress={() => router.push('/(tabs)/journal')} />
    </Card>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:colors.charcoal},content:{padding:20,paddingTop:52,paddingBottom:110,gap:14},title:{color:colors.text,fontSize:32,fontWeight:'900'},subtitle:{color:colors.muted,fontSize:14,lineHeight:21,marginBottom:5},primaryCard:{backgroundColor:colors.plum},cardTitle:{color:colors.text,fontSize:21,fontWeight:'900',lineHeight:27,marginBottom:7},body:{color:colors.ivory,fontSize:14,lineHeight:21,marginBottom:16},
});
