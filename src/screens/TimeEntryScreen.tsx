import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Plus, Trash2, Clock, Tag, Folder, Download, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import type { TimeEntry, Category, Classification } from '../types';

const classificationColors: Record<string, string> = {
  'productive': '#22c55e',
  'non-productive': '#ef4444',
  'neutral': '#f59e0b',
};

const getClassificationColor = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('productive') && !lower.includes('non')) return '#22c55e';
  if (lower.includes('non-productive') || lower.includes('non productive')) return '#ef4444';
  return '#f59e0b';
};

const calcDuration = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return { hours: Math.floor(mins / 60), minutes: mins % 60, totalMins: mins };
};

export default function TimeEntryScreen() {
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [newActivity, setNewActivity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedClassification, setSelectedClassification] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newClassificationName, setNewClassificationName] = useState('');
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: e } = await supabase
      .from('time_entries').select('*').eq('user_id', userData.user.id).eq('date', selectedDate)
      .order('start_time');
    const { data: c } = await supabase
      .from('categories').select('*').eq('user_id', userData.user.id);
    const { data: cl } = await supabase
      .from('classifications').select('*').eq('user_id', userData.user.id);

    setEntries((e ?? []) as TimeEntry[]);
    setCategories((c ?? []) as Category[]);
    setClassifications((cl ?? []) as Classification[]);

    if (c && c.length > 0 && !selectedCategory) setSelectedCategory(c[0].name);
    if (cl && cl.length > 0 && !selectedClassification) setSelectedClassification(cl[0].name);
  }, [selectedDate, selectedCategory, selectedClassification]);

  useEffect(() => {
    loadData();
  }, [loadData]);



  const seedDefaults = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    if (categories.length === 0) {
      const defaults = ['Family', 'Self', 'Office', 'Other'];
      for (const name of defaults) {
        await supabase.from('categories').insert({ name });
      }
      loadData();
    }
    if (classifications.length === 0) {
      const defaults = ['Productive', 'Non-Productive', 'Neutral'];
      for (const name of defaults) {
        await supabase.from('classifications').insert({ name });
      }
      loadData();
    }
  };

  useEffect(() => {
    if (categories.length === 0 && classifications.length === 0) {
      seedDefaults();
    }
  }, []);

  const handleAddEntry = async () => {
    if (!newActivity.trim() || !startTime || !endTime) return;
    const tempId = crypto.randomUUID();
    const newEntry: TimeEntry = {
      id: tempId, user_id: '', date: selectedDate,
      start_time: startTime, end_time: endTime,
      activity: newActivity.trim(),
      category: selectedCategory || 'General',
      classification: selectedClassification || 'Neutral',
    };
    setEntries((prev) => [...prev, newEntry]);
    setNewActivity('');
    setStartTime('');
    setEndTime('');
    setShowAddEntry(false);
    await supabase.from('time_entries').insert({
      date: selectedDate,
      start_time: startTime,
      end_time: endTime,
      activity: newActivity.trim(),
      category: selectedCategory || 'General',
      classification: selectedClassification || 'Neutral',
    });
    loadData();
  };

  const handleDeleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('time_entries').delete().eq('id', id);
    loadData();
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const tempId = crypto.randomUUID();
    setCategories((prev) => [...prev, { id: tempId, user_id: '', name: newCategoryName.trim() }]);
    await supabase.from('categories').insert({ name: newCategoryName.trim() });
    setNewCategoryName('');
    setShowCategory(false);
    loadData();
  };

  const handleAddClassification = async () => {
    if (!newClassificationName.trim()) return;
    const tempId = crypto.randomUUID();
    setClassifications((prev) => [...prev, { id: tempId, user_id: '', name: newClassificationName.trim() }]);
    await supabase.from('classifications').insert({ name: newClassificationName.trim() });
    setNewClassificationName('');
    setShowClassification(false);
    loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('categories').delete().eq('id', id);
    loadData();
  };

  const handleDeleteClassification = async (id: string) => {
    setClassifications((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('classifications').delete().eq('id', id);
    loadData();
  };

  const handleExport = () => {
    if (!exportStart || !exportEnd) return;

    const filtered = entries.filter(
      (e) => e.date >= exportStart && e.date <= exportEnd
    );

    const headers = ['Date', 'Start', 'End', 'Activity', 'Category', 'Classification', 'Duration (mins)'];
    const rows = filtered.map((e) => {
      const d = calcDuration(e.start_time, e.end_time);
      return [e.date, e.start_time, e.end_time, e.activity, e.category, e.classification, d.totalMins];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time_entries_${exportStart}_to_${exportEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const navigateDate = (dir: number) => {
    const d = parseISO(selectedDate);
    const newDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const totalTime = entries.reduce((sum, e) => sum + calcDuration(e.start_time, e.end_time).totalMins, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Date Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigateDate(-1)} className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 active:scale-90">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-700">{format(parseISO(selectedDate), 'EEEE, MMM d')}</h2>
        <button onClick={() => navigateDate(1)} className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 active:scale-90">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Total Time Summary */}
      {entries.length > 0 && (
        <div
          className="relative mb-4 overflow-hidden rounded-2xl p-4 text-white shadow-md animate-fade-in"
          style={{ background: `linear-gradient(135deg, ${theme.timeGradient[0]}, ${theme.timeGradient[1]})` }}
        >
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full opacity-20 blur-2xl bg-white" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/70">Total Tracked</p>
              <p className="text-2xl font-bold tracking-tight">{Math.floor(totalTime / 60)}h {totalTime % 60}m</p>
            </div>
            <Clock className="h-8 w-8 text-white/50" />
          </div>
        </div>
      )}

      {/* Time Entries */}
      <div className="space-y-2 mb-6">
        {entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-400">No time entries for this day. Tap + to add one!</p>
          </div>
        )}
        {entries.map((entry) => {
          const dur = calcDuration(entry.start_time, entry.end_time);
          const color = getClassificationColor(entry.classification);
          return (
            <div key={entry.id} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md animate-fade-in"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{entry.activity}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.start_time} - {entry.end_time}</span>
                  <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {entry.category}</span>
                  <span className="flex items-center gap-1"><Folder className="h-3 w-3" /> {entry.classification}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-slate-700">{dur.hours}h {dur.minutes}m</p>
              </div>
              <button
                onClick={() => handleDeleteEntry(entry.id)}
                className="flex-shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:shadow-md active:scale-95"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
        <button
          onClick={() => setShowCategory(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:shadow-md active:scale-95"
        >
          <Tag className="h-3.5 w-3.5" /> Categories
        </button>
        <button
          onClick={() => setShowClassification(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:shadow-md active:scale-95"
        >
          <Folder className="h-3.5 w-3.5" /> Classifications
        </button>
      </div>

      {/* Category/Classification Pills */}
      <div className="space-y-3">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Categories</h4>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <div key={cat.id} className="group flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                {cat.name}
                <button onClick={() => handleDeleteCategory(cat.id)} className="text-slate-300 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {categories.length === 0 && <p className="text-xs text-slate-400">No categories yet</p>}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Classifications</h4>
          <div className="flex flex-wrap gap-2">
            {classifications.map((cls) => (
              <div key={cls.id} className="group flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                style={{ background: getClassificationColor(cls.name) }}
              >
                {cls.name}
                <button onClick={() => handleDeleteClassification(cls.id)} className="text-white/70 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {classifications.length === 0 && <p className="text-xs text-slate-400">No classifications yet</p>}
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddEntry(true)}
        className="fixed bottom-20 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-200 hover:scale-110 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${theme.timeGradient[0]}, ${theme.timeGradient[1]})` }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowAddEntry(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">New Time Entry</h3>
              <button onClick={() => setShowAddEntry(false)} className="text-slate-400 transition-colors hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text" placeholder="Activity name" value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              autoFocus
              className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400"
              >
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Classification</label>
              <select value={selectedClassification} onChange={(e) => setSelectedClassification(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400"
              >
                <option value="">Select classification</option>
                {classifications.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <button
              onClick={handleAddEntry}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.timeGradient[0]}, ${theme.timeGradient[1]})` }}
            >
              Add Entry
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowExport(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Export Time Entries</h3>
              <button onClick={() => setShowExport(false)} className="text-slate-400 transition-colors hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Start Date</label>
                <input type="date" value={exportStart} onChange={(e) => setExportStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">End Date</label>
                <input type="date" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>
            <button
              onClick={handleExport}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.timeGradient[0]}, ${theme.timeGradient[1]})` }}
            >
              Export as CSV
            </button>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowCategory(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add Category</h3>
              <button onClick={() => setShowCategory(false)} className="text-slate-400 transition-colors hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text" placeholder="Category name" value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              autoFocus
              className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            <button
              onClick={handleAddCategory}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Classification Modal */}
      {showClassification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowClassification(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add Classification</h3>
              <button onClick={() => setShowClassification(false)} className="text-slate-400 transition-colors hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text" placeholder="Classification name" value={newClassificationName}
              onChange={(e) => setNewClassificationName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddClassification()}
              autoFocus
              className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            <button
              onClick={handleAddClassification}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
