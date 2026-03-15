import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTopBar from '../../navigation/components/ScreenTopBar';
import { getAdminDashboardMetrics, getMe, updateProfile, uploadProfileImage } from '../../services/auth/authService';
import { SKELETON_GRADIENT_COLORS, useSkeletonShimmer } from '../../utils/skeletonShimmer';

const ACCOUNT_PROFILE = {
  name: 'Alex Coastal',
  username: '@alex_travels',
  email: 'alex.coastal@tripzo.com',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCH3W_7GJLfMHn090YaXxgjyfo5Bd3q7OlxoVAe_zgLV3b4TJNMAq33zAvrAT7c7wC7tuY5MKubJUaAiVMcvmI9lWoZ-XhUadE64z0vntlEZoRj_fUuGoi1IlFRBVi4TXcEE83IE6voCRbuLoSX376v4XxIrCszUtV30iKjCQPG0P_XQmOxgmbj-1vf6BnDcdj3VRUxcU5_gy0CWCLLSQeWIxvGG0Z33BAYdH0PhyXy12AsTl-9CN32f-mWoDVyx5xckD8OX9xxvn0s',
};

export default function AccountScreen({ user, onLogout, onDeleteAccount, styles }) {
  const isAdminUser = user?.role === 'admin';
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [selectedRangeDays, setSelectedRangeDays] = useState(30);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const skeletonTranslateX = useSkeletonShimmer();

  const SkeletonBlock = ({ style }) => (
    <View style={[accountSkeletonStyles.base, style]}>
      <Animated.View
        pointerEvents="none"
        style={[accountSkeletonStyles.shimmer, { transform: [{ translateX: skeletonTranslateX }] }]}
      >
        <LinearGradient
          colors={SKELETON_GRADIENT_COLORS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={accountSkeletonStyles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSuccess('');
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [success]);

  const hydrateProfile = (nextUser) => {
    setProfile(nextUser);
    setFullName(nextUser?.fullName || '');
    setSecurityQuestion(nextUser?.securityQuestion || '');
    setSecurityAnswer('');
  };

  const loadProfile = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getMe();
      hydrateProfile(response.user);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardMetrics = async ({ silent = false, rangeDays = selectedRangeDays } = {}) => {
    if (silent) {
      setIsDashboardRefreshing(true);
    } else {
      setIsDashboardLoading(true);
    }

    setDashboardError('');

    try {
      const response = await getAdminDashboardMetrics(rangeDays);
      setDashboardMetrics(response.metrics);
    } catch (metricsError) {
      setDashboardError(metricsError.message);
    } finally {
      setIsDashboardLoading(false);
      setIsDashboardRefreshing(false);
      setIsLoading(false);
    }
  };

  const handleRangeChange = async (nextRangeDays) => {
    if (nextRangeDays === selectedRangeDays) {
      return;
    }
    setSelectedRangeDays(nextRangeDays);
    await loadDashboardMetrics({ rangeDays: nextRangeDays });
  };

  const handleExportCsv = async () => {
    if (!dashboardMetrics?.trends?.length || isExportingCsv) {
      return;
    }

    try {
      setIsExportingCsv(true);

      const csvRows = [];
      csvRows.push(
        [
          'Date',
          'DAU',
          'WAU',
          'MAU',
          'Itineraries',
          'TotalUsers',
          'DAU_MAU_StickinessPercent',
          'MonthlyChurnRatePercent',
          'AvgSessionDurationSeconds',
        ].join(',')
      );

      dashboardMetrics.trends.forEach((row) => {
        csvRows.push(
          [
            toCsvCell(row.date),
            toCsvCell(Number(row.dau || 0)),
            toCsvCell(Number(row.wau || 0)),
            toCsvCell(Number(row.mau || 0)),
            toCsvCell(Number(row.itineraries || 0)),
            toCsvCell(Number(dashboardMetrics?.users?.totalUsers || 0)),
            toCsvCell(Number(dashboardMetrics?.users?.dauMauStickinessPercent || 0)),
            toCsvCell(Number(dashboardMetrics?.churn?.monthlyRatePercent || 0)),
            toCsvCell(Number(dashboardMetrics?.sessions?.averageDurationSeconds || 0)),
          ].join(',')
        );
      });

      const csvContent = csvRows.join('\n');
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error('No writable directory available.');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileUri = `${baseDir}tripzo-admin-metrics-${selectedRangeDays}d-${timestamp}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: 'utf8',
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('CSV exported', `CSV file saved at:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export TripZo Admin Metrics',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (_error) {
      setDashboardError('Unable to export CSV right now.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isAdminUser) {
        loadDashboardMetrics({ rangeDays: selectedRangeDays });
        return;
      }
      loadProfile();
    }, [isAdminUser])
  );

  const saveProfile = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const normalizedCurrentQuestion = securityQuestion.trim();
    const normalizedSavedQuestion = (profile?.securityQuestion || '').trim();
    const isQuestionChanged = normalizedCurrentQuestion !== normalizedSavedQuestion;
    const requiresFreshAnswer = normalizedCurrentQuestion && (isQuestionChanged || !profile?.hasSecurityQuestion);

    if (requiresFreshAnswer && !securityAnswer.trim()) {
      setError('Please enter a security answer.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await updateProfile({
        fullName: fullName.trim(),
        securityQuestion: securityQuestion.trim(),
        securityAnswer: securityAnswer.trim(),
      });
      hydrateProfile(response.user);
      setSuccess('Profile updated successfully.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const pickProfileImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo access is required to upload a profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setIsUploadingImage(true);
      setError('');
      setSuccess('');
      const uploadResponse = await uploadProfileImage(result.assets[0].uri);
      hydrateProfile(uploadResponse.user);
      setSuccess('Profile image updated.');
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This will permanently remove your account and profile image. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await onDeleteAccount();
            } catch (deleteError) {
              setError(deleteError.message || 'Failed to delete account.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
        <View style={styles.screenContent}>
          <ScreenTopBar activeRoute="Account" styles={styles} />
          <View style={[styles.screenBody, styles.accountLoadingWrap]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountScrollContent}>
              <View style={styles.accountProfileWrap}>
                <SkeletonBlock style={accountSkeletonStyles.avatar} />
                <SkeletonBlock style={accountSkeletonStyles.name} />
                <SkeletonBlock style={accountSkeletonStyles.username} />
              </View>
              <SkeletonBlock style={accountSkeletonStyles.card} />
              <SkeletonBlock style={accountSkeletonStyles.card} />
              <SkeletonBlock style={accountSkeletonStyles.action} />
              <SkeletonBlock style={accountSkeletonStyles.action} />
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isAdminUser) {
    const usersMetrics = dashboardMetrics?.users || {};
    const itineraryMetrics = dashboardMetrics?.itinerariesGenerated || {};
    const churnMetrics = dashboardMetrics?.churn || {};
    const sessionMetrics = dashboardMetrics?.sessions || {};
    const dateRange = dashboardMetrics?.dateRange || {};
    const trends = dashboardMetrics?.trends || [];
    const trendItineraryTotal = trends.reduce((total, item) => total + Number(item.itineraries || 0), 0);
    const generatedAt = dashboardMetrics?.generatedAt
      ? new Date(dashboardMetrics.generatedAt).toLocaleString()
      : '';

    const metricCards = [
      {
        key: 'total-users',
        title: 'Total Users',
        value: formatInteger(usersMetrics.totalUsers),
        subtitle: 'Registered accounts',
        icon: 'people-outline',
        accent: '#FF6B6B',
      },
      {
        key: 'dau',
        title: 'DAU',
        value: formatInteger(usersMetrics.dau),
        subtitle: 'Active in last 24h',
        icon: 'pulse-outline',
        accent: '#0EA5E9',
      },
      {
        key: 'wau',
        title: 'WAU',
        value: formatInteger(usersMetrics.wau),
        subtitle: 'Active in last 7 days',
        icon: 'calendar-outline',
        accent: '#8B5CF6',
      },
      {
        key: 'mau',
        title: 'MAU',
        value: formatInteger(usersMetrics.mau),
        subtitle: 'Active in last 30 days',
        icon: 'trending-up-outline',
        accent: '#14B8A6',
      },
      {
        key: 'stickiness',
        title: 'DAU / MAU Stickiness',
        value: formatPercent(usersMetrics.dauMauStickinessPercent),
        subtitle: 'Daily engagement quality',
        icon: 'flash-outline',
        accent: '#FF8E53',
      },
      {
        key: 'churn',
        title: 'Monthly Churn Rate',
        value: formatPercent(churnMetrics.monthlyRatePercent),
        subtitle: churnMetrics.isHealthy ? 'Healthy (<10%)' : 'Needs attention',
        icon: 'speedometer-outline',
        accent: churnMetrics.isHealthy ? '#10B981' : '#DC2626',
      },
      {
        key: 'avg-session',
        title: 'Avg Session Time',
        value: formatDuration(sessionMetrics.averageDurationSeconds),
        subtitle: 'Rolling 30-day average',
        icon: 'time-outline',
        accent: '#1E3A6E',
      },
    ];

    return (
      <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
        <View style={styles.screenContent}>
          <ScreenTopBar activeRoute="Account" styles={styles} />
          <View style={[styles.screenBody, adminStyles.adminScreenBody]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={adminStyles.scrollContent}>
              <View style={adminStyles.heroCard}>
                <View style={adminStyles.heroTopRow}>
                  <View style={adminStyles.heroBadge}>
                    <Ionicons name="shield-checkmark-outline" size={12} color="#0F2044" />
                    <Text style={adminStyles.heroBadgeText}>TripZo Admin</Text>
                  </View>
                  {!!generatedAt && <Text style={adminStyles.lastUpdated}>Updated {generatedAt}</Text>}
                </View>
                <Text style={adminStyles.heroTitle}>Analytics Dashboard</Text>
                <Text style={adminStyles.heroSubtitle}>Live product, growth and engagement metrics.</Text>
                <View style={adminStyles.heroActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={adminStyles.refreshButton}
                    onPress={() => loadDashboardMetrics({ silent: true })}
                    disabled={isDashboardRefreshing}
                  >
                    {isDashboardRefreshing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={14} color="#FFFFFF" />
                        <Text style={adminStyles.refreshButtonText}>Refresh</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={adminStyles.csvButton}
                    onPress={handleExportCsv}
                    disabled={isExportingCsv}
                  >
                    {isExportingCsv ? (
                      <ActivityIndicator size="small" color="#0F2044" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={14} color="#0F2044" />
                        <Text style={adminStyles.csvButtonText}>Export</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={adminStyles.rangeRow}>
                  {[7, 30, 90].map((range) => {
                    const active = selectedRangeDays === range;
                    return (
                      <TouchableOpacity
                        key={`range-${range}`}
                        activeOpacity={0.9}
                        style={[adminStyles.rangeChip, active && adminStyles.rangeChipActive]}
                        onPress={() => handleRangeChange(range)}
                      >
                        <Text style={[adminStyles.rangeChipText, active && adminStyles.rangeChipTextActive]}>
                          Last {range}d
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!!dateRange?.from && !!dateRange?.to && (
                  <Text style={adminStyles.rangeCaption}>
                    Range: {dateRange.from} to {dateRange.to}
                  </Text>
                )}
              </View>

              {isDashboardLoading ? (
                <View style={adminStyles.loaderWrap}>
                  <SkeletonBlock style={adminStyles.adminSkeletonHero} />
                  <SkeletonBlock style={adminStyles.adminSkeletonMetric} />
                  <SkeletonBlock style={adminStyles.adminSkeletonMetric} />
                </View>
              ) : (
                <>
                  {!!dashboardError && <Text style={styles.accountError}>{dashboardError}</Text>}

                  <View style={adminStyles.metricsGrid}>
                    {metricCards.map((card) => (
                      <View key={card.key} style={adminStyles.metricCard}>
                        <View style={[adminStyles.metricIconWrap, { backgroundColor: `${card.accent}22` }]}>
                          <Ionicons name={card.icon} size={16} color={card.accent} />
                        </View>
                        <Text style={adminStyles.metricTitle}>{card.title}</Text>
                        <Text style={adminStyles.metricValue}>{card.value}</Text>
                        <Text style={adminStyles.metricSubtitle}>{card.subtitle}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={adminStyles.summaryRow}>
                    <View style={adminStyles.summaryCard}>
                      <Text style={adminStyles.summaryLabel}>Itineraries Generated</Text>
                      <View style={adminStyles.summaryStatsRow}>
                        <View style={adminStyles.summaryChip}>
                          <Text style={adminStyles.summaryChipLabel}>Daily</Text>
                          <Text style={adminStyles.summaryChipValue}>{formatInteger(itineraryMetrics.daily)}</Text>
                        </View>
                        <View style={adminStyles.summaryChip}>
                          <Text style={adminStyles.summaryChipLabel}>Weekly</Text>
                          <Text style={adminStyles.summaryChipValue}>{formatInteger(itineraryMetrics.weekly)}</Text>
                        </View>
                        <View style={adminStyles.summaryChip}>
                          <Text style={adminStyles.summaryChipLabel}>Monthly</Text>
                          <Text style={adminStyles.summaryChipValue}>{formatInteger(itineraryMetrics.monthly)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={adminStyles.trendsSection}>
                    <Text style={adminStyles.summaryLabel}>Trend Snapshot ({selectedRangeDays}d)</Text>
                    <View style={adminStyles.trendGrid}>
                      <TrendSparkCard
                        title="DAU"
                        value={formatInteger(usersMetrics.dau)}
                        data={trends.map((entry) => entry.dau)}
                        color="#0EA5E9"
                      />
                      <TrendSparkCard
                        title="WAU"
                        value={formatInteger(usersMetrics.wau)}
                        data={trends.map((entry) => entry.wau)}
                        color="#8B5CF6"
                      />
                      <TrendSparkCard
                        title="MAU"
                        value={formatInteger(usersMetrics.mau)}
                        data={trends.map((entry) => entry.mau)}
                        color="#14B8A6"
                      />
                      <TrendSparkCard
                        title="Itineraries"
                        value={formatInteger(trendItineraryTotal)}
                        data={trends.map((entry) => entry.itineraries)}
                        color="#FF8E53"
                      />
                    </View>
                  </View>
                </>
              )}

              <TouchableOpacity activeOpacity={0.9} style={styles.accountLogoutBtn} onPress={onLogout}>
                <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
                <Text style={styles.accountLogoutText}>Logout Account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const displayAvatar = profile?.profileImageUrl || ACCOUNT_PROFILE.avatar;
  const displayName = profile?.fullName || ACCOUNT_PROFILE.name;
  const displayUsername = profile?.username ? `@${profile.username}` : ACCOUNT_PROFILE.username;
  const displayEmail = profile?.email || user?.email || ACCOUNT_PROFILE.email;

  return (
    <SafeAreaView style={styles.screenSafe} edges={['left', 'right']}>
      <View style={styles.screenContent}>
        <ScreenTopBar activeRoute="Account" styles={styles} />
        <View style={styles.screenBody}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.accountScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.accountProfileWrap}>
              <View style={styles.accountAvatarGradient}>
                <View style={styles.accountAvatarInner}>
                  <Image source={{ uri: displayAvatar }} style={styles.accountAvatarImage} resizeMode="cover" />
                </View>
              </View>
              <TouchableOpacity activeOpacity={0.9} style={styles.accountEditAvatarBtn} onPress={pickProfileImage}>
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#FF6B6B" />
                ) : (
                  <Ionicons name="camera-outline" size={14} color="#FF6B6B" />
                )}
              </TouchableOpacity>
              <Text style={styles.accountName}>{displayName}</Text>
              <Text style={styles.accountUsername}>{displayUsername}</Text>
            </View>

            <View style={styles.accountSection}>
              <Text style={styles.accountSectionHeading}>Personal Information</Text>
              <View style={styles.accountCard}>
                <View style={[styles.accountRow, styles.accountRowBorder]}>
                  <View style={styles.accountRowIconWrap}>
                    <Ionicons name="person-outline" size={18} color="#FF6B6B" />
                  </View>
                  <View style={styles.accountRowBody}>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter your full name"
                      placeholderTextColor="#94A3B8"
                      style={styles.accountInput}
                    />
                  </View>
                </View>

                <View style={styles.accountRow}>
                  <View style={styles.accountRowIconWrap}>
                    <Ionicons name="mail-outline" size={18} color="#FF6B6B" />
                  </View>
                  <View style={styles.accountRowBody}>
                    <Text style={styles.accountRowLabel}>Email Address</Text>
                    <Text style={styles.accountRowValue}>{displayEmail}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.accountSection}>
              <Text style={styles.accountSectionHeading}>Security & Privacy</Text>
              <View style={styles.accountCard}>
                <View style={[styles.accountRow, styles.accountRowBorder]}>
                  <View style={styles.accountRowIconWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color="#FF6B6B" />
                  </View>
                  <View style={styles.accountRowBody}>
                    <Text style={styles.accountRowLabel}>Password</Text>
                    <Text style={styles.accountRowValue}>••••••••••••</Text>
                  </View>
                  
                </View>

                <View style={styles.accountRow}>
                  <View style={styles.accountRowIconWrap}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#FF6B6B" />
                  </View>
                  <View style={styles.accountRowBody}>
                    <TextInput
                      value={securityQuestion}
                      onChangeText={setSecurityQuestion}
                      placeholder="Security question (e.g. What was your first pet's name?)"
                      placeholderTextColor="#94A3B8"
                      style={styles.accountInput}
                    />
                    <TextInput
                      value={securityAnswer}
                      onChangeText={setSecurityAnswer}
                      placeholder={
                        securityQuestion.trim() ? 'Security answer (only you know)' : 'Enter a security question first'
                      }
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                      style={[styles.accountInput, styles.securityAnswerInput]}
                    />
                  </View>
                </View>
              </View>
            </View>

            {!!error && <Text style={styles.accountError}>{error}</Text>}
            {!!success && <Text style={styles.accountSuccess}>{success}</Text>}

            <View style={styles.accountActions}>
              <TouchableOpacity activeOpacity={0.9} style={styles.accountSaveBtn} onPress={saveProfile} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.accountSaveText}>Save Profile</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} style={styles.accountLogoutBtn} onPress={onLogout}>
                <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
                <Text style={styles.accountLogoutText}>Logout Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.accountDeleteBtn, isDeleting && styles.accountDeleteDisabled]}
                onPress={confirmDeleteAccount}
                disabled={isDeleting}
              >
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                <Text style={styles.accountDeleteText}>{isDeleting ? 'Deleting...' : 'Delete Account'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function formatInteger(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : '0';
}

function formatPercent(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return '0%';
  }
  return `${parsed.toFixed(2)}%`;
}

function formatDuration(seconds) {
  const parsed = Number(seconds || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '0m';
  }

  const minutes = Math.round(parsed / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes > 0 ? `${hours}h ${remainderMinutes}m` : `${hours}h`;
}

function toCsvCell(value) {
  const raw = String(value ?? '');
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

function TrendSparkCard({ title, value, data, color }) {
  return (
    <View style={adminStyles.trendCard}>
      <Text style={adminStyles.trendTitle}>{title}</Text>
      <Text style={adminStyles.trendValue}>{value}</Text>
      <MiniSparkline data={data} color={color} />
    </View>
  );
}

function MiniSparkline({ data, color }) {
  const width = 120;
  const height = 46;
  const validData = Array.isArray(data) && data.length ? data : [0];
  const normalized = validData.map((value) => Number(value || 0));
  const max = Math.max(...normalized, 1);
  const min = Math.min(...normalized, 0);
  const range = Math.max(1, max - min);
  const stepX = normalized.length > 1 ? width / (normalized.length - 1) : width;

  const points = normalized
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={adminStyles.sparklineWrap}>
      <Svg width={width} height={height}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const accountSkeletonStyles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 140,
  },
  shimmerGradient: {
    flex: 1,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  name: {
    marginTop: 12,
    width: 180,
    height: 20,
    borderRadius: 8,
  },
  username: {
    marginTop: 8,
    width: 130,
    height: 14,
    borderRadius: 8,
  },
  card: {
    width: '100%',
    minHeight: 132,
    borderRadius: 16,
  },
  action: {
    width: '100%',
    height: 50,
    borderRadius: 12,
  },
});

const adminStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 28,
    gap: 14,
  },
  adminScreenBody: {
    paddingHorizontal: 0,
  },
  heroCard: {
    marginTop: 16,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6EDF7',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroBadge: {
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroBadgeText: {
    color: '#0F2044',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    marginTop: 8,
    color: '#0F2044',
    fontSize: 28,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 6,
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  refreshButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0F2044',
    height: 40,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  csvButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DCE5F2',
    height: 40,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  csvButtonText: {
    color: '#0F2044',
    fontSize: 13,
    fontWeight: '700',
  },
  rangeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  rangeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#DCE5F2',
    backgroundColor: '#F8FAFD',
  },
  rangeChipActive: {
    backgroundColor: '#0F2044',
    borderColor: '#0F2044',
  },
  rangeChipText: {
    color: '#0F2044',
    fontSize: 12,
    fontWeight: '700',
  },
  rangeChipTextActive: {
    color: '#FFFFFF',
  },
  lastUpdated: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  rangeCaption: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 11,
  },
  loaderWrap: {
    gap: 12,
  },
  adminSkeletonHero: {
    width: '100%',
    height: 160,
    borderRadius: 16,
  },
  adminSkeletonMetric: {
    width: '100%',
    height: 118,
    borderRadius: 16,
  },
  metricsGrid: {
    flexDirection: 'column',
    gap: 10,
  },
  metricCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 116,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 6,
    color: '#0F2044',
    fontSize: 30,
    fontWeight: '800',
  },
  metricSubtitle: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 12,
  },
  summaryRow: {
    marginTop: 2,
  },
  trendsSection: {
    marginTop: 2,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 14,
  },
  trendGrid: {
    marginTop: 12,
    flexDirection: 'column',
    gap: 8,
  },
  trendCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    backgroundColor: '#F8FAFD',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  trendTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  trendValue: {
    marginTop: 4,
    color: '#0F2044',
    fontSize: 18,
    fontWeight: '800',
  },
  sparklineWrap: {
    marginTop: 7,
    borderRadius: 8,
    overflow: 'hidden',
  },
  summaryCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 14,
  },
  summaryLabel: {
    color: '#0F2044',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryStatsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  summaryChip: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E8EEF7',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryChipLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryChipValue: {
    marginTop: 5,
    color: '#0F2044',
    fontSize: 18,
    fontWeight: '800',
  },
});



