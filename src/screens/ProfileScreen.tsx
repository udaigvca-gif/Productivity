import { LogOut, Mail, Palette } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, allThemes } = useTheme();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Profile Card */}
      <div
        className="relative mb-5 overflow-hidden rounded-2xl p-6 text-white shadow-md animate-fade-in"
        style={{ background: `linear-gradient(135deg, ${theme.profileGradient[0]}, ${theme.profileGradient[1]})` }}
      >
        <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-20 blur-2xl bg-white" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/10">
            <span className="text-xl font-bold">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">{user?.email}</h2>
            <p className="text-sm text-white/70">TaskFlow Life Member</p>
          </div>
        </div>
      </div>

      {/* Themes */}
      <div className="mb-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Palette className="h-4 w-4" style={{ color: theme.primary }} />
          Color Themes
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {allThemes.map((t) => {
            const isActive = theme.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative overflow-hidden rounded-xl p-3 text-left transition-all duration-200 ${
                  isActive ? 'ring-2 ring-offset-2 ring-offset-slate-100 scale-[1.02]' : 'ring-1 ring-slate-200 hover:ring-slate-300'
                }`}
                style={isActive ? { ['--tw-ring-color' as string]: t.primary } as React.CSSProperties : {}}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}
                />
                <div className="relative">
                  <span className="text-lg">{t.emoji}</span>
                  <p className="mt-1 text-xs font-bold text-white">{t.name}</p>
                  {isActive && (
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      Active
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Info */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-fade-in">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Account</h3>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Mail className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-600">{user?.email}</span>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={() => signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 py-3 font-semibold text-red-600 transition-all duration-200 hover:bg-red-100 active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>

      <p className="mt-5 text-center text-xs text-slate-400">
        TaskFlow Life v1.0 — Your data syncs automatically
      </p>
    </div>
  );
}
