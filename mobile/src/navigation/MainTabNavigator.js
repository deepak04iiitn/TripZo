import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();
const APP_LOGO = require('../../assets/Logo.png');
const POPULAR_DESTINATIONS = [
  {
    id: 'bali',
    title: 'Bali, Indonesia',
    rating: '4.9 (2.1k reviews)',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB98Oo94eERTc9kET7aLEsiUHHHtD7tC6C_tv3p6RFNBuHzxzh0UfDIaqdx-JVbiovzcfCMJLTuBe2LitoE0t66EoaA27viMLtE34nwH_fACNI9t7z06D1rlo9j55H4oKfzNC0kj5fF-2adclr0UJFtPqLSuJZxlGM06LWhi7-VRYNTNSut-tUOVkL3X7F4OYZ3W_tC3ktJXCykEwhthp1IaJWtp7YxoOkXAP7oJjewIfpCgSnaa_7Yv-1wmg54MIUmswW95jvIQgKW',
    liked: true,
  },
  {
    id: 'kyoto',
    title: 'Kyoto, Japan',
    rating: '4.8 (1.5k reviews)',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDba27gnA7Q3fV5pmsqTe73igsqv3QpihDjlqAwuRlPhO_pgAZL_R83iyvk980iHNPeHIdgekw1AoldSfRPyPHiYvUXsrua3IZ_gC5qeY5QWNqH53j4lYdypsqcVw2bZcSTbqIWecArS4abzzKOK0xL8Ipnwyi3DsgJRIakjsgEn923d3xiJKsAe37CWLZsdzGXMZOW6O6LYip-QCBhvVNYY35n5LGwJkOvESk3352Q0AVM1WSU2TNBukX53fW_MILjQ0q47QEABp8W',
    liked: false,
  },
];
const QUICK_ACTIONS = [
  { id: 'weekend', label: 'Weekend', icon: 'partly-sunny-outline', tint: '#0EA5E9' },
  { id: 'food', label: 'Food Spots', icon: 'restaurant-outline', tint: '#F59E0B' },
  { id: 'adventure', label: 'Adventure', icon: 'trail-sign-outline', tint: '#22C55E' },
  { id: 'stays', label: 'Stays', icon: 'bed-outline', tint: '#8B5CF6' },
];
const TRENDING_EXPERIENCES = [
  {
    id: 'sunset-cruise',
    title: 'Sunset Cruise',
    place: 'Lisbon',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'street-food',
    title: 'Street Food Walk',
    place: 'Bangkok',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'mountain-trail',
    title: 'Mountain Trail',
    place: 'Interlaken',
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  },
];
const TRAVEL_CHECKLIST = [
  { id: 'passport', label: 'Passport and IDs ready', icon: 'card-outline' },
  { id: 'bookings', label: 'Hotel confirmation saved', icon: 'bed-outline' },
  { id: 'essentials', label: 'Essentials packing list', icon: 'cube-outline' },
];

