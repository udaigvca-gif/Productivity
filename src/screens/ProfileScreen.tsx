import { LogOut, Mail, CheckSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, allThemes } = useTheme();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Profile Card */}
      <div
        className="mb-6 rounded-2xl p-6 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${theme.profileGradient[0]}, ${theme.profileGradient[1]})` }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <span className="text-2xl font-bold">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold">{user?.email}</h2>
            <p className="text-sm text-white/80">TaskFlow Life Member</p>
          </div>
        </div>
      </div>

      {/* Themes */}
      <div className="mb-6">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
          <CheckSquare className="h-5 w-5" style={{ color: theme.primary }} />
          Color Themes
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {allThemes.map((t) => {
            const isActive = theme.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative overflow-hidden rounded-2xl p-4 text-left transition ${
                  isActive ? 'ring-2 ring-offset-2' : 'ring-1 ring-slate-200'
                }`}
                style={isActive ? { ['--tw-ring-color' as string]: t.primary } as React.CSSProperties : {}}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}
                />
                <div className="relative">
                  <span className="text-2xl">{t.emoji}</span>
                  <p className="mt-1 text-sm font-bold text-white">{t.name}</p>
                  {isActive && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/30 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
                      <CheckSquare className="h-3 w-3" /> Active
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Info */}
      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-700">Account</h3>
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <Mail className="h-5 w-5 text-slate-400" />
          <span className="text-sm text-slate-600">{user?.email}</span>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={() => signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 font-semibold text-red-600 transition hover:bg-red-100"
      >
        <LogOut className="h-5 w-5" />
        Sign Out
      </button>

      <p className="mt-6 text-center text-xs text-slate-400">
        TaskFlow Life v1.0 - Your data syncs automatically
      </p>
    </div>
  );
}
