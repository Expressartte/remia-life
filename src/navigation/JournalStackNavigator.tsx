import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import JournalScreen from '../screens/journal/JournalScreen';
import DreamAnalysisScreen from '../screens/morning/DreamAnalysisScreen';
import { JournalStackParamList } from '../types';

const Stack = createNativeStackNavigator<JournalStackParamList>();

export default function JournalStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JournalHome" component={JournalScreen} />
      <Stack.Screen
        name="DreamAnalysis"
        // DreamAnalysisScreen is typed to MorningStackParamList but shares the
        // same { dreamId } param — cast to any to reuse it across stacks.
        component={DreamAnalysisScreen as React.ComponentType<any>}
        options={{ animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
