import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/utils/api';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';

interface Task {
  task_id: string;
  title: string;
  completed: boolean;
  date: string;
  reminder_time?: string;
  repeat_pattern?: string;
  is_habit?: boolean;
  habit_id?: string;
  is_recurring_instance?: boolean;
  original_date?: string;
}

interface MonthlyGoal {
  goal_id: string;
  title: string;
  completed: boolean;
  month: string;
}

interface YearlyGoal {
  goal_id: string;
  title: string;
  completed: boolean;
  year: string;
}

interface SearchResults {
  query: string;
  tasks: any[];
  monthly_goals: any[];
  yearly_goals: any[];
  habits: any[];
  books: any[];
  time_entries: any[];
  total: number;
}

export default function TasksScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [yearlyGoals, setYearlyGoals] = useState<YearlyGoal[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMonthlyGoalModal, setShowMonthlyGoalModal] = useState(false);
  const [showYearlyGoalModal, setShowYearlyGoalModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [repeatPattern, setRepeatPattern] = useState<string>('');
  const [reminderTime, setReminderTime] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'week' | 'monthly' | 'yearly'>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate, viewMode]);

  // Real-time cross-device sync via polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedDate, viewMode]);

  const loadData = async () => {
    try {
      if (viewMode === 'calendar') {
        const tasksData = await api.getTasks(selectedDate);
        setTasks(tasksData as Task[]);
      } else if (viewMode === 'week') {
        const weekStart = format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekData = await api.getTasksWeek(weekStart);
        setWeekTasks(weekData as Task[]);
      } else if (viewMode === 'monthly') {
        const month = format(new Date(selectedDate), 'yyyy-MM');
        const goalsData = await api.getMonthlyGoals(month);
        setMonthlyGoals(goalsData as MonthlyGoal[]);
      } else if (viewMode === 'yearly') {
        const year = format(new Date(selectedDate), 'yyyy');
        const goalsData = await api.getYearlyGoals(year);
        setYearlyGoals(goalsData as YearlyGoal[]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await api.search(q);
      setSearchResults(results as SearchResults);
    } catch (e) {
      console.error('Search error', e);
    } finally {
      setSearching(false);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      const newTask = {
        user_id: user?.user_id,
        title: newTaskTitle,
        date: selectedDate,
        completed: false,
        repeat_pattern: repeatPattern || undefined,
        reminder_time: reminderTime || undefined,
      };

      const created: any = await api.createTask(newTask);
      // Send push notification if reminder time is set (best-effort)
      if (reminderTime && created?.task_id) {
        try {
          await api.sendTaskReminder(created.task_id, newTaskTitle);
        } catch (e) {
          console.warn('Reminder push failed (non-blocking):', e);
        }
      }
      setNewTaskTitle('');
      setRepeatPattern('');
      setReminderTime('');
      setShowTaskModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding task:', error);
      Alert.alert('Error', 'Failed to add task');
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      if (task.is_habit && task.habit_id) {
        await api.logHabit(task.habit_id, task.date, !task.completed);
      } else if (task.is_recurring_instance || task.repeat_pattern) {
        // Per-occurrence toggle — backend writes a completion override for this date
        await api.updateTask(task.task_id, { completed: !task.completed, date: task.date });
      } else {
        await api.updateTask(task.task_id, { completed: !task.completed });
      }
      loadData();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = (task: Task) => {
    if (task.repeat_pattern || task.is_recurring_instance) {
      Alert.alert(
        'Delete Recurring Task',
        'Do you want to skip just this day or delete the entire series?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Skip this day',
            onPress: async () => {
              try {
                await api.deleteTask(task.task_id, 'single', task.date);
                loadData();
              } catch (error) {
                console.error('Error skipping task:', error);
              }
            },
          },
          {
            text: 'Delete entire series',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteTask(task.task_id, 'series');
                loadData();
              } catch (error) {
                console.error('Error deleting task:', error);
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('Delete Task', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteTask(task.task_id);
              loadData();
            } catch (error) {
              console.error('Error deleting task:', error);
            }
          },
        },
      ]);
    }
  };

  const handleAddMonthlyGoal = async () => {
    if (!newGoalTitle.trim()) return;

    try {
      const month = format(new Date(selectedDate), 'yyyy-MM');
      await api.createMonthlyGoal({
        user_id: user?.user_id,
        title: newGoalTitle,
        month,
        completed: false,
      });
      setNewGoalTitle('');
      setShowMonthlyGoalModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const handleToggleMonthlyGoal = async (goal: MonthlyGoal) => {
    try {
      await api.updateMonthlyGoal(goal.goal_id, { completed: !goal.completed });
      loadData();
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  const handleDeleteMonthlyGoal = async (goalId: string) => {
    try {
      await api.deleteMonthlyGoal(goalId);
      loadData();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleAddYearlyGoal = async () => {
    if (!newGoalTitle.trim()) return;

    try {
      const year = format(new Date(selectedDate), 'yyyy');
      await api.createYearlyGoal({
        user_id: user?.user_id,
        title: newGoalTitle,
        year,
        completed: false,
      });
      setNewGoalTitle('');
      setShowYearlyGoalModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const handleToggleYearlyGoal = async (goal: YearlyGoal) => {
    try {
      await api.updateYearlyGoal(goal.goal_id, { completed: !goal.completed });
      loadData();
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  const handleDeleteYearlyGoal = async (goalId: string) => {
    try {
      await api.deleteYearlyGoal(goalId);
      loadData();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const renderTaskItem = (task: Task) => (
    <View key={task.task_id + (task.is_recurring_instance ? '_' + task.date : '')} style={styles.taskItem}>
      <TouchableOpacity
        style={styles.taskCheckbox}
        onPress={() => handleToggleTask(task)}
      >
        <Ionicons
          name={task.completed ? 'checkbox' : 'square-outline'}
          size={28}
          color={task.completed ? '#4CAF50' : '#999999'}
        />
      </TouchableOpacity>
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, task.completed && styles.taskCompleted]}>
          {task.title}
        </Text>
        {task.is_habit && (
          <Text style={[styles.taskMeta, { color: theme.secondary }]}>
            <Ionicons name="flame" size={12} /> Linked habit
          </Text>
        )}
        {task.repeat_pattern && (
          <Text style={styles.taskMeta}>
            <Ionicons name="repeat" size={12} /> {task.repeat_pattern}
          </Text>
        )}
        {task.is_recurring_instance && !task.repeat_pattern && (
          <Text style={styles.taskMeta}>
            <Ionicons name="repeat" size={12} /> recurring
          </Text>
        )}
        {task.reminder_time && (
          <Text style={styles.taskMeta}>
            <Ionicons name="alarm" size={12} /> {task.reminder_time}
          </Text>
        )}
      </View>
      {!task.is_habit && (
        <TouchableOpacity onPress={() => handleDeleteTask(task)}>
          <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderGoalItem = (goal: MonthlyGoal | YearlyGoal, isMonthly: boolean) => (
    <View key={goal.goal_id} style={styles.taskItem}>
      <TouchableOpacity
        style={styles.taskCheckbox}
        onPress={() =>
          isMonthly
            ? handleToggleMonthlyGoal(goal as MonthlyGoal)
            : handleToggleYearlyGoal(goal as YearlyGoal)
        }
      >
        <Ionicons
          name={goal.completed ? 'checkbox' : 'square-outline'}
          size={28}
          color={goal.completed ? '#4CAF50' : '#999999'}
        />
      </TouchableOpacity>
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, goal.completed && styles.taskCompleted]}>
          {goal.title}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() =>
          isMonthly
            ? handleDeleteMonthlyGoal(goal.goal_id)
            : handleDeleteYearlyGoal(goal.goal_id)
        }
      >
        <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.tasksGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {viewMode === 'calendar'
                ? 'Daily Tasks'
                : viewMode === 'week'
                ? 'Week View'
                : viewMode === 'monthly'
                ? 'Monthly Goals'
                : 'Yearly Goals'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {viewMode === 'calendar' && format(new Date(selectedDate), 'EEEE, MMM d, yyyy')}
              {viewMode === 'week' && `Week of ${format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'MMM d')}`}
              {viewMode === 'monthly' && format(new Date(selectedDate), 'MMMM yyyy')}
              {viewMode === 'yearly' && format(new Date(selectedDate), 'yyyy')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.searchIconBtn}
            onPress={() => setShowSearchModal(true)}
            testID="search-open-button"
          >
            <Ionicons name="search" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* View Mode Selector - Horizontal scroll for 4 tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.viewModeScrollWrap}
        contentContainerStyle={styles.viewModeContainer}
      >
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'calendar' && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode('calendar')}
          testID="viewmode-daily"
        >
          <Ionicons name="calendar" size={18} color={viewMode === 'calendar' ? '#FFFFFF' : '#666666'} />
          <Text style={[styles.viewModeText, viewMode === 'calendar' && styles.viewModeTextActive]}>Daily</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'week' && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode('week')}
          testID="viewmode-week"
        >
          <Ionicons name="calendar-clear" size={18} color={viewMode === 'week' ? '#FFFFFF' : '#666666'} />
          <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'monthly' && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode('monthly')}
          testID="viewmode-monthly"
        >
          <Ionicons name="calendar-number" size={18} color={viewMode === 'monthly' ? '#FFFFFF' : '#666666'} />
          <Text style={[styles.viewModeText, viewMode === 'monthly' && styles.viewModeTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'yearly' && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode('yearly')}
          testID="viewmode-yearly"
        >
          <Ionicons name="trophy" size={18} color={viewMode === 'yearly' ? '#FFFFFF' : '#666666'} />
          <Text style={[styles.viewModeText, viewMode === 'yearly' && styles.viewModeTextActive]}>Yearly</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {viewMode === 'calendar' && (
          <>
            <Calendar
              current={selectedDate}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  selectedColor: theme.primary,
                },
              }}
              theme={{
                todayTextColor: theme.primary,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: '#FFFFFF',
                arrowColor: theme.primary,
              }}
              style={styles.calendar}
            />

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Tasks for {format(new Date(selectedDate), 'MMM d')}
                </Text>
                <Text style={[styles.taskCount, { color: theme.primary }]}>
                  {tasks.filter((t) => t.completed).length}/{tasks.length}
                </Text>
              </View>

              {tasks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkbox-outline" size={48} color="#CCCCCC" />
                  <Text style={styles.emptyStateText}>No tasks for this day</Text>
                  <Text style={styles.emptyStateSubtext}>Tap + to add a new task</Text>
                </View>
              ) : (
                tasks.map(renderTaskItem)
              )}
            </View>
          </>
        )}

        {viewMode === 'week' && (
          <View style={styles.section}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const weekStart = startOfWeek(new Date(selectedDate), { weekStartsOn: 1 });
              const day = addDays(weekStart, i);
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayTasks = weekTasks.filter((t) => t.date === dayStr);
              const done = dayTasks.filter((t) => t.completed).length;
              return (
                <View key={dayStr} style={styles.weekDayBlock}>
                  <View style={styles.weekDayHeader}>
                    <View>
                      <Text style={styles.weekDayName}>{format(day, 'EEEE')}</Text>
                      <Text style={styles.weekDayDate}>{format(day, 'MMM d')}</Text>
                    </View>
                    <View style={[styles.weekDayBadge, { backgroundColor: theme.primary + '20' }]}>
                      <Text style={[styles.weekDayBadgeText, { color: theme.primary }]}>
                        {done}/{dayTasks.length}
                      </Text>
                    </View>
                  </View>
                  {dayTasks.length === 0 ? (
                    <Text style={styles.weekEmptyText}>No tasks</Text>
                  ) : (
                    dayTasks.map((task) => (
                      <View key={task.task_id} style={styles.weekTaskItem}>
                        <TouchableOpacity onPress={() => handleToggleTask(task)}>
                          <Ionicons
                            name={task.completed ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={task.completed ? '#4CAF50' : '#999999'}
                          />
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.weekTaskTitle,
                            task.completed && styles.taskCompleted,
                          ]}
                        >
                          {task.title}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        )}

        {viewMode === 'monthly' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Goals for {format(new Date(selectedDate), 'MMMM yyyy')}
              </Text>
              <Text style={[styles.taskCount, { color: theme.primary }]}>
                {monthlyGoals.filter((g) => g.completed).length}/{monthlyGoals.length}
              </Text>
            </View>

            {monthlyGoals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="flag-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyStateText}>No monthly goals set</Text>
                <Text style={styles.emptyStateSubtext}>Tap + to add a new goal</Text>
              </View>
            ) : (
              monthlyGoals.map((goal) => renderGoalItem(goal, true))
            )}
          </View>
        )}

        {viewMode === 'yearly' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Goals for {format(new Date(selectedDate), 'yyyy')}
              </Text>
              <Text style={[styles.taskCount, { color: theme.primary }]}>
                {yearlyGoals.filter((g) => g.completed).length}/{yearlyGoals.length}
              </Text>
            </View>

            {yearlyGoals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyStateText}>No yearly goals set</Text>
                <Text style={styles.emptyStateSubtext}>Tap + to add a new goal</Text>
              </View>
            ) : (
              yearlyGoals.map((goal) => renderGoalItem(goal, false))
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {viewMode !== 'week' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            if (viewMode === 'calendar') setShowTaskModal(true);
            else if (viewMode === 'monthly') setShowMonthlyGoalModal(true);
            else setShowYearlyGoalModal(true);
          }}
          testID="fab-add"
        >
          <LinearGradient colors={theme.tasksGradient} style={styles.fabGradient}>
            <Ionicons name="add" size={32} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Add Task Modal */}
      <Modal
        visible={showTaskModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTaskModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Task</Text>

            <TextInput
              style={styles.input}
              placeholder="Task title"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="Reminder time (HH:MM)"
              value={reminderTime}
              onChangeText={setReminderTime}
            />

            <Text style={styles.label}>Repeat</Text>
            <View style={styles.repeatOptions}>
              {['', 'daily', 'weekly', 'monthly'].map((pattern) => (
                <TouchableOpacity
                  key={pattern}
                  style={[
                    styles.repeatOption,
                    repeatPattern === pattern && [styles.repeatOptionActive, { backgroundColor: theme.primary }],
                  ]}
                  onPress={() => setRepeatPattern(pattern)}
                >
                  <Text
                    style={[
                      styles.repeatOptionText,
                      repeatPattern === pattern && styles.repeatOptionTextActive,
                    ]}
                  >
                    {pattern || 'None'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowTaskModal(false);
                  setNewTaskTitle('');
                  setRepeatPattern('');
                  setReminderTime('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd, { backgroundColor: theme.primary }]}
                onPress={handleAddTask}
              >
                <Text style={styles.modalButtonText}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Monthly Goal Modal */}
      <Modal
        visible={showMonthlyGoalModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMonthlyGoalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Monthly Goal</Text>

            <TextInput
              style={styles.input}
              placeholder="Goal title"
              value={newGoalTitle}
              onChangeText={setNewGoalTitle}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowMonthlyGoalModal(false);
                  setNewGoalTitle('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd, { backgroundColor: theme.primary }]}
                onPress={handleAddMonthlyGoal}
              >
                <Text style={styles.modalButtonText}>Add Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Yearly Goal Modal */}
      <Modal
        visible={showYearlyGoalModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowYearlyGoalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Yearly Goal</Text>

            <TextInput
              style={styles.input}
              placeholder="Goal title"
              value={newGoalTitle}
              onChangeText={setNewGoalTitle}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowYearlyGoalModal(false);
                  setNewGoalTitle('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd, { backgroundColor: theme.primary }]}
                onPress={handleAddYearlyGoal}
              >
                <Text style={styles.modalButtonText}>Add Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchHeaderRow}>
              <View style={[styles.searchInputWrap, { borderColor: theme.primary }]}>
                <Ionicons name="search" size={20} color="#999999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search tasks, habits, goals..."
                  placeholderTextColor="#999999"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus
                  testID="search-input"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => handleSearch('')}>
                    <Ionicons name="close-circle" size={20} color="#999999" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                  setSearchResults(null);
                }}
                style={styles.searchCancelBtn}
              >
                <Text style={[styles.searchCancelText, { color: theme.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.searchResults}>
              {searching && (
                <Text style={styles.searchStatus}>Searching...</Text>
              )}
              {!searching && !searchResults && searchQuery.length === 0 && (
                <View style={styles.searchEmpty}>
                  <Ionicons name="search-outline" size={48} color="#CCCCCC" />
                  <Text style={styles.searchEmptyText}>Search across all your data</Text>
                  <Text style={styles.searchEmptySubtext}>Tasks, goals, habits, books, time entries</Text>
                </View>
              )}
              {searchResults && searchResults.total === 0 && (
                <Text style={styles.searchStatus}>No results found</Text>
              )}
              {searchResults && searchResults.total > 0 && (
                <>
                  <Text style={styles.searchResultCount}>
                    {searchResults.total} result{searchResults.total !== 1 ? 's' : ''}
                  </Text>

                  {searchResults.tasks.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>📋 Tasks</Text>
                      {searchResults.tasks.map((t: any) => (
                        <TouchableOpacity
                          key={t.task_id}
                          style={styles.searchItem}
                          onPress={() => {
                            setSelectedDate(t.date);
                            setViewMode('calendar');
                            setShowSearchModal(false);
                          }}
                        >
                          <Text style={styles.searchItemTitle}>{t.title}</Text>
                          <Text style={styles.searchItemMeta}>{t.date}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {searchResults.monthly_goals.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>🎯 Monthly Goals</Text>
                      {searchResults.monthly_goals.map((g: any) => (
                        <View key={g.goal_id} style={styles.searchItem}>
                          <Text style={styles.searchItemTitle}>{g.title}</Text>
                          <Text style={styles.searchItemMeta}>{g.month}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {searchResults.yearly_goals.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>🏆 Yearly Goals</Text>
                      {searchResults.yearly_goals.map((g: any) => (
                        <View key={g.goal_id} style={styles.searchItem}>
                          <Text style={styles.searchItemTitle}>{g.title}</Text>
                          <Text style={styles.searchItemMeta}>{g.year}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {searchResults.habits.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>🔥 Habits</Text>
                      {searchResults.habits.map((h: any) => (
                        <View key={h.habit_id} style={styles.searchItem}>
                          <Text style={styles.searchItemTitle}>{h.title}</Text>
                          <Text style={styles.searchItemMeta}>{h.habit_type}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {searchResults.books.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>📚 Books</Text>
                      {searchResults.books.map((b: any) => (
                        <View key={b.book_id} style={styles.searchItem}>
                          <Text style={styles.searchItemTitle}>{b.title}</Text>
                          {b.author && <Text style={styles.searchItemMeta}>by {b.author}</Text>}
                        </View>
                      ))}
                    </View>
                  )}

                  {searchResults.time_entries.length > 0 && (
                    <View style={styles.searchGroup}>
                      <Text style={styles.searchGroupTitle}>⏱ Time Entries</Text>
                      {searchResults.time_entries.map((e: any) => (
                        <View key={e.entry_id} style={styles.searchItem}>
                          <Text style={styles.searchItemTitle}>{e.activity}</Text>
                          <Text style={styles.searchItemMeta}>
                            {e.date} • {e.start_time}-{e.end_time} • {e.category}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeScrollWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    maxHeight: 68,
  },
  weekDayBlock: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  weekDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekDayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  weekDayDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  weekDayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  weekDayBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekEmptyText: {
    fontSize: 13,
    color: '#CCCCCC',
    fontStyle: 'italic',
  },
  weekTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekTaskTitle: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 12,
    flex: 1,
  },
  searchModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    height: '90%',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333333',
  },
  searchCancelBtn: {
    marginLeft: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchResults: {
    flex: 1,
  },
  searchStatus: {
    textAlign: 'center',
    padding: 24,
    color: '#999999',
  },
  searchResultCount: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    fontWeight: '600',
  },
  searchEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  searchEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999999',
    marginTop: 16,
  },
  searchEmptySubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  searchGroup: {
    marginBottom: 16,
  },
  searchGroupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  searchItem: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  searchItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  searchItemMeta: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  viewModeContainer: {
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    flexShrink: 0,
  },
  viewModeButtonActive: {
    backgroundColor: '#FF6B9D',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginLeft: 6,
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  calendar: {
    marginBottom: 16,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  taskCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  taskCheckbox: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 4,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  taskMeta: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
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
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  repeatOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  repeatOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    marginRight: 8,
    marginBottom: 8,
  },
  repeatOptionActive: {
    backgroundColor: '#FF6B9D',
  },
  repeatOptionText: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'capitalize',
  },
  repeatOptionTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  modalButtonCancel: {
    backgroundColor: '#F8F9FA',
  },
  modalButtonAdd: {
    backgroundColor: '#FF6B9D',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
});
