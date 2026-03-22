import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTopBar from '../../navigation/components/ScreenTopBar';
import TripPlannerScreen from './TripPlannerScreen';
import { getMe, updateProfile } from '../../services/auth/authService';
import { requestLiveLocation } from '../../services/maps/locationService';
import {
  searchPhotonPlaces,
  getPlaceCoords,
  reverseGeocodeWithPhoton,
} from '../../services/maps/googleGeocodingService';
import {
  listRecentTrips,
  listTrendingAttractions,
} from '../../services/itinerary/itineraryService';
import { SKELETON_GRADIENT_COLORS, useSkeletonShimmer } from '../../utils/skeletonShimmer';

const SMART_TIPS = [
  {
    id: 'fare-window',
    icon: 'airplane-outline',
    title: 'Smart Tip',
    text: 'Flights booked on Tue/Wed can often be 8-14% cheaper for short-haul routes.',
  },
  {
    id: 'early-checkin',
    icon: 'time-outline',
    title: 'Smart Tip',
    text: 'Start your first stop before 10 AM to avoid crowds and gain an extra sightseeing slot.',
  },
  {
    id: 'cluster-stops',
    icon: 'git-network-outline',
    title: 'Smart Tip',
    text: 'Group nearby places on the same day to reduce transit fatigue and save commute time.',
  },
  {
    id: 'offline-ready',
    icon: 'download-outline',
    title: 'Smart Tip',
    text: 'Save key addresses and transport notes offline in case your mobile data drops mid-trip.',
  },
];

const COMMUNITY_TIPS = [
  {
    id: 'budget-hack',
    tag: 'Budget Hack',
    icon: 'bulb-outline',
    accent: '#FF6B6B',
    bg: 'rgba(255,107,107,0.08)',
    border: 'rgba(255,107,107,0.2)',
    text: 'Book museum tickets online 48h in advance to save up to 15% and skip the lines.',
  },
  {
    id: 'local-secret',
    tag: 'Local Secret',
    icon: 'compass-outline',
    accent: '#FF9F43',
    bg: 'rgba(255,159,67,0.10)',
    border: 'rgba(255,159,67,0.24)',
    text: 'In Tokyo, the best sushi is often found in the small basements of subway stations.',
  },
  {
    id: 'packing-pro',
    tag: 'Packing Pro',
    icon: 'briefcase-outline',
    accent: '#0EA5E9',
    bg: 'rgba(14,165,233,0.10)',
    border: 'rgba(14,165,233,0.24)',
    text: 'Roll your clothes instead of folding them to save up to 25% of space in your suitcase.',
  },
  {
    id: 'transit-trick',
    tag: 'Transit Trick',
    icon: 'subway-outline',
    accent: '#8B5CF6',
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.24)',
    text: 'Buy day passes for public transit at the airport before you head to your hotel to save cash.',
  },
  {
    id: 'foodie-find',
    tag: 'Foodie Find',
    icon: 'restaurant-outline',
    accent: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.24)',
    text: 'Skip restaurants right next to major tourist traps. Walk 3 blocks away for local prices.',
  },
];

const PRE_PLANNING_TASKS = [
  { id: 'book-flights', label: 'Book Flights', completed: true },
  { id: 'travel-insurance', label: 'Travel Insurance', completed: true },
  { id: 'pack-essentials', label: 'Pack Essentials', completed: false },
  { id: 'currency-exchange', label: 'Currency Exchange', completed: false },
  { id: 'visa-check', label: 'Check Visa Requirements', completed: false },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_TRIPS_LIMIT = 3;
const BUDGET_OPTIONS = [
  { key: '$', label: 'Low' },
  { key: '$$', label: 'Medium' },
  { key: '$$$', label: 'High' },
];

// Returns today's date in YYYY-MM-DD using LOCAL timezone (not UTC)
// This prevents the UTC offset bug where IST devices see yesterday as "today"
function todayLocalIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatIsoDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const result = [];
  for (let i = 0; i < startDay; i += 1) {
    result.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    result.push(new Date(year, month, day));
  }
  return result;
}

