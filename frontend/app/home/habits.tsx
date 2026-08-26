import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/utils/api';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';

interface Habit {
  habit_id: string;
  title: string;
  habit_type: string;
  duration_hours: number;
  duration_minutes: number;
  add_to_daily?: boolean;
}

interface Book {
  book_id: string;
  title: string;
  author?: string;
  completed: boolean;
  date_completed?: string;
}

interface HabitLog {
  log_id: string;
  habit_id: string;
  date: string;
  completed: boolean;
}

export default function HabitsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [habitAnalytics, setHabitAnalytics] = useState<any>(null);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showHabitDetailModal, setShowHabitDetailModal] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState('general');
  const [durationHours, setDurationHours] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [addToDaily, setAddToDaily] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'habits' | 'books'>('habits');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [viewMode]);

  const loadData = async () => {
    try {
      if (viewMode === 'habits') {
        const habitsData = await api.getHabits();
        setHabits(habitsData);
      } else {
        const booksData = await api.getBooks();
        setBooks(booksData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadHabitDetails = async (habit: Habit) => {
    try {
      const month = format(currentMonth, 'yyyy-MM');
      const [logs, analytics] = await Promise.all([
        api.getHabitLogs(habit.habit_id, month),
        api.getHabitAnalytics(habit.habit_id),
      ]);
      setHabitLogs(logs);
      setHabitAnalytics(analytics);
      setSelectedHabit(habit);
      setShowHabitDetailModal(true);
    } catch (error) {
      console.error('Error loading habit details:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddHabit = async () => {
    if (!newHabitTitle.trim()) return;

    try {
      await api.createHabit({
        user_id: user?.user_id,
        title: newHabitTitle,
        habit_type: newHabitType,
        duration_hours: parseInt(durationHours) || 0,
        duration_minutes: parseInt(durationMinutes) || 0,
        add_to_daily: addToDaily,
      });
      setNewHabitTitle('');
      setNewHabitType('general');
      setDurationHours('0');
      setDurationMinutes('0');
      setAddToDaily(false);
      setShowAddHabitModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding habit:', error);
      Alert.alert('Error', 'Failed to add habit');
    }
  };

  const handleToggleAddToDaily = async (habit: Habit) => {
    try {
      await api.updateHabit(habit.habit_id, { add_to_daily: !habit.add_to_daily });
      loadData();
    } catch (error) {
      console.error('Error toggling add_to_daily:', error);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    Alert.alert('Delete Habit', 'Are you sure you want to delete this habit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteHabit(habitId);
            loadData();
          } catch (error) {
            console.error('Error deleting habit:', error);
          }
        },
      },
    ]);
  };

  const handleToggleHabitLog = async (date: string, currentStatus: boolean) => {
    if (!selectedHabit) return;

    try {
      await api.logHabit(selectedHabit.habit_id, date, !currentStatus);
      // Reload habit details
      await loadHabitDetails(selectedHabit);
    } catch (error) {
      console.error('Error toggling habit log:', error);
    }
  };

  const handleAddBook = async () => {
    if (!newBookTitle.trim()) return;

    try {
      await api.createBook({
        user_id: user?.user_id,
        title: newBookTitle,
        author: newBookAuthor || undefined,
        completed: false,
      });
      setNewBookTitle('');
      setNewBookAuthor('');
      setShowAddBookModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding book:', error);
      Alert.alert('Error', 'Failed to add book');
    }
  };

  const handleToggleBook = async (book: Book) => {
    try {
      await api.updateBook(book.book_id, {
        completed: !book.completed,
        date_completed: !book.completed ? format(new Date(), 'yyyy-MM-dd') : null,
      });
      loadData();
    } catch (error) {
      console.error('Error updating book:', error);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    Alert.alert('Delete Book', 'Are you sure you want to delete this book?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteBook(bookId);
            loadData();
          } catch (error) {
            console.error('Error deleting book:', error);
          }
        },
      },
    ]);
  };

  const renderHabitCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => {
              const newMonth = new Date(currentMonth);
              newMonth.setMonth(newMonth.getMonth() - 1);
              setCurrentMonth(newMonth);
              if (selectedHabit) loadHabitDetails(selectedHabit);
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#333333" />
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity
            onPress={() => {
              const newMonth = new Date(currentMonth);
              newMonth.setMonth(newMonth.getMonth() + 1);
              setCurrentMonth(newMonth);
              if (selectedHabit) loadHabitDetails(selectedHabit);
            }}
          >
            <Ionicons name="chevron-forward" size={24} color="#333333" />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarGrid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <View key={index} style={styles.calendarDayHeader}>
              <Text style={styles.calendarDayHeaderText}>{day}</Text>
            </View>
          ))}

          {/* Empty cells for days before month starts */}
          {Array.from({ length: monthStart.getDay() }).map((_, index) => (
            <View key={`empty-${index}`} style={styles.calendarDay} />
          ))}

          {/* Actual days */}
          {daysInMonth.map((day) => {
            const dateString = format(day, 'yyyy-MM-dd');
            const log = habitLogs.find((l) => l.date === dateString);
            const isCompleted = log?.completed || false;
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <TouchableOpacity
                key={dateString}
                style={[
                  styles.calendarDay,
                  isCompleted && [styles.calendarDayCompleted, { backgroundColor: theme.secondary }],
                  isToday && styles.calendarDayToday,
                ]}
                onPress={() => handleToggleHabitLog(dateString, isCompleted)}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    isCompleted && styles.calendarDayTextCompleted,
                    isToday && styles.calendarDayTextToday,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.habitsGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>
          {viewMode === 'habits' ? 'Habit Tracker' : 'Books Reading List'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {viewMode === 'habits'
            ? 'Build better habits, one day at a time'
            : 'Track your reading journey'}
        </Text>
      </LinearGradient>

      {/* View Mode Selector */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'habits' && { backgroundColor: theme.secondary }]}
          onPress={() => setViewMode('habits')}
        >
          <Ionicons
            name="flame"
            size={20}
            color={viewMode === 'habits' ? '#FFFFFF' : '#666666'}
          />
          <Text
            style={[styles.viewModeText, viewMode === 'habits' && styles.viewModeTextActive]}
          >
            Habits
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'books' && { backgroundColor: theme.secondary }]}
          onPress={() => setViewMode('books')}
        >
          <Ionicons
            name="book"
            size={20}
            color={viewMode === 'books' ? '#FFFFFF' : '#666666'}
          />
          <Text style={[styles.viewModeText, viewMode === 'books' && styles.viewModeTextActive]}>
            Books
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {viewMode === 'habits' ? (
          <View style={styles.section}>
            {habits.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="flame-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyStateText}>No habits yet</Text>
                <Text style={styles.emptyStateSubtext}>Tap + to add your first habit</Text>
              </View>
            ) : (
              habits.map((habit) => (
                <TouchableOpacity
                  key={habit.habit_id}
                  style={styles.habitCard}
                  onPress={() => loadHabitDetails(habit)}
                >
                  <View style={styles.habitIcon}>
                    <Ionicons
                      name={habit.habit_type === 'books' ? 'book' : 'flame'}
                      size={32}
                      color={theme.secondary}
                    />
                  </View>
                  <View style={styles.habitContent}>
                    <Text style={styles.habitTitle}>{habit.title}</Text>
                    {(habit.duration_hours > 0 || habit.duration_minutes > 0) && (
                      <Text style={styles.habitDuration}>
                        Target: {habit.duration_hours}h {habit.duration_minutes}m
                      </Text>
                    )}
                    {habit.add_to_daily && (
                      <View style={[styles.dailyBadge, { backgroundColor: theme.secondary + '20' }]}>
                        <Ionicons name="link" size={11} color={theme.secondary} />
                        <Text style={[styles.dailyBadgeText, { color: theme.secondary }]}>
                          Linked to Daily
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleToggleAddToDaily(habit);
                      }}
                      testID={`toggle-daily-${habit.habit_id}`}
                    >
                      <Ionicons
                        name={habit.add_to_daily ? 'link' : 'link-outline'}
                        size={22}
                        color={habit.add_to_daily ? theme.secondary : '#999999'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteHabit(habit.habit_id)}>
                      <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {books.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="book-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyStateText}>No books added</Text>
                <Text style={styles.emptyStateSubtext}>Tap + to add a book</Text>
              </View>
            ) : (
              <>
                {/* Reading */}
                <Text style={styles.sectionTitle}>Currently Reading</Text>
                {books
                  .filter((b) => !b.completed)
                  .map((book) => (
                    <View key={book.book_id} style={styles.bookCard}>
                      <TouchableOpacity
                        style={styles.bookCheckbox}
                        onPress={() => handleToggleBook(book)}
                      >
                        <Ionicons
                          name={book.completed ? 'checkbox' : 'square-outline'}
                          size={28}
                          color={book.completed ? '#4CAF50' : '#999999'}
                        />
                      </TouchableOpacity>
                      <View style={styles.bookContent}>
                        <Text style={styles.bookTitle}>{book.title}</Text>
                        {book.author && <Text style={styles.bookAuthor}>by {book.author}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteBook(book.book_id)}>
                        <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  ))}

                {/* Completed */}
                {books.filter((b) => b.completed).length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Completed</Text>
                    {books
                      .filter((b) => b.completed)
                      .map((book) => (
                        <View key={book.book_id} style={styles.bookCard}>
                          <TouchableOpacity
                            style={styles.bookCheckbox}
                            onPress={() => handleToggleBook(book)}
                          >
                            <Ionicons name="checkbox" size={28} color="#4CAF50" />
                          </TouchableOpacity>
                          <View style={styles.bookContent}>
                            <Text style={[styles.bookTitle, styles.bookCompleted]}>
                              {book.title}
                            </Text>
                            {book.author && (
                              <Text style={[styles.bookAuthor, styles.bookCompleted]}>
                                by {book.author}
                              </Text>
                            )}
                            {book.date_completed && (
                              <Text style={styles.bookDate}>
                                Completed on{' '}
                                {format(new Date(book.date_completed), 'MMM d, yyyy')}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity onPress={() => handleDeleteBook(book.book_id)}>
                            <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (viewMode === 'habits') setShowAddHabitModal(true);
          else setShowAddBookModal(true);
        }}
      >
        <LinearGradient colors={theme.habitsGradient} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Habit Modal */}
      <Modal
        visible={showAddHabitModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddHabitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Habit</Text>

            <TextInput
              style={styles.input}
              placeholder="Habit title (e.g., Morning Workout)"
              value={newHabitTitle}
              onChangeText={setNewHabitTitle}
              autoFocus
            />

            <Text style={styles.label}>Habit Type</Text>
            <View style={styles.typeOptions}>
              {['general', 'exercise', 'reading', 'meditation', 'learning'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    newHabitType === type && [styles.typeOptionActive, { backgroundColor: theme.secondary }],
                  ]}
                  onPress={() => setNewHabitType(type)}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      newHabitType === type && styles.typeOptionTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Duration (Optional)</Text>
            <View style={styles.durationContainer}>
              <View style={styles.durationInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Hours"
                  value={durationHours}
                  onChangeText={setDurationHours}
                  keyboardType="number-pad"
                />
                <Text style={styles.durationLabel}>hours</Text>
              </View>
              <View style={styles.durationInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Minutes"
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  keyboardType="number-pad"
                />
                <Text style={styles.durationLabel}>minutes</Text>
              </View>
            </View>

            {/* Add to Daily Tasks Toggle */}
            <TouchableOpacity
              style={[
                styles.dailyToggle,
                addToDaily && { backgroundColor: theme.secondary + '20', borderColor: theme.secondary },
              ]}
              onPress={() => setAddToDaily(!addToDaily)}
              testID="add-to-daily-toggle"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dailyToggleTitle}>Link to Daily Tasks</Text>
                <Text style={styles.dailyToggleSubtitle}>
                  Show this habit as a checkbox in Daily Tasks
                </Text>
              </View>
              <Ionicons
                name={addToDaily ? 'toggle' : 'toggle-outline'}
                size={40}
                color={addToDaily ? theme.secondary : '#CCCCCC'}
              />
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowAddHabitModal(false);
                  setNewHabitTitle('');
                  setNewHabitType('general');
                  setDurationHours('0');
                  setDurationMinutes('0');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd, { backgroundColor: theme.secondary }]}
                onPress={handleAddHabit}
              >
                <Text style={styles.modalButtonText}>Add Habit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Book Modal */}
      <Modal
        visible={showAddBookModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddBookModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Book</Text>

            <TextInput
              style={styles.input}
              placeholder="Book title"
              value={newBookTitle}
              onChangeText={setNewBookTitle}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="Author (optional)"
              value={newBookAuthor}
              onChangeText={setNewBookAuthor}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowAddBookModal(false);
                  setNewBookTitle('');
                  setNewBookAuthor('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd, { backgroundColor: theme.secondary }]}
                onPress={handleAddBook}
              >
                <Text style={styles.modalButtonText}>Add Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Habit Detail Modal */}
      <Modal
        visible={showHabitDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHabitDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContentFull}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedHabit?.title}</Text>
              <TouchableOpacity onPress={() => setShowHabitDetailModal(false)}>
                <Ionicons name="close" size={28} color="#333333" />
              </TouchableOpacity>
            </View>

            {habitAnalytics && (
              <View style={styles.analyticsContainer}>
                <View style={styles.analyticsCard}>
                  <Text style={[styles.analyticsValue, { color: theme.secondary }]}>{habitAnalytics.completed_days}</Text>
                  <Text style={styles.analyticsLabel}>Total Days</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <Text style={[styles.analyticsValue, { color: theme.secondary }]}>
                    {habitAnalytics.completion_rate.toFixed(1)}%
                  </Text>
                  <Text style={styles.analyticsLabel}>Success Rate</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <Text style={[styles.analyticsValue, { color: theme.secondary }]}>{habitAnalytics.current_streak}</Text>
                  <Text style={styles.analyticsLabel}>Current Streak</Text>
                </View>
              </View>
            )}

            {renderHabitCalendar()}

            <Text style={styles.calendarInfo}>
              Tap on a day to mark/unmark completion
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dailyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  dailyToggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  dailyToggleSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  dailyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  dailyBadgeText: {
    fontSize: 11,
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  viewModeContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
  },
  viewModeButtonActive: {
    backgroundColor: '#C766EF',
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  habitCard: {
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
  habitIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  habitContent: {
    flex: 1,
  },
  habitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  habitDuration: {
    fontSize: 14,
    color: '#999999',
  },
  bookCard: {
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
  bookCheckbox: {
    marginRight: 12,
  },
  bookContent: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 14,
    color: '#666666',
  },
  bookCompleted: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  bookDate: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
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
  modalContentFull: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
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
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    marginRight: 8,
    marginBottom: 8,
  },
  typeOptionActive: {
    backgroundColor: '#C766EF',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'capitalize',
  },
  typeOptionTextActive: {
    color: '#FFFFFF',
  },
  durationContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  durationInput: {
    flex: 1,
    marginRight: 8,
  },
  durationLabel: {
    fontSize: 12,
    color: '#999999',
    marginTop: -8,
    marginLeft: 4,
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
    backgroundColor: '#C766EF',
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
  analyticsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: '#F8F3FF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  analyticsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#C766EF',
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666666',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayHeader: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarDayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  calendarDayCompleted: {
    backgroundColor: '#C766EF',
    borderRadius: 8,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#FF6B9D',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#333333',
  },
  calendarDayTextCompleted: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  calendarDayTextToday: {
    color: '#FF6B9D',
    fontWeight: 'bold',
  },
  calendarInfo: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
  },
});
