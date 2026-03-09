import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OnboardingScreen from './screens/OnboardingScreen';

export default function App() {
  const [onboarded, setOnboarded] = useState(false);

  if (!onboarded) {
    return <OnboardingScreen onFinish={() => setOnboarded(true)} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to TripZo!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F4FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
