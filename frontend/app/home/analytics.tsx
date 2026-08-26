import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { api } from '@/src/utils/api';
import { useTheme } from '@/src/contexts/ThemeContext';

interface Overview {
  tasks: {
    total: number;
    completed: number;
    today_total: number;
    today_completed: number;
    completion_rate: number;
  };
  habits: {
    total: number;
    completions_this_month: number;
  };
  books: {
    total: number;
    completed: number;
  };
  monthly_goals: {
    total: number;
    completed: number;
  };
}

interface TimeBreakdown {
  total_entries: number;
  by_category: { name: string; minutes: number }[];
  by_classification: { name: string; minutes: number }[];
}

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [breakdown, setBreakdown] = useState<TimeBreakdown | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const start = format(startOfMonth(now), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      const [ov, br] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getTimeBreakdown(start, end),
      ]);
      setOverview(ov as Overview);
      setBreakdown(br as TimeBreakdown);
    } catch (e) {
      console.error('Analytics load error', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const getClassificationColor = (classification: string) => {
    const lower = classification.toLowerCase();
    if (lower.includes('non-productive') || lower.includes('non productive')) return '#FF6B6B';
    if (lower.includes('productive')) return '#4CAF50';
    return '#FFA500';
  };

  const totalCategoryMins =
    breakdown?.by_category.reduce((s, c) => s + c.minutes, 0) || 0;
  const totalClassMins =
    breakdown?.by_classification.reduce((s, c) => s + c.minutes, 0) || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.gradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Your productivity insights</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Overview Cards */}
        {overview && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderLeftColor: theme.primary }]}>
                <Ionicons name="checkbox" size={28} color={theme.primary} />
                <Text style={styles.statValue}>{overview.tasks.completed}/{overview.tasks.total}</Text>
                <Text style={styles.statLabel}>Tasks Completed</Text>
                <Text style={[styles.statSubtext, { color: theme.primary }]}>
                  {overview.tasks.completion_rate.toFixed(0)}% completion
                </Text>
              </View>

              <View style={[styles.statCard, { borderLeftColor: theme.secondary }]}>
                <Ionicons name="today" size={28} color={theme.secondary} />
                <Text style={styles.statValue}>
                  {overview.tasks.today_completed}/{overview.tasks.today_total}
                </Text>
                <Text style={styles.statLabel}>Today&apos;s Tasks</Text>
                <Text style={[styles.statSubtext, { color: theme.secondary }]}>
                  {overview.tasks.today_total > 0
                    ? `${((overview.tasks.today_completed / overview.tasks.today_total) * 100).toFixed(0)}% done`
                    : 'Nothing pending'}
                </Text>
              </View>

              <View style={[styles.statCard, { borderLeftColor: '#4CAF50' }]}>
                <Ionicons name="flame" size={28} color="#4CAF50" />
                <Text style={styles.statValue}>{overview.habits.completions_this_month}</Text>
                <Text style={styles.statLabel}>Habit Check-ins</Text>
                <Text style={[styles.statSubtext, { color: '#4CAF50' }]}>
                  This month
                </Text>
              </View>

              <View style={[styles.statCard, { borderLeftColor: '#FF6B9D' }]}>
                <Ionicons name="book" size={28} color="#FF6B9D" />
                <Text style={styles.statValue}>{overview.books.completed}/{overview.books.total}</Text>
                <Text style={styles.statLabel}>Books Read</Text>
                <Text style={[styles.statSubtext, { color: '#FF6B9D' }]}>
                  {overview.books.total > 0
                    ? `${((overview.books.completed / overview.books.total) * 100).toFixed(0)}%`
                    : 'Start reading!'}
                </Text>
              </View>

              <View style={[styles.statCard, { borderLeftColor: '#FFA500' }]}>
                <Ionicons name="trophy" size={28} color="#FFA500" />
                <Text style={styles.statValue}>
                  {overview.monthly_goals.completed}/{overview.monthly_goals.total}
                </Text>
                <Text style={styles.statLabel}>Monthly Goals</Text>
                <Text style={[styles.statSubtext, { color: '#FFA500' }]}>
                  {format(new Date(), 'MMMM')}
                </Text>
              </View>

              <View style={[styles.statCard, { borderLeftColor: '#4E78FF' }]}>
                <Ionicons name="time" size={28} color="#4E78FF" />
                <Text style={styles.statValue}>{breakdown?.total_entries || 0}</Text>
                <Text style={styles.statLabel}>Time Entries</Text>
                <Text style={[styles.statSubtext, { color: '#4E78FF' }]}>
                  This month
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Time Breakdown by Classification */}
        {breakdown && breakdown.by_classification.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time by Classification</Text>
            <Text style={styles.sectionSubtitle}>
              Total: {formatDuration(totalClassMins)}
            </Text>
            {breakdown.by_classification
              .sort((a, b) => b.minutes - a.minutes)
              .map((c) => {
                const pct = totalClassMins > 0 ? (c.minutes / totalClassMins) * 100 : 0;
                const color = getClassificationColor(c.name);
                return (
                  <View key={c.name} style={styles.barRow}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>{c.name}</Text>
                      <Text style={[styles.barValue, { color }]}>
                        {formatDuration(c.minutes)} ({pct.toFixed(0)}%)
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {/* Time Breakdown by Category */}
        {breakdown && breakdown.by_category.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time by Category</Text>
            <Text style={styles.sectionSubtitle}>
              Total: {formatDuration(totalCategoryMins)}
            </Text>
            {breakdown.by_category
              .sort((a, b) => b.minutes - a.minutes)
              .map((c, idx) => {
                const pct = totalCategoryMins > 0 ? (c.minutes / totalCategoryMins) * 100 : 0;
                const colors = [theme.primary, theme.secondary, '#4CAF50', '#FF6B9D', '#FFA500', '#4E78FF'];
                const color = colors[idx % colors.length];
                return (
                  <View key={c.name} style={styles.barRow}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>{c.name}</Text>
                      <Text style={[styles.barValue, { color }]}>
                        {formatDuration(c.minutes)} ({pct.toFixed(0)}%)
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {(!breakdown || breakdown.total_entries === 0) && (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color="#CCCCCC" />
            <Text style={styles.emptyStateText}>No time entries this month</Text>
            <Text style={styles.emptyStateSubtext}>
              Add entries in the Time Entry tab to see analytics
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    width: (screenWidth - 44) / 2,
    marginHorizontal: 6,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  statSubtext: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  barRow: {
    marginBottom: 16,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  barValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  barTrack: {
    height: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
