import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StatusBar, StyleSheet, View } from 'react-native';
// import * as Google from 'expo-auth-session/providers/google';
// import * as WebBrowser from 'expo-web-browser';
// import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import {
  deleteAccount as requestDeleteAccount,
  endUserSession,
  getMe,
  signin,
  signup,
  startUserSession,
} from './src/services/auth/authService';
import {
  clearSession,
  isOnboardingDone,
  markOnboardingDone,
  readSession,
  saveSession,
} from './src/services/auth/sessionStorage';
import { setAuthToken } from './src/services/api/client';
// import { firebaseAuth } from './src/services/auth/firebaseClient';

// WebBrowser.maybeCompleteAuthSession();

const SCREEN = {
  LOADING: 'loading',
  SPLASH: 'splash',
  ONBOARDING: 'onboarding',
  AUTH_LOGIN: 'auth_login',
  AUTH_REGISTER: 'auth_register',
  MAIN: 'main',
};

export default function App() {
  const [screen, setScreen] = useState(SCREEN.LOADING);
  const [user, setUser] = useState(null);
  const activeSessionRef = useRef({
    sessionId: null,
    startedAt: null,
  });
  const appStateRef = useRef(AppState.currentState);
  // const [googleRequest, _googleResponse, promptGoogleSignIn] = Google.useAuthRequest({
  //   expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  //   androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  //   iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  //   webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  //   scopes: ['profile', 'email'],
  // });

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const session = await readSession();

        if (session?.token) {
          setAuthToken(session.token);
          try {
            const meResponse = await getMe();
            if (!isMounted) {
              return;
            }
            setUser(meResponse.user);
            setScreen(SCREEN.MAIN);
            return;
          } catch (_error) {
            await clearSession();
            setAuthToken(null);
          }
        }

        if (!isMounted) {
          return;
        }
        setScreen(SCREEN.SPLASH);
      } catch (_error) {
        if (isMounted) {
          setScreen(SCREEN.SPLASH);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const finishSplash = async () => {
    const onboardingDone = await isOnboardingDone();
    setScreen(onboardingDone ? SCREEN.AUTH_LOGIN : SCREEN.ONBOARDING);
  };

  const handleOnboardingFinish = async () => {
    await markOnboardingDone();
    setScreen(SCREEN.AUTH_LOGIN);
  };

  const persistAuth = async (payload) => {
    const session = { token: payload.token, user: payload.user };
    await saveSession(session);
    setAuthToken(payload.token);
    setUser(payload.user);
    setScreen(SCREEN.MAIN);
  };

  const handleLogin = async ({ email, password }) => {
    const response = await signin({ email, password });
    await persistAuth(response);
  };

  const handleRegister = async ({ email, password }) => {
    const response = await signup({ email, password });
    await persistAuth(response);
  };

  // const handleGoogleAuth = async () => {
  //   if (!googleRequest) {
  //     throw new Error('Google sign-in is not configured. Add Google client IDs to your Expo env.');
  //   }
  //
  //   const authResult = await promptGoogleSignIn();
  //   if (authResult.type !== 'success') {
  //     throw new Error('Google sign-in was cancelled.');
  //   }
  //
  //   const googleIdToken = authResult.authentication?.idToken || authResult.params?.id_token;
  //   const accessToken = authResult.authentication?.accessToken;
  //
  //   if (!googleIdToken && !accessToken) {
  //     throw new Error('Unable to obtain Google credentials.');
  //   }
  //
  //   const credential = GoogleAuthProvider.credential(googleIdToken || null, accessToken);
  //   const firebaseSession = await signInWithCredential(firebaseAuth, credential);
  //   const firebaseIdToken = await firebaseSession.user.getIdToken(true);
  //   await signOut(firebaseAuth);
  //
  //   const response = await googleAuth(firebaseIdToken);
  //   await persistAuth(response);
  // };

  const handleLogout = async () => {
    await clearSession();
    setAuthToken(null);
    setUser(null);
    setScreen(SCREEN.AUTH_LOGIN);
  };

  const handleDeleteAccount = async () => {
    await requestDeleteAccount();
    await handleLogout();
  };

  useEffect(() => {
    if (screen !== SCREEN.MAIN || !user?.id) {
      return undefined;
    }

    let isMounted = true;

    const startSession = async () => {
      if (activeSessionRef.current.sessionId) {
        return;
      }

      try {
        const response = await startUserSession();
        if (!isMounted) {
          return;
        }
        activeSessionRef.current = {
          sessionId: response.sessionId,
          startedAt: Date.now(),
        };
      } catch (_error) {
        // Session tracking should never block app usage.
      }
    };

    const endSession = async () => {
      const activeSession = activeSessionRef.current;
      if (!activeSession.sessionId) {
        return;
      }

      activeSessionRef.current = { sessionId: null, startedAt: null };

      const elapsedSeconds = activeSession.startedAt
        ? Math.max(0, Math.floor((Date.now() - activeSession.startedAt) / 1000))
        : undefined;

      try {
        await endUserSession(activeSession.sessionId, elapsedSeconds);
      } catch (_error) {
        // Ignore cleanup errors and continue app flow.
      }
    };

    startSession();

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState === 'active' && /inactive|background/.test(nextState)) {
        endSession();
      }

      if (/inactive|background/.test(previousState) && nextState === 'active') {
        startSession();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
      endSession();
    };
  }, [screen, user?.id]);

  let content = (
    <MainTabNavigator user={user} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} />
  );

  if (screen === SCREEN.LOADING) {
    content = (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  } else if (screen === SCREEN.SPLASH) {
    content = <SplashScreen onDone={finishSplash} />;
  } else if (screen === SCREEN.ONBOARDING) {
    content = <OnboardingScreen onFinish={handleOnboardingFinish} />;
  } else if (screen === SCREEN.AUTH_LOGIN) {
    content = (
      <LoginScreen
        onLogin={handleLogin}
        // onGoogleLogin={handleGoogleAuth}
        onGoRegister={() => setScreen(SCREEN.AUTH_REGISTER)}
      />
    );
  } else if (screen === SCREEN.AUTH_REGISTER) {
    content = (
      <RegisterScreen
        onRegister={handleRegister}
        // onGoogleRegister={handleGoogleAuth}
        onGoLogin={() => setScreen(SCREEN.AUTH_LOGIN)}
      />
    );
  }

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
        hidden={false}
      />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
