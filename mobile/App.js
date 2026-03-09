import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';

const SCREEN = { SPLASH: 'splash', ONBOARDING: 'onboarding', MAIN: 'main' };

export default function App() {
  const [screen, setScreen] = useState(SCREEN.SPLASH);

  if (screen === SCREEN.SPLASH) {
    return <SplashScreen onDone={() => setScreen(SCREEN.ONBOARDING)} />;
  }

  if (screen === SCREEN.ONBOARDING) {
    return <OnboardingScreen onFinish={() => setScreen(SCREEN.MAIN)} />;
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
    color: '#FF6B6B',
  },
});
