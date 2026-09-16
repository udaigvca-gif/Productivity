import { useState } from 'react';
import { Calendar, Flame, Clock, BarChart3, User as UserIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { TabKey } from '../types';
import TasksScreen from './TasksScreen';
import HabitsScreen from './HabitsScreen';
import TimeEntryScreen from './TimeEntryScreen';
import AnalyticsScreen from './AnalyticsScreen';
import ProfileScreen from './ProfileScreen';

const tabs: { key: TabKey; label: string; icon: typeof Calendar }[] = [
  { key: 'tasks', label: 'Tasks', icon: Calendar },
  { key: 'habits', label: 'Habits', icon: Flame },
  { key: 'time', label: 'Time', icon: Clock },
  { key: 'analytics', label: 'Stats', icon: BarChart3 },
  { key: 'profile', label: 'Profile', icon: UserIcon },
];

export default function MainApp() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('tasks');

  const gradientMap: Record<TabKey, [string, string]> = {
    tasks: theme.tasksGradient,
    habits: theme.habitsGradient,
    time: theme.timeGradient,
    analytics: theme.tasksGradient,
    profile: theme.profileGradient,
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50">
      <header
        className="flex items-center justify-between px-6 py-4 shadow-md"
        style={{ background: `linear-gradient(135deg, ${gradientMap[activeTab][0]}, ${gradientMap[activeTab][1]})` }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">TaskFlow Life</h1>
        </div>
        <div className="text-sm font-medium text-white/80">
          {tabs.find((t) => t.key === activeTab)?.label}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'tasks' && <TasksScreen />}
        {activeTab === 'habits' && <HabitsScreen />}
        {activeTab === 'time' && <TimeEntryScreen />}
        {activeTab === 'analytics' && <AnalyticsScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </main>

      <nav className="flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 shadow-lg">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="group flex flex-1 flex-col items-center gap-1 py-2 transition"
            >
              <Icon
                className="h-6 w-6 transition"
                style={{ color: isActive ? theme.primary : '#94a3b8' }}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className="text-xs font-medium transition"
                style={{ color: isActive ? theme.primary : '#94a3b8' }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
