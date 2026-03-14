import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTopBar from '../../navigation/components/ScreenTopBar';
import { getMe, updateProfile } from '../../services/auth/authService';
import { requestLiveLocation } from '../../services/maps/locationService';
import { searchPhotonPlaces, getPlaceCoords, reverseGeocodeWithPhoton } from '../../services/maps/googleGeocodingService';
import { generateSmartItinerary, listLatestTrips, listTrips, saveTrip } from '../../services/itinerary/itineraryService';

const TRIP_PLANNING_ESSENTIALS = [
  {
    id: 'smart-route',
    title: 'Smart Route Flow',
    description: 'Stops sequenced to reduce backtracking and save travel time.',
    icon: 'git-network-outline',
    accent: '#0EA5E9',
    badge: 'Efficiency',
  },
  {
    id: 'balanced-days',
    title: 'Balanced Day Split',
    description: 'Auto-balances your day plan for better pace and coverage.',
    icon: 'calendar-clear-outline',
    accent: '#8B5CF6',
    badge: 'Scheduling',
  },
  {
    id: 'budget-aware',
    title: 'Budget-Aware Picks',
    description: 'Suggestions align with your selected budget tier and schedule.',
    icon: 'wallet-outline',
    accent: '#10B981',
    badge: 'Cost',
  },
];

