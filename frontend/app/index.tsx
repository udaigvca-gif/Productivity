import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTheme } from "@/src/contexts/ThemeContext";

export default function Index() {
  const { user, loading, login } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return (
    <LinearGradient
      colors={theme.loginGradient}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkbox" size={80} color="#FFFFFF" />
        </View>
        
        <Text style={styles.title}>TaskFlow Life</Text>
        <Text style={styles.subtitle}>
          Organize your tasks, track your habits, and achieve your goals
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="calendar" size={24} color="#FFFFFF" />
            <Text style={styles.featureText}>Daily Tasks & Calendar</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="trophy" size={24} color="#FFFFFF" />
            <Text style={styles.featureText}>Monthly & Yearly Goals</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="flame" size={24} color="#FFFFFF" />
            <Text style={styles.featureText}>Habit Tracker</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="time" size={24} color="#FFFFFF" />
            <Text style={styles.featureText}>Time Analytics</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={login}>
          <Ionicons name="logo-google" size={24} color={theme.primary} />
          <Text style={[styles.loginButtonText, { color: theme.primary }]}>Sign in with Google</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Your data syncs across all devices
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 48,
    opacity: 0.9,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 16,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  footerText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 24,
    opacity: 0.8,
  },
});
