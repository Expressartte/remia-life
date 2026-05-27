import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MorningScreen from '../screens/morning/MorningScreen';
import SocraticDialogScreen from '../screens/morning/SocraticDialogScreen';
import DreamAnalysisScreen from '../screens/morning/DreamAnalysisScreen';
import { MorningStackParamList } from '../types';

const Stack = createNativeStackNavigator<MorningStackParamList>();

export default function MorningStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MorningHome" component={MorningScreen} />
      <Stack.Screen
        name="SocraticDialog"
        component={SocraticDialogScreen}
        options={{
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="DreamAnalysis"
        component={DreamAnalysisScreen}
        options={{
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}
