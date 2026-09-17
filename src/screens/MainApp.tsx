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

  const accentMap: Record<TabKey, [string, string]> = {
    tasks: theme.tasksGradient,
    habits: theme.habitsGradient,
    time: theme.timeGradient,
    analytics: theme.tasksGradient,
    profile: theme.profileGradient,
  };

  const [g0, g1] = accentMap[activeTab];

  return (
    <div className="flex h-screen w-full flex-col" style={{ background: '#f5f7f3' }}>
      <header
        className="relative flex items-center justify-between px-5 py-4 transition-all duration-500"
        style={{
          background: `linear-gradient(120deg, ${g0}, ${g1})`,
          color: '#fff',
        }}
      >
        <h1 className="font-display text-lg font-bold tracking-tight text-white">TaskFlow Life</h1>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
          {tabs.find((t) => t.key === activeTab)?.label}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'tasks' && <TasksScreen />}
          {activeTab === 'habits' && <HabitsScreen />}
          {activeTab === 'time' && <TimeEntryScreen />}
          {activeTab === 'analytics' && <AnalyticsScreen />}
          {activeTab === 'profile' && <ProfileScreen />}
        </div>
      </main>

      <nav
        className="flex items-center justify-around border-t px-2 py-1.5 shadow-sm"
        style={{ borderColor: 'rgba(0,0,0,0.06)', background: '#fff' }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="group flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-all duration-200"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200"
                style={isActive ? { background: `${theme.primary}1a` } : {}}
              >
                <Icon
                  className="h-[18px] w-[18px] transition-all duration-200"
                  style={{ color: isActive ? theme.primary : '#94a08e' }}
                  strokeWidth={isActive ? 2.4 : 2}
                />
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.1em] transition-all duration-200"
                style={{ color: isActive ? theme.primary : '#94a08e' }}
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
