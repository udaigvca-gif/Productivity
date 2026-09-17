import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, parseISO, isSameDay, isToday } from 'date-fns';
import {
  Plus, Trash2, Repeat, Bell, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Trophy, Target, X, Calendar, CalendarDays
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import {
  expandRecurringTasks, getWeekDates,
  type ExpandedTask
} from '../lib/recurring';
import type { Task, MonthlyGoal, YearlyGoal, TaskException, TaskCompletionOverride } from '../types';

type ViewMode = 'calendar' | 'week' | 'monthly' | 'yearly';

export default function TasksScreen() {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [exceptions, setExceptions] = useState<TaskException[]>([]);
  const [overrides, setOverrides] = useState<TaskCompletionOverride[]>([]);
  const [expanded, setExpanded] = useState<ExpandedTask[]>([]);
  const [weekTasks, setWeekTasks] = useState<Record<string, ExpandedTask[]>>({});
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [yearlyGoals, setYearlyGoals] = useState<YearlyGoal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [repeatPattern, setRepeatPattern] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    if (viewMode === 'calendar' || viewMode === 'week') {
      const { data: rawTasks } = await supabase
        .from('tasks').select('*').eq('user_id', userData.user.id);
      const { data: excs } = await supabase
        .from('task_exceptions').select('*').eq('user_id', userData.user.id);
      const { data: ovs } = await supabase
        .from('task_completion_overrides').select('*').eq('user_id', userData.user.id);

      const t = (rawTasks ?? []) as Task[];
      const e = (excs ?? []) as TaskException[];
      const o = (ovs ?? []) as TaskCompletionOverride[];
      setTasks(t);
      setExceptions(e);
      setOverrides(o);

      if (viewMode === 'calendar') {
        setExpanded(expandRecurringTasks(t, e, o, selectedDate));
      } else {
        const weekStart = format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekDates = getWeekDates(weekStart);
        const byDate: Record<string, ExpandedTask[]> = {};
        for (const d of weekDates) {
          byDate[d] = expandRecurringTasks(t, e, o, d);
        }
        setWeekTasks(byDate);
      }
    } else if (viewMode === 'monthly') {
      const month = format(parseISO(selectedDate), 'yyyy-MM');
      const { data } = await supabase
        .from('monthly_goals').select('*').eq('user_id', userData.user.id).eq('month', month);
      setMonthlyGoals((data ?? []) as MonthlyGoal[]);
    } else if (viewMode === 'yearly') {
      const year = format(parseISO(selectedDate), 'yyyy');
      const { data } = await supabase
        .from('yearly_goals').select('*').eq('user_id', userData.user.id).eq('year', year);
      setYearlyGoals((data ?? []) as YearlyGoal[]);
    }
  }, [viewMode, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      user_id: '',
      title: newTitle.trim(),
      completed: false,
      date: selectedDate,
      reminder_time: reminderTime || null,
      repeat_pattern: (repeatPattern || null) as Task['repeat_pattern'],
      repeat_end_date: repeatEndDate || null,
      created_at: new Date().toISOString(),
    };

    // Optimistic: add to local state immediately
    if (viewMode === 'calendar') {
      setExpanded((prev) => [...prev, { ...newTask, is_recurring_instance: false, exception_dates: [] }]);
    }
    setTasks((prev) => [...prev, newTask]);

    const { error } = await supabase.from('tasks').insert({
      title: newTitle.trim(),
      date: selectedDate,
      reminder_time: reminderTime || null,
      repeat_pattern: repeatPattern || null,
      repeat_end_date: repeatEndDate || null,
    });
    if (!error) {
      setNewTitle('');
      setRepeatPattern('');
      setRepeatEndDate('');
      setReminderTime('');
      setShowAddModal(false);
      loadData(); // refresh to get the real DB id
    }
  };

  const handleToggle = async (task: ExpandedTask) => {
    // Optimistic toggle
    const toggleIn = (arr: ExpandedTask[]) =>
      arr.map((t) =>
        t.id === task.id && t.date === task.date
          ? { ...t, completed: !t.completed }
          : t
      );
    setExpanded(toggleIn);
    setWeekTasks((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = toggleIn(next[k]);
      return next;
    });

    if (task.is_recurring_instance) {
      const existing = overrides.find((o) => o.task_id === task.id && o.date === task.date);
      if (existing) {
        await supabase
          .from('task_completion_overrides')
          .update({ completed: !task.completed })
          .eq('id', existing.id);
      } else {
        await supabase.from('task_completion_overrides').insert({
          task_id: task.id,
          date: task.date,
          completed: !task.completed,
        });
      }
    } else {
      await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id);
    }
    loadData();
  };

  const handleDelete = (task: ExpandedTask) => {
    if (task.is_recurring_instance) {
      const doSkip = async () => {
        setExpanded((prev) => prev.filter((t) => !(t.id === task.id && t.date === task.date)));
        await supabase.from('task_exceptions').insert({
          task_id: task.id,
          exception_date: task.date,
        });
        loadData();
      };
      const doDeleteSeries = async () => {
        setExpanded((prev) => prev.filter((t) => t.id !== task.id));
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        await supabase.from('tasks').delete().eq('id', task.id);
        loadData();
      };
      if (confirm('Skip just this day (OK) or delete the entire series (Cancel for series)?')) {
        doSkip();
      } else {
        if (confirm('Delete the ENTIRE recurring series? This cannot be undone.')) {
          doDeleteSeries();
        }
      }
    } else {
      if (confirm('Delete this task?')) {
        setExpanded((prev) => prev.filter((t) => t.id !== task.id));
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        supabase.from('tasks').delete().eq('id', task.id).then(() => loadData());
      }
    }
  };

  const handleAddGoal = async () => {
    if (!newGoalTitle.trim()) return;
    if (viewMode === 'monthly') {
      await supabase.from('monthly_goals').insert({
        title: newGoalTitle.trim(),
        month: format(parseISO(selectedDate), 'yyyy-MM'),
      });
    } else {
      await supabase.from('yearly_goals').insert({
        title: newGoalTitle.trim(),
        year: format(parseISO(selectedDate), 'yyyy'),
      });
    }
    setNewGoalTitle('');
    setShowGoalModal(false);
    loadData();
  };

  const handleToggleGoal = async (goal: MonthlyGoal | YearlyGoal, table: 'monthly_goals' | 'yearly_goals') => {
    // Optimistic
    if (table === 'monthly_goals') {
      setMonthlyGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, completed: !g.completed } : g));
    } else {
      setYearlyGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, completed: !g.completed } : g));
    }
    await supabase.from(table).update({ completed: !goal.completed }).eq('id', goal.id);
    loadData();
  };

  const handleDeleteGoal = async (id: string, table: 'monthly_goals' | 'yearly_goals') => {
    if (table === 'monthly_goals') {
      setMonthlyGoals((prev) => prev.filter((g) => g.id !== id));
    } else {
      setYearlyGoals((prev) => prev.filter((g) => g.id !== id));
    }
    await supabase.from(table).delete().eq('id', id);
    loadData();
  };

  const navigateDate = (direction: number) => {
    const d = parseISO(selectedDate);
    let newDate: Date;
    if (viewMode === 'calendar' || viewMode === 'week') {
      newDate = addDays(d, direction * 7);
    } else if (viewMode === 'monthly') {
      newDate = new Date(d.getFullYear(), d.getMonth() + direction, 1);
    } else {
      newDate = new Date(d.getFullYear() + direction, d.getMonth(), 1);
    }
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const getDateLabel = () => {
    const d = parseISO(selectedDate);
    if (viewMode === 'calendar') return format(d, 'EEEE, MMM d, yyyy');
    if (viewMode === 'week') {
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const we = addDays(ws, 6);
      return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`;
    }
    if (viewMode === 'monthly') return format(d, 'MMMM yyyy');
    return format(d, 'yyyy');
  };

  const renderTaskItem = (task: ExpandedTask) => (
    <div
      key={task.id + (task.is_recurring_instance ? '_' + task.date : '')}
      className="group flex items-center gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md animate-fade-in"
    >
      <button onClick={() => handleToggle(task)} className="flex-shrink-0 transition-transform active:scale-90">
        {task.completed ? (
          <CheckCircle2 className="h-7 w-7 transition-colors" style={{ color: '#22c55e' }} />
        ) : (
          <Circle className="h-7 w-7 text-[#b4c1ad] transition-colors group-hover:text-[#8a9a83]" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium transition-all ${task.completed ? 'text-[#8a9a83] line-through' : 'text-[#263024]'}`}
        >
          {task.title}
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          {task.repeat_pattern && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f0f3ed] px-2 py-0.5 text-xs text-[#5d6b56]">
              <Repeat className="h-3 w-3" /> {task.repeat_pattern}
              {task.repeat_end_date && <span className="text-[#8a9a83]">until {format(parseISO(task.repeat_end_date), 'MMM d')}</span>}
            </span>
          )}
          {task.reminder_time && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50/70 px-2 py-0.5 text-xs text-amber-700">
              <Bell className="h-3 w-3" /> {task.reminder_time}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => handleDelete(task)}
        className="flex-shrink-0 rounded-lg p-1.5 text-[#b4c1ad] opacity-0 transition-all hover:bg-red-50/70 hover:text-red-700 group-hover:opacity-100"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );

  const renderCalendar = () => {
    const monthStart = new Date(
      parseISO(selectedDate).getFullYear(),
      parseISO(selectedDate).getMonth(),
      1
    );
    const startDay = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
    const gridStart = addDays(monthStart, -startDay);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(addDays(gridStart, i));
    }

    return (
      <div className="mb-6 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-[#8a9a83] py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSelected = isSameDay(day, parseISO(selectedDate));
            const isCurrentMonth = day.getMonth() === parseISO(selectedDate).getMonth();
            const isTodayDate = isToday(day);
            const dayExpanded = expandRecurringTasks(tasks, exceptions, overrides, dateStr);
            const hasTasks = dayExpanded.length > 0;
            const allDone = hasTasks && dayExpanded.every((t) => t.completed);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative flex flex-col items-center justify-center rounded-lg py-2 text-sm transition-all duration-150
                  ${isSelected ? 'text-white font-bold scale-[1.02]' : isCurrentMonth ? 'text-[#3d4a37] hover:bg-white/60' : 'text-[#b4c1ad]'}
                `}
                style={isSelected ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` } : {}}
              >
                <span className={isTodayDate && !isSelected ? `font-bold rounded-full h-6 w-6 flex items-center justify-center text-white` : ''}
                  style={isTodayDate && !isSelected ? { background: theme.primary } : {}}
                >
                  {day.getDate()}
                </span>
                {hasTasks && (
                  <span
                    className="mt-0.5 h-1.5 w-1.5 rounded-full transition-colors"
                    style={{ background: isSelected ? 'white' : allDone ? '#22c55e' : theme.primary }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekDates = getWeekDates(weekStart);
    return (
      <div className="space-y-4">
        {weekDates.map((date) => {
          const dayTasks = weekTasks[date] ?? [];
          return (
            <div key={date}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5d6b56]">
                {format(parseISO(date), 'EEE, MMM d')}
                {isToday(parseISO(date)) && (
                  <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: theme.primary }}>
                    Today
                  </span>
                )}
                <span className="text-xs text-[#8a9a83]">({dayTasks.length})</span>
              </h3>
              <div className="space-y-2">
                {dayTasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-black/8 p-3 text-center text-xs text-[#8a9a83]">
                    No tasks
                  </div>
                )}
                {dayTasks.map(renderTaskItem)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGoals = (goals: (MonthlyGoal | YearlyGoal)[], table: 'monthly_goals' | 'yearly_goals') => (
    <div className="space-y-2">
      {goals.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/8 p-8 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-[#b4c1ad]" />
          <p className="text-[#8a9a83]">No goals yet. Tap + to add one!</p>
        </div>
      )}
      {goals.map((goal) => (
        <div
          key={goal.id}
          className="group flex items-center gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md animate-fade-in"
        >
          <button onClick={() => handleToggleGoal(goal, table)} className="flex-shrink-0 transition-transform active:scale-90">
            {goal.completed ? (
              <Trophy className="h-7 w-7" style={{ color: '#22c55e' }} />
            ) : (
              <Circle className="h-7 w-7 text-[#b4c1ad] transition-colors group-hover:text-[#8a9a83]" />
            )}
          </button>
          <span className={`flex-1 text-sm font-medium transition-all ${goal.completed ? 'text-[#8a9a83] line-through' : 'text-[#263024]'}`}>
            {goal.title}
          </span>
          <button
            onClick={() => handleDeleteGoal(goal.id, table)}
            className="flex-shrink-0 rounded-lg p-1.5 text-[#b4c1ad] opacity-0 transition-all hover:bg-red-50/70 hover:text-red-700 group-hover:opacity-100"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* View Mode Switcher */}
      <div className="mb-4 flex gap-1 rounded-xl bg-[#f0f3ed] p-1">
        {(['calendar', 'week', 'monthly', 'yearly'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all duration-200 ${
              viewMode === mode ? 'bg-white shadow-sm' : 'text-[#5d6b56]'
            }`}
            style={viewMode === mode ? { color: theme.primary } : {}}
          >
            {mode === 'calendar' ? 'Daily' : mode}
          </button>
        ))}
      </div>

      {/* Date Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigateDate(-1)} className="rounded-lg p-2 text-[#8a9a83] transition-all hover:bg-[#f0f3ed] active:scale-90">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-[#263024]">{getDateLabel()}</h2>
        <button onClick={() => navigateDate(1)} className="rounded-lg p-2 text-[#8a9a83] transition-all hover:bg-[#f0f3ed] active:scale-90">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      {viewMode === 'calendar' && (
        <>
          {renderCalendar()}
          <div className="space-y-2">
            {expanded.length === 0 && (
              <div className="rounded-xl border border-dashed border-black/8 p-8 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-[#b4c1ad]" />
                <p className="text-[#8a9a83]">No tasks for this day. Tap + to add one!</p>
              </div>
            )}
            {expanded.map(renderTaskItem)}
          </div>
        </>
      )}

      {viewMode === 'week' && renderWeekView()}

      {viewMode === 'monthly' && (
        <>
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5" style={{ color: theme.primary }} />
              <h3 className="font-semibold text-[#263024]">Monthly Goals</h3>
            </div>
            <p className="text-sm text-[#8a9a83]">
              {monthlyGoals.filter((g) => g.completed).length} of {monthlyGoals.length} completed
            </p>
            <div className="mt-2 h-2 rounded-full bg-[#f0f3ed] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${monthlyGoals.length > 0 ? (monthlyGoals.filter((g) => g.completed).length / monthlyGoals.length) * 100 : 0}%`,
                  background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
                }}
              />
            </div>
          </div>
          {renderGoals(monthlyGoals, 'monthly_goals')}
        </>
      )}

      {viewMode === 'yearly' && (
        <>
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5" style={{ color: theme.primary }} />
              <h3 className="font-semibold text-[#263024]">Yearly Goals</h3>
            </div>
            <p className="text-sm text-[#8a9a83]">
              {yearlyGoals.filter((g) => g.completed).length} of {yearlyGoals.length} completed
            </p>
            <div className="mt-2 h-2 rounded-full bg-[#f0f3ed] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${yearlyGoals.length > 0 ? (yearlyGoals.filter((g) => g.completed).length / yearlyGoals.length) * 100 : 0}%`,
                  background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
                }}
              />
            </div>
          </div>
          {renderGoals(yearlyGoals, 'yearly_goals')}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => (viewMode === 'monthly' || viewMode === 'yearly') ? setShowGoalModal(true) : setShowAddModal(true)}
        className="fixed bottom-20 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-200 hover:scale-110 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div
            className="w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1a2318]">New Task</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#8a9a83] transition-colors hover:text-[#3d4a37]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              autoFocus
              className="mb-3 w-full rounded-xl border border-black/8 px-4 py-3 text-[#263024] outline-none transition-colors focus:border-slate-400"
            />
            <div className="mb-3">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#5d6b56]">
                <Repeat className="h-3.5 w-3.5" /> Repeat
              </label>
              <div className="flex gap-2">
                {['', 'daily', 'weekly', 'monthly'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setRepeatPattern(p)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-all duration-200 ${
                      repeatPattern === p ? 'text-white shadow-sm' : 'bg-[#f0f3ed] text-[#5d6b56] hover:bg-black/8'
                    }`}
                    style={repeatPattern === p ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` } : {}}
                  >
                    {p || 'None'}
                  </button>
                ))}
              </div>
            </div>
            {repeatPattern && (
              <div className="mb-3 animate-fade-in">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#5d6b56]">
                  <CalendarDays className="h-3.5 w-3.5" /> Repeat Until (optional)
                </label>
                <input
                  type="date"
                  value={repeatEndDate}
                  min={selectedDate}
                  onChange={(e) => setRepeatEndDate(e.target.value)}
                  className="w-full rounded-xl border border-black/8 px-4 py-3 text-[#263024] outline-none transition-colors focus:border-slate-400"
                />
              </div>
            )}
            <div className="mb-4">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#5d6b56]">
                <Bell className="h-3.5 w-3.5" /> Reminder Time (optional)
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-xl border border-black/8 px-4 py-3 text-[#263024] outline-none transition-colors focus:border-slate-400"
              />
            </div>
            <button
              onClick={handleAddTask}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add Task
            </button>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowGoalModal(false)}>
          <div
            className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1a2318]">
                New {viewMode === 'monthly' ? 'Monthly' : 'Yearly'} Goal
              </h3>
              <button onClick={() => setShowGoalModal(false)} className="text-[#8a9a83] transition-colors hover:text-[#3d4a37]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Goal title"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
              autoFocus
              className="mb-4 w-full rounded-xl border border-black/8 px-4 py-3 text-[#263024] outline-none transition-colors focus:border-slate-400"
            />
            <button
              onClick={handleAddGoal}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add Goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
