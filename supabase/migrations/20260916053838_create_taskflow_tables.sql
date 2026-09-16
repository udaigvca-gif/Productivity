/*
# TaskFlow Life - Full Database Schema

Creates all tables for the TaskFlow Life productivity app:
- tasks (with recurring support), task_exceptions, task_completion_overrides
- monthly_goals, yearly_goals
- habits, habit_logs, books
- time_entries, categories, classifications
- custom_themes

All tables are user-scoped with RLS policies (authenticated only).
Owner columns default to auth.uid() so inserts work without passing user_id.
*/

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  date date NOT NULL DEFAULT CURRENT_DATE,
  reminder_time text,
  repeat_pattern text CHECK (repeat_pattern IN ('daily', 'weekly', 'monthly') OR repeat_pattern IS NULL),
  repeat_end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);

-- Task exceptions (skip a single occurrence of a recurring task)
CREATE TABLE IF NOT EXISTS task_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, exception_date)
);
ALTER TABLE task_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_task_exceptions" ON task_exceptions;
CREATE POLICY "select_own_task_exceptions" ON task_exceptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_task_exceptions" ON task_exceptions;
CREATE POLICY "insert_own_task_exceptions" ON task_exceptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_task_exceptions" ON task_exceptions;
CREATE POLICY "delete_own_task_exceptions" ON task_exceptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Task completion overrides (per-occurrence completion for recurring tasks)
CREATE TABLE IF NOT EXISTS task_completion_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, date)
);
ALTER TABLE task_completion_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_overrides" ON task_completion_overrides;
CREATE POLICY "select_own_overrides" ON task_completion_overrides FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_overrides" ON task_completion_overrides;
CREATE POLICY "insert_own_overrides" ON task_completion_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_overrides" ON task_completion_overrides;
CREATE POLICY "update_own_overrides" ON task_completion_overrides FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_overrides" ON task_completion_overrides;
CREATE POLICY "delete_own_overrides" ON task_completion_overrides FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Monthly Goals
CREATE TABLE IF NOT EXISTS monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  month text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_monthly_goals" ON monthly_goals;
CREATE POLICY "select_own_monthly_goals" ON monthly_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_monthly_goals" ON monthly_goals;
CREATE POLICY "insert_own_monthly_goals" ON monthly_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_monthly_goals" ON monthly_goals;
CREATE POLICY "update_own_monthly_goals" ON monthly_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_monthly_goals" ON monthly_goals;
CREATE POLICY "delete_own_monthly_goals" ON monthly_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Yearly Goals
CREATE TABLE IF NOT EXISTS yearly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE yearly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_yearly_goals" ON yearly_goals;
CREATE POLICY "select_own_yearly_goals" ON yearly_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_yearly_goals" ON yearly_goals;
CREATE POLICY "insert_own_yearly_goals" ON yearly_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_yearly_goals" ON yearly_goals;
CREATE POLICY "update_own_yearly_goals" ON yearly_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_yearly_goals" ON yearly_goals;
CREATE POLICY "delete_own_yearly_goals" ON yearly_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Habits
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  target_hours numeric DEFAULT 0,
  target_minutes numeric DEFAULT 0,
  add_to_daily boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_habits" ON habits;
CREATE POLICY "select_own_habits" ON habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_habits" ON habits;
CREATE POLICY "insert_own_habits" ON habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_habits" ON habits;
CREATE POLICY "update_own_habits" ON habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_habits" ON habits;
CREATE POLICY "delete_own_habits" ON habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Habit Logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_habit_logs" ON habit_logs;
CREATE POLICY "select_own_habit_logs" ON habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_habit_logs" ON habit_logs;
CREATE POLICY "insert_own_habit_logs" ON habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_habit_logs" ON habit_logs;
CREATE POLICY "delete_own_habit_logs" ON habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date);

-- Books
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  completed boolean NOT NULL DEFAULT false,
  completed_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_books" ON books;
CREATE POLICY "select_own_books" ON books FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_books" ON books;
CREATE POLICY "insert_own_books" ON books FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_books" ON books;
CREATE POLICY "update_own_books" ON books FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_books" ON books;
CREATE POLICY "delete_own_books" ON books FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Time Entries
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  start_time text NOT NULL,
  end_time text NOT NULL,
  activity text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  classification text NOT NULL DEFAULT 'Neutral',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_time_entries" ON time_entries;
CREATE POLICY "select_own_time_entries" ON time_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_time_entries" ON time_entries;
CREATE POLICY "insert_own_time_entries" ON time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_time_entries" ON time_entries;
CREATE POLICY "update_own_time_entries" ON time_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_time_entries" ON time_entries;
CREATE POLICY "delete_own_time_entries" ON time_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_categories" ON categories;
CREATE POLICY "select_own_categories" ON categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Classifications
CREATE TABLE IF NOT EXISTS classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_classifications" ON classifications;
CREATE POLICY "select_own_classifications" ON classifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_classifications" ON classifications;
CREATE POLICY "insert_own_classifications" ON classifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_classifications" ON classifications;
CREATE POLICY "delete_own_classifications" ON classifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Custom Themes
CREATE TABLE IF NOT EXISTS custom_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🎨',
  primary_color text NOT NULL,
  secondary_color text NOT NULL,
  gradient_start text NOT NULL,
  gradient_end text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE custom_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_custom_themes" ON custom_themes;
CREATE POLICY "select_own_custom_themes" ON custom_themes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_custom_themes" ON custom_themes;
CREATE POLICY "insert_own_custom_themes" ON custom_themes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_custom_themes" ON custom_themes;
CREATE POLICY "delete_own_custom_themes" ON custom_themes FOR DELETE TO authenticated USING (auth.uid() = user_id);