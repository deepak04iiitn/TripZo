import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

const TAB_META = {
  Home: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  Trips: { label: 'Trips', icon: 'briefcase-outline', activeIcon: 'briefcase' },
  Map: { label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  Explore: { label: 'Explore', icon: 'compass-outline', activeIcon: 'compass' },
  Account: { label: 'Account', icon: 'person-outline', activeIcon: 'person' },
};

function PlaceholderTabScreen({ title, subtitle, accent = '#FF6B6B' }) {
  return (
    <SafeAreaView style={styles.screenSafe} edges={['top', 'left', 'right']}>
      <View style={styles.screenContent}>
        <View style={styles.placeholderCard}>
          <View style={[styles.placeholderDot, { backgroundColor: accent }]} />
          <Text style={styles.placeholderTitle}>{title}</Text>
          <Text style={styles.placeholderSubtitle}>{subtitle}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AccountScreen({ user, onLogout }) {
  return (
    <SafeAreaView style={styles.screenSafe} edges={['top', 'left', 'right']}>
      <View style={styles.screenContent}>
        <View style={styles.placeholderCard}>
          <View style={[styles.placeholderDot, { backgroundColor: '#8B5CF6' }]} />
          <Text style={styles.placeholderTitle}>Account</Text>
          <Text style={styles.placeholderSubtitle}>{user?.email || 'Signed in user'}</Text>
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AnimatedTabIcon({ focused, routeName }) {
  const isMap = routeName === 'Map';
  const { label, icon, activeIcon } = TAB_META[routeName];
  const scale = useRef(new Animated.Value(focused ? 1 : 0.94)).current;
  const lift = useRef(new Animated.Value(focused ? -2 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.06 : 0.94,
        useNativeDriver: true,
        speed: 18,
        bounciness: 8,
      }),
      Animated.timing(lift, {
        toValue: focused ? -2 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, lift, scale]);

  return (
    <Animated.View style={[styles.iconWrap, { transform: [{ scale }, { translateY: lift }] }]}>
      <Ionicons
        name={focused ? activeIcon : icon}
        size={isMap ? 28 : 22}
        color={isMap ? '#FFFFFF' : focused ? '#FF6B6B' : '#9CA3AF'}
      />
      {!isMap ? (
        <Text style={[styles.iconLabel, focused ? styles.iconLabelActive : styles.iconLabelInactive]}>{label}</Text>
      ) : null}
    </Animated.View>
  );
}

function FloatingMapTabButton({ children, onPress, accessibilityState }) {
  const isFocused = accessibilityState?.selected;

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={styles.mapTabTouchable}>
      <LinearGradient
        colors={isFocused ? ['#FF6B6B', '#FF8A5C'] : ['#FF7E7E', '#FFB347']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mapTabButton, isFocused && styles.mapTabButtonActive]}
      >
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function MainTabNavigator({ user, onLogout }) {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: route.name === 'Map' ? styles.mapTabItem : styles.standardTabItem,
          tabBarIcon: ({ focused }) => <AnimatedTabIcon focused={focused} routeName={route.name} />,
          tabBarButton: (props) => (route.name === 'Map' ? <FloatingMapTabButton {...props} /> : <TouchableOpacity {...props} />),
          animation: 'shift',
        })}
      >
        <Tab.Screen
          name="Home"
          children={() => (
            <PlaceholderTabScreen
              title="Home"
              subtitle="Your travel dashboard and quick actions will appear here."
              accent="#FF6B6B"
            />
          )}
        />
        <Tab.Screen
          name="Trips"
          children={() => (
            <PlaceholderTabScreen
              title="Trips"
              subtitle="Upcoming itineraries and saved plans will appear here."
              accent="#0EA5E9"
            />
          )}
        />
        <Tab.Screen
          name="Map"
          children={() => (
            <PlaceholderTabScreen
              title="Map"
              subtitle="Live map, destinations, and routes will appear here."
              accent="#22C55E"
            />
          )}
        />
        <Tab.Screen
          name="Explore"
          children={() => (
            <PlaceholderTabScreen
              title="Explore"
              subtitle="Discover places, food, and experiences near you."
              accent="#F59E0B"
            />
          )}
        />
        <Tab.Screen name="Account">{() => <AccountScreen user={user} onLogout={onLogout} />}</Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    height: 74,
    borderTopWidth: 0,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 12,
  },
  standardTabItem: {
    paddingTop: 2,
  },
  mapTabItem: {
    marginTop: -22,
  },
  iconWrap: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconLabelActive: {
    color: '#FF6B6B',
  },
  iconLabelInactive: {
    color: '#9CA3AF',
  },
  mapTabTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.36,
    shadowRadius: 20,
    elevation: 10,
  },
  mapTabButtonActive: {
    transform: [{ scale: 1.04 }],
  },
  screenSafe: {
    flex: 1,
    backgroundColor: '#F4F7FC',
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 112,
  },
  placeholderCard: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  placeholderDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 14,
  },
  placeholderTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F2044',
    marginBottom: 8,
  },
  placeholderSubtitle: {
    color: '#5B677D',
    fontSize: 15,
    lineHeight: 22,
  },
  logoutButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#0F2044',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

