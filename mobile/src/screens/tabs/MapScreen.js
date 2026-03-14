import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import ScreenTopBar from '../../navigation/components/ScreenTopBar';
import { listSavedTrips, listTrips } from '../../services/itinerary/itineraryService';
import { getOsrmRoute } from '../../services/maps/googleRoutingService';

const INITIAL_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 14,
  longitudeDelta: 14,
};
const DAY_ROUTE_COLORS = ['#FF6B6B', '#FF8E53', '#FFC947', '#0EA5E9', '#10B981', '#8B5CF6'];
const MARKER_TRACK_DISABLE_DELAY_MS = 700;

function parseDateOnly(value) {
  const [year, month, day] = String(value || '').split('-').map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return 'Date not set';
  }
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  return `${startLabel} - ${endLabel}`;
}

function formatSingleDate(dateValue) {
  if (!dateValue) {
    return 'Date unavailable';
  }
  const date = parseDateOnly(dateValue);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTripStatus(trip) {
  if (trip?.status === 'completed') {
    return 'completed';
  }
  const now = new Date();
  const start = parseDateOnly(trip?.startDate);
  const end = parseDateOnly(trip?.endDate);
  if (start > now) {
    return 'upcoming';
  }
  if (end < now) {
    return 'completed';
  }
  return 'ongoing';
}

function statusMeta(status) {
  if (status === 'ongoing') {
    return { label: 'Ongoing', text: '#0369A1', bg: 'rgba(14,165,233,0.14)' };
  }
  if (status === 'completed') {
    return { label: 'Completed', text: '#475569', bg: 'rgba(148,163,184,0.18)' };
  }
  return { label: 'Upcoming', text: '#047857', bg: 'rgba(16,185,129,0.14)' };
}

function recommendationTypeMeta(type) {
  if (type === 'restaurant') {
    return {
      icon: 'restaurant-outline',
      color: '#D97706',
      bg: 'rgba(245,158,11,0.16)',
      label: 'Restaurant',
      markerText: 'R',
    };
  }
  if (type === 'atm') {
    return {
      icon: 'card-outline',
      color: '#0284C7',
      bg: 'rgba(14,165,233,0.16)',
      label: 'ATM',
      markerText: 'A',
    };
  }
  return {
    icon: 'water-outline',
    color: '#0F766E',
    bg: 'rgba(20,184,166,0.16)',
    label: 'Washroom',
    markerText: 'W',
  };
}

function getCurrentTripDayNumber(trip) {
  if (!trip?.startDate || !trip?.durationDays) {
    return 1;
  }
  const today = new Date();
  const start = parseDateOnly(trip.startDate);
  const end = parseDateOnly(trip.endDate);
  if (start > today) {
    return 1;
  }
  if (end < today) {
    return Math.max(1, Number(trip.durationDays) || 1);
  }
  const dayIndex = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(Number(trip.durationDays) || 1, dayIndex));
}

function getTripDays(trip) {
  const daysFromData = [...(trip?.days || [])]
    .sort((a, b) => Number(a.day) - Number(b.day))
    .map((item) => ({
      day: Number(item.day),
      date: item.date,
      stopsCount: (item.stops || []).length,
    }))
    .filter((item) => Number.isFinite(item.day));
  if (daysFromData.length) {
    return daysFromData;
  }
  const durationDays = Math.max(1, Number(trip?.durationDays) || 1);
  return Array.from({ length: durationDays }, (_unused, index) => ({
    day: index + 1,
    date: '',
    stopsCount: 0,
  }));
}

