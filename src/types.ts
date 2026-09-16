export interface Task {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  date: string;
  reminder_time: string | null;
  repeat_pattern: 'daily' | 'weekly' | 'monthly' | null;
  repeat_end_date: string | null;
  created_at: string;
}

export interface TaskException {
  id: string;
  task_id: string;
  user_id: string;
  exception_date: string;
}

export interface TaskCompletionOverride {
  id: string;
  task_id: string;
  user_id: string;
  date: string;
  completed: boolean;
}

export interface MonthlyGoal {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  month: string;
}

export interface YearlyGoal {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  year: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  type: string;
  target_hours: number;
  target_minutes: number;
  add_to_daily: boolean;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  completed: boolean;
}

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  completed: boolean;
  completed_date: string | null;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  activity: string;
  category: string;
  classification: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
}

export interface Classification {
  id: string;
  user_id: string;
  name: string;
}

export interface CustomTheme {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  primary_color: string;
  secondary_color: string;
  gradient_start: string;
  gradient_end: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  emoji: string;
  gradient: [string, string];
  primary: string;
  secondary: string;
  tasksGradient: [string, string];
  habitsGradient: [string, string];
  timeGradient: [string, string];
  profileGradient: [string, string];
}

export type TabKey = 'tasks' | 'habits' | 'time' | 'analytics' | 'profile';