const TAB_META = {
  Home: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  Trips: { label: 'Trips', icon: 'briefcase-outline', activeIcon: 'briefcase' },
  Map: { label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  Explore: { label: 'Explore', icon: 'compass-outline', activeIcon: 'compass' },
  Account: { label: 'Account', icon: 'person-outline', activeIcon: 'person' },
};

function PlaceholderTabScreen({ title, subtitle, accent = '#FF6B6B' }) {
  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute={title} />
        <View style={styles.screenBody}>
          <View style={styles.placeholderCard}>
            <View style={[styles.placeholderDot, { backgroundColor: accent }]} />
            <Text style={styles.placeholderTitle}>{title}</Text>
            <Text style={styles.placeholderSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AccountScreen({ user, onLogout }) {
  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute="Account" />
        <View style={styles.screenBody}>
          <View style={styles.placeholderCard}>
            <View style={[styles.placeholderDot, { backgroundColor: '#8B5CF6' }]} />
            <Text style={styles.placeholderTitle}>Account</Text>
            <Text style={styles.placeholderSubtitle}>{user?.email || 'Signed in user'}</Text>
            <Pressable style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function HomeScreen() {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [budget, setBudget] = useState('$');

  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute="Home" />
        <View style={styles.screenBody}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeScrollContent}>
            <View style={styles.homeHero}>
              <Text style={styles.heroEyebrow}>SMART PLANNER</Text>
              <Text style={styles.homeHeroTitle}>Where to next?</Text>
              <Text style={styles.homeHeroSubtitle}>Plan your dream getaway in seconds.</Text>
              <View style={styles.heroStatRow}>
                <View style={styles.heroStatChip}>
                  <Ionicons name="time-outline" size={14} color="#FF6B6B" />
                  <Text style={styles.heroStatText}>Avg plan time: 18 sec</Text>
                </View>
                <View style={styles.heroStatChip}>
                  <Ionicons name="flash-outline" size={14} color="#FF6B6B" />
                  <Text style={styles.heroStatText}>Instant itinerary</Text>
                </View>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
              {QUICK_ACTIONS.map((item) => (
                <TouchableOpacity key={item.id} activeOpacity={0.9} style={styles.quickActionCard}>
                  <View style={[styles.quickActionIconWrap, { backgroundColor: `${item.tint}1A` }]}>
                    <Ionicons name={item.icon} size={18} color={item.tint} />
                  </View>
                  <Text style={styles.quickActionLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.itineraryCard}>
              <View style={styles.itineraryHeader}>
                <View>
                  <Text style={styles.itineraryTitle}>Build your itinerary</Text>
                  <Text style={styles.itinerarySubtitle}>Personalized by preferences and budget</Text>
                </View>
                <View style={styles.itineraryBadge}>
                    <Ionicons name="compass-outline" size={14} color="#FF6B6B" />
                </View>
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>From</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="navigate-outline" size={18} color="#FF6B6B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Current Location"
                    placeholderTextColor="#94A3B8"
                    value={fromLocation}
                    onChangeText={setFromLocation}
                  />
                </View>
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>To</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="map-outline" size={18} color="#FF6B6B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter destination"
                    placeholderTextColor="#94A3B8"
                    value={toLocation}
                    onChangeText={setToLocation}
                  />
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridColumn}>
                  <Text style={styles.inputLabel}>Duration</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="calendar-outline" size={18} color="#FF6B6B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Days"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={duration}
                      onChangeText={setDuration}
                    />
                  </View>
                </View>

                <View style={styles.gridColumn}>
                  <Text style={styles.inputLabel}>Budget</Text>
                  <View style={styles.budgetWrap}>
                    {['$', '$$', '$$$'].map((level) => {
                      const selected = budget === level;
                      return (
                        <TouchableOpacity
                          key={level}
                          activeOpacity={0.9}
                          onPress={() => setBudget(level)}
                          style={[styles.budgetItem, selected && styles.budgetItemActive]}
                        >
                          <Text style={[styles.budgetText, selected && styles.budgetTextActive]}>{level}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <TouchableOpacity activeOpacity={0.92} style={styles.planButtonWrap}>
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E53']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.planButton}
                >
                  <Ionicons name="airplane-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.planButtonText}>Plan my Trip</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.planTrustRow}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#0EA5E9" />
                <Text style={styles.planTrustText}>Trusted by 50k+ travelers worldwide</Text>
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Popular Destinations</Text>
              <TouchableOpacity activeOpacity={0.8}>
                <Text style={styles.sectionAction}>See all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {POPULAR_DESTINATIONS.map((destination) => (
                <View key={destination.id} style={styles.destinationCard}>
                  <View style={styles.destinationImageWrap}>
                    <Image source={{ uri: destination.image }} style={styles.destinationImage} resizeMode="cover" />
                    <View style={styles.favoritePill}>
                      <Ionicons
                        name={destination.liked ? 'heart' : 'heart-outline'}
                        size={14}
                        color={destination.liked ? '#FF6B6B' : '#94A3B8'}
                      />
                    </View>
                  </View>
                  <View style={styles.destinationBody}>
                    <Text style={styles.destinationTitle}>{destination.title}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={13} color="#94A3B8" />
                      <Text style={styles.ratingText}>{destination.rating}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.communityCard}>
              <View style={styles.communityHead}>
                <View style={styles.communityIconWrap}>
                  <Ionicons name="people-outline" size={18} color="#0EA5E9" />
                </View>
                <View style={styles.communityHeadText}>
                  <Text style={styles.communityTitle}>Community Favorites This Week</Text>
                  <Text style={styles.communitySubtitle}>Most saved destinations by TripZo travelers</Text>
                </View>
              </View>

              <View style={styles.communityTagsRow}>
                {['Goa Beaches', 'Rishikesh Camps', 'Coorg Escapes', 'Jaipur Walks'].map((tag) => (
                  <TouchableOpacity key={tag} activeOpacity={0.9} style={styles.communityTagChip}>
                    <Text style={styles.communityTagText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.recentTripsSection}>
              <Text style={styles.sectionTitle}>Your Recent Trips</Text>
              <TouchableOpacity activeOpacity={0.9} style={styles.recentTripCard}>
                <Image
                  source={{
                    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxUVrLlyD4qcqI0PviLV-XWZV5gABYq2_0MGeW54LUPUzyLgpOI1CFB1mrF3--BeB3-GzPZf55uwZkYWsKcQS31GDYjQ2KVLFAw2nAfkKhjTVfUMDGF82sXabv01AClzwfydlaWb9xjBixmtFMV-r1ccBHzvbFx3Pxlq-pqnrYacyL0EnLjMUpRdXhqLKZBFh9Um2u1LhAMf_CzoTRFB3qT7g8-3hCqV1dF7--7v62PSTIV7wXr1-MBFBvABh-npUWkrl_gHZ5pG6a',
                  }}
                  style={styles.recentTripImage}
                />
                <View style={styles.recentTripBody}>
                  <Text style={styles.recentTripTitle}>Santorini, Greece</Text>
                  <Text style={styles.recentTripMeta}>Aug 12 - Aug 19 • 4 people</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
              </TouchableOpacity>

              <View style={styles.smartTipCard}>
                <View style={styles.smartTipIcon}>
                  <Ionicons name="bulb-outline" size={16} color="#FF8E53" />
                </View>
                <View style={styles.smartTipBody}>
                  <Text style={styles.smartTipTitle}>Smart Tip</Text>
                  <Text style={styles.smartTipText}>
                    Booking flights on Tue/Wed can reduce fares by 8-14% for most short-haul trips.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Trending Experiences</Text>
              <TouchableOpacity activeOpacity={0.8}>
                <Text style={styles.sectionAction}>Explore</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.experiencesRow}>
              {TRENDING_EXPERIENCES.map((experience) => (
                <TouchableOpacity key={experience.id} activeOpacity={0.92} style={styles.experienceCard}>
                  <Image source={{ uri: experience.image }} style={styles.experienceImage} resizeMode="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(15,32,68,0.85)']}
                    start={{ x: 0.5, y: 0.1 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.experienceOverlay}
                  >
                    <Text style={styles.experienceTitle}>{experience.title}</Text>
                    <View style={styles.experienceMeta}>
                      <Ionicons name="location-outline" size={13} color="#E2E8F0" />
                      <Text style={styles.experiencePlace}>{experience.place}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.checklistCard}>
              <View style={styles.checklistHeader}>
                <Text style={styles.checklistTitle}>Pre-trip Checklist</Text>
                <View style={styles.checklistBadge}>
                  <Text style={styles.checklistBadgeText}>3 tasks</Text>
                </View>
              </View>
              {TRAVEL_CHECKLIST.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.checklistRow, index !== TRAVEL_CHECKLIST.length - 1 && styles.checklistRowBorder]}
                >
                  <View style={styles.checklistIconWrap}>
                    <Ionicons name={item.icon} size={16} color="#0EA5E9" />
                  </View>
                  <Text style={styles.checklistLabel}>{item.label}</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ScreenTopBar({ activeRoute }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isHome = activeRoute === 'Home';

  const onBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (!isHome) {
      navigation.navigate('Home');
    }
  };

  return (
    <View style={[styles.topBarShell, { paddingTop: insets.top + 2 }]}>
      <View style={styles.topBarInner}>
        <View style={styles.topBarTitleWrap} pointerEvents="none">
          <Text style={styles.topBarTitleTrip}>Trip</Text>
          <Text style={styles.topBarTitleZo}>Zo</Text>
        </View>
        <Pressable
          onPress={onBackPress}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed, isHome && styles.backButtonDisabled]}
        >
          <Ionicons name="chevron-back" size={22} color={isHome ? '#C7CFDA' : '#0F2044'} />
        </Pressable>
        <Image source={APP_LOGO} style={styles.topBarLogo} resizeMode="contain" />
      </View>
    </View>
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
          children={() => <HomeScreen />}
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
    paddingTop: 0,
    paddingBottom: 112,
  },
  topBarShell: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  topBarInner: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 0,
    position: 'relative',
  },
  topBarTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitleTrip: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  topBarTitleZo: {
    color: '#FF8E53',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  screenBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  homeScrollContent: {
    paddingBottom: 30,
  },
  heroEyebrow: {
    color: '#FF6B6B',
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '800',
    marginBottom: 6,
  },
  homeHero: {
    paddingTop: 16,
    paddingBottom: 10,
  },
  homeHeroTitle: {
    color: '#0F2044',
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 42,
    marginBottom: 4,
  },
  homeHeroSubtitle: {
    color: '#64748B',
    fontSize: 18,
  },
  heroStatRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.16)',
  },
  heroStatText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsRow: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  quickActionCard: {
    minWidth: 112,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  quickActionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionLabel: {
    color: '#0F2044',
    fontSize: 13,
    fontWeight: '700',
  },
  itineraryCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.08)',
    padding: 18,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  itineraryHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itineraryTitle: {
    color: '#0F2044',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  itinerarySubtitle: {
    color: '#64748B',
    fontSize: 12,
  },
  itineraryBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,107,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBlock: {
    marginBottom: 14,
  },
  inputLabel: {
    marginLeft: 4,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F2044',
  },
  inputRow: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F8F5F5',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  textInput: {
    height: '100%',
    paddingLeft: 42,
    paddingRight: 12,
    color: '#0F2044',
    fontSize: 15,
    fontWeight: '500',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridColumn: {
    flex: 1,
  },
  budgetWrap: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F8F5F5',
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  budgetItem: {
    flex: 1,
    height: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetItemActive: {
    backgroundColor: '#FFFFFF',
  },
  budgetText: {
    color: '#94A3B8',
    fontWeight: '800',
    fontSize: 13,
  },
  budgetTextActive: {
    color: '#FF6B6B',
  },
  planButtonWrap: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  planButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  planButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },
  planTrustRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  planTrustText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHead: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#0F2044',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionAction: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '700',
  },
  horizontalList: {
    paddingBottom: 4,
    gap: 12,
  },
  destinationCard: {
    width: 204,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.08)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  destinationImageWrap: {
    height: 130,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  destinationImage: {
    width: '100%',
    height: '100%',
  },
  favoritePill: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationBody: {
    padding: 12,
  },
  destinationTitle: {
    color: '#0F2044',
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#64748B',
    fontSize: 12,
  },
  recentTripsSection: {
    marginTop: 22,
  },
  communityCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.18)',
    backgroundColor: '#FFFFFF',
  },
  communityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  communityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityHeadText: {
    flex: 1,
  },
  communityTitle: {
    color: '#0F2044',
    fontSize: 15,
    fontWeight: '800',
  },
  communitySubtitle: {
    color: '#64748B',
    fontSize: 12,
  },
  communityTagsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  communityTagChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(14,165,233,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.18)',
  },
  communityTagText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
  },
  recentTripCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.16)',
    backgroundColor: 'rgba(255,107,107,0.06)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentTripImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  recentTripBody: {
    flex: 1,
  },
  recentTripTitle: {
    color: '#0F2044',
    fontSize: 14,
    fontWeight: '800',
  },
  recentTripMeta: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
  },
  smartTipCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,142,83,0.2)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  smartTipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,142,83,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  smartTipBody: {
    flex: 1,
  },
  smartTipTitle: {
    color: '#0F2044',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  smartTipText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  experiencesRow: {
    paddingBottom: 6,
    gap: 12,
  },
  experienceCard: {
    width: 208,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#CBD5E1',
  },
  experienceImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  experienceOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  experienceTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  experienceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  experiencePlace: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  checklistCard: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.16)',
    padding: 14,
    marginBottom: 8,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  checklistTitle: {
    color: '#0F2044',
    fontSize: 17,
    fontWeight: '800',
  },
  checklistBadge: {
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checklistBadgeText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '700',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  checklistRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  checklistIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(14,165,233,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistLabel: {
    flex: 1,
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  backButtonPressed: {
    opacity: 0.8,
  },
  backButtonDisabled: {
    backgroundColor: '#F2F5FA',
  },
  topBarLogo: {
    width: 122,
    height: 38,
    marginRight: -20,
  },
  placeholderCard: {
    marginTop: 16,
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

