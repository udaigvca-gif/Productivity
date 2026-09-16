import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, parseISO, isSameDay, isToday } from 'date-fns';
import {
  Plus, Trash2, Repeat, Bell, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Trophy, Target, X, Calendar
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
  const [reminderTime, setReminderTime] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    if (viewMode === 'calendar') {
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
      setExpanded(expandRecurringTasks(t, e, o, selectedDate));
    } else if (viewMode === 'week') {
      const weekStart = format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const { data: rawTasks } = await supabase
        .from('tasks').select('*').eq('user_id', userData.user.id);
      const { data: excs } = await supabase
        .from('task_exceptions').select('*').eq('user_id', userData.user.id);
      const { data: ovs } = await supabase
        .from('task_completion_overrides').select('*').eq('user_id', userData.user.id);

      const t = (rawTasks ?? []) as Task[];
      const e = (excs ?? []) as TaskException[];
      const o = (ovs ?? []) as TaskCompletionOverride[];
      const weekDates = getWeekDates(weekStart);
      const byDate: Record<string, ExpandedTask[]> = {};
      for (const d of weekDates) {
        byDate[d] = expandRecurringTasks(t, e, o, d);
      }
      setWeekTasks(byDate);
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

  useEffect(() => {
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from('tasks').insert({
      title: newTitle.trim(),
      date: selectedDate,
      reminder_time: reminderTime || null,
      repeat_pattern: repeatPattern || null,
    });
    if (!error) {
      setNewTitle('');
      setRepeatPattern('');
      setReminderTime('');
      setShowAddModal(false);
      loadData();
    }
  };

  const handleToggle = async (task: ExpandedTask) => {
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
        await supabase.from('task_exceptions').insert({
          task_id: task.id,
          exception_date: task.date,
        });
        loadData();
      };
      const doDeleteSeries = async () => {
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
    await supabase.from(table).update({ completed: !goal.completed }).eq('id', goal.id);
    loadData();
  };

  const handleDeleteGoal = async (id: string, table: 'monthly_goals' | 'yearly_goals') => {
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
      className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md animate-fade-in"
    >
      <button onClick={() => handleToggle(task)} className="flex-shrink-0">
        {task.completed ? (
          <CheckCircle2 className="h-7 w-7" style={{ color: '#22c55e' }} />
        ) : (
          <Circle className="h-7 w-7 text-slate-300 group-hover:text-slate-400" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}
        >
          {task.title}
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          {task.repeat_pattern && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              <Repeat className="h-3 w-3" /> {task.repeat_pattern}
            </span>
          )}
          {task.reminder_time && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
              <Bell className="h-3 w-3" /> {task.reminder_time}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => handleDelete(task)}
        className="flex-shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
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
      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
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
                className={`
                  relative flex flex-col items-center justify-center rounded-lg py-2 text-sm transition
                  ${isSelected ? 'text-white font-bold' : isCurrentMonth ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-300'}
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
                    className="mt-0.5 h-1.5 w-1.5 rounded-full"
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
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                {format(parseISO(date), 'EEE, MMM d')}
                {isToday(parseISO(date)) && (
                  <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: theme.primary }}>
                    Today
                  </span>
                )}
                <span className="text-xs text-slate-400">({dayTasks.length})</span>
              </h3>
              <div className="space-y-2">
                {dayTasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
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
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-400">No goals yet. Tap + to add one!</p>
        </div>
      )}
      {goals.map((goal) => (
        <div
          key={goal.id}
          className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md animate-fade-in"
        >
          <button onClick={() => handleToggleGoal(goal, table)} className="flex-shrink-0">
            {goal.completed ? (
              <Trophy className="h-7 w-7" style={{ color: '#22c55e' }} />
            ) : (
              <Circle className="h-7 w-7 text-slate-300 group-hover:text-slate-400" />
            )}
          </button>
          <span className={`flex-1 text-sm font-medium ${goal.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
            {goal.title}
          </span>
          <button
            onClick={() => handleDeleteGoal(goal.id, table)}
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
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
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['calendar', 'week', 'monthly', 'yearly'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition ${
              viewMode === mode ? 'bg-white shadow-sm' : 'text-slate-500'
            }`}
            style={viewMode === mode ? { color: theme.primary } : {}}
          >
            {mode === 'calendar' ? 'Daily' : mode}
          </button>
        ))}
      </div>

      {/* Date Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigateDate(-1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-700">{getDateLabel()}</h2>
        <button onClick={() => navigateDate(1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      {viewMode === 'calendar' && (
        <>
          {renderCalendar()}
          <div className="space-y-2">
            {expanded.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-slate-400">No tasks for this day. Tap + to add one!</p>
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
              <h3 className="font-semibold text-slate-700">Monthly Goals</h3>
            </div>
            <p className="text-sm text-slate-400">
              {monthlyGoals.filter((g) => g.completed).length} of {monthlyGoals.length} completed
            </p>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
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
              <h3 className="font-semibold text-slate-700">Yearly Goals</h3>
            </div>
            <p className="text-sm text-slate-400">
              {yearlyGoals.filter((g) => g.completed).length} of {yearlyGoals.length} completed
            </p>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
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
        className="fixed bottom-20 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setShowAddModal(false)}>
          <div
            className="w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">New Task</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
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
              className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700 outline-none focus:border-slate-400"
            />
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Repeat</label>
              <div className="flex gap-2">
                {['', 'daily', 'weekly', 'monthly'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setRepeatPattern(p)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition ${
                      repeatPattern === p ? 'text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                    style={repeatPattern === p ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` } : {}}
                  >
                    {p || 'None'}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Reminder Time (optional)</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
            <button
              onClick={handleAddTask}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            >
              Add Task
            </button>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGoalModal(false)}>
          <div
            className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                New {viewMode === 'monthly' ? 'Monthly' : 'Yearly'} Goal
              </h3>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-slate-600">
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
              className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700 outline-none focus:border-slate-400"
            />
            <button
              onClick={handleAddGoal}
              className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition hover:opacity-90"
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
