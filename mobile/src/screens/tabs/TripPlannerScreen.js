import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { requestLiveLocation } from '../../services/maps/locationService';
import { geocodeWithPhoton, reverseGeocodeWithPhoton } from '../../services/maps/googleGeocodingService';
import { fetchCityAttractionsPreview, generateSmartItinerary, saveTrip } from '../../services/itinerary/itineraryService';
import { SKELETON_GRADIENT_COLORS, useSkeletonShimmer } from '../../utils/skeletonShimmer';

const FALLBACK_IMAGE_URLS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDfupL4gqxmh2ZpjDq4-KH45SzTC6K89wX5ewCLjvAj5z7Nz0irNR7-_eiSH7BJQP2OXCk-JPYPQQ4RkBOCffIsqjdwaljQZQuO7if07wHOEzjG9cccPLO1_7U11sJKk4UGnM1rT6JmT3jiYyZALx3kZgdSaVpTNBzX4-NZ-ZmF50CaONyXN1kswyN_stHg07VOn2GTlvYRcx33-EGcbh7oSIGVMiNGjjZNw4_G6S1cLKBaYaJKC2mQf1oc2gjgPuhwlH2AIOfQEJ_L',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDQ-So_W7EdI8sRDE6Se3vFtoAuNIrJk9qFqTzqV0iGYABBgmY_pStKikQA272N9dDvdggqYZqVcKAqIJdM0wrTsoSQNZXL5wUjrCNufIqCEpkLKBJgsN3J2LwOkGlZONk9qa0_mNaiCd8RktFQJSqScf5IhOQsT7jgEi1ZOwkXxrc34DdfpX_QhkX6wpNVmO5KLyzbubH9NCT2dCKiFihQIxitH0lBrlf79hpsflYXb37hr1Ab4OxVtAiOVhlryF_z4g6FgGYCR3au',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB2gt9ctxYdnzm2jfpy3Q0t2pIqQYwXqCvCqmFA0PCKrnk0sk6Ie8g3IY3QRYM6JI6KUvusu7uEh8EyCoVCnBRuKU_seQYGOpG0p7ZJBMLWOzl27-dGmNlS4eDvhCq79hrqADAQDyU6Z-N6Lz7UcdyaeJi-A0Fn04ZGqHyLzRtcWvRwaUm6sh4zfyhPxFhk_8BUOSADW-wHmWKGwe1nO1SD14t3qiAr_3HQk79P9mNsJ5UR_C2Vt4Xo1hTLJplQ36nUw7nkwzbJXPfr',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAgUn8cJLErgL0AHvUg9yCeDFEFyPmxCRtWRZpKUIAHMe12tDNKV3zcvfJp4NpMyCF6d2FQiIxPQ51xi4UbNsSL2xpKCY8dbDfPmYaqDMG7kodI1v7p6IQ8O8ZS1R92VJplXItu6Sj1qITCA1tMyqXz4wF66Jpc-rr27AYOQ6TYje9SLbUCicPMANKJNwFIewfbUYVWZtlDMouFQ5R3wd_2CS_nyOYBX1TTT8zdwviPPV6z3KUptp0oTZTjkRIWFWuzD99S2yqFNYfd',
];

function getAttractionImage(place, index) {
  return place?.imageUrl || FALLBACK_IMAGE_URLS[index % FALLBACK_IMAGE_URLS.length];
}

function formatMeta(place) {
  const rating = Number(place?.tags?.rating || 0);
  const reviews = Number(place?.tags?.userRatingsTotal || 0);
  return {
    rating: Number.isFinite(rating) ? rating.toFixed(1) : '0.0',
    reviews: `${reviews.toLocaleString()} reviews`,
  };
}

function isExcludedStayFoodTransitPlace(place) {
  const label = String(place?.label || place?.name || '').toLowerCase();
  const category = String(place?.category || '').toLowerCase();
  const tourism = String(place?.tags?.tourism || '').toLowerCase();
  const placeTypes = Array.isArray(place?.tags?.placeTypes) ? place.tags.placeTypes.map((t) => String(t).toLowerCase()) : [];
  const hasBlockedType = placeTypes.some((type) =>
    ['restaurant', 'food', 'cafe', 'meal_takeaway', 'meal_delivery', 'lodging', 'train_station', 'subway_station', 'transit_station', 'bus_station'].includes(type)
  );
  const hasBlockedKeyword = [
    'restaurant',
    'railway station',
    'train station',
    'metro station',
    'junction',
    'hotel',
    'resort',
    'guest house',
    'guesthouse',
    'hostel',
    'inn',
    'stay',
    'stays',
  ].some((word) => label.includes(word));
  return (
    hasBlockedType ||
    hasBlockedKeyword ||
    category === 'restaurant' ||
    category === 'hotel' ||
    category === 'lodging' ||
    tourism === 'hotel' ||
    tourism === 'hostel'
  );
}