function flattenTripData(trip, options = {}) {
  const focusDayNumber = options.focusDayNumber || null;
  const dayList = [...(trip?.days || [])].sort((a, b) => Number(a.day) - Number(b.day));
  const activeDays = focusDayNumber ? dayList.filter((dayItem) => Number(dayItem.day) === Number(focusDayNumber)) : dayList;
  const orderedStops = dayList.flatMap((dayItem) =>
    // Build full ordered stops first; activeDays are selected below for focused-map mode.
    [...(dayItem.stops || [])]
      .sort((a, b) => Number(a.sequence) - Number(b.sequence))
      .map((stop) => ({
        ...stop,
        day: dayItem.day,
      }))
  );
  const activeOrderedStops = activeDays.flatMap((dayItem) =>
    [...(dayItem.stops || [])]
      .sort((a, b) => Number(a.sequence) - Number(b.sequence))
      .map((stop) => ({
        ...stop,
        day: dayItem.day,
      }))
  );

  const stopNodes = activeOrderedStops
    .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
    .map((stop, index) => ({
      key: `stop-${stop.id || `${stop.day}-${stop.sequence}`}`,
      index: index + 1,
      title: stop.label || `Stop ${index + 1}`,
      subtitle: `Day ${stop.day} • ${stop.category || 'attraction'}`,
      latitude: stop.latitude,
      longitude: stop.longitude,
      source: stop,
    }));

  const startNode = Number.isFinite(trip?.from?.latitude) && Number.isFinite(trip?.from?.longitude)
    ? {
        key: 'start',
        index: 0,
        title: trip?.from?.label || 'Trip start',
        subtitle: 'Start location',
        latitude: trip.from.latitude,
        longitude: trip.from.longitude,
      }
    : null;

  const routeNodes = startNode && stopNodes.length ? [startNode, ...stopNodes] : stopNodes;

  const recommendationNodes = activeOrderedStops.flatMap((stop, stopIndex) => {
    const recommendations = stop?.recommendations || [];
    return recommendations
      .filter(
        (item) =>
          Number.isFinite(item?.place?.latitude) &&
          Number.isFinite(item?.place?.longitude) &&
          (item.type === 'restaurant' || item.type === 'atm' || item.type === 'washroom')
      )
      .map((item, recommendationIndex) => ({
        key: `recommendation-${item.type}-${stop.id || stopIndex}-${recommendationIndex}`,
        type: item.type,
        title: item.place.label || recommendationTypeMeta(item.type).label,
        subtitle: `${recommendationTypeMeta(item.type).label} • ${item.reason || 'Recommended on route'}`,
        latitude: item.place.latitude,
        longitude: item.place.longitude,
        stopLabel: stop.label || `Stop ${stopIndex + 1}`,
      }));
  });

  return { routeNodes, stopNodes, recommendationNodes, startNode, totalStops: orderedStops.length };
}

function computeRegionFromPoints(points) {
  if (!points.length) {
    return INITIAL_REGION;
  }
  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      longitude: points[0].longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  points.forEach((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  });

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.5),
  };
}

