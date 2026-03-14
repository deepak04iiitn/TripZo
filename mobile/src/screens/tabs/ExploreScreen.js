import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTopBar from '../../navigation/components/ScreenTopBar';
import { listExploreTrips, saveTripForUser } from '../../services/itinerary/itineraryService';

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'popular', label: 'Popular' },
  { key: 'durationAsc', label: 'Short' },
  { key: 'durationDesc', label: 'Long' },
];

const BUDGET_OPTIONS = [
  { key: '', label: 'Any Budget' },
  { key: '$', label: 'Low' },
  { key: '$$', label: 'Medium' },
  { key: '$$$', label: 'High' },
];

function ownerName(owner) {
  return owner?.fullName || owner?.username || 'Traveler';
}

function durationLabel(days) {
  const value = Number(days || 1);
  return `${value} day${value > 1 ? 's' : ''}`;
}

function budgetLabel(value) {
  if (value === '$') return 'Low';
  if (value === '$$') return 'Medium';
  if (value === '$$$') return 'High';
  return 'Medium';
}

function avatarInitial(owner) {
  const name = ownerName(owner);
  return String(name).charAt(0).toUpperCase() || 'T';
}

export default function ExploreScreen({ styles }) {
  const { height: windowHeight } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeIndicatorAnim = useRef(new Animated.Value(0)).current;
  const swipeIndicatorLoopRef = useRef(null);
  const swipeIndicatorTimeoutRef = useRef(null);
  const hasShownSwipeIndicatorRef = useRef(false);
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({ sort: 'newest', budget: '', durationMin: '', durationMax: '' });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(false);

  const fetchCards = useCallback(
    async (nextFilters = filters, nextSearchText = searchText) => {
      setIsLoading(true);
      try {
        const trips = await listExploreTrips({
          ...nextFilters,
          search: nextSearchText,
        });
        setCards(trips.filter((trip) => !trip.isSaved));
      } finally {
        setIsLoading(false);
      }
    },
    [filters, searchText]
  );

  const stopSwipeIndicator = useCallback(() => {
    if (swipeIndicatorLoopRef.current) {
      swipeIndicatorLoopRef.current.stop();
      swipeIndicatorLoopRef.current = null;
    }
    if (swipeIndicatorTimeoutRef.current) {
      clearTimeout(swipeIndicatorTimeoutRef.current);
      swipeIndicatorTimeoutRef.current = null;
    }
    setShowSwipeIndicator(false);
  }, []);

  const startSwipeIndicator = useCallback(() => {
    stopSwipeIndicator();
    setShowSwipeIndicator(true);
    swipeIndicatorAnim.setValue(0);
    swipeIndicatorLoopRef.current = Animated.loop(
      Animated.timing(swipeIndicatorAnim, {
        toValue: 1,
        duration: 850,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    swipeIndicatorLoopRef.current.start();
    swipeIndicatorTimeoutRef.current = setTimeout(() => {
      stopSwipeIndicator();
    }, 3200);
  }, [stopSwipeIndicator, swipeIndicatorAnim]);

  useFocusEffect(
    useCallback(() => {
      hasShownSwipeIndicatorRef.current = false;
      fetchCards();
      return () => {
        stopSwipeIndicator();
      };
    }, [fetchCards, stopSwipeIndicator])
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchCards();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCards]);

  const currentCard = cards[0] || null;
  const nextCard = cards[1] || null;
  const cardHeight = Math.max(380, Math.min(500, windowHeight - 380));
  const deckMinHeight = cardHeight + 40;
  const nextCardHeight = Math.max(340, cardHeight - 30);

  const rotate = pan.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-14deg', '0deg', '14deg'],
    extrapolate: 'clamp',
  });

  const swipeLabelOpacityRight = pan.x.interpolate({
    inputRange: [40, 120, 210],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });
  const swipeLabelOpacityLeft = pan.x.interpolate({
    inputRange: [-210, -120, -40],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const popCard = useCallback(() => {
    setCards((prev) => prev.slice(1));
    pan.setValue({ x: 0, y: 0 });
    setIsSwiping(false);
  }, [pan]);

  const swipeOut = useCallback(
    (direction) => {
      if (!currentCard || isSwiping) {
        return;
      }
      setIsSwiping(true);
      const toX = direction === 'right' ? 420 : -420;
      Animated.timing(pan, {
        toValue: { x: toX, y: 10 },
        duration: 210,
        useNativeDriver: false,
      }).start(async () => {
        if (direction === 'right' && currentCard?.id) {
          await saveTripForUser(currentCard.id);
        }
        popCard();
      });
    },
    [currentCard, isSwiping, pan, popCard]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 8,
        onPanResponderMove: (_evt, gesture) => {
          pan.setValue({ x: gesture.dx, y: gesture.dy * 0.28 });
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx > 110) {
            swipeOut('right');
            return;
          }
          if (gesture.dx < -110) {
            swipeOut('left');
            return;
          }
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            bounciness: 8,
            speed: 12,
          }).start();
        },
      }),
    [pan, swipeOut]
  );

  const applyFilter = async (nextFilters) => {
    setFilters(nextFilters);
    setIsFilterModalOpen(false);
    await fetchCards(nextFilters, searchText);
  };

  useEffect(() => {
    if (!isLoading && currentCard && !hasShownSwipeIndicatorRef.current) {
      hasShownSwipeIndicatorRef.current = true;
      startSwipeIndicator();
    }
  }, [currentCard, isLoading, startSwipeIndicator]);

  useEffect(
    () => () => {
      stopSwipeIndicator();
    },
    [stopSwipeIndicator]
  );

  const leftHintOpacity = swipeIndicatorAnim.interpolate({
    inputRange: [0, 0.25, 0.6, 1],
    outputRange: [0.2, 0.92, 0.45, 0.2],
    extrapolate: 'clamp',
  });
  const rightHintOpacity = swipeIndicatorAnim.interpolate({
    inputRange: [0, 0.35, 0.75, 1],
    outputRange: [0.2, 0.45, 0.92, 0.2],
    extrapolate: 'clamp',
  });
  const leftHintTranslate = swipeIndicatorAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -14, 0],
    extrapolate: 'clamp',
  });
  const rightHintTranslate = swipeIndicatorAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 14, 0],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute="Explore" styles={styles} />
        <View style={styles.screenBody}>
          <View style={screenStyles.topControls}>
            <View style={screenStyles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
              <TextInput
                placeholder="Search itinerary..."
                placeholderTextColor="#94A3B8"
                value={searchText}
                onChangeText={setSearchText}
                returnKeyType="search"
                onSubmitEditing={() => fetchCards(filters, searchText)}
                style={screenStyles.searchInput}
              />
            </View>
            <TouchableOpacity style={screenStyles.filterBtn} onPress={() => setIsFilterModalOpen(true)} activeOpacity={0.9}>
              <Ionicons name="options-outline" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={screenStyles.screenScrollContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#FF6B6B" />}
          >
            <View style={screenStyles.sortRow}>
              {SORT_OPTIONS.map((option) => {
                const selected = filters.sort === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.9}
                    onPress={() => applyFilter({ ...filters, sort: option.key })}
                    style={[screenStyles.sortChip, selected && screenStyles.sortChipActive]}
                  >
                    <Text style={[screenStyles.sortChipText, selected && screenStyles.sortChipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[screenStyles.deckWrap, { minHeight: deckMinHeight }]}>
              {isLoading ? (
                <View style={screenStyles.emptyCard}>
                  <ActivityIndicator color="#FF6B6B" />
                  <Text style={screenStyles.emptyTitle}>Loading itineraries...</Text>
                </View>
              ) : null}

              {!isLoading && !currentCard ? (
                <View style={screenStyles.emptyCard}>
                  <Ionicons name="map-outline" size={24} color="#94A3B8" />
                  <Text style={screenStyles.emptyTitle}>No more itineraries right now</Text>
                  <Text style={screenStyles.emptySub}>
                    Pull to refresh or adjust filters to discover more travel plans.
                  </Text>
                </View>
              ) : null}

              {!isLoading && !!currentCard && (
                <>
                  {!!nextCard && (
                    <View style={[screenStyles.nextCardPreview, { height: nextCardHeight }]}>
                      <ImageBackground source={{ uri: nextCard.coverImageUrl }} style={screenStyles.nextCardImage} imageStyle={screenStyles.cardBgImage}>
                        <LinearGradient colors={['rgba(15,23,42,0.08)', 'rgba(15,23,42,0.45)']} style={screenStyles.nextCardGradient} />
                      </ImageBackground>
                    </View>
                  )}

                  <Animated.View
                    style={[
                      screenStyles.card,
                      { height: cardHeight },
                      {
                        transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
                      },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    <ImageBackground source={{ uri: currentCard.coverImageUrl }} style={screenStyles.cardImage} imageStyle={screenStyles.cardBgImage}>
                      <LinearGradient colors={['rgba(2,6,23,0.08)', 'rgba(2,6,23,0.74)']} style={screenStyles.cardOverlay}>
                        <Animated.View style={[screenStyles.likeLabel, { opacity: swipeLabelOpacityRight }]}>
                          <Ionicons name="bookmark" size={14} color="#065F46" />
                          <Text style={screenStyles.likeLabelText}>Saved</Text>
                        </Animated.View>
                        <Animated.View style={[screenStyles.nopeLabel, { opacity: swipeLabelOpacityLeft }]}>
                          <Ionicons name="close" size={14} color="#9F1239" />
                          <Text style={screenStyles.nopeLabelText}>Skip</Text>
                        </Animated.View>

                        <View style={screenStyles.ownerRow}>
                          {currentCard.owner?.profileImageUrl ? (
                            <Image source={{ uri: currentCard.owner.profileImageUrl }} style={screenStyles.ownerAvatar} />
                          ) : (
                            <View style={screenStyles.ownerAvatarFallback}>
                              <Text style={screenStyles.ownerAvatarFallbackText}>{avatarInitial(currentCard.owner)}</Text>
                            </View>
                          )}
                          <View style={screenStyles.ownerTextWrap}>
                            <Text style={screenStyles.ownerName}>{ownerName(currentCard.owner)}</Text>
                            <Text style={screenStyles.ownerSub}>Shared this itinerary</Text>
                          </View>
                        </View>

                        {showSwipeIndicator ? (
                          <View pointerEvents="none" style={screenStyles.swipeIndicatorOverlay}>
                            <Animated.View
                              style={[
                                screenStyles.swipeIndicatorBubble,
                                screenStyles.swipeIndicatorLeft,
                                { opacity: leftHintOpacity, transform: [{ translateX: leftHintTranslate }] },
                              ]}
                            >
                              <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
                            </Animated.View>
                            <Animated.View
                              style={[
                                screenStyles.swipeIndicatorBubble,
                                screenStyles.swipeIndicatorRight,
                                { opacity: rightHintOpacity, transform: [{ translateX: rightHintTranslate }] },
                              ]}
                            >
                              <Ionicons name="arrow-forward" size={26} color="#FFFFFF" />
                            </Animated.View>
                          </View>
                        ) : null}

                        <View style={screenStyles.cardBottomContent}>
                          <Text style={screenStyles.cardTitle}>{currentCard.title}</Text>
                          <View style={screenStyles.cardMetaRow}>
                            <View style={screenStyles.cardMetaChip}>
                              <Ionicons name="location-outline" size={12} color="#F8FAFC" />
                              <Text style={screenStyles.cardMetaText}>{currentCard.from?.label || 'Destination'}</Text>
                            </View>
                            <View style={screenStyles.cardMetaChip}>
                              <Ionicons name="time-outline" size={12} color="#F8FAFC" />
                              <Text style={screenStyles.cardMetaText}>{durationLabel(currentCard.durationDays)}</Text>
                            </View>
                            <View style={screenStyles.cardMetaChip}>
                              <Ionicons name="wallet-outline" size={12} color="#F8FAFC" />
                              <Text style={screenStyles.cardMetaText}>{budgetLabel(currentCard.budget)}</Text>
                            </View>
                          </View>
                        </View>
                      </LinearGradient>
                    </ImageBackground>
                  </Animated.View>
                </>
              )}
            </View>

            {!!currentCard && (
              <View style={screenStyles.actionRow}>
                <TouchableOpacity style={screenStyles.actionNopeBtn} onPress={() => swipeOut('left')} activeOpacity={0.9}>
                  <Ionicons name="close" size={22} color="#BE123C" />
                </TouchableOpacity>
                <TouchableOpacity style={screenStyles.actionSaveBtn} onPress={() => swipeOut('right')} activeOpacity={0.95}>
                  <LinearGradient colors={['#34D399', '#10B981']} style={screenStyles.actionSaveGradient}>
                    <Ionicons name="bookmark" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      <Modal visible={isFilterModalOpen} transparent animationType="fade" onRequestClose={() => setIsFilterModalOpen(false)}>
        <Pressable style={screenStyles.filterOverlay} onPress={() => setIsFilterModalOpen(false)}>
          <Pressable style={screenStyles.filterCard} onPress={() => null}>
            <Text style={screenStyles.filterTitle}>Filter Explore Feed</Text>

            <Text style={screenStyles.filterLabel}>Budget</Text>
            <View style={screenStyles.filterBudgetRow}>
              {BUDGET_OPTIONS.map((option) => {
                const selected = filters.budget === option.key;
                return (
                  <TouchableOpacity
                    key={option.key || 'any'}
                    activeOpacity={0.9}
                    onPress={() => setFilters((prev) => ({ ...prev, budget: option.key }))}
                    style={[screenStyles.filterBudgetChip, selected && screenStyles.filterBudgetChipActive]}
                  >
                    <Text style={[screenStyles.filterBudgetChipText, selected && screenStyles.filterBudgetChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={screenStyles.filterLabel}>Duration (days)</Text>
            <View style={screenStyles.filterDurationRow}>
              <TextInput
                placeholder="Min"
                value={filters.durationMin}
                onChangeText={(text) => setFilters((prev) => ({ ...prev, durationMin: text.replace(/[^0-9]/g, '') }))}
                keyboardType="numeric"
                style={screenStyles.filterInput}
                placeholderTextColor="#94A3B8"
              />
              <TextInput
                placeholder="Max"
                value={filters.durationMax}
                onChangeText={(text) => setFilters((prev) => ({ ...prev, durationMax: text.replace(/[^0-9]/g, '') }))}
                keyboardType="numeric"
                style={screenStyles.filterInput}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity style={screenStyles.applyBtn} onPress={() => applyFilter(filters)} activeOpacity={0.92}>
              <Text style={screenStyles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  topControls: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenScrollContent: {
    paddingTop: 12,
    paddingBottom: 130,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortChipActive: {
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: 'rgba(255,107,107,0.28)',
  },
  sortChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  sortChipTextActive: {
    color: '#FF6B6B',
  },
  deckWrap: {
    minHeight: 520,
    justifyContent: 'center',
  },
  nextCardPreview: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 16,
    height: 470,
    borderRadius: 24,
    overflow: 'hidden',
    transform: [{ scale: 0.98 }],
    opacity: 0.55,
  },
  nextCardImage: {
    flex: 1,
  },
  nextCardGradient: {
    flex: 1,
  },
  card: {
    height: 500,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  cardImage: {
    flex: 1,
  },
  cardBgImage: {
    borderRadius: 26,
  },
  cardOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardBottomContent: {
    marginTop: 'auto',
  },
  likeLabel: {
    position: 'absolute',
    top: 68,
    left: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeLabelText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
  },
  nopeLabel: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(244,63,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nopeLabelText: {
    color: '#9F1239',
    fontSize: 12,
    fontWeight: '800',
  },
  ownerRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  ownerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  ownerTextWrap: {
    flex: 1,
  },
  swipeIndicatorOverlay: {
    position: 'absolute',
    top: '46%',
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swipeIndicatorBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  swipeIndicatorLeft: {
    backgroundColor: 'rgba(190,24,93,0.34)',
    borderColor: 'rgba(251,113,133,0.65)',
  },
  swipeIndicatorRight: {
    backgroundColor: 'rgba(4,120,87,0.34)',
    borderColor: 'rgba(52,211,153,0.7)',
  },
  ownerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  ownerSub: {
    color: 'rgba(248,250,252,0.9)',
    fontSize: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  cardMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardMetaChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(15,23,42,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardMetaText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  actionNopeBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  actionSaveBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  actionSaveGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    minHeight: 220,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  filterCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.14)',
  },
  filterTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  filterLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  filterBudgetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterBudgetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterBudgetChipActive: {
    borderColor: 'rgba(255,107,107,0.35)',
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  filterBudgetChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  filterBudgetChipTextActive: {
    color: '#FF6B6B',
  },
  filterDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  filterInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  applyBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

