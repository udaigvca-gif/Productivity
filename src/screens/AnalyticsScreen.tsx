import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { TrendingUp, CheckCircle2, Flame, Clock, Target } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { expandRecurringTasks } from '../lib/recurring';
import type { Task, TaskException, TaskCompletionOverride } from '../types';

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, todayTotal: 0, todayCompleted: 0 });
  const [habitStats, setHabitStats] = useState({ total: 0, completionsThisMonth: 0 });
  const [timeStats, setTimeStats] = useState({ total: 0, productive: 0, nonProductive: 0, neutral: 0 });
  const [goalStats, setGoalStats] = useState({ monthlyTotal: 0, monthlyCompleted: 0, yearlyTotal: 0, yearlyCompleted: 0 });
  const [weekData, setWeekData] = useState<{ day: string; tasks: number; completed: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; minutes: number }[]>([]);

  const loadData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const uid = userData.user.id;
    const today = format(new Date(), 'yyyy-MM-dd');
    const month = format(new Date(), 'yyyy-MM');

    const { data: allTasks } = await supabase.from('tasks').select('*').eq('user_id', uid);
    const { data: excs } = await supabase.from('task_exceptions').select('*').eq('user_id', uid);
    const { data: ovs } = await supabase.from('task_completion_overrides').select('*').eq('user_id', uid);
    const tasks = (allTasks ?? []) as Task[];
    const todayExpanded = expandRecurringTasks(tasks, (excs ?? []) as TaskException[], (ovs ?? []) as TaskCompletionOverride[], today);
    setTaskStats({
      total: tasks.length,
      completed: tasks.filter((t) => t.completed).length,
      todayTotal: todayExpanded.length,
      todayCompleted: todayExpanded.filter((t) => t.completed).length,
    });

    const week: { day: string; tasks: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const expanded = expandRecurringTasks(tasks, (excs ?? []) as TaskException[], (ovs ?? []) as TaskCompletionOverride[], date);
      week.push({
        day: format(subDays(new Date(), i), 'EEE'),
        tasks: expanded.length,
        completed: expanded.filter((t) => t.completed).length,
      });
    }
    setWeekData(week);

    const { data: habits } = await supabase.from('habits').select('*').eq('user_id', uid);
    const { data: habitLogs } = await supabase
      .from('habit_logs').select('*').eq('user_id', uid)
      .gte('date', `${month}-01`).lte('date', `${month}-31`);
    setHabitStats({
      total: habits?.length ?? 0,
      completionsThisMonth: habitLogs?.filter((l) => l.completed).length ?? 0,
    });

    const { data: timeEntries } = await supabase
      .from('time_entries').select('*').eq('user_id', uid)
      .gte('date', `${month}-01`).lte('date', `${month}-31`);

    const entries = timeEntries ?? [];
    const calcMins = (start: string, end: string) => {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let m = (eh * 60 + em) - (sh * 60 + sm);
      if (m < 0) m += 24 * 60;
      return m;
    };

    let total = 0, prod = 0, nonProd = 0, neutral = 0;
    const byCat: Record<string, number> = {};
    for (const e of entries) {
      const mins = calcMins(e.start_time, e.end_time);
      total += mins;
      const cls = e.classification.toLowerCase();
      if (cls.includes('non')) nonProd += mins;
      else if (cls.includes('productive')) prod += mins;
      else neutral += mins;
      byCat[e.category] = (byCat[e.category] ?? 0) + mins;
    }
    setTimeStats({ total: Math.floor(total / 60), productive: Math.floor(prod / 60), nonProductive: Math.floor(nonProd / 60), neutral: Math.floor(neutral / 60) });
    setCategoryData(Object.entries(byCat).map(([name, minutes]) => ({ name, minutes: Math.floor(minutes / 60) })));

    const { data: mg } = await supabase.from('monthly_goals').select('*').eq('user_id', uid).eq('month', month);
    const { data: yg } = await supabase.from('yearly_goals').select('*').eq('user_id', uid).eq('year', format(new Date(), 'yyyy'));
    setGoalStats({
      monthlyTotal: mg?.length ?? 0,
      monthlyCompleted: mg?.filter((g) => g.completed).length ?? 0,
      yearlyTotal: yg?.length ?? 0,
      yearlyCompleted: yg?.filter((g) => g.completed).length ?? 0,
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completionRate = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
  const pieData = [
    { name: 'Productive', value: timeStats.productive },
    { name: 'Non-Productive', value: timeStats.nonProductive },
    { name: 'Neutral', value: timeStats.neutral },
  ].filter((d) => d.value > 0);
  const pieColors = ['#16a34a', '#dc2626', '#d97706'];

  const StatCard = ({ icon, label, value, sublabel, color }: { icon: React.ReactNode; label: string; value: string; sublabel?: string; color: string }) => (
    <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md animate-fade-in">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-[#5d6b56]">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-[#1a2318]">{value}</p>
      {sublabel && <p className="text-xs text-[#8a9a83] mt-0.5">{sublabel}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Stat Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" style={{ color: theme.primary }} />}
          label="Tasks Today"
          value={`${taskStats.todayCompleted}/${taskStats.todayTotal}`}
          color={theme.primary}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" style={{ color: theme.primary }} />}
          label="Completion"
          value={`${completionRate}%`}
          color={theme.primary}
        />
        <StatCard
          icon={<Flame className="h-4 w-4" style={{ color: '#f97316' }} />}
          label="Habit Logs"
          value={`${habitStats.completionsThisMonth}`}
          sublabel="this month"
          color="#f97316"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" style={{ color: theme.primary }} />}
          label="Time Tracked"
          value={`${timeStats.total}h`}
          sublabel="this month"
          color={theme.primary}
        />
      </div>

      {/* Goals Progress */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm animate-fade-in">
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: theme.primary }} />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#5d6b56]">Monthly</span>
          </div>
          <p className="text-2xl font-bold tracking-tight text-[#1a2318]">
            {goalStats.monthlyCompleted}<span className="text-base text-[#8a9a83]">/{goalStats.monthlyTotal}</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-[#e8eee4] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${goalStats.monthlyTotal > 0 ? (goalStats.monthlyCompleted / goalStats.monthlyTotal) * 100 : 0}%`,
                background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
              }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm animate-fade-in">
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: theme.primary }} />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#5d6b56]">Yearly</span>
          </div>
          <p className="text-2xl font-bold tracking-tight text-[#1a2318]">
            {goalStats.yearlyCompleted}<span className="text-base text-[#8a9a83]">/{goalStats.yearlyTotal}</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-[#e8eee4] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${goalStats.yearlyTotal > 0 ? (goalStats.yearlyCompleted / goalStats.yearlyTotal) * 100 : 0}%`,
                background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Week Chart */}
      <div className="mb-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm animate-fade-in">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#5d6b56]">Task Completion (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eee4" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a9a83' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#8a9a83' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              cursor={{ fill: '#f0f3ed' }}
            />
            <Bar dataKey="tasks" fill={theme.primary} radius={[4, 4, 0, 0]} name="Total" maxBarSize={28} />
            <Bar dataKey="completed" fill="#22c55e" radius={[4, 4, 0, 0]} name="Completed" maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Time Pie Chart */}
      {pieData.length > 0 && (
        <div className="mb-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm animate-fade-in">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#5d6b56]">Time Breakdown (This Month)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2} label={(e: any) => `${e.name}: ${e.value}h`}>
                {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category Bar Chart */}
      {categoryData.length > 0 && (
        <div className="mb-4 rounded-2xl border border-black/8 bg-white p-4 shadow-sm animate-fade-in">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#5d6b56]">Time by Category (This Month)</h3>
          <ResponsiveContainer width="100%" height={Math.max(140, categoryData.length * 44)}>
            <BarChart data={categoryData} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eee4" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8a9a83' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8a9a83' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: number) => [`${v}h`, 'Hours']}
                cursor={{ fill: '#f0f3ed' }}
              />
              <Bar dataKey="minutes" fill={theme.primary} radius={[0, 4, 4, 0]} name="Hours" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
