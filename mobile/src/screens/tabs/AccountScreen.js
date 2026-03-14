import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import ScreenTopBar from '../../navigation/components/ScreenTopBar';
import { getMe, updateProfile, uploadProfileImage } from '../../services/auth/authService';

const ACCOUNT_PROFILE = {
  name: 'Alex Coastal',
  username: '@alex_travels',
  email: 'alex.coastal@tripzo.com',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCH3W_7GJLfMHn090YaXxgjyfo5Bd3q7OlxoVAe_zgLV3b4TJNMAq33zAvrAT7c7wC7tuY5MKubJUaAiVMcvmI9lWoZ-XhUadE64z0vntlEZoRj_fUuGoi1IlFRBVi4TXcEE83IE6voCRbuLoSX376v4XxIrCszUtV30iKjCQPG0P_XQmOxgmbj-1vf6BnDcdj3VRUxcU5_gy0CWCLLSQeWIxvGG0Z33BAYdH0PhyXy12AsTl-9CN32f-mWoDVyx5xckD8OX9xxvn0s',
};

export default function AccountScreen({ user, onLogout, onDeleteAccount, styles }) {
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

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
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
            <ActivityIndicator size="large" color="#FF6B6B" />
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



