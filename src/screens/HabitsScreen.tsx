import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInCalendarDays, eachDayOfInterval, subDays } from 'date-fns';
import {
  Plus, Trash2, Flame, Book, BookOpen, Check, X,
  BookPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import type { Habit, HabitLog, Book as BookType } from '../types';

export default function HabitsScreen() {
  const { theme } = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [books, setBooks] = useState<BookType[]>([]);
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

  const handleAddHabit = async () => {
    if (!newHabitName.trim()) return;
    const tempId = crypto.randomUUID();
    const newHabit: Habit = {
      id: tempId,
      user_id: '',
      name: newHabitName.trim(),
      type: newHabitType,
      target_hours: 0,
      target_minutes: 0,
      add_to_daily: false,
    };
    setHabits((prev) => [...prev, newHabit]);
    setNewHabitName('');
    setNewHabitType('general');
    setShowAddHabit(false);
    await supabase.from('habits').insert({
      name: newHabit.name,
      type: newHabit.type,
    });
    loadData();
  };

  const handleDeleteHabit = async (id: string) => {
    if (!confirm('Delete this habit and all its logs?')) return;
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogs((prev) => prev.filter((l) => l.habit_id !== id));
    await supabase.from('habits').delete().eq('id', id);
    loadData();
  };

  const handleToggleLog = async (habitId: string, date: string) => {
    const existing = logs.find((l) => l.habit_id === habitId && l.date === date);
    // Optimistic
    if (existing) {
      setLogs((prev) => prev.filter((l) => l.id !== existing.id));
      await supabase.from('habit_logs').delete().eq('id', existing.id);
    } else {
      const tempId = crypto.randomUUID();
      setLogs((prev) => [...prev, {
        id: tempId, habit_id: habitId, user_id: '', date, completed: true,
      }]);
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
    const tempId = crypto.randomUUID();
    const newBook: BookType = {
      id: tempId,
      user_id: '',
      title: newBookTitle.trim(),
      author: newBookAuthor.trim() || null,
      completed: false,
      completed_date: null,
    };
    setBooks((prev) => [...prev, newBook]);
    setNewBookTitle('');
    setNewBookAuthor('');
    setShowAddBook(false);
    await supabase.from('books').insert({
      title: newBook.title,
      author: newBook.author,
    });
    loadData();
  };

  const handleToggleBook = async (book: BookType) => {
    // Optimistic
    setBooks((prev) => prev.map((b) =>
      b.id === book.id
        ? { ...b, completed: !b.completed, completed_date: !b.completed ? format(new Date(), 'yyyy-MM-dd') : null }
        : b
    ));
    if (book.completed) {
      await supabase.from('books').update({ completed: false, completed_date: null }).eq('id', book.id);
    } else {
      await supabase.from('books').update({ completed: true, completed_date: format(new Date(), 'yyyy-MM-dd') }).eq('id', book.id);
    }
    loadData();
  };

  const handleDeleteBook = async (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    await supabase.from('books').delete().eq('id', id);
    loadData();
  };

  const getHabitStats = (habitId: string) => {
    const habitLogs = logs.filter((l) => l.habit_id === habitId && l.completed);
    const totalDays = habitLogs.length;
    const sortedDates = habitLogs.map((l) => l.date).sort();

    let currentStreak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
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
              className={`h-7 w-7 rounded-md transition-all duration-150 active:scale-90 ${
                isDone ? 'text-white' : 'bg-[#f0f3ed] text-[#b4c1ad] hover:bg-black/8'
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
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#263024]">
            <Flame className="h-5 w-5" style={{ color: theme.primary }} />
            Habits
          </h2>
        </div>

        {habits.length === 0 && (
          <div className="rounded-xl border border-dashed border-black/8 p-8 text-center">
            <Flame className="mx-auto mb-3 h-10 w-10 text-[#b4c1ad]" />
            <p className="text-[#8a9a83]">No habits yet. Tap + to start tracking!</p>
          </div>
        )}

        <div className="space-y-3">
          {habits.map((habit) => {
            const stats = getHabitStats(habit.id);
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const doneToday = logs.some((l) => l.habit_id === habit.id && l.date === todayStr && l.completed);

            return (
              <div key={habit.id} className="group rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md animate-fade-in">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleLog(habit.id, todayStr)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-90"
                      style={doneToday
                        ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }
                        : { background: '#f1f5f9' }
                      }
                    >
                      {doneToday ? <Check className="h-5 w-5 text-white" /> : <Flame className="h-5 w-5 text-[#8a9a83]" />}
                    </button>
                    <div>
                      <h3 className="font-semibold text-[#263024]">{habit.name}</h3>
                      <p className="text-xs text-[#8a9a83] capitalize">{habit.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteHabit(habit.id)}
                    className="rounded-lg p-1.5 text-[#b4c1ad] opacity-0 transition-all hover:bg-red-50/70 hover:text-red-700 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/60 p-2 text-center">
                    <p className="text-xs text-[#8a9a83]">Total Days</p>
                    <p className="text-lg font-bold text-[#263024]">{stats.totalDays}</p>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: `${theme.primary}15` }}>
                    <p className="text-xs text-[#8a9a83]">Streak</p>
                    <p className="text-lg font-bold" style={{ color: theme.primary }}>{stats.currentStreak}</p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-2 text-center">
                    <p className="text-xs text-[#8a9a83]">Success</p>
                    <p className="text-lg font-bold text-[#263024]">{stats.successRate}%</p>
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
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#263024]">
            <BookOpen className="h-5 w-5" style={{ color: theme.primary }} />
            Books
          </h2>
          <button
            onClick={() => setShowAddBook(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            <BookPlus className="h-4 w-4" /> Add Book
          </button>
        </div>

        {readingBooks.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-2 text-sm font-medium text-[#5d6b56]">Currently Reading</h3>
            <div className="space-y-2">
              {readingBooks.map((book) => (
                <div key={book.id} className="group flex items-center gap-3 rounded-xl border border-black/5 bg-white p-3 shadow-sm animate-fade-in">
                  <Book className="h-5 w-5 flex-shrink-0 text-[#8a9a83]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#263024] truncate">{book.title}</p>
                    {book.author && <p className="text-xs text-[#8a9a83] truncate">{book.author}</p>}
                  </div>
                  <button
                    onClick={() => handleToggleBook(book)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
                  >
                    Mark Done
                  </button>
                  <button
                    onClick={() => handleDeleteBook(book.id)}
                    className="rounded-lg p-1.5 text-[#b4c1ad] opacity-0 transition-all hover:bg-red-50/70 hover:text-red-700 group-hover:opacity-100"
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
            <h3 className="mb-2 text-sm font-medium text-[#5d6b56]">Completed ({completedBooks.length})</h3>
            <div className="space-y-2">
              {completedBooks.map((book) => (
                <div key={book.id} className="group flex items-center gap-3 rounded-xl border border-black/5 bg-white p-3 shadow-sm animate-fade-in">
                  <Check className="h-5 w-5 flex-shrink-0 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#5d6b56] line-through truncate">{book.title}</p>
                    {book.author && <p className="text-xs text-[#8a9a83] truncate">{book.author}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteBook(book.id)}
                    className="rounded-lg p-1.5 text-[#b4c1ad] opacity-0 transition-all hover:bg-red-50/70 hover:text-red-700 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {books.length === 0 && (
          <div className="rounded-xl border border-dashed border-black/8 p-8 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-[#b4c1ad]" />
            <p className="text-[#8a9a83]">No books yet. Tap "Add Book" to start your reading list!</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddHabit(true)}
        className="fixed bottom-20 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-200 hover:scale-110 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Add Habit Modal */}
      {showAddHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowAddHabit(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1a2318]">New Habit</h3>
              <button onClick={() => setShowAddHabit(false)} className="text-[#8a9a83] transition-colors hover:text-[#3d4a37]"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text" placeholder="Habit name" value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
              autoFocus
              className="mb-3 w-full rounded-xl border border-black/8 px-4 py-3 text-[#263024] outline-none transition-colors focus:border-slate-400"
            />
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-[#5d6b56]">Type</label>
              <div className="flex flex-wrap gap-2">
                {habitTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewHabitType(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200 ${
                      newHabitType === t ? 'text-white shadow-sm' : 'bg-[#f0f3ed] text-[#5d6b56] hover:bg-black/8'
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
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add Habit
            </button>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      {showAddBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowAddBook(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1a2318]">Add Book</h3>
              <button onClick={() => setShowAddBook(false)} className="text-[#8a9a83] transition-colors hover:text-[#3d4a37]"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text" placeholder="Book title" value={newBookTitle}
              onChange={(e) => setNewBookTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBook()}
              autoFocus
              className="mb-3 w-full rounded-xl border border-black/8 px-4 py-3 text-[#263024] outline-none transition-colors focus:border-slate-400"
            />
            <input
              type="text" placeholder="Author (optional)" value={newBookAuthor}
              onChange={(e) => setNewBookAuthor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBook()}
              className="mb-4 w-full rounded-xl border border-black/8 px-4 py-3 text-[#263024] outline-none transition-colors focus:border-slate-400"
            />
            <button
              onClick={handleAddBook}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add Book
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