export default function MapScreen({ styles }) {
  const mapRef = useRef(null);
  const route = useRoute();
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState(null);
  const [isTripDropdownOpen, setIsTripDropdownOpen] = useState(false);
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [routePolylines, setRoutePolylines] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [activeMarker, setActiveMarker] = useState(null);
  const [trackMarkerViews, setTrackMarkerViews] = useState(Platform.OS === 'android');
  const [mapFilters, setMapFilters] = useState({
    start: true,
    stops: true,
    restaurant: true,
    atm: true,
    washroom: true,
  });

  const loadTrips = useCallback(async () => {
    const [ownedTrips, savedTrips] = await Promise.all([listTrips(), listSavedTrips()]);
    const mergedTrips = [...ownedTrips, ...savedTrips].filter(
      (trip, index, source) => source.findIndex((item) => item.id === trip.id) === index
    );
    setTrips(mergedTrips);
    setSelectedTripId((currentSelected) => {
      if (!mergedTrips.length) {
        return null;
      }
      if (currentSelected && mergedTrips.some((item) => item.id === currentSelected)) {
        return currentSelected;
      }
      return null;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingTrips(true);
      (async () => {
        try {
          await loadTrips();
        } finally {
          if (active) {
            setLoadingTrips(false);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [loadTrips])
  );

  useEffect(() => {
    const incomingTripId = route?.params?.tripId;
    if (incomingTripId) {
      setSelectedTripId(incomingTripId);
      setIsTripDropdownOpen(false);
    }
  }, [route?.params?.tripId]);

  const selectedTrip = useMemo(
    () => trips.find((item) => item.id === selectedTripId) || null,
    [selectedTripId, trips]
  );
  const selectedTripDays = useMemo(() => getTripDays(selectedTrip), [selectedTrip]);
  const selectedTripDayCount = selectedTripDays.length;

  useEffect(() => {
    if (!selectedTrip) {
      setSelectedDayNumber(null);
      setDayPickerVisible(false);
      setIsTripDropdownOpen(false);
      return;
    }
    if (selectedTripDayCount <= 1) {
      setSelectedDayNumber(1);
      setDayPickerVisible(false);
      return;
    }
    setSelectedDayNumber(null);
    setDayPickerVisible(true);
  }, [selectedTrip?.id, selectedTripDayCount]);

  const shouldRenderMapData = useMemo(
    () => Boolean(selectedTrip && selectedDayNumber),
    [selectedTrip, selectedDayNumber]
  );

  const { routeNodes, stopNodes, recommendationNodes, startNode, totalStops } = useMemo(
    () => {
      if (!shouldRenderMapData) {
        return { routeNodes: [], stopNodes: [], recommendationNodes: [], startNode: null, totalStops: 0 };
      }
      return flattenTripData(selectedTrip, {
        focusDayNumber: selectedDayNumber,
      });
    },
    [selectedDayNumber, selectedTrip, shouldRenderMapData]
  );

  const filteredStopNodes = useMemo(
    () => (mapFilters.stops ? stopNodes : []),
    [mapFilters.stops, stopNodes]
  );

  const filteredRecommendationNodes = useMemo(
    () =>
      recommendationNodes.filter((item) => {
        if (item.type === 'restaurant') return mapFilters.restaurant;
        if (item.type === 'atm') return mapFilters.atm;
        if (item.type === 'washroom') return mapFilters.washroom;
        return true;
      }),
    [mapFilters.atm, mapFilters.restaurant, mapFilters.washroom, recommendationNodes]
  );

  const mapRegion = useMemo(
    () => computeRegionFromPoints([...routeNodes, ...filteredRecommendationNodes]),
    [filteredRecommendationNodes, routeNodes]
  );

  const handlePickTrip = useCallback(
    (tripId) => {
      setSelectedTripId(tripId);
      setIsTripDropdownOpen(false);
    },
    []
  );

  const handlePickDay = useCallback((dayNumber) => {
    setSelectedDayNumber(dayNumber);
    setDayPickerVisible(false);
  }, []);

  const toggleFilter = useCallback((key) => {
    setMapFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    setTrackMarkerViews(true);
    const timer = setTimeout(() => setTrackMarkerViews(false), MARKER_TRACK_DISABLE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [selectedTripId, selectedDayNumber, mapFilters.start, mapFilters.stops, mapFilters.restaurant, mapFilters.atm, mapFilters.washroom]);

  useEffect(() => {
    let cancelled = false;
    const buildRoute = async () => {
      setActiveMarker(null);
      setRoutePolylines([]);

      if (!routeNodes.length) {
        return;
      }
      if (routeNodes.length <= 1) {
        return;
      }

      setRouteLoading(true);
      try {
        const segmentRequests = [];
        for (let index = 0; index < routeNodes.length - 1; index += 1) {
          const fromNode = routeNodes[index];
          const toNode = routeNodes[index + 1];
          const day = Number(toNode.day || fromNode.day || 1);
          segmentRequests.push(
            getOsrmRoute(fromNode, toNode)
              .then((segment) => ({ segment, fromNode, toNode, day }))
              .catch(() => ({ segment: null, fromNode, toNode, day }))
          );
        }
        const routes = await Promise.all(segmentRequests);
        if (cancelled) {
          return;
        }

        const groupedByDay = new Map();
        routes.forEach(({ segment, fromNode, toNode, day }) => {
          const fallbackPair = [
            { latitude: fromNode.latitude, longitude: fromNode.longitude },
            { latitude: toNode.latitude, longitude: toNode.longitude },
          ];
          const chunk = segment?.geometry?.length ? segment.geometry : fallbackPair;
          if (!groupedByDay.has(day)) {
            groupedByDay.set(day, []);
          }
          const current = groupedByDay.get(day);
          if (!current.length) {
            current.push(...chunk);
          } else {
            const isDuplicateStart =
              current[current.length - 1].latitude === chunk[0].latitude &&
              current[current.length - 1].longitude === chunk[0].longitude;
            current.push(...(isDuplicateStart ? chunk.slice(1) : chunk));
          }
        });

        const dayPolylines = [...groupedByDay.entries()]
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([day, coordinates], index) => ({
            key: `polyline-day-${day}`,
            day: Number(day),
            color: DAY_ROUTE_COLORS[index % DAY_ROUTE_COLORS.length],
            coordinates,
          }))
          .filter((item) => item.coordinates.length >= 2);
        setRoutePolylines(dayPolylines);
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    };

    buildRoute();
    return () => {
      cancelled = true;
    };
  }, [routeNodes]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    const flattenedPolylineCoords = routePolylines.flatMap((item) => item.coordinates || []);
    const coordsToFit = flattenedPolylineCoords.length
      ? flattenedPolylineCoords
      : routeNodes.map((node) => ({ latitude: node.latitude, longitude: node.longitude }));
    if (!coordsToFit.length) {
      mapRef.current.animateToRegion(mapRegion, 420);
      return;
    }
    if (coordsToFit.length === 1) {
      mapRef.current.animateToRegion(mapRegion, 420);
      return;
    }
    mapRef.current.fitToCoordinates(coordsToFit, {
      edgePadding: { top: 130, right: 56, bottom: 190, left: 56 },
      animated: true,
    });
  }, [mapRegion, routePolylines, routeNodes]);

  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute="Map" styles={styles} />

        <View style={screenStyles.container}>
          <MapView
            ref={mapRef}
            style={screenStyles.map}
            initialRegion={mapRegion}
            showsCompass
            showsUserLocation
            showsMyLocationButton
            toolbarEnabled={false}
          >
            {routePolylines.map((polyline) => (
              <Polyline
                key={polyline.key}
                coordinates={polyline.coordinates}
                strokeColor={polyline.color}
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {startNode && mapFilters.start && (
              <Marker
                coordinate={{ latitude: startNode.latitude, longitude: startNode.longitude }}
                pinColor="#0F2044"
                onPress={() =>
                  setActiveMarker({
                    type: 'start',
                    title: startNode.title,
                    subtitle: startNode.subtitle,
                  })
                }
              />
            )}

            {filteredStopNodes.map((stop) => (
              <Marker
                key={stop.key}
                coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                tracksViewChanges={trackMarkerViews}
                onPress={() =>
                  setActiveMarker({
                    type: 'stop',
                    title: stop.title,
                    subtitle: stop.subtitle,
                  })
                }
              >
                <View style={screenStyles.stopMarker}>
                  <Text style={screenStyles.stopMarkerText}>{stop.index}</Text>
                </View>
              </Marker>
            ))}

            {filteredRecommendationNodes.map((recommendation) => {
              const meta = recommendationTypeMeta(recommendation.type);
              return (
                <Marker
                  key={recommendation.key}
                  coordinate={{ latitude: recommendation.latitude, longitude: recommendation.longitude }}
                  tracksViewChanges={trackMarkerViews}
                  onPress={() =>
                    setActiveMarker({
                      type: recommendation.type,
                      title: recommendation.title,
                      subtitle: recommendation.subtitle,
                    })
                  }
                >
                  <View style={[screenStyles.recommendationMarker, { backgroundColor: meta.bg }]}>
                    <Text style={[screenStyles.recommendationMarkerText, { color: meta.color }]}>{meta.markerText}</Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>

          <View style={[screenStyles.topOverlay, !loadingTrips && !selectedTrip && screenStyles.topOverlayCentered]}>
            {loadingTrips ? (
              <View style={screenStyles.loadingTripsWrap}>
                <ActivityIndicator size="small" color="#FF6B6B" />
                <Text style={screenStyles.loadingTripsText}>Loading your trips...</Text>
              </View>
            ) : (
              <View style={screenStyles.controlCard}>
                <View style={screenStyles.controlHeadRow}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsTripDropdownOpen((value) => !value)}
                    style={screenStyles.tripDropdownTrigger}
                  >
                    <View style={screenStyles.controlTripTextWrap}>
                      <Text numberOfLines={1} style={screenStyles.controlTripTitle}>
                        {selectedTrip ? selectedTrip.title || 'Untitled Trip' : 'Select a trip'}
                      </Text>
                      {!!selectedTrip && (
                        <Text style={screenStyles.controlTripMeta}>
                          {formatDateRange(selectedTrip.startDate, selectedTrip.endDate)} • Day {selectedDayNumber || '-'}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={isTripDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#475569"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={loadTrips} style={screenStyles.refreshBtn}>
                    <Ionicons name="refresh" size={15} color="#FF6B6B" />
                    <Text style={screenStyles.refreshBtnText}>Refresh</Text>
                  </TouchableOpacity>
                </View>

                {isTripDropdownOpen && (
                  <View style={screenStyles.tripDropdownMenu}>
                    <ScrollView
                      style={screenStyles.tripDropdownList}
                      contentContainerStyle={screenStyles.tripDropdownListContent}
                      nestedScrollEnabled
                    >
                      {trips.map((trip) => {
                        const status = statusMeta(getTripStatus(trip));
                        const selected = trip.id === selectedTripId;
                        return (
                          <TouchableOpacity
                            key={`dropdown-${trip.id}`}
                            activeOpacity={0.9}
                            onPress={() => handlePickTrip(trip.id)}
                            style={[screenStyles.tripDropdownItem, selected && screenStyles.tripDropdownItemSelected]}
                          >
                            <View style={screenStyles.tripDropdownTextWrap}>
                              <Text numberOfLines={1} style={screenStyles.tripDropdownTitle}>
                                {trip.title || 'Untitled Trip'}
                              </Text>
                              <Text style={screenStyles.tripDropdownDate}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
                            </View>
                            <View style={[screenStyles.tripDropdownStatusBadge, { backgroundColor: status.bg }]}>
                              <Text style={[screenStyles.tripDropdownStatusText, { color: status.text }]}>{status.label}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {!!selectedTrip && (
                  <View style={screenStyles.selectorHeaderActions}>
                  {selectedTripDayCount > 1 && (
                    <TouchableOpacity onPress={() => setDayPickerVisible(true)} style={screenStyles.actionBtn}>
                      <Ionicons name="calendar-outline" size={14} color="#334155" />
                      <Text style={screenStyles.actionBtnText}>Change Day</Text>
                    </TouchableOpacity>
                  )}
                  </View>
                )}
                {!!selectedTrip && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={screenStyles.filterRow}>
                  <TouchableOpacity
                    onPress={() => toggleFilter('start')}
                    style={[screenStyles.filterChip, mapFilters.start && screenStyles.filterChipActive]}
                  >
                    <Text style={[screenStyles.filterChipText, mapFilters.start && screenStyles.filterChipTextActive]}>Start</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleFilter('stops')}
                    style={[screenStyles.filterChip, mapFilters.stops && screenStyles.filterChipActive]}
                  >
                    <Text style={[screenStyles.filterChipText, mapFilters.stops && screenStyles.filterChipTextActive]}>Stops</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleFilter('restaurant')}
                    style={[screenStyles.filterChip, mapFilters.restaurant && screenStyles.filterChipActive]}
                  >
                    <Text style={[screenStyles.filterChipText, mapFilters.restaurant && screenStyles.filterChipTextActive]}>Restaurants</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleFilter('atm')}
                    style={[screenStyles.filterChip, mapFilters.atm && screenStyles.filterChipActive]}
                  >
                    <Text style={[screenStyles.filterChipText, mapFilters.atm && screenStyles.filterChipTextActive]}>ATMs</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleFilter('washroom')}
                    style={[screenStyles.filterChip, mapFilters.washroom && screenStyles.filterChipActive]}
                  >
                    <Text style={[screenStyles.filterChipText, mapFilters.washroom && screenStyles.filterChipTextActive]}>Washrooms</Text>
                  </TouchableOpacity>
                  </ScrollView>
                )}
                {!selectedTrip && (
                  <Text style={screenStyles.tripDropdownHint}>Tap the dropdown to choose a trip and load the map.</Text>
                )}
              </View>
            )}
          </View>

          {dayPickerVisible && selectedTripDayCount > 1 && (
            <View style={screenStyles.tripPickerOverlay}>
              <View style={screenStyles.tripPickerCard}>
                <Text style={screenStyles.tripPickerTitle}>Choose a day to view</Text>
                <Text style={screenStyles.tripPickerSubtitle}>
                  {selectedTrip?.title || 'This trip'} has multiple days. Select which day you want to map.
                </Text>
                <ScrollView
                  style={screenStyles.tripPickerList}
                  contentContainerStyle={screenStyles.tripPickerListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedTripDays.map((dayItem) => (
                    <TouchableOpacity
                      key={`day-${dayItem.day}`}
                      activeOpacity={0.9}
                      onPress={() => handlePickDay(dayItem.day)}
                      style={screenStyles.tripPickerItem}
                    >
                      <View style={screenStyles.tripPickerItemTextWrap}>
                        <Text style={screenStyles.tripPickerItemTitle}>Day {dayItem.day}</Text>
                        <Text style={screenStyles.tripPickerItemDate}>
                          {formatSingleDate(dayItem.date)} • {dayItem.stopsCount} stops
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {(routeLoading || activeMarker) && (
            <View style={screenStyles.bottomOverlay}>
              {routeLoading && (
                <View style={screenStyles.routeLoadingCard}>
                  <ActivityIndicator size="small" color="#FF6B6B" />
                  <Text style={screenStyles.routeLoadingText}>Drawing optimized route...</Text>
                </View>
              )}
              {!!activeMarker && (
                <View style={screenStyles.infoCard}>
                  <View style={screenStyles.infoIconWrap}>
                    {activeMarker.type === 'start' && <Ionicons name="navigate-outline" size={18} color="#0F2044" />}
                    {activeMarker.type === 'stop' && <Ionicons name="location-outline" size={18} color="#FF6B6B" />}
                    {(activeMarker.type === 'restaurant' ||
                      activeMarker.type === 'atm' ||
                      activeMarker.type === 'washroom') && (
                      <Ionicons
                        name={recommendationTypeMeta(activeMarker.type).icon}
                        size={18}
                        color={recommendationTypeMeta(activeMarker.type).color}
                      />
                    )}
                  </View>
                  <View style={screenStyles.infoTextWrap}>
                    <Text numberOfLines={1} style={screenStyles.infoTitle}>
                      {activeMarker.title}
                    </Text>
                    <Text numberOfLines={2} style={screenStyles.infoSubtitle}>
                      {activeMarker.subtitle}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveMarker(null)} style={screenStyles.infoCloseBtn}>
                    <Ionicons name="close" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
  },
  topOverlayCentered: {
    top: 0,
    bottom: 0,
    left: 20,
    right: 20,
    justifyContent: 'center',
  },
  tripPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 64,
  },
  tripPickerCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  tripPickerTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  tripPickerSubtitle: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  tripPickerList: {
    marginTop: 12,
  },
  tripPickerListContent: {
    gap: 8,
  },
  tripPickerItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tripPickerItemTextWrap: {
    flex: 1,
  },
  tripPickerItemTitle: {
    color: '#0F2044',
    fontSize: 14,
    fontWeight: '800',
  },
  tripPickerItemDate: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  tripPickerStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tripPickerStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  loadingTripsWrap: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingTripsText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  controlCard: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    padding: 10,
    gap: 8,
  },
  controlHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tripDropdownTrigger: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripDropdownMenu: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    maxHeight: 220,
    overflow: 'hidden',
  },
  tripDropdownList: {
    maxHeight: 220,
  },
  tripDropdownListContent: {
    padding: 8,
    gap: 6,
  },
  tripDropdownItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tripDropdownItemSelected: {
    borderColor: 'rgba(255,107,107,0.35)',
    backgroundColor: 'rgba(255,107,107,0.08)',
  },
  tripDropdownTextWrap: {
    flex: 1,
  },
  tripDropdownTitle: {
    color: '#0F2044',
    fontSize: 13,
    fontWeight: '800',
  },
  tripDropdownDate: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  tripDropdownStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tripDropdownStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tripDropdownHint: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  controlTripTextWrap: {
    flex: 1,
  },
  controlTripTitle: {
    color: '#0F2044',
    fontSize: 14,
    fontWeight: '800',
  },
  controlTripMeta: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  selectorHeader: {
    marginBottom: 8,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },
  filterRow: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: 'rgba(255,107,107,0.35)',
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  filterChipText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#FF6B6B',
  },
  selectorTitle: {
    color: '#0F2044',
    fontSize: 13,
    fontWeight: '800',
  },
  dayFocusBtn: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.32)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayFocusBtnActive: {
    backgroundColor: '#0F2044',
    borderColor: '#0F2044',
  },
  dayFocusText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },
  dayFocusTextActive: {
    color: '#FFFFFF',
  },
  refreshBtn: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.24)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshBtnText: {
    color: '#FF6B6B',
    fontSize: 11,
    fontWeight: '800',
  },
  tripSelectorContent: {
    gap: 10,
    paddingRight: 8,
  },
  emptyTripsCard: {
    width: 300,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  emptyTripsTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyTripsSubtitle: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  tripCard: {
    width: 225,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.26)',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  tripCardActive: {
    borderColor: 'rgba(255,107,107,0.45)',
    backgroundColor: '#FFFFFF',
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tripCardTitle: {
    flex: 1,
    color: '#0F2044',
    fontSize: 15,
    fontWeight: '800',
  },
  tripCardDate: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  tripStatusBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tripStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stopMarker: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: '#FF6B6B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  stopMarkerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  recommendationMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  recommendationMarkerText: {
    fontSize: 12,
    fontWeight: '800',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 100,
    gap: 10,
  },
  routeLoadingCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeLoadingText: {
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  infoSubtitle: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  infoMetaText: {
    marginTop: 5,
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
  },
  infoCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


