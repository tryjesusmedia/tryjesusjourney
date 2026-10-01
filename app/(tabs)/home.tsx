import React from 'react';
import { Redirect } from 'expo-router';

// Keep existing home links working while making reading the front door.
export default function HomeScreen() {
  return <Redirect href="/(tabs)/bible" />;
}
