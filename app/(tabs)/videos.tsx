import React from 'react';
import { ScrollView } from 'react-native';
import { colors } from '@/constants/theme';
import { YouTubeOffer } from '@/components/YouTubeOffer';

export default function VideosScreen() {
  return <ScrollView style={{ flex: 1, backgroundColor: colors.charcoal }} contentContainerStyle={{ padding: 24, paddingBottom: 36 }}><YouTubeOffer /></ScrollView>;
}
