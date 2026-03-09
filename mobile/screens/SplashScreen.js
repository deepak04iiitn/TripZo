import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const Logo = require('../assets/TripZo_Logo.png');

const { width, height } = Dimensions.get('window');

const CORAL     = '#FF6B6B';
const TANGERINE = '#FF8E53';
const AMBER     = '#FFC947';

export default function SplashScreen({ onDone }) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── Radial glow layers behind logo ── */}
      <View style={styles.glowOuter} />
      <View style={styles.glowMid} />
      <View style={styles.glowInner} />

      {/* ── Top accent line ── */}
      <LinearGradient
        colors={['transparent', CORAL, TANGERINE, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLineTop}
      />

      {/* ── Main content ── */}
      <View style={styles.content}>

        {/* Small floating label above logo */}
        <View style={styles.floatingLabel}>
          <Text style={styles.floatingLabelText}>✦  Smart Travel Planning</Text>
        </View>

        {/* Logo — dominant, fills the width */}
        <Image source={Logo} style={styles.logo} resizeMode="contain" />

        {/* Tagline */}
        <Text style={styles.tagline}>
          Explore More  ·  Waste Less Time  ·  Travel Smart
        </Text>

        {/* Decorative dots row */}
        <View style={styles.dotsRow}>
          {[CORAL, TANGERINE, AMBER].map((c, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: c }]} />
          ))}
        </View>
      </View>

      {/* ── CTA ── */}
      <View style={styles.bottomArea}>
        <TouchableOpacity onPress={onDone} activeOpacity={0.88} style={styles.btnWrapper}>
          <LinearGradient
            colors={[CORAL, TANGERINE, AMBER]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Welcome to TripZo</Text>
            <View style={styles.btnArrow}>
              <Text style={styles.btnArrowText}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.hint}>Tap to begin your journey</Text>
      </View>

      {/* ── Bottom accent line ── */}
      <LinearGradient
        colors={[CORAL, TANGERINE, AMBER]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLineBottom}
      />
    </View>
  );
}

const GLOW_SIZE = width * 1.1;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: height * 0.1,
    paddingBottom: 0,
    paddingHorizontal: 28,
  },

  /* ── Radial glow ── */
  glowOuter: {
    position: 'absolute',
    top: height * 0.12,
    alignSelf: 'center',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: CORAL,
    opacity: 0.045,
  },
  glowMid: {
    position: 'absolute',
    top: height * 0.12 + GLOW_SIZE * 0.12,
    alignSelf: 'center',
    width: GLOW_SIZE * 0.75,
    height: GLOW_SIZE * 0.75,
    borderRadius: (GLOW_SIZE * 0.75) / 2,
    backgroundColor: TANGERINE,
    opacity: 0.065,
  },
  glowInner: {
    position: 'absolute',
    top: height * 0.12 + GLOW_SIZE * 0.25,
    alignSelf: 'center',
    width: GLOW_SIZE * 0.48,
    height: GLOW_SIZE * 0.48,
    borderRadius: (GLOW_SIZE * 0.48) / 2,
    backgroundColor: AMBER,
    opacity: 0.07,
  },

  /* ── Accent lines ── */
  accentLineTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  accentLineBottom: {
    width: '100%',
    height: 5,
  },

  /* ── Main content ── */
  content: {
    alignItems: 'center',
    gap: 20,
    flex: 1,
    justifyContent: 'center',
  },

  floatingLabel: {
    backgroundColor: '#FFF5F5',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.18)',
  },
  floatingLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: CORAL,
    letterSpacing: 0.5,
  },

  logo: {
    width: width * 0.88,
    height: width * 0.88 * 0.38,
  },

  tagline: {
    fontSize: 12,
    fontWeight: '500',
    color: '#B0B8C1',
    letterSpacing: 0.8,
    textAlign: 'center',
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    opacity: 0.75,
  },

  /* ── Bottom area ── */
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 28,
  },

  btnWrapper: {
    width: '100%',
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  btn: {
    paddingVertical: 19,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  btnArrow: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnArrowText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  hint: {
    fontSize: 12,
    color: '#C4CBD6',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