const TRAVEL_CHECKLIST = [
  { id: 'passport', label: 'Passport and IDs ready', icon: 'card-outline' },
  { id: 'bookings', label: 'Hotel confirmation saved', icon: 'bed-outline' },
  { id: 'essentials', label: 'Essentials packing list', icon: 'cube-outline' },
  { id: 'payments', label: 'Cards, cash and UPI backup set', icon: 'wallet-outline' },
  { id: 'maps', label: 'Offline maps and key addresses saved', icon: 'map-outline' },
  { id: 'emergency', label: 'Emergency contacts and documents backed up', icon: 'shield-checkmark-outline' },
];

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
  const [isPlanningTrip, setIsPlanningTrip] = useState(false);
  const [planningStep, setPlanningStep] = useState('Preparing smart optimizer...');
  const [planningProgress, setPlanningProgress] = useState(0);
  const [securityPromptVisible, setSecurityPromptVisible] = useState(false);
  const [securityPromptStep, setSecurityPromptStep] = useState('intro');
  const [securityPromptQuestion, setSecurityPromptQuestion] = useState('');
  const [securityPromptAnswer, setSecurityPromptAnswer] = useState('');
  const [securityPromptError, setSecurityPromptError] = useState('');
  const [isSecurityPromptSaving, setIsSecurityPromptSaving] = useState(false);
  const [recentTrips, setRecentTrips] = useState([]);
  const [isLoadingRecentTrips, setIsLoadingRecentTrips] = useState(false);
  const [latestItineraries, setLatestItineraries] = useState([]);
  const [isLoadingLatestItineraries, setIsLoadingLatestItineraries] = useState(false);
  const [smartTipIndex, setSmartTipIndex] = useState(0);
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

      const prefillLiveLocation = async () => {
        if (!isMounted) {
          return;
        }
        // Auto-fill from current GPS when Home opens, but don't overwrite user-entered text.
        if (fromLocation.trim() || fromSelectedPlace) {
          return;
        }
        await applyResolvedLiveLocation({ silent: true, onlyIfUntouched: true });
      };

      checkSecuritySetup();
      prefillLiveLocation();
      return () => {
        isMounted = false;
      };
    }, [applyResolvedLiveLocation, fromLocation, fromSelectedPlace])
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
    setIsLoadingLatestItineraries(true);
    try {
      const [tripsResult, latestResult] = await Promise.allSettled([listTrips(), listLatestTrips(80)]);
      const trips = tripsResult.status === 'fulfilled' ? tripsResult.value : [];

      setRecentTrips(trips.slice(0, RECENT_TRIPS_LIMIT));

      const latestFromAllTrips = latestResult.status === 'fulfilled' ? latestResult.value : [];
      const latestSource = latestFromAllTrips.length ? latestFromAllTrips : trips;
      const latestSorted = [...latestSource].sort((a, b) => {
        const aTime = new Date(a.createdAt || a.createdAtIso || a.updatedAt || a.startDate || 0).getTime();
        const bTime = new Date(b.createdAt || b.createdAtIso || b.updatedAt || b.startDate || 0).getTime();
        return bTime - aTime;
      });
      setLatestItineraries(latestSorted.slice(0, 8));
    } catch (_error) {
      setRecentTrips([]);
      setLatestItineraries([]);
    } finally {
      setIsLoadingRecentTrips(false);
      setIsLoadingLatestItineraries(false);
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

  const generatePlan = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Trip dates required', 'Please select your start and end dates.');
      return;
    }

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
      // Use already-selected location if available; only fetch live GPS as fallback
      let resolvedLocation = fromSelectedPlace;
      if (!resolvedLocation) {
        const liveLocation = await requestLiveLocation();
        const areaName = await reverseGeocodeWithPhoton(
          liveLocation.latitude,
          liveLocation.longitude
        ).catch(() => 'Current Location');
        resolvedLocation = { ...liveLocation, label: areaName || 'Current Location' };
        setFromSelectedPlace(resolvedLocation);
        setFromLocation(resolvedLocation.label);
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
      });

      await saveTrip(itinerary);
      setPlanningProgress(100);
      setPlanningStep('Trip ready! Opening your Trips section...');
      setTimeout(() => {
        setIsPlanningTrip(false);
        navigation.navigate('Trips');
      }, 380);
    } catch (error) {
      setIsPlanningTrip(false);
      Alert.alert('Unable to generate trip', error.message || 'Please try again.');
    } finally {
      clearInterval(progressTimer);
    }
  };

  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute="Home" styles={styles} />
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
        <Modal visible={isPlanningTrip} transparent animationType="fade">
          <View style={localStyles.planningOverlay}>
            <View style={localStyles.planningCard}>
              <View style={localStyles.planningSpinner}>
                <ActivityIndicator size="large" color="#FF6B6B" />
              </View>
              <Text style={localStyles.planningTitle}>Creating your smart itinerary</Text>
              <Text style={localStyles.planningSubtitle}>{planningStep}</Text>
              <View style={localStyles.progressTrack}>
                <View style={[localStyles.progressFill, { width: `${planningProgress}%` }]} />
              </View>
              <Text style={localStyles.progressText}>{planningProgress}% complete</Text>
            </View>
          </View>
        </Modal>
        <View style={styles.screenBody}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeScrollContent}>
            <View style={styles.homeHero}>
              <View style={styles.homeHeroHeaderRow}>
                <View style={styles.homeHeroBadge}>
                  <Ionicons name="map-outline" size={12} color="#0F2044" />
                  <Text style={styles.homeHeroBadgeText}>Smart Planner</Text>
                </View>
              </View>
              <Text style={styles.homeHeroTitle}>Plan Smarter, Travel Better</Text>
              <Text style={styles.homeHeroSubtitle}>
                Build optimized itineraries in seconds with live location and budget-aware routing.
              </Text>
              <View style={styles.heroStatRow}>
                <View style={styles.heroStatChip}>
                  <Ionicons name="time-outline" size={13} color="#0EA5E9" />
                  <Text style={styles.heroStatText} numberOfLines={1} ellipsizeMode="tail">
                    Avg plan time: 10 sec
                  </Text>
                </View>
                <View style={styles.heroStatChip}>
                  <Ionicons name="git-network-outline" size={13} color="#8B5CF6" />
                  <Text style={styles.heroStatText} numberOfLines={1} ellipsizeMode="tail">
                    Optimized routes
                  </Text>
                </View>
              </View>
            </View>

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
                    placeholder="Current location / city / landmark"
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
                          {!!suggestion.subtitle && <Text style={localStyles.suggestionSubtitle}>{suggestion.subtitle}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.gridRow}>
                <View style={styles.gridColumn}>
                  <Text style={styles.inputLabel}>Dates</Text>
                  <TouchableOpacity activeOpacity={0.9} style={styles.inputRow} onPress={() => setShowDateRangePicker(true)}>
                    <Ionicons name="calendar-outline" size={18} color="#FF6B6B" style={styles.inputIcon} />
                    <Text style={localStyles.dateInputText}>
                      {startDate && endDate ? `${formatIsoDate(startDate)} - ${formatIsoDate(endDate)}` : 'Select start & end date'}
                    </Text>
                  </TouchableOpacity>
                  {!!durationDays && <Text style={localStyles.durationLabel}>Duration: {durationDays} day{durationDays > 1 ? 's' : ''}</Text>}
                </View>

                <View style={styles.gridColumn}>
                  <Text style={styles.inputLabel}>Budget</Text>
                  <TouchableOpacity activeOpacity={0.9} style={styles.inputRow} onPress={() => setShowBudgetPicker(true)}>
                    <Ionicons name="cash-outline" size={18} color="#FF6B6B" style={styles.inputIcon} />
                    <Text style={localStyles.budgetDropdownText}>
                      {BUDGET_OPTIONS.find((option) => option.key === budget)?.label || 'Select budget'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#94A3B8" style={localStyles.budgetChevron} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity activeOpacity={0.92} style={styles.planButtonWrap} onPress={generatePlan}>
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
                <Text style={styles.planTrustText}>Trusted by travelers worldwide</Text>
              </View>
            </View>

            <View style={localStyles.essentialsSection}>
            <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Trip Planning Essentials</Text>
            </View>
              <Text style={styles.essentialsSubtitle}>
                Every trip uses smart route logic, balanced day pacing, and budget-aware suggestions.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.essentialsCarouselRow}>
                {TRIP_PLANNING_ESSENTIALS.map((item) => (
                  <View key={item.id} style={styles.essentialSlideCard}>
                    <View style={styles.essentialSlideHeader}>
                      <View style={[styles.essentialSlideIconWrap, { backgroundColor: `${item.accent}1A` }]}>
                        <Ionicons name={item.icon} size={18} color={item.accent} />
                    </View>
                      <Text style={styles.essentialSlideTitle}>{item.title}</Text>
                  </View>
                    <Text style={styles.essentialSlideDescription}>{item.description}</Text>
                    <View style={styles.essentialSlideFooter}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.essentialSlideFooterText}>Always included</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            </View>

            <View style={styles.recentTripsSection}>
              <Text style={styles.sectionTitle}>Your Recent Trips</Text>
              {isLoadingRecentTrips ? (
                <View style={localStyles.recentTripsStateCard}>
                  <ActivityIndicator size="small" color="#FF6B6B" />
                  <Text style={localStyles.recentTripsStateText}>Loading your latest trips...</Text>
                </View>
              ) : recentTrips.length ? (
                recentTrips.map((trip) => (
                  <TouchableOpacity
                    key={trip.id}
                    activeOpacity={0.9}
                    style={styles.recentTripCard}
                    onPress={() => navigation.navigate('Trips')}
                  >
                    <Image
                      source={{
                        uri:
                          trip.coverImageUrl ||
                          'https://lh3.googleusercontent.com/aida-public/AB6AXuCxUVrLlyD4qcqI0PviLV-XWZV5gABYq2_0MGeW54LUPUzyLgpOI1CFB1mrF3--BeB3-GzPZf55uwZkYWsKcQS31GDYjQ2KVLFAw2nAfkKhjTVfUMDGF82sXabv01AClzwfydlaWb9xjBixmtFMV-r1ccBHzvbFx3Pxlq-pqnrYacyL0EnLjMUpRdXhqLKZBFh9Um2u1LhAMf_CzoTRFB3qT7g8-3hCqV1dF7--7v62PSTIV7wXr1-MBFBvABh-npUWkrl_gHZ5pG6a',
                      }}
                      style={styles.recentTripImage}
                    />
                    <View style={styles.recentTripBody}>
                      <Text style={styles.recentTripTitle}>{trip.title}</Text>
                      <Text style={styles.recentTripMeta}>
                        {formatIsoDate(trip.startDate)} - {formatIsoDate(trip.endDate)} • {trip.stats?.totalStops || 0} stops
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={localStyles.recentTripsStateCard}>
                  <Ionicons name="briefcase-outline" size={18} color="#94A3B8" />
                  <Text style={localStyles.recentTripsStateText}>No recent trips yet. Plan one to see it here.</Text>
                </View>
              )}

              <Animated.View
                style={[
                  styles.smartTipCard,
                  {
                    opacity: smartTipAnim,
                    transform: [
                      {
                        translateY: smartTipAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.smartTipIcon}>
                  <Ionicons name={currentSmartTip.icon} size={16} color="#FF8E53" />
                </View>
                <View style={styles.smartTipBody}>
                  <Text style={styles.smartTipTitle}>{currentSmartTip.title}</Text>
                  <Text style={styles.smartTipText}>{currentSmartTip.text}</Text>
                  <View style={styles.smartTipDotsRow}>
                    {SMART_TIPS.map((tip, index) => (
                      <View
                        key={tip.id}
                        style={[styles.smartTipDot, index === smartTipIndex && styles.smartTipDotActive]}
                      />
                    ))}
                  </View>
                </View>
              </Animated.View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Trending Experiences</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Explore')}>
                <Text style={styles.sectionAction}>Explore</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.experiencesRow}>
              {isLoadingLatestItineraries ? (
                <View style={localStyles.trendingStateCard}>
                  <ActivityIndicator size="small" color="#FF6B6B" />
                  <Text style={localStyles.trendingStateText}>Loading latest itineraries...</Text>
                </View>
              ) : latestItineraries.length ? (
                latestItineraries.map((trip) => (
                  <TouchableOpacity key={trip.id} activeOpacity={0.92} style={styles.experienceCard}>
                    <Image
                      source={{
                        uri:
                          trip.coverImageUrl ||
                          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
                      }}
                      style={styles.experienceImage}
                      resizeMode="cover"
                    />
                  <LinearGradient
                    colors={['transparent', 'rgba(15,32,68,0.85)']}
                    start={{ x: 0.5, y: 0.1 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.experienceOverlay}
                  >
                      <Text style={styles.experienceTitle} numberOfLines={2}>
                        {trip.from?.label || trip.title || 'Unknown place'}
                      </Text>
                    <View style={styles.experienceMeta}>
                        <Ionicons name="time-outline" size={13} color="#E2E8F0" />
                        <Text style={styles.experiencePlace}>{formatTripDurationDays(trip)}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                ))
              ) : (
                <View style={localStyles.trendingStateCard}>
                  <Ionicons name="map-outline" size={16} color="#94A3B8" />
                  <Text style={localStyles.trendingStateText}>No itineraries yet. Create one to see it here.</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.checklistCard}>
              <View style={styles.checklistHeader}>
                <Text style={styles.checklistTitle}>Pre-trip Checklist</Text>
                <View style={styles.checklistBadge}>
                  <Text style={styles.checklistBadgeText}>{TRAVEL_CHECKLIST.length} tasks</Text>
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

function formatTripDurationDays(trip) {
  const durationDays = Number(trip?.durationDays || trip?.days?.length || 1);
  if (!Number.isFinite(durationDays) || durationDays <= 1) {
    return '1 day';
  }
  return `${durationDays} days`;
}

const localStyles = StyleSheet.create({
  essentialsSection: {
    marginTop: 14,
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
});