const AttractionItem = React.memo(({ place, index, selected, onToggle, triggerHaptic, entranceAnim, styles }) => {
  const { rating, reviews } = formatMeta(place);
  
  const rowOpacity = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const rowTranslate = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: rowOpacity,
        transform: [{ translateY: rowTranslate }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.attractionCard, !selected && styles.attractionCardUnselected]}
        onPress={() => {
          triggerHaptic?.('light');
          onToggle(place.id);
        }}
      >
        <Image 
          source={{ uri: getAttractionImage(place, index) }} 
          style={[styles.attractionImage, !selected && styles.attractionImageUnselected]} 
        />
        <View style={styles.attractionMain}>
          <Text numberOfLines={1} style={[styles.attractionTitle, !selected && styles.attractionTitleUnselected]}>
            {place.label}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name='star' size={12} color='#FBBF24' />
            <Text style={styles.ratingValue}>{rating}</Text>
            <Text style={styles.reviewText}>({reviews})</Text>
          </View>
        </View>
        <View style={[styles.selectBtn, selected ? styles.selectBtnActive : styles.selectBtnIdle]}>
          <Ionicons name={selected ? 'checkmark' : 'add'} size={14} color={selected ? '#FFFFFF' : '#94A3B8'} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function TripPlannerScreen({
  navigation,
  fromLocation,
  fromSelectedPlace,
  startDate,
  endDate,
  budget,
  onBack,
  onTripSaved,
  triggerHaptic,
}) {
  const [plannerResolvedLocation, setPlannerResolvedLocation] = useState(null);
  const [isLimitModalVisible, setIsLimitModalVisible] = useState(false);
  const [cityAttractions, setCityAttractions] = useState([]);
  const [previewCityName, setPreviewCityName] = useState('');
  const [selectedAttractionIds, setSelectedAttractionIds] = useState([]);
  const [isLoadingAttractionPreview, setIsLoadingAttractionPreview] = useState(true);
  const [planningMode, setPlanningMode] = useState('manual');
  const [isPlanningTrip, setIsPlanningTrip] = useState(false);
  const [planningStep, setPlanningStep] = useState('Optimizing your route...');
  const [planningProgress, setPlanningProgress] = useState(0);
  const [isManualGuideOpen, setIsManualGuideOpen] = useState(false);
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const loaderAnim = useRef(new Animated.Value(0)).current;
  const onBackRef = useRef(onBack);
  const skeletonTranslateX = useSkeletonShimmer();

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const displayedAttractions = useMemo(
    () => cityAttractions.filter((place) => !isExcludedStayFoodTransitPlace(place)).slice(0, 50),
    [cityAttractions]
  );

  const selectedAttractions = useMemo(() => {
    const set = new Set(selectedAttractionIds);
    return displayedAttractions.filter((place) => set.has(place.id));
  }, [displayedAttractions, selectedAttractionIds]);

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const { dx, dy } = gestureState;
          return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const { dx } = gestureState;
          if (dx <= -50 && planningMode !== 'auto') {
            triggerHaptic?.('light');
            setPlanningMode('auto');
          } else if (dx >= 50 && planningMode !== 'manual') {
            triggerHaptic?.('light');
            setPlanningMode('manual');
          }
        },
      }),
    [planningMode, triggerHaptic]
  );

  const resolvePlanningLocation = useCallback(async () => {
    if (fromSelectedPlace) return fromSelectedPlace;

    if (String(fromLocation || '').trim()) {
      try {
        const geocoded = await geocodeWithPhoton(fromLocation.trim());
        return {
          ...geocoded,
          label: fromLocation.trim(),
          source: geocoded.source || 'manual',
        };
      } catch (_error) {
        // fall through
      }
    }

    const liveLocation = await requestLiveLocation();
    const areaName = await reverseGeocodeWithPhoton(liveLocation.latitude, liveLocation.longitude).catch(() => 'Current Location');
    return { ...liveLocation, label: areaName || 'Current Location', source: 'live' };
  }, [fromLocation, fromSelectedPlace]);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      setIsLoadingAttractionPreview(true);
      try {
        const resolvedLocation = await resolvePlanningLocation();
        const preview = await fetchCityAttractionsPreview({
          fromLocation: {
            mode: resolvedLocation.source === 'live' ? 'live' : 'selected',
            text: resolvedLocation.label,
            selected: resolvedLocation,
          },
          limit: 50,
        });

        if (!isMounted) return;
        setPlannerResolvedLocation(resolvedLocation);
        setPreviewCityName(preview.city || resolvedLocation.label || 'Selected City');
        const attractions = (preview.attractions || []).filter((place) => !isExcludedStayFoodTransitPlace(place));
        setCityAttractions(attractions);
        setSelectedAttractionIds(attractions.slice(0, 10).map((item) => item.id));
      } catch (error) {
        if (!isMounted) return;
        Alert.alert('Unable to load attractions', error.message || 'Please try again.');
        onBackRef.current?.();
      } finally {
        if (isMounted) setIsLoadingAttractionPreview(false);
      }
    };

    loadPreview();
    return () => {
      isMounted = false;
    };
  }, [resolvePlanningLocation]);

  useEffect(() => {
    if (planningMode !== 'manual') return;
    entranceAnim.setValue(0);
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [planningMode, cityAttractions.length, entranceAnim]);

  useEffect(() => {
    if (!isLoadingAttractionPreview) {
      loaderAnim.stopAnimation();
      loaderAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(loaderAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(loaderAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLoadingAttractionPreview, loaderAnim]);

  const SkeletonBlock = ({ style }) => (
    <View style={[styles.skeletonBase, style]}>
      <Animated.View style={[styles.skeletonShimmer, { transform: [{ translateX: skeletonTranslateX }] }]}>
        <LinearGradient
          colors={SKELETON_GRADIENT_COLORS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.skeletonShimmerGradient}
        />
      </Animated.View>
    </View>
  );

  const generatePlan = async (mode = planningMode) => {
    const phases = [
      'Fetching best attractions...',
      'Optimizing route with TSP heuristics...',
      'Balancing daily schedule...',
      'Matching budget and smart stops...',
      'Finalizing your itinerary...',
    ];

    setIsPlanningTrip(true);
    setPlanningProgress(8);
    let phaseIndex = 0;
    const progressTimer = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length;
      setPlanningStep(phases[phaseIndex]);
      setPlanningProgress((prev) => Math.min(prev + 18, 92));
    }, 850);

    try {
      const resolvedLocation = plannerResolvedLocation || (await resolvePlanningLocation());
      const selectedForPlan = mode === 'manual' ? selectedAttractions : displayedAttractions;
      if (mode === 'manual' && !selectedForPlan.length) {
        throw new Error('Select at least one attraction for manual planning.');
      }

      const itinerary = await generateSmartItinerary({
        fromLocation: {
          mode: resolvedLocation.source === 'live' ? 'live' : 'selected',
          text: resolvedLocation.label,
          selected: resolvedLocation,
        },
        startDate,
        endDate,
        budget,
        planMode: mode,
        selectedAttractions: selectedForPlan,
      });

      const savedTrip = await saveTrip(itinerary);
      setPlanningProgress(100);
      setPlanningStep('Trip ready! Opening your Trips section...');
      setTimeout(async () => {
        setIsPlanningTrip(false);
        await onTripSaved?.(savedTrip || itinerary);
      }, 380);
    } catch (error) {
      setIsPlanningTrip(false);
      if (error.status === 429) {
        setIsLimitModalVisible(true);
      } else {
        Alert.alert('Unable to generate trip', error.message || 'Please try again.');
      }
    } finally {
      clearInterval(progressTimer);
    }
  };

  const toggleAttraction = useCallback((id) => {
    setSelectedAttractionIds((prev) =>
      prev.includes(id) ? prev.filter((existingId) => existingId !== id) : [...prev, id]
    );
  }, []);

  const renderItem = useCallback(({ item, index }) => {
    const selected = selectedAttractionIds.includes(item.id);
    return (
      <AttractionItem
        place={item}
        index={index}
        selected={selected}
        onToggle={toggleAttraction}
        triggerHaptic={triggerHaptic}
        entranceAnim={entranceAnim}
        styles={styles}
      />
    );
  }, [selectedAttractionIds, toggleAttraction, triggerHaptic, entranceAnim, styles]);

  /* renderAttractions removed */

  return (
    <View style={styles.screen}>
      <View style={styles.headerWrap}>


        <LinearGradient colors={['#0f2044', '#1e293b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <Ionicons name='compass' size={96} color='rgba(255,255,255,0.10)' style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Top attractions in {previewCityName || 'Paris'}</Text>
          <Text style={styles.heroSubtitle}>Discover the city</Text>
          <View style={styles.chipsRow}>
            <View style={styles.routeChip}>
              <Ionicons name='checkmark-circle' size={13} color='#ff6b6b' />
              <Text style={styles.routeChipText}>Route Optimized</Text>
            </View>
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{Math.min(cityAttractions.length, 50)} Attractions Found</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View {...swipeResponder.panHandlers} style={styles.swipeArea}>
        <View style={styles.tabsWrap}>
          <Pressable style={[styles.tabBtn, planningMode === 'manual' && styles.tabBtnActive]} onPress={() => setPlanningMode('manual')}>
            <Text style={[styles.tabText, planningMode === 'manual' && styles.tabTextActive]}>Manual</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, planningMode === 'auto' && styles.tabBtnActive]} onPress={() => setPlanningMode('auto')}>
            <Text style={[styles.tabText, planningMode === 'auto' && styles.tabTextActive]}>Automatic</Text>
          </Pressable>
        </View>

        <FlatList
          data={planningMode === 'manual' ? displayedAttractions : []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mainContent}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={
            <>
              {planningMode === 'manual' ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.manualGuideToggle}
                    onPress={() => setIsManualGuideOpen((prev) => !prev)}
                  >
                    <View style={styles.manualGuideToggleLeft}>
                      <View style={styles.manualGuideToggleIconWrap}>
                        <Ionicons name='map-outline' size={16} color='#ff6b6b' />
                      </View>
                      <View>
                        <Text style={styles.manualGuideToggleTitle}>See how to plan beautifully</Text>
                        <Text style={styles.manualGuideToggleSubtitle}>
                          Tap to {isManualGuideOpen ? 'hide' : 'view'} quick planning tips
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isManualGuideOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color='#334155'
                    />
                  </TouchableOpacity>

                  {isManualGuideOpen ? (
                    <View style={styles.instructionsCard}>
                      <View style={styles.instructionsHead}>
                        <Ionicons name='bulb-outline' size={18} color='#ff6b6b' />
                        <Text style={styles.instructionsTitle}>How Manual Planning with TripZo</Text>
                      </View>
                      <InstructionRow index={1} text='TripZo lines up the city highlights first, you just tap your vibe.' />
                      <InstructionRow index={2} text='We auto-shape the shortest practical route with minimal backtracking.' />
                      <InstructionRow index={3} text='Plus smart recommendations for restaurants, ATMs, and washrooms on route.' />
                    </View>
                  ) : null}

                  <Text style={styles.sectionTitle}>Popular Places</Text>
                  {!displayedAttractions.length && (
                    <Text style={styles.emptyText}>No attractions found for this city.</Text>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.instructionsCard}>
                    <View style={styles.instructionsHead}>
                      <Ionicons name='flash-outline' size={18} color='#ff6b6b' />
                      <Text style={styles.instructionsTitle}>Why automatic planning with TripZo</Text>
                    </View>
                    <InstructionRow index={1} text='TripZo auto-selects the best attractions from the city list.' />
                    <InstructionRow index={2} text='We generate a shortest-route itinerary for smoother and faster travel.' />
                    <InstructionRow index={3} text='You also get recommendations for restaurants, ATMs, and washrooms.' />
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.92}
                    style={styles.tabGenerateButton}
                    onPress={() => generatePlan('auto')}
                  >
                    <Text style={styles.tabGenerateButtonText}>Generate Optimized Itinerary</Text>
                    <Ionicons name='git-network-outline' size={16} color='#FFFFFF' />
                  </TouchableOpacity>
                </>
              )}
            </>
          }
          ListFooterComponent={
            <View style={[styles.bottomSpacer, planningMode === 'manual' && styles.bottomSpacerManual]} />
          }
        />
      </View>

      {planningMode === 'manual' && !isLoadingAttractionPreview ? (
        <View style={styles.manualFloatingWrap} pointerEvents='box-none'>
          <TouchableOpacity
            activeOpacity={0.92}
            style={[styles.manualFloatingButton, !selectedAttractions.length && styles.tabGenerateButtonDisabled]}
            onPress={() => generatePlan('manual')}
            disabled={!selectedAttractions.length}
          >
            <Text style={styles.manualFloatingButtonText}>
              Optimize Route for {selectedAttractions.length} Selected Places
            </Text>
            <Ionicons name='git-network-outline' size={16} color='#FFFFFF' style={styles.manualFloatingButtonIcon} />
          </TouchableOpacity>
        </View>
      ) : null}

      {isPlanningTrip ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <SkeletonBlock style={styles.overlaySkeletonAvatar} />
            <Text style={styles.overlayTitle}>Optimizing your route...</Text>
            <Text style={styles.overlayText}>{planningStep}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${planningProgress}%` }]} />
            </View>
            <View style={styles.overlaySkeletonLines}>
              <SkeletonBlock style={styles.overlaySkeletonLine} />
              <SkeletonBlock style={[styles.overlaySkeletonLine, styles.overlaySkeletonLineShort]} />
            </View>
          </View>
        </View>
      ) : null}

      {isLoadingAttractionPreview ? (
        <View style={styles.startupLoader} pointerEvents='auto'>
          <LinearGradient colors={['#0b1328', '#111827', '#1e293b']} style={styles.startupLoaderBackdrop}>
            <Animated.View
              style={[
                styles.startupLoaderCard,
                {
                  transform: [{ scale: loaderAnim.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.015] }) }],
                },
              ]}
            >
              <View style={styles.startupLoaderBadge}>
                <Ionicons name='map-outline' size={20} color='#ff6b6b' />
              </View>
              <Text style={styles.startupLoaderTitle}>Building your city plan</Text>
              <Text style={styles.startupLoaderSubtitle}>Finding top attractions and shaping your smartest route...</Text>

              <View style={styles.loaderDotsRow}>
                <Animated.View
                  style={[
                    styles.loaderDot,
                    {
                      opacity: loaderAnim.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.35, 1, 0.35] }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.loaderDot,
                    {
                      opacity: loaderAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.loaderDot,
                    {
                      opacity: loaderAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.35, 1, 0.35] }),
                    },
                  ]}
                />
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.startupLoaderSkeletonWrap,
                {
                  opacity: loaderAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
                },
              ]}
            >
              <View style={styles.startupLoaderSkeletonRow} />
              <View style={[styles.startupLoaderSkeletonRow, styles.startupLoaderSkeletonRowShort]} />
              <View style={styles.startupLoaderSkeletonRow} />
            </Animated.View>
          </LinearGradient>
        </View>
      ) : null}

      <Modal
        visible={isLimitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLimitModalVisible(false)}
      >
        <View style={styles.limitModalOverlay}>
          <View style={styles.limitModalCard}>
            <View style={styles.limitModalIconWrap}>
              <Ionicons name="alert-circle" size={42} color="#FF6B6B" />
            </View>
            <Text style={styles.limitModalTitle}>Daily Limit Reached</Text>
            <Text style={styles.limitModalText}>
              You have reached your daily limit of itinerary generation, come back tomorrow, till then u can explore other's itineraries in explore tab
            </Text>
            <View style={styles.limitModalActions}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.limitModalSecondaryBtn}
                onPress={() => setIsLimitModalVisible(false)}
              >
                <Text style={styles.limitModalSecondaryText}>Maybe Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.limitModalPrimaryBtn}
                onPress={() => {
                  setIsLimitModalVisible(false);
                  navigation?.navigate('Explore');
                }}
              >
                <Text style={styles.limitModalPrimaryText}>Explore Itineraries</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InstructionRow({ index, text }) {
  return (
    <View style={styles.instructionRow}>
      <View style={styles.stepDot}>
        <Text style={styles.stepText}>{index}</Text>
      </View>
      <Text style={styles.instructionText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f5f5',
  },
  headerWrap: {
    paddingHorizontal: 10,
    paddingTop: 12,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    color: '#0f2044',
    fontSize: 18,
    fontWeight: '700',
  },
  spacer: {
    width: 40,
    height: 40,
  },
  heroCard: {
    borderRadius: 12,
    padding: 18,
    overflow: 'hidden',
  },
  heroIcon: {
    position: 'absolute',
    right: 12,
    top: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 4,
    color: '#CBD5E1',
    fontSize: 12,
  },
  chipsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  routeChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  countChip: {
    borderRadius: 999,
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  tabsWrap: {
    marginTop: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,32,68,0.10)',
  },
  swipeArea: {
    flex: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#ff6b6b',
  },
  tabText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0f2044',
    fontWeight: '700',
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 130,
  },
  instructionsCard: {
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.25)',
    borderRadius: 12,
    padding: 14,
  },
  manualGuideToggle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,32,68,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  manualGuideToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualGuideToggleIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,107,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualGuideToggleTitle: {
    color: '#0f2044',
    fontSize: 13,
    fontWeight: '700',
  },
  manualGuideToggleSubtitle: {
    marginTop: 1,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  instructionsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  instructionsTitle: {
    color: '#0f2044',
    fontSize: 13,
    fontWeight: '700',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    color: '#64748B',
    fontSize: 11,
    lineHeight: 14,
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    color: '#0f2044',
    fontSize: 16,
    fontWeight: '700',
  },
  listWrap: {
    gap: 12,
  },
  attractionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,32,68,0.05)',
  },
  attractionCardUnselected: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderStyle: 'dashed',
    borderColor: 'rgba(15,32,68,0.12)',
  },
  attractionImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  attractionImageUnselected: {
    opacity: 0.7,
  },
  attractionMain: {
    flex: 1,
    minWidth: 0,
  },
  attractionTitle: {
    color: '#0f2044',
    fontSize: 15,
    fontWeight: '700',
  },
  attractionTitleUnselected: {
    color: '#64748B',
  },
  ratingRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    color: '#0f2044',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewText: {
    color: '#64748B',
    fontSize: 10,
  },
  categoryText: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 11,
  },
  selectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnActive: {
    backgroundColor: '#ff6b6b',
  },
  selectBtnIdle: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    paddingVertical: 18,
  },
  tabGenerateButton: {
    marginTop: 14,
    backgroundColor: '#0f2044',
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  tabGenerateButtonDisabled: {
    opacity: 0.45,
  },
  tabGenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 24,
  },
  bottomSpacerManual: {
    height: 120,
  },
  manualFloatingWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: -20,
    zIndex: 40,
    elevation: 20,
  },
  manualFloatingButton: {
    backgroundColor: '#0f2044',
    borderRadius: 18,
    minHeight: 64,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#0f2044',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  manualFloatingButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
  manualFloatingButtonIcon: {
    marginLeft: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: -112,
    left: 0,
    zIndex: 40,
    backgroundColor: 'rgba(15,32,68,0.80)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  skeletonBase: {
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 140,
  },
  skeletonShimmerGradient: {
    flex: 1,
  },
  overlaySkeletonAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  spinnerWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    marginTop: 18,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  overlayText: {
    marginTop: 6,
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: 12,
    width: '100%',
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff6b6b',
  },
  overlaySkeletonLines: {
    marginTop: 12,
    width: '100%',
    gap: 8,
  },
  overlaySkeletonLine: {
    width: '100%',
    height: 10,
    borderRadius: 7,
  },
  overlaySkeletonLineShort: {
    width: '74%',
  },
  startupLoader: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: -112,
    left: 0,
    backgroundColor: '#0b1328',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
  },
  startupLoaderBackdrop: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  startupLoaderCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
  },
  startupLoaderBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,107,107,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  startupLoaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  startupLoaderSubtitle: {
    marginTop: 8,
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  loaderDotsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6b6b',
  },
  startupLoaderSkeletonWrap: {
    width: '100%',
    maxWidth: 340,
    gap: 10,
  },
  startupLoaderSkeletonRow: {
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
  },
  startupLoaderSkeletonRowShort: {
    width: '82%',
  },
  limitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  limitModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  limitModalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,107,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  limitModalTitle: {
    color: '#0F2044',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  limitModalText: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  limitModalActions: {
    width: '100%',
    gap: 12,
  },
  limitModalPrimaryBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  limitModalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  limitModalSecondaryBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  limitModalSecondaryText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '700',
  },
});
