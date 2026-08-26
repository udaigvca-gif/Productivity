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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar } from 'react-native-calendars';
import { api } from '@/src/utils/api';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface TimeEntry {
  entry_id: string;
  date: string;
  start_time: string;
  end_time: string;
  activity: string;
  category: string;
  classification: string;
}

interface Category {
  category_id: string;
  name: string;
}

interface Classification {
  classification_id: string;
  name: string;
}

export default function TimeEntryScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [newActivity, setNewActivity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedClassification, setSelectedClassification] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newClassificationName, setNewClassificationName] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    loadCategories();
    loadClassifications();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      const entriesData = await api.getTimeEntries(selectedDate);
      // Sort by start time
      entriesData.sort((a: TimeEntry, b: TimeEntry) => a.start_time.localeCompare(b.start_time));
      setEntries(entriesData);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await api.getCategories();
      setCategories(categoriesData);
      if (categoriesData.length > 0 && !selectedCategory) {
        setSelectedCategory(categoriesData[0].name);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadClassifications = async () => {
    try {
      const classificationsData = await api.getClassifications();
      setClassifications(classificationsData);
      if (classificationsData.length > 0 && !selectedClassification) {
        setSelectedClassification(classificationsData[0].name);
      }
    } catch (error) {
      console.error('Error loading classifications:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadCategories(), loadClassifications()]);
    setRefreshing(false);
  };

  const handleAddEntry = async () => {
    if (!newActivity.trim() || !startTime || !endTime) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('Error', 'Please use HH:MM format for times');
      return;
    }

    try {
      await api.createTimeEntry({
        user_id: user?.user_id,
        date: selectedDate,
        start_time: startTime,
        end_time: endTime,
        activity: newActivity,
        category: selectedCategory,
        classification: selectedClassification,
      });
      setNewActivity('');
      setStartTime('');
      setEndTime('');
      setShowAddEntryModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding entry:', error);
      Alert.alert('Error', 'Failed to add time entry');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTimeEntry(entryId);
            loadData();
          } catch (error) {
            console.error('Error deleting entry:', error);
          }
        },
      },
    ]);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      await api.createCategory(newCategoryName);
      setNewCategoryName('');
      setShowCategoryModal(false);
      loadCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      Alert.alert('Error', 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await api.deleteCategory(categoryId);
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleAddClassification = async () => {
    if (!newClassificationName.trim()) return;

    try {
      await api.createClassification(newClassificationName);
      setNewClassificationName('');
      setShowClassificationModal(false);
      loadClassifications();
    } catch (error) {
      console.error('Error adding classification:', error);
      Alert.alert('Error', 'Failed to add classification');
    }
  };

  const handleDeleteClassification = async (classificationId: string) => {
    try {
      await api.deleteClassification(classificationId);
      loadClassifications();
    } catch (error) {
      console.error('Error deleting classification:', error);
    }
  };

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      Alert.alert('Error', 'Please select start and end dates');
      return;
    }

    try {
      const blob = await api.exportTimeEntries(exportStartDate, exportEndDate);
      
      if (Platform.OS === 'web') {
        // Web download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `time_entries_${exportStartDate}_to_${exportEndDate}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Mobile download and share
        const fileUri = `${FileSystem.documentDirectory}time_entries_${exportStartDate}_to_${exportEndDate}.xlsx`;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Sharing.shareAsync(fileUri);
        };
        reader.readAsDataURL(blob);
      }

      setShowExportModal(false);
      Alert.alert('Success', 'Time entries exported successfully');
    } catch (error) {
      console.error('Error exporting:', error);
      Alert.alert('Error', 'Failed to export time entries');
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes };
  };

  const getClassificationColor = (classification: string) => {
    const lower = classification.toLowerCase();
    if (lower.includes('productive')) return '#4CAF50';
    if (lower.includes('non-productive')) return '#FF6B6B';
    return '#FFA500';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.timeGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Time Entry</Text>
            <Text style={styles.headerSubtitle}>
              {format(new Date(selectedDate), 'EEEE, MMM d, yyyy')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => setShowExportModal(true)}
          >
            <Ionicons name="download-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Calendar */}
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

      {/* Manage Categories & Classifications */}
      <View style={styles.manageContainer}>
        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => setShowCategoryModal(true)}
        >
          <Ionicons name="pricetags-outline" size={20} color={theme.primary} />
          <Text style={[styles.manageButtonText, { color: theme.primary }]}>Manage Categories</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => setShowClassificationModal(true)}
        >
          <Ionicons name="list-outline" size={20} color={theme.primary} />
          <Text style={[styles.manageButtonText, { color: theme.primary }]}>Manage Classifications</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Time Entries for {format(new Date(selectedDate), 'MMM d')}
          </Text>

          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>No time entries</Text>
              <Text style={styles.emptyStateSubtext}>Tap + to add a new entry</Text>
            </View>
          ) : (
            entries.map((entry) => {
              const duration = calculateDuration(entry.start_time, entry.end_time);
              return (
                <View key={entry.entry_id} style={styles.entryCard}>
                  <View
                    style={[
                      styles.entryIndicator,
                      { backgroundColor: getClassificationColor(entry.classification) },
                    ]}
                  />
                  <View style={styles.entryContent}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryTime}>
                        {entry.start_time} - {entry.end_time}
                      </Text>
                      <Text style={[styles.entryDuration, { color: theme.primary }]}>
                        {duration.hours}h {duration.minutes}m
                      </Text>
                    </View>
                    <Text style={styles.entryActivity}>{entry.activity}</Text>
                    <View style={styles.entryTags}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{entry.category}</Text>
                      </View>
                      <View
                        style={[
                          styles.tag,
                          { backgroundColor: getClassificationColor(entry.classification) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagText,
                            { color: getClassificationColor(entry.classification) },
                          ]}
                        >
                          {entry.classification}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteEntry(entry.entry_id)}>
                    <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddEntryModal(true)}>
        <LinearGradient colors={theme.timeGradient} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Entry Modal */}
      <Modal
        visible={showAddEntryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddEntryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Time Entry</Text>

            <TextInput
              style={styles.input}
              placeholder="Activity description"
              value={newActivity}
              onChangeText={setNewActivity}
              autoFocus
              multiline
            />

            <View style={styles.timeInputs}>
              <View style={styles.timeInput}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (e.g., 09:00)"
                  value={startTime}
                  onChangeText={setStartTime}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (e.g., 10:30)"
                  value={endTime}
                  onChangeText={setEndTime}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.category_id}
                  style={[
                    styles.option,
                    selectedCategory === cat.name && [styles.optionActive, { backgroundColor: theme.primary }],
                  ]}
                  onPress={() => setSelectedCategory(cat.name)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedCategory === cat.name && styles.optionTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Classification</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
              {classifications.map((cls) => (
                <TouchableOpacity
                  key={cls.classification_id}
                  style={[
                    styles.option,
                    selectedClassification === cls.name && [styles.optionActive, { backgroundColor: theme.primary }],
                  ]}
                  onPress={() => setSelectedClassification(cls.name)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedClassification === cls.name && styles.optionTextActive,
                    ]}
                  >
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowAddEntryModal(false);
                  setNewActivity('');
                  setStartTime('');
                  setEndTime('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd, { backgroundColor: theme.primary }]}
                onPress={handleAddEntry}
              >
                <Text style={styles.modalButtonText}>Add Entry</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Manage Categories Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Categories</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={28} color="#333333" />
              </TouchableOpacity>
            </View>

            <View style={styles.addItemContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="New category name"
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <TouchableOpacity style={[styles.addItemButton, { backgroundColor: theme.primary }]} onPress={handleAddCategory}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.itemsList}>
              {categories.map((cat) => (
                <View key={cat.category_id} style={styles.itemRow}>
                  <Text style={styles.itemText}>{cat.name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteCategory(cat.category_id)}>
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manage Classifications Modal */}
      <Modal
        visible={showClassificationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowClassificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Classifications</Text>
              <TouchableOpacity onPress={() => setShowClassificationModal(false)}>
                <Ionicons name="close" size={28} color="#333333" />
              </TouchableOpacity>
            </View>

            <View style={styles.addItemContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="New classification name"
                value={newClassificationName}
                onChangeText={setNewClassificationName}
              />
              <TouchableOpacity style={[styles.addItemButton, { backgroundColor: theme.primary }]} onPress={handleAddClassification}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.itemsList}>
              {classifications.map((cls) => (
                <View key={cls.classification_id} style={styles.itemRow}>
                  <Text style={styles.itemText}>{cls.name}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteClassification(cls.classification_id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export to Excel</Text>

            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2026-01-01"
              value={exportStartDate}
              onChangeText={setExportStartDate}
            />

            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2026-01-31"
              value={exportEndDate}
              onChangeText={setExportEndDate}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowExportModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd, { backgroundColor: theme.primary }]}
                onPress={handleExport}
              >
                <Text style={styles.modalButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  exportButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendar: {
    marginBottom: 8,
  },
  manageContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  manageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4E78FF',
    marginLeft: 6,
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
  entryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  entryIndicator: {
    width: 4,
  },
  entryContent: {
    flex: 1,
    padding: 16,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  entryDuration: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4E78FF',
  },
  entryActivity: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
  },
  entryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#666666',
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
    maxHeight: '85%',
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
  timeInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  optionsScroll: {
    marginBottom: 24,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    marginRight: 8,
  },
  optionActive: {
    backgroundColor: '#4E78FF',
  },
  optionText: {
    fontSize: 14,
    color: '#666666',
  },
  optionTextActive: {
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
    backgroundColor: '#4E78FF',
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
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addItemButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4E78FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  itemsList: {
    maxHeight: 300,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
  },
  itemText: {
    fontSize: 16,
    color: '#333333',
  },
});