function DateRangePickerModal({ visible, initialStartDate, initialEndDate, onClose, onApply }) {
  const { width: screenWidth } = useWindowDimensions();
  const [monthCursor, setMonthCursor] = useState(() => {
    if (initialStartDate) {
      return new Date(`${initialStartDate}T00:00:00`);
    }
    return new Date();
  });
  const [draftStart, setDraftStart] = useState(initialStartDate || '');
  const [draftEnd, setDraftEnd] = useState(initialEndDate || '');
  const monthDays = useMemo(() => buildMonthDays(monthCursor), [monthCursor]);
  const todayIso = todayLocalIso();
  const calendarCardWidth = Math.max(310, Math.min(410, screenWidth - 28));
  const gridHorizontalPadding = 4;
  const gridGap = 6;
  const dayCellSize = Math.max(
    36,
    Math.min(46, Math.floor((calendarCardWidth - 32 - gridHorizontalPadding * 2 - gridGap * 6) / 7))
  );

  useEffect(() => {
    if (visible) {
      setDraftStart(initialStartDate || '');
      setDraftEnd(initialEndDate || '');
      setMonthCursor(initialStartDate ? new Date(`${initialStartDate}T00:00:00`) : new Date());
    }
  }, [visible, initialStartDate, initialEndDate]);

  const goPrevMonth = () =>
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));

  const goNextMonth = () =>
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const onSelectDate = (date) => {
    const iso = toIsoDate(date);
    if (iso < todayIso) {
      return;
    }
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(iso);
      setDraftEnd('');
      return;
    }
    if (iso < draftStart) {
      setDraftStart(iso);
      setDraftEnd(draftStart);
      return;
    }
    setDraftEnd(iso);
  };

  const durationText = (() => {
    if (!draftStart || !draftEnd) {
      return 'Select start and end date';
    }
    const diff = Math.floor((new Date(`${draftEnd}T00:00:00`).getTime() - new Date(`${draftStart}T00:00:00`).getTime()) / DAY_MS) + 1;
    return `${diff} day${diff > 1 ? 's' : ''}`;
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={localStyles.calendarOverlay}>
        <View style={[localStyles.calendarCard, { width: calendarCardWidth }]}>
          <View style={localStyles.calendarHeader}>
            <Text style={localStyles.calendarTitle}>Select trip dates</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          <View style={localStyles.calendarMonthRow}>
            <Pressable onPress={goPrevMonth} style={localStyles.calendarNavBtn}>
              <Ionicons name="chevron-back" size={16} color="#334155" />
            </Pressable>
            <View style={localStyles.calendarMonthChip}>
              <Text style={localStyles.calendarMonthText}>{monthLabel(monthCursor)}</Text>
            </View>
            <Pressable onPress={goNextMonth} style={localStyles.calendarNavBtn}>
              <Ionicons name="chevron-forward" size={16} color="#334155" />
            </Pressable>
          </View>

          <View style={localStyles.calendarWeekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
              <Text key={`${label}-${index}`} style={localStyles.calendarWeekDay}>
                {label}
              </Text>
            ))}
          </View>

          <View style={localStyles.calendarGrid}>
            {monthDays.map((day, index) => {
              if (!day) {
                return (
                  <View key={`empty-${index}`} style={[localStyles.calendarCell, { width: dayCellSize, height: dayCellSize }]} />
                );
              }

              const iso = toIsoDate(day);
              const isPast = iso < todayIso;
              const isStart = draftStart === iso;
              const isEnd = draftEnd === iso;
              const isBetween = !!draftStart && !!draftEnd && iso > draftStart && iso < draftEnd;
              const isToday = iso === todayIso;
              const selected = isStart || isEnd || isBetween;

              return (
                <Pressable
                  key={iso}
                  disabled={isPast}
                  onPress={() => onSelectDate(day)}
                  style={[
                    localStyles.calendarCell,
                    { width: dayCellSize, height: dayCellSize },
                    selected && localStyles.calendarCellSelected,
                    (isStart || isEnd) && localStyles.calendarCellEdge,
                    isToday && !selected && localStyles.calendarCellToday,
                  ]}
                >
                  <Text
                    style={[
                      localStyles.calendarDateText,
                      isPast && localStyles.calendarDateTextPast,
                      isToday && !selected && localStyles.calendarDateTextToday,
                      selected && localStyles.calendarDateTextSelected,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={localStyles.calendarInfoRow}>
            <View style={localStyles.calendarInfoPill}>
              <Text style={localStyles.calendarInfoLabel}>Start</Text>
              <Text style={localStyles.calendarInfoText}>{draftStart ? formatIsoDate(draftStart) : 'Select'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
            <View style={localStyles.calendarInfoPill}>
              <Text style={localStyles.calendarInfoLabel}>End</Text>
              <Text style={localStyles.calendarInfoText}>{draftEnd ? formatIsoDate(draftEnd) : 'Select'}</Text>
            </View>
          </View>
          <Text style={localStyles.calendarDuration}>{durationText}</Text>

          <View style={localStyles.calendarActions}>
            <TouchableOpacity activeOpacity={0.9} style={localStyles.calendarSecondaryBtn} onPress={onClose}>
              <Text style={localStyles.calendarSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                localStyles.calendarPrimaryBtn,
                (!draftStart || !draftEnd) && localStyles.calendarPrimaryBtnDisabled,
              ]}
              disabled={!draftStart || !draftEnd}
              onPress={() => onApply(draftStart, draftEnd)}
            >
              <Text style={localStyles.calendarPrimaryText}>Apply dates</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen({ styles }) {
  const navigation = useNavigation();
  const [fromLocation, setFromLocation] = useState('');
  const [fromSelectedPlace, setFromSelectedPlace] = useState(null);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState('from');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showBudgetPicker, setShowBudgetPicker] = useState(false);
  const [budget, setBudget] = useState('$');
  const [plannerView, setPlannerView] = useState('form');
  const [securityPromptVisible, setSecurityPromptVisible] = useState(false);
  const [securityPromptStep, setSecurityPromptStep] = useState('intro');
  const [securityPromptQuestion, setSecurityPromptQuestion] = useState('');
  const [securityPromptAnswer, setSecurityPromptAnswer] = useState('');
  const [securityPromptError, setSecurityPromptError] = useState('');
  const [isSecurityPromptSaving, setIsSecurityPromptSaving] = useState(false);
  const [recentTrips, setRecentTrips] = useState([]);
  const [userTripCount, setUserTripCount] = useState(0);
  const [isLoadingRecentTrips, setIsLoadingRecentTrips] = useState(false);
  const [trendingAttractions, setTrendingAttractions] = useState([]);
  const [isLoadingTrendingAttractions, setIsLoadingTrendingAttractions] = useState(false);
  const [smartTipIndex, setSmartTipIndex] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const fromLocationRef = useRef('');
  const fromSelectedPlaceRef = useRef(null);
  const fromEditedManuallyRef = useRef(false);
  const smartTipAnim = useRef(new Animated.Value(1)).current;
  const smartTipAnimatingRef = useRef(false);

  useEffect(() => {
    fromLocationRef.current = fromLocation;
  }, [fromLocation]);

  useEffect(() => {
    fromSelectedPlaceRef.current = fromSelectedPlace;
  }, [fromSelectedPlace]);

  const applyResolvedLiveLocation = useCallback(async ({ silent = false, onlyIfUntouched = false } = {}) => {
    setIsFetchingLocation(true);
    try {
      const location = await requestLiveLocation();
      const areaName = await reverseGeocodeWithPhoton(
        location.latitude,
        location.longitude
      ).catch(() => 'Current Location');

      if (
        onlyIfUntouched &&
        (fromEditedManuallyRef.current || fromLocationRef.current.trim() || fromSelectedPlaceRef.current)
      ) {
        return null;
      }

      const resolved = { ...location, label: areaName || 'Current Location', source: 'live' };
      setFromSelectedPlace(resolved);
      setFromLocation(resolved.label);
      setFromSuggestions([]);
      setActiveSuggestionField(null);
      return resolved;
    } catch (error) {
      if (!silent) {
        Alert.alert('Location needed', error.message || 'Please allow location access to use GPS start point.');
      }
      return null;
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const checkSecuritySetup = async () => {
        try {
          const response = await getMe();
          if (!isMounted) {
            return;
          }
          if (!response.user?.hasSecurityQuestion) {
            setSecurityPromptVisible(true);
            setSecurityPromptStep('intro');
          }
        } catch (_error) {
          // Silent fail for non-blocking helper prompt.
        }
      };

      checkSecuritySetup();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  useEffect(() => {
    if (SMART_TIPS.length <= 1) {
      return undefined;
    }

    const rotateTip = () => {
      if (smartTipAnimatingRef.current) {
        return;
      }

      smartTipAnimatingRef.current = true;
      Animated.timing(smartTipAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setSmartTipIndex((prev) => (prev + 1) % SMART_TIPS.length);
        smartTipAnim.setValue(0);
        Animated.timing(smartTipAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start(() => {
          smartTipAnimatingRef.current = false;
        });
      });
    };

    const interval = setInterval(rotateTip, 3600);
    return () => clearInterval(interval);
  }, [smartTipAnim]);

  const currentSmartTip = SMART_TIPS[smartTipIndex] || SMART_TIPS[0];
  const skeletonTranslateX = useSkeletonShimmer();

  const triggerHaptic = useCallback((kind = 'light') => {
    if (Platform.OS === 'web') {
      return;
    }
    const durationMs = kind === 'success' ? 14 : 7;
    Vibration.vibrate(durationMs);
  }, []);

  useEffect(() => {
    if (!fromLocation.trim()) {
      setFromSuggestions([]);
      return undefined;
    }

    const timeout = setTimeout(async () => {
      try {
        const suggestions = await searchPhotonPlaces(fromLocation, 5);
        setFromSuggestions(suggestions);
      } catch (_error) {
        setFromSuggestions([]);
      }
    }, 280);

    return () => clearTimeout(timeout);
  }, [fromLocation]);

  const loadRecentTrips = useCallback(async () => {
    setIsLoadingRecentTrips(true);
    setIsLoadingTrendingAttractions(true);
    try {
      const [recentResult, trendingResult] = await Promise.allSettled([
        listRecentTrips(),
        listTrendingAttractions(3),
      ]);

      if (recentResult.status === 'fulfilled') {
        setRecentTrips(recentResult.value.trips || []);
        setUserTripCount(recentResult.value.userTripCount ?? 0);
      } else {
        setRecentTrips([]);
        setUserTripCount(0);
      }

      const topTrending = trendingResult.status === 'fulfilled' ? trendingResult.value : [];
      setTrendingAttractions(topTrending.slice(0, 3));
    } catch (_error) {
      setRecentTrips([]);
      setUserTripCount(0);
      setTrendingAttractions([]);
    } finally {
      setIsLoadingRecentTrips(false);
      setIsLoadingTrendingAttractions(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentTrips();
    }, [loadRecentTrips])
  );

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) {
      return 0;
    }
    return Math.max(1, Math.floor((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / DAY_MS) + 1);
  }, [startDate, endDate]);

  const applyDateRange = (nextStartDate, nextEndDate) => {
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setShowDateRangePicker(false);
  };

  const useLiveFromLocation = async () => {
    await applyResolvedLiveLocation({ silent: false });
  };

  const pickSuggestion = async (suggestion) => {
    setFromLocation(suggestion.label);
    setFromSuggestions([]);
    setActiveSuggestionField(null);
    fromEditedManuallyRef.current = true;

    // If coords are already present (live location), use directly
    if (Number.isFinite(suggestion.latitude) && Number.isFinite(suggestion.longitude)) {
      setFromSelectedPlace(suggestion);
      return;
    }

    // Google autocomplete returns place_id but no coords — resolve via Place Details
    if (suggestion.placeId) {
      try {
        const coords = await getPlaceCoords(suggestion.placeId);
        if (coords) {
          setFromSelectedPlace({ ...suggestion, ...coords, source: 'autocomplete' });
          return;
        }
      } catch (_error) {
        // fall through
      }
    }

    // Fallback: store without coords (server will geocode from label)
    setFromSelectedPlace(suggestion);
  };

  const saveSecurityPromptDetails = async () => {
    if (!securityPromptQuestion.trim() || !securityPromptAnswer.trim()) {
      setSecurityPromptError('Please enter both a security question and answer.');
      return;
    }

    setSecurityPromptError('');
    setIsSecurityPromptSaving(true);
    try {
      await updateProfile({
        securityQuestion: securityPromptQuestion.trim(),
        securityAnswer: securityPromptAnswer.trim(),
      });
      setSecurityPromptVisible(false);
      setSecurityPromptQuestion('');
      setSecurityPromptAnswer('');
      setSecurityPromptStep('intro');
    } catch (error) {
      setSecurityPromptError(error.message || 'Unable to save security question right now.');
    } finally {
      setIsSecurityPromptSaving(false);
    }
  };

  const startPlannerFlow = () => {
    if (!startDate || !endDate) {
      Alert.alert('Trip dates required', 'Please select your start and end dates.');
      return;
    }
    setPlannerView('planning');
  };

  const SkeletonBlock = ({ style }) => (
    <View style={[localStyles.skeletonBase, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          localStyles.skeletonShimmer,
          {
            transform: [{ translateX: skeletonTranslateX }],
          },
        ]}
      >
        <LinearGradient
          colors={SKELETON_GRADIENT_COLORS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={localStyles.skeletonShimmerGradient}
        />
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screenSafe, localStyles.premiumRoot]} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar
          activeRoute="Home"
          styles={styles}
          onCustomBack={plannerView === 'planning' ? () => setPlannerView('form') : null}
        />
        
        <Modal visible={isFetchingLocation} transparent animationType="fade">
          <View style={localStyles.loaderOverlay}>
            <View style={localStyles.loaderCard}>
              <View style={localStyles.loaderIconWrap}>
                <Ionicons name="location" size={32} color="#0EA5E9" />
              </View>
              <Text style={localStyles.loaderTitle}>Fetching your live location...</Text>
              <Text style={localStyles.loaderSubtitle}>Just a moment while we find you</Text>
              <ActivityIndicator size="small" color="#0EA5E9" style={localStyles.loaderSpinner} />
            </View>
          </View>
        </Modal>

        <Modal
          visible={securityPromptVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSecurityPromptVisible(false)}
        >
          <View style={styles.securityPromptOverlay}>
            <View style={styles.securityPromptCard}>
              <Text style={styles.securityPromptTitle}>Set up password recovery</Text>
              {securityPromptStep === 'intro' ? (
                <>
                  <Text style={styles.securityPromptText}>
                    Add a security question now so you can safely recover your account if you ever forget your password.
                  </Text>
                  <View style={styles.securityPromptActions}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.securityPromptSecondaryBtn}
                      onPress={() => setSecurityPromptVisible(false)}
                    >
                      <Text style={styles.securityPromptSecondaryText}>Later</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.securityPromptPrimaryBtn}
                      onPress={() => setSecurityPromptStep('form')}
                    >
                      <Text style={styles.securityPromptPrimaryText}>Proceed</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TextInput
                    value={securityPromptQuestion}
                    onChangeText={setSecurityPromptQuestion}
                    placeholder="Security question (e.g. What was your first pet's name?)"
                    placeholderTextColor="#94A3B8"
                    style={styles.securityPromptInput}
                  />
                  <TextInput
                    value={securityPromptAnswer}
                    onChangeText={setSecurityPromptAnswer}
                    placeholder="Security answer"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    style={[styles.securityPromptInput, styles.securityPromptInputGap]}
                  />
                  {!!securityPromptError && <Text style={styles.securityPromptError}>{securityPromptError}</Text>}
                  <View style={styles.securityPromptActions}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.securityPromptSecondaryBtn}
                      onPress={() => setSecurityPromptStep('intro')}
                      disabled={isSecurityPromptSaving}
                    >
                      <Text style={styles.securityPromptSecondaryText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.securityPromptPrimaryBtn}
                      onPress={saveSecurityPromptDetails}
                      disabled={isSecurityPromptSaving}
                    >
                      {isSecurityPromptSaving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.securityPromptPrimaryText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
        <DateRangePickerModal
          visible={showDateRangePicker}
          initialStartDate={startDate}
          initialEndDate={endDate}
          onClose={() => setShowDateRangePicker(false)}
          onApply={applyDateRange}
        />
        <Modal visible={showBudgetPicker} transparent animationType="fade" onRequestClose={() => setShowBudgetPicker(false)}>
          <Pressable style={localStyles.budgetPickerOverlay} onPress={() => setShowBudgetPicker(false)}>
            <Pressable style={localStyles.budgetPickerCard} onPress={() => {}}>
              <Text style={localStyles.budgetPickerTitle}>Select budget</Text>
              {BUDGET_OPTIONS.map((option) => {
                const selected = budget === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.9}
                    onPress={() => {
                      setBudget(option.key);
                      setShowBudgetPicker(false);
                    }}
                    style={[localStyles.budgetPickerOption, selected && localStyles.budgetPickerOptionSelected]}
                  >
                    <Text style={[localStyles.budgetPickerOptionText, selected && localStyles.budgetPickerOptionTextSelected]}>
                      {option.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={16} color="#FF6B6B" />}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
        <View
          style={[
            styles.screenBody,
            localStyles.homeScreenBody,
            plannerView === 'planning' && localStyles.plannerScreenBody,
          ]}
        >
          {plannerView === 'planning' ? (
            <TripPlannerScreen
              navigation={navigation}
              fromLocation={fromLocation}
              fromSelectedPlace={fromSelectedPlace}
              startDate={startDate}
              endDate={endDate}
              budget={budget}
              triggerHaptic={triggerHaptic}
              onBack={() => setPlannerView('form')}
              onTripSaved={async (savedTrip) => {
                setPlannerView('form');
                navigation.navigate('Trips', savedTrip?.id ? { openTripId: savedTrip.id } : undefined);
              }}
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={localStyles.premiumScrollContent}
            >
              <View style={localStyles.premiumPlannerCard}>
                <ImageBackground
                  source={{
                    uri:
                      'https://lh3.googleusercontent.com/aida-public/AB6AXuAtHCCGWUzIlodb3PSfVTTcWCaOkqcAiWU_e2_bMv65UCGf_yuGGzZTIVcGn8woMXyEbESMefmrt5ZbvX1yj_MGWfz9hl0MgPelwmlY4J4GypcHGf0a4KaKNXzYI6lIWuAslftHvsK6DrNg0-g37aZBnli3Ryj1Vq4eV3H2Yn3x4nmQnm7AlCyXijJLPW24ScmXLTeQcaQygchKKNqanIpjG4PeIN5iskeyhkbvZ5HLkDdQMrf-pMeE3PKww-tnpowQkoP_MO0AfRr_',
                  }}
                  style={localStyles.premiumHeroImage}
                >
                  <LinearGradient
                    colors={['rgba(26,42,108,0.12)', 'rgba(26,42,108,0.72)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={localStyles.premiumHeroOverlay}
                  >
                    <Text style={localStyles.premiumHeroEyebrow}>Route, Time & Cost Optimized</Text>
                    <Text style={localStyles.premiumHeroTitle}>Your Personal Travel Guide</Text>
                    <Text style={localStyles.premiumHeroSubtitle}>
                      Discover optimized routes and clear navigation to explore every destination smoothly and confidently.
                    </Text>
                  </LinearGradient>
                </ImageBackground>

                <View style={localStyles.premiumPlannerBody}>
                  <View style={localStyles.premiumStarterRow}>
                    <View style={localStyles.premiumStarterBar} />
                    <Text style={localStyles.premiumStarterText}>Start your instant trip</Text>
                  </View>

                  <View style={localStyles.premiumFieldBlock}>
                    <Text style={localStyles.premiumFieldLabel}>Destination</Text>
                    <View style={localStyles.premiumInputRow}>
                      <Ionicons name="trail-sign-outline" size={18} color="#FF6B6B" style={localStyles.premiumInputIcon} />
                      <TextInput
                        style={localStyles.premiumTextInput}
                        placeholder="e.g. Kyoto, Japan"
                        placeholderTextColor="#94A3B8"
                        value={fromLocation}
                        onFocus={() => setActiveSuggestionField('from')}
                        onChangeText={(value) => {
                          fromEditedManuallyRef.current = true;
                          setFromLocation(value);
                          setFromSelectedPlace(null);
                          setActiveSuggestionField('from');
                        }}
                      />
                      <TouchableOpacity
                        activeOpacity={0.86}
                        style={localStyles.liveLocationButton}
                        onPress={() => {
                          triggerHaptic('light');
                          useLiveFromLocation();
                        }}
                      >
                        <Ionicons name="locate" size={16} color="#0EA5E9" />
                      </TouchableOpacity>
                    </View>
                    {activeSuggestionField === 'from' && fromSuggestions.length > 0 && (
                      <View style={localStyles.suggestionCard}>
                        {fromSuggestions.map((suggestion) => (
                          <TouchableOpacity
                            key={`from-${suggestion.id}`}
                            style={localStyles.suggestionRow}
                            activeOpacity={0.85}
                            onPress={() => pickSuggestion(suggestion)}
                          >
                            <Ionicons name="location-outline" size={14} color="#0EA5E9" />
                            <View style={localStyles.suggestionTextWrap}>
                              <Text style={localStyles.suggestionTitle}>{suggestion.label}</Text>
                              {!!suggestion.subtitle && (
                                <Text style={localStyles.suggestionSubtitle}>{suggestion.subtitle}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={localStyles.premiumTwoColRow}>
                    <View style={localStyles.premiumCol}>
                      <Text style={localStyles.premiumFieldLabel}>Travel Dates</Text>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={localStyles.premiumInputRow}
                        onPress={() => setShowDateRangePicker(true)}
                      >
                        <Ionicons name="calendar-clear-outline" size={18} color="#FF6B6B" style={localStyles.premiumInputIcon} />
                        <Text style={localStyles.premiumDropdownText} numberOfLines={1}>
                          {startDate && endDate ? `${formatIsoDate(startDate)} - ${formatIsoDate(endDate)}` : 'Pick dates'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={localStyles.premiumCol}>
                      <Text style={localStyles.premiumFieldLabel}>Budget</Text>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={localStyles.premiumInputRow}
                        onPress={() => setShowBudgetPicker(true)}
                      >
                        <Ionicons name="wallet-outline" size={18} color="#FF6B6B" style={localStyles.premiumInputIcon} />
                        <Text style={localStyles.premiumDropdownText}>
                          {BUDGET_OPTIONS.find((option) => option.key === budget)?.label || 'Select'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#94A3B8" style={localStyles.premiumChevron} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <Text style={localStyles.sliderHintText}>
                    Select your destination, dates and budget to get started.
                  </Text>

                  {!!durationDays && (
                    <Text style={localStyles.durationLabel}>
                      Duration: {durationDays} day{durationDays > 1 ? 's' : ''}
                    </Text>
                  )}

                  <TouchableOpacity activeOpacity={0.92} style={localStyles.premiumPlanButtonWrap} onPress={startPlannerFlow}>
                    <LinearGradient
                      colors={['#FF6B6B', '#FF9F43']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={localStyles.premiumPlanButton}
                    >
                      <Text style={localStyles.premiumPlanButtonText}>Plan my Trip</Text>
                      <Ionicons name="airplane-outline" size={18} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={localStyles.premiumSectionHead}>
                <Text style={localStyles.premiumSectionTitle}>
                  {userTripCount >= 3 ? 'Your Recent Trips' : 'Recent Trips'}
                </Text>
                {userTripCount >= 3 && (
                  <TouchableOpacity activeOpacity={0.85} style={localStyles.inlineLink} onPress={() => navigation.navigate('Trips')}>
                    <Text style={localStyles.inlineLinkText}>View All</Text>
                    <Ionicons name="arrow-forward" size={12} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.premiumHorizontalRow}>
                {isLoadingRecentTrips ? (
                  <View style={localStyles.skeletonRecentRow}>
                    {[0, 1, 2].map((item) => (
                      <View key={`recent-skeleton-${item}`} style={localStyles.journeyCard}>
                        <SkeletonBlock style={localStyles.skeletonJourneyImage} />
                        <SkeletonBlock style={localStyles.skeletonJourneyTitle} />
                        <SkeletonBlock style={localStyles.skeletonJourneyMeta} />
                      </View>
                    ))}
                  </View>
                ) : recentTrips.length ? (
                  recentTrips.map((trip) => (
                    <TouchableOpacity
                      key={trip.id}
                      activeOpacity={0.9}
                      style={localStyles.journeyCard}
                      onPress={() => navigation.navigate('Trips')}
                    >
                      <Image
                        source={{
                          uri:
                            trip.coverImageUrl ||
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuAgqSe4qO0Vn7HWklIiOQ6Ab5qjZsvUm5l8i2pAZTdxX_VqcWEGvMpcrMN1XmvmmR1Z-Z0TOIEetAHAgTpNe612c_mfW6R47T51plH14h7FIr1QP_MXBjvbRmBPXcM444VMqIz6nEUv7fQBnwXMOraEmEi0QNRVZyFu1Fx4LpEFG04Opjb1oGy_AuKIsXAO9Bbagb7eYEST7nY0FB5cDEN3zv3BADUnfDeUqqMSbGovD24sc5KVERTcNvMbS8Wu1F17wcPtEJLWnX6d',
                        }}
                        style={localStyles.journeyImage}
                      />
                      <Text style={localStyles.journeyTitle} numberOfLines={1}>
                        {trip.title || 'Untitled trip'}
                      </Text>
                      <Text style={localStyles.journeyMeta}>
                        {trip.startDate && trip.endDate
                          ? `${formatIsoDate(trip.startDate)} - ${formatIsoDate(trip.endDate)}`
                          : 'Dates unavailable'}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={localStyles.recentTripsStateCard}>
                    <Ionicons name="briefcase-outline" size={18} color="#94A3B8" />
                    <Text style={localStyles.recentTripsStateText}>No recent trips yet. Plan one to see it here.</Text>
                  </View>
                )}
              </ScrollView>

              <View style={localStyles.premiumStackSection}>
                <View style={localStyles.premiumSectionTitleRow}>
                  <Text style={localStyles.premiumSectionTitle}>Trending Destinations</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={localStyles.inlineLink}
                    onPress={() => navigation.navigate('Explore')}
                  >
                    <Text style={localStyles.inlineLinkText}>Explore</Text>
                    <Ionicons name="arrow-forward" size={12} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
                {isLoadingTrendingAttractions ? (
                  [0, 1].map((item) => (
                    <View key={`trending-skeleton-${item}`} style={localStyles.trendingCard}>
                      <SkeletonBlock style={localStyles.skeletonTrendingImage} />
                      <View style={localStyles.skeletonTrendingBottom}>
                        <SkeletonBlock style={localStyles.skeletonTrendingCountry} />
                        <SkeletonBlock style={localStyles.skeletonTrendingTitle} />
                        <SkeletonBlock style={localStyles.skeletonTrendingMeta} />
                      </View>
                    </View>
                  ))
                ) : trendingAttractions.length ? (
                  trendingAttractions.map((place, index) => (
                    <TouchableOpacity
                      key={place.id || `trending-fallback-${index}`}
                      activeOpacity={0.92}
                      style={localStyles.trendingCard}
                      onPress={() => navigation.navigate('Trips')}
                    >
                      <Image
                        source={{
                          uri:
                            place.imageUrl ||
                            (index % 2 === 0
                              ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZs8yOKPph1zu9wdLWAltLfE7PlOm4QCkvCRMfid2Nilc6EOQMuU_1adYywcrn7MRDBx0U1ubSUSM2UXdoFGJrBwgL-PNe0rW8T7_E1tokmJ9yGhWC0V96JPGGcNwRBe6Tl1q1kr0mJ_6_U-NOjO0_cdxRpza7__zjc9PGFHbDahAK_1g6oqBcE6ioiWLRfqoCHyCH-OL7-JpaB4Zda5JKWvL4_tawuaNuOOKrSZLn_LZwYQKUB9VyfPWmr6_vGoD-zkE8waiE8dnB'
                              : 'https://lh3.googleusercontent.com/aida-public/AB6AXuAA9PywXUbbSbT2lIEisFaBY0GT21cbBPf9eyh1S0TN65chPN3Mj5l4cBO7R6GCszXypIscUbL0rNcJiGWpFQHe_Rs3szhuALZTcEDUAqesuYmz2F35qOezZU0v1HDkRPcA1YKoNoRABLIZCs0kwuIIB_rzG-U1uAWH9zYt-Rwd7SoA-VfNDYOrH67hbOhvxZwkpDhxFwKfGxYdGezCCVLuWImAaZsAZOrWIvhZrS-3zqjT2I4teM0qB3jth02fwc7nrUyD0m8wtcW5'),
                        }}
                        style={localStyles.trendingImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.75)']}
                        start={{ x: 0.5, y: 0.2 }}
                        end={{ x: 0.5, y: 1 }}
                        style={localStyles.trendingOverlay}
                      >
                        <View style={localStyles.trendingBottomRow}>
                          <View style={localStyles.trendingTextCol}>
                            <Text style={localStyles.trendingCountry}>Top Rated Attraction</Text>
                            <Text style={localStyles.trendingTitle} numberOfLines={1}>
                              {place.label || (index % 2 === 0 ? 'Great Barrier Reef' : 'London City')}
                            </Text>
                          </View>
                          <View>
                            <View style={localStyles.trendingRatingRow}>
                              <Ionicons name="star" size={13} color="#FF9F43" />
                              <Text style={localStyles.trendingRating}>
                                {Number(place.tags?.rating || 0).toFixed(1) || (index % 2 === 0 ? '4.9' : '4.7')}
                              </Text>
                            </View>
                            <Text style={localStyles.trendingPrice}>
                              {`${Number(place.tags?.userRatingsTotal || 0).toLocaleString()} ratings`}
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={localStyles.trendingStateCard}>
                    <Ionicons name="map-outline" size={16} color="#94A3B8" />
                    <Text style={localStyles.trendingStateText}>No trending places available yet.</Text>
                  </View>
                )}
              </View>

              <View style={localStyles.premiumChecklistCard}>
                <Text style={localStyles.premiumChecklistTitle}>Pre-Planning Checklist</Text>
                {PRE_PLANNING_TASKS.map((item) => {
                  return (
                    <View key={item.id} style={localStyles.premiumChecklistRow}>
                      <Ionicons
                        name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={item.completed ? '#10B981' : '#CBD5E1'}
                      />
                      <Text style={localStyles.premiumChecklistText}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={localStyles.premiumStackSection}>
                <Text style={localStyles.premiumSectionTitle}>Community Vetted Tips</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.premiumHorizontalRow}>
                  <Animated.View
                    style={[
                      localStyles.communityTipCard,
                      {
                        backgroundColor: COMMUNITY_TIPS[0].bg,
                        borderColor: COMMUNITY_TIPS[0].border,
                        opacity: smartTipAnim,
                      },
                    ]}
                  >
                    <View style={localStyles.communityTipTagRow}>
                      <Ionicons name={COMMUNITY_TIPS[0].icon} size={16} color={COMMUNITY_TIPS[0].accent} />
                      <Text style={[localStyles.communityTipTag, { color: COMMUNITY_TIPS[0].accent }]}>
                        {COMMUNITY_TIPS[0].tag}
                      </Text>
                    </View>
                    <Text style={localStyles.communityTipText}>{currentSmartTip?.text || COMMUNITY_TIPS[0].text}</Text>
                  </Animated.View>

                  {COMMUNITY_TIPS.slice(1).map((tip) => (
                    <View
                      key={tip.id}
                      style={[
                        localStyles.communityTipCard,
                        {
                          backgroundColor: tip.bg,
                          borderColor: tip.border,
                        },
                      ]}
                    >
                      <View style={localStyles.communityTipTagRow}>
                        <Ionicons name={tip.icon} size={16} color={tip.accent} />
                        <Text style={[localStyles.communityTipTag, { color: tip.accent }]}>
                          {tip.tag}
                        </Text>
                      </View>
                      <Text style={localStyles.communityTipText}>{tip.text}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <View style={localStyles.premiumBottomSpacer} />
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  homeScreenBody: {
    paddingHorizontal: 0,
  },
  premiumRoot: {
    backgroundColor: '#F8F5F5',
  },
  plannerScreenBody: {
    paddingHorizontal: 0,
  },
  premiumHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.7)',
    zIndex: 8,
  },
  premiumAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,107,107,0.22)',
    backgroundColor: '#FFFFFF',
  },
  premiumAvatar: {
    width: '100%',
    height: '100%',
  },
  premiumBrand: {
    color: '#FF6B6B',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  premiumBellButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  premiumScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  premiumPlannerCard: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.46)',
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  premiumHeroImage: {
    width: '100%',
    height: 224,
    justifyContent: 'flex-end',
  },
  premiumHeroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  premiumHeroEyebrow: {
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  premiumHeroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
  },
  premiumHeroSubtitle: {
    marginTop: 7,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    maxWidth: '94%',
  },
  premiumPlannerBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  premiumStarterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  premiumStarterBar: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#FF6B6B',
  },
  premiumStarterText: {
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  premiumFieldBlock: {
    marginBottom: 16,
  },
  premiumFieldLabel: {
    marginBottom: 6,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  premiumInputRow: {
    minHeight: 55,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'center',
    position: 'relative',
  },
  premiumInputIcon: {
    position: 'absolute',
    left: 12,
    top: 18,
    zIndex: 2,
  },
  premiumTextInput: {
    minHeight: 55,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 42,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500',
  },
  premiumTwoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  premiumCol: {
    flex: 1,
  },
  premiumDropdownText: {
    minHeight: 55,
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 55,
    paddingLeft: 40,
    paddingRight: 32,
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  premiumChevron: {
    position: 'absolute',
    right: 10,
    top: 20,
  },
  sliderFieldBlock: {
    marginTop: 18,
    marginBottom: 4,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sliderValueText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  sliderTrackWrap: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 6,
  },
  sliderTrackBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    width: '100%',
    position: 'absolute',
  },
  sliderTrackFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B6B',
    position: 'absolute',
    left: 0,
  },
  sliderThumbNative: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    position: 'absolute',
    marginLeft: -12,
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sliderHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sliderHintText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  premiumPlanButtonWrap: {
    marginTop: 12,
  },
  premiumPlanButton: {
    minHeight: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.26,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  premiumPlanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  premiumSectionHead: {
    marginTop: 24,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  premiumSectionTitle: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inlineLinkText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '700',
  },
  premiumHorizontalRow: {
    gap: 12,
    paddingRight: 12,
  },
  skeletonBase: {
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 130,
  },
  skeletonShimmerGradient: {
    flex: 1,
  },
  skeletonRecentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  journeyCard: {
    width: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  journeyImage: {
    width: '100%',
    height: 96,
    borderRadius: 12,
    marginBottom: 8,
  },
  journeyTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  journeyMeta: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  skeletonJourneyImage: {
    width: '100%',
    height: 96,
    borderRadius: 12,
    marginBottom: 8,
  },
  skeletonJourneyTitle: {
    width: '78%',
    height: 13,
    borderRadius: 6,
    marginBottom: 7,
  },
  skeletonJourneyMeta: {
    width: '62%',
    height: 10,
    borderRadius: 6,
  },
  premiumStackSection: {
    marginTop: 24,
    gap: 12,
  },
  premiumSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trendingCard: {
    height: 192,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#CBD5E1',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  trendingImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  trendingOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  skeletonTrendingImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: '#CBD5E1',
  },
  skeletonTrendingBottom: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  skeletonTrendingCountry: {
    width: 110,
    height: 10,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#94A3B8',
  },
  skeletonTrendingTitle: {
    width: '68%',
    height: 22,
    borderRadius: 8,
    marginBottom: 9,
    backgroundColor: '#E2E8F0',
  },
  skeletonTrendingMeta: {
    width: 96,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#CBD5E1',
  },
  trendingBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  trendingTextCol: {
    flex: 1,
  },
  trendingCountry: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  trendingTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  trendingRatingRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  trendingRating: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  trendingPrice: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  premiumChecklistCard: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 10,
  },
  premiumChecklistTitle: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  premiumChecklistRow: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  premiumChecklistText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  communityTipCard: {
    width: 262,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  communityTipTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  communityTipTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  communityTipText: {
    color: '#1A2A6C',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  premiumBottomSpacer: {
    height: 8,
  },
  fromInputWithLiveButton: {
    paddingRight: 42,
  },
  liveLocationButton: {
    position: 'absolute',
    right: 10,
    top: 13.5,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  essentialsSection: {
    marginTop: 14,
  },
  planningFlowContainer: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 12,
    marginTop: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  planningHeroCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  planningBackButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  planningBackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  planningFlowTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  planningFlowSubtitle: {
    marginTop: 4,
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  planningMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planningMetaChip: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planningMetaText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  modeTabs: {
    position: 'relative',
    flexDirection: 'row',
    gap: 10,
    padding: 3,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  modeTabIndicator: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(225,29,72,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.2)',
  },
  modeTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 2,
  },
  modeTabActive: {
    backgroundColor: 'transparent',
  },
  modeTabPressed: {
    transform: [{ scale: 0.98 }],
  },
  modeTabText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#E11D48',
  },
  selectionInfoCard: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  selectionInfoContent: {
    flex: 1,
  },
  selectionTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  selectionHint: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 17,
  },
  attractionListCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  attractionRow: {
    minHeight: 62,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attractionRowSelected: {
    backgroundColor: 'rgba(34,197,94,0.09)',
  },
  attractionRowPressed: {
    transform: [{ scale: 0.992 }],
    backgroundColor: '#F8FAFC',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
  },
  attractionRowMain: {
    flex: 1,
  },
  attractionName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  attractionMeta: {
    marginTop: 1,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyAttractionsText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  autoInfoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 13,
    marginBottom: 10,
  },
  autoInfoTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  autoInfoText: {
    marginTop: 5,
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  autoInfoPoints: {
    marginTop: 10,
    gap: 6,
  },
  autoInfoPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoInfoPointText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  proceedButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#E11D48',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  proceedButtonDisabled: {
    opacity: 0.45,
  },
  proceedButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  suggestionCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionSubtitle: {
    marginTop: 1,
    color: '#64748B',
    fontSize: 11,
  },
  recentTripsStateCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  recentTripsStateText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  trendingStateCard: {
    width: 230,
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  trendingStateText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  dateInputText: {
    height: '100%',
    paddingLeft: 42,
    paddingRight: 12,
    color: '#0F2044',
    fontSize: 13,
    fontWeight: '600',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 56,
  },
  durationLabel: {
    marginTop: 6,
    marginLeft: 4,
    color: '#0EA5E9',
    fontSize: 11,
    fontWeight: '700',
  },
  budgetDropdownText: {
    height: '100%',
    paddingLeft: 42,
    paddingRight: 36,
    color: '#0F2044',
    fontSize: 13,
    fontWeight: '600',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 56,
  },
  budgetChevron: {
    position: 'absolute',
    right: 12,
    top: 20,
  },
  budgetPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  budgetPickerCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  budgetPickerTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  budgetPickerOption: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetPickerOptionSelected: {
    borderColor: 'rgba(255,107,107,0.3)',
    backgroundColor: 'rgba(255,107,107,0.08)',
  },
  budgetPickerOptionText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  budgetPickerOptionTextSelected: {
    color: '#FF6B6B',
  },
  planningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  planningCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.16)',
  },
  planningSpinner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.08)',
    marginBottom: 14,
  },
  planningTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  planningSubtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: 16,
    width: '100%',
    height: 9,
    borderRadius: 6,
    backgroundColor: '#EEF2F7',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B6B',
  },
  progressText: {
    marginTop: 8,
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  calendarCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.12)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  calendarNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarMonthChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  calendarMonthText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  calendarWeekDay: {
    flex: 1,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 6,
    marginBottom: 10,
  },
  calendarCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  calendarCellSelected: {
    backgroundColor: 'rgba(255,107,107,0.16)',
  },
  calendarCellEdge: {
    backgroundColor: '#FF6B6B',
  },
  calendarCellToday: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,107,0.45)',
  },
  calendarDateText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  calendarDateTextPast: {
    color: '#CBD5E1',
  },
  calendarDateTextToday: {
    color: '#FF6B6B',
  },
  calendarDateTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarInfoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  calendarInfoPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  calendarInfoLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  calendarInfoText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  calendarDuration: {
    marginTop: 8,
    color: '#0EA5E9',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
  calendarActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  calendarSecondaryBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  calendarSecondaryText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarPrimaryBtn: {
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  calendarPrimaryBtnDisabled: {
    opacity: 0.45,
  },
  calendarPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  loaderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCard: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  loaderIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  loaderSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  loaderSpinner: {
    transform: [{ scale: 1.2 }],
  },
});




