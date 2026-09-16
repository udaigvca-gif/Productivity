import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInCalendarDays, eachDayOfInterval, subDays } from 'date-fns';
import {
  Plus, Trash2, Flame, Book, BookOpen, Check, X,
  TrendingUp, Calendar as CalIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import type { Habit, HabitLog, Book as BookType } from '../types';

export default function HabitsScreen() {
  const { theme } = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [books, setBooks] = useState<BookType[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showAddBook, setShowAddBook] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState('general');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: h } = await supabase.from('habits').select('*').eq('user_id', userData.user.id);
    const { data: l } = await supabase.from('habit_logs').select('*').eq('user_id', userData.user.id);
    const { data: b } = await supabase.from('books').select('*').eq('user_id', userData.user.id);

    setHabits((h ?? []) as Habit[]);
    setLogs((l ?? []) as HabitLog[]);
    setBooks((b ?? []) as BookType[]);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAddHabit = async () => {
    if (!newHabitName.trim()) return;
    await supabase.from('habits').insert({
      name: newHabitName.trim(),
      type: newHabitType,
    });
    setNewHabitName('');
    setNewHabitType('general');
    setShowAddHabit(false);
    loadData();
  };

  const handleDeleteHabit = async (id: string) => {
    if (!confirm('Delete this habit and all its logs?')) return;
    await supabase.from('habits').delete().eq('id', id);
    if (selectedHabit?.id === id) setSelectedHabit(null);
    loadData();
  };

  const handleToggleLog = async (habitId: string, date: string) => {
    const existing = logs.find((l) => l.habit_id === habitId && l.date === date);
    if (existing) {
      await supabase.from('habit_logs').delete().eq('id', existing.id);
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habitId,
        date,
        completed: true,
      });
    }
    loadData();
  };

  const handleAddBook = async () => {
    if (!newBookTitle.trim()) return;
    await supabase.from('books').insert({
      title: newBookTitle.trim(),
      author: newBookAuthor.trim() || null,
    });
    setNewBookTitle('');
    setNewBookAuthor('');
    setShowAddBook(false);
    loadData();
  };

  const handleToggleBook = async (book: BookType) => {
    if (book.completed) {
      await supabase.from('books').update({ completed: false, completed_date: null }).eq('id', book.id);
    } else {
      await supabase.from('books').update({ completed: true, completed_date: format(new Date(), 'yyyy-MM-dd') }).eq('id', book.id);
    }
    loadData();
  };

  const handleDeleteBook = async (id: string) => {
    await supabase.from('books').delete().eq('id', id);
    loadData();
  };

  const getHabitStats = (habitId: string) => {
    const habitLogs = logs.filter((l) => l.habit_id === habitId && l.completed);
    const totalDays = habitLogs.length;
    const sortedDates = habitLogs.map((l) => l.date).sort();

    let currentStreak = 0;
    let today = format(new Date(), 'yyyy-MM-dd');
    let yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const checkDate = (date: string) => habitLogs.some((l) => l.date === date);

    if (checkDate(today)) {
      currentStreak = 1;
      let d = subDays(new Date(), 1);
      while (checkDate(format(d, 'yyyy-MM-dd'))) {
        currentStreak++;
        d = subDays(d, 1);
      }
    } else if (checkDate(yesterday)) {
      let d = subDays(new Date(), 1);
      while (checkDate(format(d, 'yyyy-MM-dd'))) {
        currentStreak++;
        d = subDays(d, 1);
      }
    }

    const firstLog = sortedDates[0];
    const daysSinceFirst = firstLog ? differenceInCalendarDays(new Date(), parseISO(firstLog)) + 1 : 0;
    const successRate = daysSinceFirst > 0 ? Math.round((totalDays / daysSinceFirst) * 100) : 0;

    return { totalDays, currentStreak, successRate };
  };

  const habitTypes = ['general', 'exercise', 'reading', 'meditation', 'learning'];

  const renderCalendar = (habitId: string) => {
    const today = new Date();
    const start = subDays(today, 29);
    const days = eachDayOfInterval({ start, end: today });

    return (
      <div className="flex flex-wrap gap-1.5">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isDone = logs.some((l) => l.habit_id === habitId && l.date === dateStr && l.completed);
          return (
            <button
              key={dateStr}
              onClick={() => handleToggleLog(habitId, dateStr)}
              className={`h-7 w-7 rounded-md transition ${
                isDone ? 'text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
              }`}
              style={isDone ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` } : {}}
              title={dateStr}
            />
          );
        })}
      </div>
    );
  };

  const readingBooks = books.filter((b) => !b.completed);
  const completedBooks = books.filter((b) => b.completed);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Habits Section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-700">
            <Flame className="h-5 w-5" style={{ color: theme.primary }} />
            Habits
          </h2>
        </div>

        {habits.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <Flame className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-400">No habits yet. Tap + to start tracking!</p>
          </div>
        )}

        <div className="space-y-3">
          {habits.map((habit) => {
            const stats = getHabitStats(habit.id);
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const doneToday = logs.some((l) => l.habit_id === habit.id && l.date === todayStr && l.completed);

            return (
              <div key={habit.id} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md animate-fade-in">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleLog(habit.id, todayStr)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition"
                      style={doneToday
                        ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }
                        : { background: '#f1f5f9' }
                      }
                    >
                      {doneToday ? <Check className="h-5 w-5 text-white" /> : <Flame className="h-5 w-5 text-slate-400" />}
                    </button>
                    <div>
                      <h3 className="font-semibold text-slate-700">{habit.name}</h3>
                      <p className="text-xs text-slate-400 capitalize">{habit.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteHabit(habit.id)}
                    className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <p className="text-xs text-slate-400">Total Days</p>
                    <p className="text-lg font-bold text-slate-700">{stats.totalDays}</p>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: `${theme.primary}15` }}>
                    <p className="text-xs text-slate-400">Streak</p>
                    <p className="text-lg font-bold" style={{ color: theme.primary }}>{stats.currentStreak}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <p className="text-xs text-slate-400">Success</p>
                    <p className="text-lg font-bold text-slate-700">{stats.successRate}%</p>
                  </div>
                </div>

                {renderCalendar(habit.id)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Books Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-700">
            <BookOpen className="h-5 w-5" style={{ color: theme.primary }} />
            Books
          </h2>
        </div>

        {readingBooks.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-2 text-sm font-medium text-slate-500">Currently Reading</h3>
            <div className="space-y-2">
              {readingBooks.map((book) => (
                <div key={book.id} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm animate-fade-in">
                  <Book className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{book.title}</p>
                    {book.author && <p className="text-xs text-slate-400 truncate">{book.author}</p>}
                  </div>
                  <button
                    onClick={() => handleToggleBook(book)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
                    style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
                  >
                    Mark Done
                  </button>
                  <button
                    onClick={() => handleDeleteBook(book.id)}
                    className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {completedBooks.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-2 text-sm font-medium text-slate-500">Completed ({completedBooks.length})</h3>
            <div className="space-y-2">
              {completedBooks.map((book) => (
                <div key={book.id} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm animate-fade-in">
                  <Check className="h-5 w-5 flex-shrink-0 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-500 line-through truncate">{book.title}</p>
                    {book.author && <p className="text-xs text-slate-400 truncate">{book.author}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteBook(book.id)}
                    className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {books.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-400">No books yet. Tap + to add one!</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddHabit(true)}
        className="fixed bottom-20 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Add Habit Modal */}
      {showAddHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAddHabit(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">New Habit</h3>
              <button onClick={() => setShowAddHabit(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text" placeholder="Habit name" value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
              autoFocus
              className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700 outline-none focus:border-slate-400"
            />
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
              <div className="flex flex-wrap gap-2">
                {habitTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewHabitType(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                      newHabitType === t ? 'text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                    style={newHabitType === t ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleAddHabit}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add Habit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
