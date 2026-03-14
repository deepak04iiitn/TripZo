import React from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AnimatedTabIcon, FloatingMapTabButton } from './components/TabBarComponents';
import PlaceholderTabScreen from '../screens/tabs/PlaceholderTabScreen';
import HomeScreen from '../screens/tabs/HomeScreen';
import TripsScreen from '../screens/tabs/TripsScreen';
import AccountScreen from '../screens/tabs/AccountScreen';
import MapScreen from '../screens/tabs/MapScreen';

const Tab = createBottomTabNavigator();
 

export default function MainTabNavigator({ user, onLogout, onDeleteAccount }) {
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
          tabBarIcon: ({ focused }) => <AnimatedTabIcon focused={focused} routeName={route.name} styles={styles} />,
          tabBarButton: (props) =>
            (route.name === 'Map' ? <FloatingMapTabButton {...props} styles={styles} /> : <TouchableOpacity {...props} />),
          animation: 'shift',
        })}
      >
        <Tab.Screen name="Home" children={() => <HomeScreen styles={styles} />} />
        <Tab.Screen name="Trips" children={() => <TripsScreen styles={styles} />} />
        <Tab.Screen
          name="Map"
          children={() => <MapScreen styles={styles} />}
        />
        <Tab.Screen
          name="Explore"
          children={() => (
            <PlaceholderTabScreen
              title="Explore"
              subtitle="Discover places, food, and experiences near you."
              accent="#F59E0B"
              styles={styles}
            />
          )}
        />
        <Tab.Screen name="Account">
          {() => <AccountScreen user={user} onLogout={onLogout} onDeleteAccount={onDeleteAccount} styles={styles} />}
        </Tab.Screen>
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
  securityPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  securityPromptCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.12)',
  },
  securityPromptTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  securityPromptText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  securityPromptInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
  },
  securityPromptInputGap: {
    marginTop: 10,
  },
  securityPromptActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  securityPromptSecondaryBtn: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  securityPromptSecondaryText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  securityPromptPrimaryBtn: {
    minWidth: 88,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
  },
  securityPromptPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  securityPromptError: {
    marginTop: 8,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
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
  accountScrollContent: {
    paddingBottom: 28,
  },
  accountLoadingWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountProfileWrap: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  accountAvatarGradient: {
    width: 128,
    height: 128,
    borderRadius: 64,
    padding: 4,
    backgroundColor: '#FF6B6B',
  },
  accountAvatarInner: {
    flex: 1,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    padding: 4,
  },
  accountAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
  },
  accountEditAvatarBtn: {
    position: 'absolute',
    right: '35%',
    top: 108,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  accountName: {
    marginTop: 14,
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
  },
  accountUsername: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  accountMemberBadge: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountMemberText: {
    color: '#FF6B6B',
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  accountSection: {
    marginTop: 14,
  },
  accountSectionHeading: {
    marginBottom: 10,
    marginLeft: 6,
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  accountCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  accountRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  accountRowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountRowBody: {
    flex: 1,
  },
  accountRowLabel: {
    color: '#94A3B8',
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  accountRowValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  accountInput: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  securityAnswerInput: {
    marginTop: 8,
  },
  accountInputHint: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  changeChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeChipText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '800',
  },
  changeHintText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '700',
  },
  accountError: {
    marginTop: 10,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  accountSuccess: {
    marginTop: 10,
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '600',
  },
  accountActions: {
    marginTop: 18,
    gap: 12,
  },
  accountSaveBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accountSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  accountLogoutBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  accountLogoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  accountDeleteBtn: {
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,107,107,0.22)',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accountDeleteText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '800',
  },
  accountDeleteDisabled: {
    opacity: 0.7,
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

