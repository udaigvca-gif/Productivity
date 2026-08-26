import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

class ApiClient {
  private async getToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem('session_token');
    }
    return await storage.secureGet('session_token', null);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Tasks
  async getTasks(date?: string) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/api/tasks${query}`);
  }

  async createTask(task: any) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(taskId: string, updates: any) {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(taskId: string) {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  // Monthly Goals
  async getMonthlyGoals(month?: string) {
    const query = month ? `?month=${month}` : '';
    return this.request(`/api/goals/monthly${query}`);
  }

  async createMonthlyGoal(goal: any) {
    return this.request('/api/goals/monthly', {
      method: 'POST',
      body: JSON.stringify(goal),
    });
  }

  async updateMonthlyGoal(goalId: string, updates: any) {
    return this.request(`/api/goals/monthly/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteMonthlyGoal(goalId: string) {
    return this.request(`/api/goals/monthly/${goalId}`, {
      method: 'DELETE',
    });
  }

  // Yearly Goals
  async getYearlyGoals(year?: string) {
    const query = year ? `?year=${year}` : '';
    return this.request(`/api/goals/yearly${query}`);
  }

  async createYearlyGoal(goal: any) {
    return this.request('/api/goals/yearly', {
      method: 'POST',
      body: JSON.stringify(goal),
    });
  }

  async updateYearlyGoal(goalId: string, updates: any) {
    return this.request(`/api/goals/yearly/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteYearlyGoal(goalId: string) {
    return this.request(`/api/goals/yearly/${goalId}`, {
      method: 'DELETE',
    });
  }

  // Habits
  async getHabits() {
    return this.request('/api/habits');
  }

  async createHabit(habit: any) {
    return this.request('/api/habits', {
      method: 'POST',
      body: JSON.stringify(habit),
    });
  }

  async updateHabit(habitId: string, updates: any) {
    return this.request(`/api/habits/${habitId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteHabit(habitId: string) {
    return this.request(`/api/habits/${habitId}`, {
      method: 'DELETE',
    });
  }

  async logHabit(habitId: string, date: string, completed: boolean) {
    return this.request(`/api/habits/${habitId}/log?date=${date}&completed=${completed}`, {
      method: 'POST',
    });
  }

  async getHabitLogs(habitId: string, month?: string) {
    const query = month ? `?month=${month}` : '';
    return this.request(`/api/habits/${habitId}/logs${query}`);
  }

  async getHabitAnalytics(habitId: string) {
    return this.request(`/api/habits/${habitId}/analytics`);
  }

  // Books
  async getBooks() {
    return this.request('/api/books');
  }

  async createBook(book: any) {
    return this.request('/api/books', {
      method: 'POST',
      body: JSON.stringify(book),
    });
  }

  async updateBook(bookId: string, updates: any) {
    return this.request(`/api/books/${bookId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteBook(bookId: string) {
    return this.request(`/api/books/${bookId}`, {
      method: 'DELETE',
    });
  }

  // Time Entries
  async getTimeEntries(date?: string) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/api/time-entries${query}`);
  }

  async createTimeEntry(entry: any) {
    return this.request('/api/time-entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateTimeEntry(entryId: string, updates: any) {
    return this.request(`/api/time-entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTimeEntry(entryId: string) {
    return this.request(`/api/time-entries/${entryId}`, {
      method: 'DELETE',
    });
  }

  async exportTimeEntries(startDate: string, endDate: string) {
    const token = await this.getToken();
    const response = await fetch(
      `${BACKEND_URL}/api/time-entries/export?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.blob();
  }

  // Categories
  async getCategories() {
    return this.request('/api/categories');
  }

  async createCategory(name: string) {
    return this.request(`/api/categories?name=${name}`, {
      method: 'POST',
    });
  }

  async deleteCategory(categoryId: string) {
    return this.request(`/api/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Classifications
  async getClassifications() {
    return this.request('/api/classifications');
  }

  async createClassification(name: string) {
    return this.request(`/api/classifications?name=${name}`, {
      method: 'POST',
    });
  }

  async deleteClassification(classificationId: string) {
    return this.request(`/api/classifications/${classificationId}`, {
      method: 'DELETE',
    });
  }

  // Search
  async search(query: string) {
    return this.request(`/api/search?q=${encodeURIComponent(query)}`);
  }

  // Week View
  async getTasksWeek(startDate: string) {
    return this.request(`/api/tasks/week?start_date=${startDate}`);
  }

  // Analytics
  async getAnalyticsOverview() {
    return this.request('/api/analytics/overview');
  }

  async getTimeBreakdown(startDate: string, endDate: string) {
    return this.request(`/api/analytics/time-breakdown?start_date=${startDate}&end_date=${endDate}`);
  }

  // Custom Themes
  async getCustomThemes() {
    return this.request('/api/custom-themes');
  }

  async createCustomTheme(theme: any) {
    return this.request('/api/custom-themes', {
      method: 'POST',
      body: JSON.stringify(theme),
    });
  }

  async deleteCustomTheme(themeId: string) {
    return this.request(`/api/custom-themes/${themeId}`, {
      method: 'DELETE',
    });
  }

  // Task Reminders
  async sendTaskReminder(taskId: string, title: string) {
    return this.request('/api/send-task-reminder', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, title }),
    });
  }
}

export const api = new ApiClient();
