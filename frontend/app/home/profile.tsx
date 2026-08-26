import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme, ThemePalette } from '@/src/contexts/ThemeContext';
import { api } from '@/src/utils/api';
import { useRouter } from 'expo-router';

// Preset color choices for the custom theme picker (bright & aesthetic)
const COLOR_PRESETS = [
  '#FF6B9D', '#FFA07A', '#C766EF', '#9B4DFF', '#4E78FF', '#6B5EFF',
  '#43E97B', '#38F9D7', '#00C6FB', '#005BEA', '#F953C6', '#B91D73',
  '#FBC2EB', '#A6C1EE', '#FDCBF1', '#FF9966', '#FF5E62', '#11998E',
  '#38EF7D', '#FC466B', '#3F5EFB', '#8E2DE2', '#4A00E0', '#F6D365',
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { theme, setTheme, allThemes, addCustomTheme, setCustomThemes } = useTheme();
  const router = useRouter();
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🎨');
  const [primaryColor, setPrimaryColor] = useState('#FF6B9D');
  const [secondaryColor, setSecondaryColor] = useState('#C766EF');
  const [gradientStart, setGradientStart] = useState('#FF6B9D');
  const [gradientEnd, setGradientEnd] = useState('#C766EF');
  const [activeColorSelect, setActiveColorSelect] = useState<'primary' | 'secondary' | 'gradStart' | 'gradEnd'>('primary');

  // Load custom themes from backend
  const loadCustomThemes = useCallback(async () => {
    try {
      const backendThemes: any = await api.getCustomThemes();
      const mapped: ThemePalette[] = backendThemes.map((t: any) => ({
        id: t.theme_id,
        name: t.name,
        emoji: t.emoji || '🎨',
        gradient: [t.gradient_start, t.gradient_end],
        primary: t.primary,
        secondary: t.secondary,
        tasksGradient: [t.gradient_start, t.gradient_end],
        habitsGradient: [t.secondary, t.primary],
        timeGradient: [t.primary, t.secondary],
        profileGradient: [t.gradient_end, t.gradient_start],
        loginGradient: [t.gradient_start, t.primary, t.gradient_end],
      }));
      setCustomThemes(mapped);
    } catch (e) {
      console.warn('Failed to load custom themes:', e);
    }
  }, [setCustomThemes]);

  useEffect(() => {
    loadCustomThemes();
  }, [loadCustomThemes]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleCreateCustomTheme = async () => {
    if (!customName.trim()) {
      Alert.alert('Error', 'Please enter a theme name');
      return;
    }
    try {
      const newTheme: any = await api.createCustomTheme({
        name: customName,
        emoji: customEmoji,
        primary: primaryColor,
        secondary: secondaryColor,
        gradient_start: gradientStart,
        gradient_end: gradientEnd,
      });
      const palette: ThemePalette = {
        id: newTheme.theme_id,
        name: newTheme.name,
        emoji: newTheme.emoji || '🎨',
        gradient: [gradientStart, gradientEnd],
        primary: primaryColor,
        secondary: secondaryColor,
        tasksGradient: [gradientStart, gradientEnd],
        habitsGradient: [secondaryColor, primaryColor],
        timeGradient: [primaryColor, secondaryColor],
        profileGradient: [gradientEnd, gradientStart],
        loginGradient: [gradientStart, primaryColor, gradientEnd],
      };
      addCustomTheme(palette);
      setTheme(palette.id);
      setCustomName('');
      setShowCustomThemeModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save custom theme');
    }
  };

  const handleColorPick = (color: string) => {
    if (activeColorSelect === 'primary') setPrimaryColor(color);
    else if (activeColorSelect === 'secondary') setSecondaryColor(color);
    else if (activeColorSelect === 'gradStart') setGradientStart(color);
    else if (activeColorSelect === 'gradEnd') setGradientEnd(color);
  };

  const getActiveColor = () => {
    if (activeColorSelect === 'primary') return primaryColor;
    if (activeColorSelect === 'secondary') return secondaryColor;
    if (activeColorSelect === 'gradStart') return gradientStart;
    return gradientEnd;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.profileGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Profile</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImagePlaceholder, { backgroundColor: theme.primary }]}>
              <Ionicons name="person" size={48} color="#FFFFFF" />
            </View>
          )}
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>

        {/* Theme Picker Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="color-palette" size={24} color={theme.primary} />
              <Text style={styles.sectionTitle}>Color Theme</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAllThemes(!showAllThemes)}>
              <Text style={[styles.showAllText, { color: theme.primary }]}>
                {showAllThemes ? 'Show Less' : 'View All'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionSubtitle}>
            Currently using: {theme.emoji} {theme.name}
          </Text>

          <View style={styles.themesGrid}>
            {(showAllThemes ? allThemes : allThemes.slice(0, 4)).map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.themeCardWrapper}
                onPress={() => setTheme(t.id)}
                testID={`theme-${t.id}`}
              >
                <LinearGradient
                  colors={t.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.themeCard,
                    theme.id === t.id && styles.themeCardSelected,
                  ]}
                >
                  {theme.id === t.id && (
                    <View style={styles.themeCheckmark}>
                      <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                    </View>
                  )}
                  <Text style={styles.themeEmoji}>{t.emoji}</Text>
                  <Text style={styles.themeName}>{t.name}</Text>
                  <View style={styles.themeColorDots}>
                    <View style={[styles.themeColorDot, { backgroundColor: t.primary }]} />
                    <View style={[styles.themeColorDot, { backgroundColor: t.secondary }]} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Create Custom Theme Button */}
          <TouchableOpacity
            style={[styles.createThemeBtn, { borderColor: theme.primary }]}
            onPress={() => setShowCustomThemeModal(true)}
            testID="create-custom-theme"
          >
            <Ionicons name="add-circle" size={24} color={theme.primary} />
            <Text style={[styles.createThemeBtnText, { color: theme.primary }]}>
              Create Custom Theme
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About TaskFlow Life</Text>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="calendar" size={24} color={theme.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Daily Tasks & Calendar</Text>
              <Text style={styles.featureDescription}>
                Organize your daily tasks with an intuitive calendar view. Set reminders and repeat
                patterns for recurring tasks.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: theme.secondary + '20' }]}>
              <Ionicons name="trophy" size={24} color={theme.secondary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Monthly & Yearly Goals</Text>
              <Text style={styles.featureDescription}>
                Set and track your monthly and yearly goals. Stay focused on what matters most.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: theme.secondary + '20' }]}>
              <Ionicons name="flame" size={24} color={theme.secondary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Habit Tracker</Text>
              <Text style={styles.featureDescription}>
                Build better habits with visual progress tracking. See your streaks and completion
                rates at a glance.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="book" size={24} color={theme.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Books Reading List</Text>
              <Text style={styles.featureDescription}>
                Track books you&apos;re reading and have completed. Build your personal library.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="time" size={24} color={theme.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Time Entry & Analytics</Text>
              <Text style={styles.featureDescription}>
                Log how you spend your time. Categorize activities and export data to Excel for
                analysis.
              </Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="cloud-done" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>All data synced to cloud</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>Secure authentication with Google</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>Works across all your devices</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} testID="logout-button">
          <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Custom Theme Creator Modal */}
      <Modal
        visible={showCustomThemeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customThemeModal}>
            <View style={styles.customThemeHeader}>
              <Text style={styles.customThemeTitle}>Create Your Theme</Text>
              <TouchableOpacity onPress={() => setShowCustomThemeModal(false)}>
                <Ionicons name="close" size={28} color="#333333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Preview */}
              <LinearGradient
                colors={[gradientStart, gradientEnd]}
                style={styles.themePreview}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.themePreviewEmoji}>{customEmoji || '🎨'}</Text>
                <Text style={styles.themePreviewName}>{customName || 'My Theme'}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={[styles.themeColorDot, { backgroundColor: primaryColor }]} />
                  <View style={[styles.themeColorDot, { backgroundColor: secondaryColor }]} />
                </View>
              </LinearGradient>

              {/* Name */}
              <Text style={styles.customThemeLabel}>Theme Name</Text>
              <TextInput
                style={styles.customThemeInput}
                placeholder="e.g., My Vibe"
                value={customName}
                onChangeText={setCustomName}
                testID="custom-theme-name"
              />

              {/* Emoji */}
              <Text style={styles.customThemeLabel}>Emoji</Text>
              <View style={styles.emojiRow}>
                {['🎨', '🌟', '💎', '🔥', '⚡', '🌈', '🌺', '🍁', '☀️', '🌙'].map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.emojiBtn,
                      customEmoji === e && { backgroundColor: primaryColor + '30', borderColor: primaryColor },
                    ]}
                    onPress={() => setCustomEmoji(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color role selector */}
              <Text style={styles.customThemeLabel}>Pick Colors</Text>
              <View style={styles.colorRoleRow}>
                {[
                  { key: 'primary', label: 'Primary', color: primaryColor },
                  { key: 'secondary', label: 'Secondary', color: secondaryColor },
                  { key: 'gradStart', label: 'Gradient A', color: gradientStart },
                  { key: 'gradEnd', label: 'Gradient B', color: gradientEnd },
                ].map((role) => (
                  <TouchableOpacity
                    key={role.key}
                    style={[
                      styles.colorRoleBtn,
                      activeColorSelect === role.key && styles.colorRoleBtnActive,
                    ]}
                    onPress={() => setActiveColorSelect(role.key as any)}
                  >
                    <View style={[styles.colorRoleDot, { backgroundColor: role.color }]} />
                    <Text
                      style={[
                        styles.colorRoleLabel,
                        activeColorSelect === role.key && styles.colorRoleLabelActive,
                      ]}
                    >
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color palette */}
              <View style={styles.colorPalette}>
                {COLOR_PRESETS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.paletteColor,
                      { backgroundColor: c },
                      getActiveColor() === c && styles.paletteColorSelected,
                    ]}
                    onPress={() => handleColorPick(c)}
                    testID={`palette-${c}`}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveThemeBtn, { backgroundColor: primaryColor }]}
                onPress={handleCreateCustomTheme}
                testID="save-custom-theme"
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveThemeBtnText}>Save & Apply Theme</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  createThemeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  createThemeBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  customThemeModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '90%',
  },
  customThemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  customThemeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
  },
  themePreview: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  themePreviewEmoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  themePreviewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  customThemeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    marginTop: 8,
  },
  customThemeInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiText: {
    fontSize: 22,
  },
  colorRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  colorRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  colorRoleBtnActive: {
    borderColor: '#333333',
  },
  colorRoleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  colorRoleLabel: {
    fontSize: 13,
    color: '#666666',
  },
  colorRoleLabelActive: {
    color: '#333333',
    fontWeight: '600',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paletteColor: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paletteColorSelected: {
    borderColor: '#333333',
    transform: [{ scale: 1.1 }],
  },
  saveThemeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 32,
    gap: 8,
  },
  saveThemeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 24,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#999999',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  showAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  themeCardWrapper: {
    width: '50%',
    padding: 6,
  },
  themeCard: {
    padding: 16,
    borderRadius: 16,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  themeCardSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  themeCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  themeEmoji: {
    fontSize: 32,
  },
  themeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  themeColorDots: {
    flexDirection: 'row',
    marginTop: 8,
  },
  themeColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  infoSection: {
    padding: 16,
    paddingTop: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
    marginLeft: 8,
  },
  version: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 32,
  },
});
