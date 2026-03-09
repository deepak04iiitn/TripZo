import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

import Svg1 from '../assets/svg-1.svg';
import Svg2 from '../assets/svg-2.svg';


const { width, height } = Dimensions.get('window');

// ── Coastal Light palette (PRD §09) ───────────────────────────────────────
const CORAL        = '#FF6B6B';
const TANGERINE    = '#FF8E53';
const AMBER        = '#FFC947';
const NAVY_MID     = '#1E3A6E';
const INK_MID      = '#374151';
const INK_SOFT     = '#6B7280';
const DOT_INACTIVE = '#E2E8F2';
// ─────────────────────────────────────────────────────────────────────────

const slides = [
  {
    id: '1',
    Svg: Svg1,
    titleLight: 'EXPLORE MORE,',
    titleBold:  'WASTE LESS TIME.',
    description:
      "Stop wasting hours on back-and-forth routes. TripZo auto-builds optimized itineraries around your location, time, and interests — cutting transit by up to 40% so you see far more of what matters.",
  },
  {
    id: '2',
    Svg: Svg2,
    titleLight: 'YOUR PERFECT TRIP,',
    titleBold:  'FULLY AUTOMATED.',
    description:
      "Multi-day plans, restaurant slots, nearby ATMs, live trip progress, real traveller tips, and one-tap sharing — every tool a modern traveller needs, beautifully unified in one app.",
  },
];

const ILLUSTRATION_H = height * 0.65;  // illustration fills ~65%, bleeds behind the sheet
const SHEET_H        = height * 0.5;   // bottom sheet covers exactly the bottom half

export default function OnboardingScreen({ onFinish }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const isLast = currentIndex === slides.length - 1;

  const goNext = () => {
    if (!isLast) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish?.();
    }
  };

  // navigateRef is updated every render so the PanResponder always reads
  // the latest currentIndex — avoids the stale closure problem.
  const navigateRef = useRef(null);
  navigateRef.current = (dx) => {
    if (dx < -40) {
      if (currentIndex < slides.length - 1) {
        flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        setCurrentIndex(currentIndex + 1);
      } else {
        onFinish?.();
      }
    } else if (dx > 40 && currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
      setCurrentIndex(currentIndex - 1);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx }) => navigateRef.current(dx),
    })
  ).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderIllustration = ({ item }) => {
    const SvgIllustration = item.Svg;
    return (
      <LinearGradient
        colors={[CORAL, TANGERINE, AMBER]}
        style={styles.illustrationArea}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SvgIllustration
          width={width * 0.82}
          height={height * 0.33}
          style={styles.svgImage}
        />
      </LinearGradient>
    );
  };

  const slide = slides[currentIndex];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Scrollable illustrations — taller than the sheet so they show above it */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderIllustration}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        scrollEventThrottle={16}
        style={{ height: ILLUSTRATION_H }}
      />

      {/* Bottom sheet — swipe gestures forwarded to FlatList via PanResponder */}
      <View style={styles.whitePanel} {...panResponder.panHandlers}>
        <View style={styles.textArea}>
          <Text style={styles.titleLight}>{slide.titleLight}</Text>
          <Text style={styles.titleBold}>{slide.titleBold}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>

        {/* Controls row — glued to bottom of same white surface */}
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={onFinish} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <View style={styles.dotsRow}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
            ))}
          </View>

          {isLast ? (
            <TouchableOpacity onPress={onFinish} activeOpacity={0.85}>
              <LinearGradient
                colors={[CORAL, TANGERINE, AMBER]}
                style={styles.ctaBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaText}>START</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
              <LinearGradient
                colors={[CORAL, TANGERINE]}
                style={styles.ctaBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaText}>NEXT</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CORAL,
  },

  /* ── Illustration (scrollable, bleeds behind the sheet) ── */
  illustrationArea: {
    width,
    height: ILLUSTRATION_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: height * 0.14,
  },
  svgImage: {
    marginBottom: 4,
  },

  /* ── Bottom sheet — absolutely anchored, overlaps illustration ── */
  whitePanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 16,
  },

  textArea: {},
  titleLight: {
    fontSize: 19,
    fontWeight: '700',
    color: NAVY_MID,
    letterSpacing: 1.1,
  },
  titleBold: {
    fontSize: 26,
    fontWeight: '800',
    color: CORAL,
    letterSpacing: 1.3,
    marginTop: 2,
    marginBottom: 14,
  },
  description: {
    fontSize: 14.5,
    lineHeight: 22.5,
    color: INK_MID,
    maxWidth: '92%',
  },

  /* ── Controls row — inside the white panel ── */
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    minWidth: 44,
  },
  skipText: {
    fontSize: 14,
    color: INK_SOFT,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DOT_INACTIVE,
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: AMBER,
  },
  ctaBtn: {
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 20,
    elevation: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.9,
  },
});
