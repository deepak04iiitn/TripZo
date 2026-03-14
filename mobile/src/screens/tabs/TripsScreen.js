import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTopBar from '../../navigation/components/ScreenTopBar';
import { categorizeTrips, deleteTrip, listTrips, updateTripLike } from '../../services/itinerary/itineraryService';

const TRIP_TABS = [
  { key: 'all', label: 'All' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Done' },
];

const FALLBACK_COVERS = {
  ongoing:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD4X9W79UmFj6_cdxGetBojVGUCHsKYA7AjV-uD2B31qpcn1PE-o4lW_tSa3flIYD-Hre4mWpxtH4p6uvPQ20loNOxO0wSJO0U2zDwTVvfdmF2zxRNKMvsi0sY9II8c67U6O-1e1qIESdOxqzzUeq2byE1YfbzlrL6zNJ55QVQb57XDW9yIrOE30qQpQlPX0sYSQjo8o85LLmHfIldECxeu8em0Ayg_94AJUzgRFy5IXFGdBGiXDxtq8HSOZwzqDu-DXGv-b36G2gdp',
  upcoming:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAxUu-eXihuAJJuzcqudi3_ai-C7bNIlNz9E2m_A13ObpMqa1FRGNJ5q2h-wrGmSTDzmjyVyBxrdbnFRO3NtU5ggoTAQlyOzrpkvmdYvXJIGrgFTrHhhWKa8bw-m-1utV98fLIVqviyZl6qe6nKjg6hPWd7TuY32RrccTcndk1wp3lQoQIoe72wW0EOYopOHoNX4eapJATo7EgGjvD3-3jsmh4FWTTufuXg9RFnRL1PuzQDxn2zwWqMyuE3_fEWxI7SDav5FSNZ9q29',
  completed:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA1w8HmlwwDsgX0SihGBHHAGcjQPZwwSk2LjnX5OldO6RSlTLcEtoXA_-dDKhM75CRkbql3W-UHN8eyX9lQyuWW0m0yaGk29eMu5GT438GyAcSegXeyfGlqNOj2TlYIxF_-PWikIXqudSyKLWsTb9nIExmhfyK7XbeO0jSMmxpRzX62XW_KlFgA5Pf28U1wy5AJ0uL3U4zdGu8nkQSWgcb-ApsmnuXHK4s_IarQNc9AZFsUUz7HbrUlWZyFFiexS6Hk30rVchC4Xrk7',
};

function formatDateShort(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function budgetLabel(value) {
  if (value === '$') return 'Low';
  if (value === '$$') return 'Medium';
  if (value === '$$$') return 'High';
  return value || 'Medium';
}

function formatTimeFromMinutes(minutesFromDayStart) {
  const safeMinutes = Math.max(0, minutesFromDayStart);
  const hour24 = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function statusMeta(status) {
  if (status === 'ongoing') {
    return { label: 'Ongoing', dot: '#0EA5E9', bg: 'rgba(14,165,233,0.12)', text: '#0369A1' };
  }
  if (status === 'completed') {
    return { label: 'Completed', dot: '#94A3B8', bg: 'rgba(148,163,184,0.18)', text: '#475569' };
  }
  return { label: 'Upcoming', dot: '#10B981', bg: 'rgba(16,185,129,0.12)', text: '#047857' };
}

function getCoverImage(trip) {
  const status = trip.status === 'planned' ? 'upcoming' : trip.status;
  return trip.coverImageUrl || FALLBACK_COVERS[status] || FALLBACK_COVERS.upcoming;
}

function getStopImage(stop, trip) {
  return stop?.imageUrl || trip?.coverImageUrl || '';
}

function getStopIcon(stop) {
  const label = String(stop?.label || '').toLowerCase();
  const category = String(stop?.category || '').toLowerCase();
  if (category.includes('museum') || label.includes('museum') || label.includes('gallery')) return 'business-outline';
  if (label.includes('church') || label.includes('basilica') || label.includes('temple')) return 'home-outline';
  if (label.includes('tower') || label.includes('castle') || label.includes('fort')) return 'location-outline';
  return 'compass-outline';
}

function recommendationMeta(type) {
  if (type === 'atm') {
    return {
      icon: 'card-outline',
      label: 'ATM Nearby',
      color: '#0284C7',
      border: 'rgba(14,165,233,0.3)',
      bg: 'rgba(14,165,233,0.08)',
      iconBg: 'rgba(14,165,233,0.16)',
    };
  }
  return {
    icon: 'water-outline',
    label: 'Washroom',
    color: '#0F766E',
    border: 'rgba(20,184,166,0.32)',
    bg: 'rgba(20,184,166,0.08)',
    iconBg: 'rgba(20,184,166,0.16)',
  };
}

export default function TripsScreen({ styles }) {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('all');
  const [tripBuckets, setTripBuckets] = useState({ all: [], ongoing: [], upcoming: [], completed: [] });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const loadTrips = useCallback(async () => {
    const trips = await listTrips();
    setTripBuckets(categorizeTrips(trips));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const refreshTrips = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadTrips();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadTrips]);

  const applyTripUpdate = (updatedTrip) => {
    if (!updatedTrip?.id) {
      return;
    }
    setTripBuckets((prev) => {
      const replaceIn = (items = []) => items.map((trip) => (trip.id === updatedTrip.id ? { ...trip, ...updatedTrip } : trip));
      return {
        all: replaceIn(prev.all),
        ongoing: replaceIn(prev.ongoing),
        upcoming: replaceIn(prev.upcoming),
        completed: replaceIn(prev.completed),
      };
    });
    if (selectedTrip?.id === updatedTrip.id) {
      setSelectedTrip((prev) => (prev ? { ...prev, ...updatedTrip } : prev));
    }
  };

  const confirmDeleteTrip = (trip) => {
    Alert.alert('Delete Trip', `Delete "${trip.title}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(trip.id);
          if (selectedTrip?.id === trip.id) {
        setSelectedTrip(null);
      }
          await loadTrips();
        },
      },
    ]);
  };

  const toggleLikeTrip = async (trip) => {
    const nextLike = !trip.isLiked;
    const updated = await updateTripLike(trip.id, nextLike);
    if (updated) {
      applyTripUpdate(updated);
    } else {
      applyTripUpdate({ id: trip.id, isLiked: nextLike, likesCount: nextLike ? 1 : 0 });
    }
  };

  const openTripOnMap = (trip) => {
    if (!trip?.id) {
      return;
    }
    navigation.navigate('Map', { tripId: trip.id });
  };

  const activeTrips = useMemo(() => tripBuckets[activeTab] || [], [activeTab, tripBuckets]);

  if (selectedTrip) {
    return (
      <SafeAreaView style={styles.screenSafe} edges={['top']}>
        <View style={styles.screenContent}>
          <View style={[styles.screenBody, screenStyles.detailScreenBody]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={screenStyles.detailScrollContent}>
              <View style={screenStyles.heroWrap}>
                <ImageBackground source={{ uri: getCoverImage(selectedTrip) }} style={screenStyles.heroImage}>
                  <LinearGradient
                    colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
                    style={screenStyles.heroOverlay}
                  >
                    <View style={screenStyles.heroTopControls}>
                      <TouchableOpacity style={screenStyles.heroCircleBtn} onPress={() => setSelectedTrip(null)}>
                        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                      <View style={screenStyles.heroRightBtns}>
                        <TouchableOpacity style={screenStyles.heroCircleBtn} onPress={() => toggleLikeTrip(selectedTrip)}>
                          <Ionicons name={selectedTrip.isLiked ? 'heart' : 'heart-outline'} size={19} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={screenStyles.heroBottomTextWrap}>
                      <Text style={screenStyles.heroTitle}>{selectedTrip.title}</Text>
                      <View style={screenStyles.heroLocationRow}>
                        <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.82)" />
                        <Text style={screenStyles.heroLocationText}>{selectedTrip.from?.label || 'Selected Area'}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </View>

              <View style={screenStyles.summaryCard}>
                <View style={screenStyles.summaryStatsWrap}>
                  <View>
                    <Text style={screenStyles.summaryLabel}>Duration</Text>
                    <Text style={screenStyles.summaryValuePrimary}>{selectedTrip.durationDays} Days</Text>
                  </View>
                  <View style={screenStyles.summaryDivider} />
                  <View>
                    <Text style={screenStyles.summaryLabel}>Budget</Text>
                    <Text style={screenStyles.summaryValue}>{budgetLabel(selectedTrip.budget)}</Text>
                  </View>
                  <View style={screenStyles.summaryDivider} />
                  <View>
                    <Text style={screenStyles.summaryLabel}>Stops</Text>
                    <Text style={screenStyles.summaryValue}>{selectedTrip.stats?.totalStops || 0}</Text>
                  </View>
                </View>
                <TouchableOpacity style={screenStyles.shareBtn}>
                  <Ionicons name="share-social-outline" size={16} color="#FF6B6B" />
                </TouchableOpacity>
              </View>

              <View style={screenStyles.itinerarySection}>
                <View style={screenStyles.itineraryHeaderRow}>
                  <Ionicons name="document-text-outline" size={18} color="#FF6B6B" />
                  <Text style={screenStyles.itineraryHeaderText}>Your Itinerary</Text>
                </View>

                {(selectedTrip.days || []).map((dayItem, dayIndex) => {
                  const dayName = `Day ${dayItem.day}`;
                  return (
                    <View key={`${selectedTrip.id}-d-${dayItem.day}`} style={screenStyles.dayBlock}>
                      <View style={screenStyles.dayHeadRow}>
                        <View style={screenStyles.dayDot} />
                        <Text style={screenStyles.dayTitle}>{dayName}</Text>
                        <Text style={screenStyles.dayDateText}>{formatDateShort(dayItem.date)}</Text>
                      </View>
                      {dayIndex < (selectedTrip.days || []).length - 1 && <View style={screenStyles.dayConnector} />}

                      <View style={screenStyles.dayStopsWrap}>
                        {(dayItem.stops || []).map((stop, stopIndex) => {
                          const previousStops = (dayItem.stops || []).slice(0, stopIndex);
                          const elapsedBefore = previousStops.reduce(
                            (sum, item) => sum + (item.travelMinutesFromPrevious || 0) + (item.visitMinutes || 0),
                            9 * 60
                          );
                          const stopStart = elapsedBefore + (stop.travelMinutesFromPrevious || 0);
                          const restaurantRecommendation = (stop.recommendations || []).find((r) => r.type === 'restaurant');
                          const utilityRecommendations = (stop.recommendations || []).filter(
                            (r) => r.type === 'atm' || r.type === 'washroom'
                          );
                          const stopImageUrl = getStopImage(stop, selectedTrip);

                          return (
                            <View key={`${selectedTrip.id}-${dayItem.day}-${stop.id}-${stop.sequence}`} style={screenStyles.stopBlock}>
                              {stopImageUrl ? (
                                <View style={screenStyles.stopThumbWrap}>
                                  <Image source={{ uri: stopImageUrl }} style={screenStyles.stopThumbImage} />
                                  <View style={screenStyles.stopThumbOverlayIcon}>
                                    <Ionicons name={getStopIcon(stop)} size={12} color="#FFFFFF" />
                                  </View>
                                </View>
                              ) : (
                                <View style={screenStyles.stopIconWrap}>
                                  <Ionicons name={getStopIcon(stop)} size={18} color="#FF6B6B" />
                                </View>
                              )}
                              <View style={screenStyles.stopContent}>
                                <View style={screenStyles.stopMetaRow}>
                                  <Text style={screenStyles.stopTimeText}>{formatTimeFromMinutes(stopStart)}</Text>
                                  <View style={screenStyles.stopMetaDot} />
                                  <Text style={screenStyles.stopDurationText}>{Math.max(1, Math.round((stop.visitMinutes || 0) / 60))}h Duration</Text>
                                </View>
                                <Text style={screenStyles.stopTitle}>{stop.label}</Text>
                                <Text style={screenStyles.stopDesc}>{stop.category} • Travel {stop.travelMinutesFromPrevious || 0} min</Text>

                                {!!restaurantRecommendation && (
                                  <View style={screenStyles.restoHighlightCard}>
                                    <View style={screenStyles.restoIconWrap}>
                                      <Ionicons name="restaurant-outline" size={18} color="#D97706" />
                                    </View>
                                    <View style={screenStyles.restoTextWrap}>
                                      <Text style={screenStyles.restoLabel}>Restaurant</Text>
                                      <Text style={screenStyles.restoTitle}>{restaurantRecommendation.place?.label || 'Recommended Restaurant'}</Text>
                                    </View>
                                  </View>
                                )}

                                {utilityRecommendations.map((recommendation, recIndex) => {
                                  const meta = recommendationMeta(recommendation.type);
                                  return (
                                    <View
                                      key={`${selectedTrip.id}-${dayItem.day}-${stop.id}-${recommendation.type}-${recIndex}`}
                                      style={[
                                        screenStyles.utilityRecommendationCard,
                                        { borderColor: meta.border, backgroundColor: meta.bg },
                                      ]}
                                    >
                                      <View style={[screenStyles.utilityRecommendationIconWrap, { backgroundColor: meta.iconBg }]}>
                                        <Ionicons name={meta.icon} size={17} color={meta.color} />
                                      </View>
                                      <View style={screenStyles.utilityRecommendationTextWrap}>
                                        <Text style={[screenStyles.utilityRecommendationLabel, { color: meta.color }]}>{meta.label}</Text>
                                        <Text style={screenStyles.utilityRecommendationTitle}>
                                          {recommendation.place?.label || meta.label}
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute="Trips" styles={styles} />
        <View style={styles.screenBody}>
          <View style={screenStyles.tabsStickyWrap}>
            <View style={screenStyles.segmentedWrap}>
                  {TRIP_TABS.map((tab) => {
                    const selected = activeTab === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        activeOpacity={0.9}
                        onPress={() => setActiveTab(tab.key)}
                    style={[screenStyles.segmentItem, selected && screenStyles.segmentItemActive]}
                      >
                    <Text style={[screenStyles.segmentText, selected && screenStyles.segmentTextActive]}>{tab.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                        </View>
                      </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={screenStyles.listContentContainer}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshTrips} tintColor="#FF6B6B" />}
          >
            {activeTrips.map((trip) => {
              const meta = statusMeta(trip.status);
              const status = trip.status === 'planned' ? 'upcoming' : trip.status;
              const likesCount = Number(trip.likesCount || 0);

              return (
                <View key={trip.id} style={[screenStyles.tripCard, status === 'completed' && screenStyles.tripCardCompleted]}>
                  <View style={screenStyles.cardImageWrap}>
                    <ImageBackground source={{ uri: getCoverImage(trip) }} style={screenStyles.cardImage}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={screenStyles.deleteTripBtn}
                        onPress={() => confirmDeleteTrip(trip)}
                      >
                        <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                      </TouchableOpacity>
                      <View style={screenStyles.statusBadgeWrap}>
                        <View style={[screenStyles.statusBadge, { backgroundColor: meta.bg }]}> 
                          <View style={[screenStyles.statusDot, { backgroundColor: meta.dot }]} />
                          <Text style={[screenStyles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                        </View>
                      </View>
                    </ImageBackground>
                </View>

                  <View style={screenStyles.cardBody}>
                    <View style={screenStyles.cardHeadRow}>
                      <View style={screenStyles.cardHeadTextWrap}>
                        <Text style={screenStyles.tripTitle}>{trip.title}</Text>
                        <View style={screenStyles.calendarRow}>
                          <Ionicons name="calendar-outline" size={15} color="#64748B" />
                          <Text style={screenStyles.tripDateText}>{formatDateShort(trip.startDate)} - {formatDateShort(trip.endDate)}</Text>
                    </View>
                  </View>
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => openTripOnMap(trip)}
                        style={status === 'ongoing' ? screenStyles.mapCircleActive : screenStyles.mapCircleIdle}
                      >
                        <Ionicons
                          name={status === 'completed' ? 'checkmark-circle' : 'map-outline'}
                          size={14}
                          color={status === 'ongoing' ? '#FFFFFF' : '#475569'}
                        />
                        <Text style={status === 'ongoing' ? screenStyles.mapActionTextActive : screenStyles.mapActionTextIdle}>
                          Open in Map
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={screenStyles.cardBottomRow}>
                      <View style={screenStyles.cardStatsInline}>
                        <View style={screenStyles.inlineStat}>
                          <Ionicons name="location-outline" size={15} color="#64748B" />
                          <Text style={screenStyles.inlineStatText}>{trip.stats?.totalStops || 0} Stops</Text>
                          </View>
                        <View style={screenStyles.inlineStat}>
                          <Ionicons name="heart-outline" size={15} color="#64748B" />
                          <Text style={screenStyles.inlineStatText}>{likesCount} Liked</Text>
                          </View>
                        </View>

                      <TouchableOpacity
                        activeOpacity={0.92}
                        onPress={() => setSelectedTrip(trip)}
                        style={[screenStyles.viewButton, status === 'ongoing' ? screenStyles.viewButtonActive : screenStyles.viewButtonIdle]}
                      >
                        <Text style={[screenStyles.viewButtonText, status === 'ongoing' ? screenStyles.viewButtonTextActive : screenStyles.viewButtonTextIdle]}>
                          {status === 'completed' ? 'Trip Recap' : 'View Details'}
                                  </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                                </View>
                              );
                            })}

            {!activeTrips.length && (
              <View style={screenStyles.emptyCard}>
                <Ionicons name="briefcase-outline" size={20} color="#94A3B8" />
                <Text style={screenStyles.emptyTitle}>No trips in this tab yet</Text>
                <Text style={screenStyles.emptySub}>Plan a new trip from Home and it will appear here.</Text>
                          </View>
            )}
          </ScrollView>

        </View>
      </View>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  topHeader: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    color: '#0F2044',
    fontSize: 22,
    fontWeight: '800',
  },
  tabsStickyWrap: {
    marginTop: 6,
    marginBottom: 10,
  },
  segmentedWrap: {
    height: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(148,163,184,0.2)',
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    height: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#FF6B6B',
  },
  listContentContainer: {
    paddingBottom: 120,
    gap: 16,
  },
  tripCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  tripCardCompleted: {
    opacity: 0.93,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  statusBadgeWrap: {
    alignItems: 'flex-end',
    padding: 12,
  },
  deleteTripBtn: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    zIndex: 3,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardHeadTextWrap: {
    flex: 1,
  },
  tripTitle: {
    color: '#0F2044',
    fontSize: 21,
    fontWeight: '800',
  },
  calendarRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripDateText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  mapCircleActive: {
    minWidth: 108,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
  },
  mapCircleIdle: {
    minWidth: 108,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2F7',
  },
  mapActionTextActive: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  mapActionTextIdle: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },
  cardBottomRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardStatsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlineStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineStatText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  viewButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  viewButtonActive: {
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  viewButtonIdle: {
    backgroundColor: '#F1F5F9',
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  viewButtonTextActive: {
    color: '#FF6B6B',
  },
  viewButtonTextIdle: {
    color: '#475569',
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    padding: 20,
    gap: 4,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },

  detailScrollContent: {
    paddingBottom: 140,
  },
  detailScreenBody: {
    paddingHorizontal: 0,
  },
  heroWrap: {
    height: 390,
    width: '100%',
  },
  heroImage: {
    flex: 1,
  },
  heroOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  heroTopControls: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroRightBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  heroCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  heroBottomTextWrap: {
    marginBottom: 14,
  },
  heroTitle: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  heroLocationRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroLocationText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    marginTop: -30,
    marginHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.15)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  summaryStatsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#E2E8F0',
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValuePrimary: {
    marginTop: 2,
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '800',
  },
  summaryValue: {
    marginTop: 2,
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  itinerarySection: {
    marginTop: 16,
    paddingHorizontal: 10,
  },
  itineraryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  itineraryHeaderText: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
  },
  dayBlock: {
    position: 'relative',
    paddingBottom: 14,
  },
  dayHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
    borderWidth: 4,
    borderColor: 'rgba(255,107,107,0.24)',
  },
  dayTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  dayDateText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  dayConnector: {
    position: 'absolute',
    left: 5,
    top: 24,
    bottom: 0,
    width: 2,
    backgroundColor: '#E2E8F0',
  },
  dayStopsWrap: {
    marginLeft: 20,
    gap: 14,
  },
  stopBlock: {
    flexDirection: 'row',
    gap: 10,
  },
  stopIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
    marginTop: 2,
  },
  stopThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 1,
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  stopThumbImage: {
    width: '100%',
    height: '100%',
  },
  stopThumbOverlayIcon: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  stopContent: {
    flex: 1,
  },
  stopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopTimeText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '800',
  },
  stopMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  stopDurationText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  stopTitle: {
    marginTop: 2,
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  stopDesc: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  restoHighlightCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
    backgroundColor: 'rgba(254,243,199,0.55)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  restoTextWrap: {
    flex: 1,
  },
  restoLabel: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  restoTitle: {
    marginTop: 1,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  utilityRecommendationCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  utilityRecommendationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityRecommendationTextWrap: {
    flex: 1,
  },
  utilityRecommendationLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  utilityRecommendationTitle: {
    marginTop: 1,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
});
