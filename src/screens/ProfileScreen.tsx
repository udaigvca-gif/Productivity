import { LogOut, Mail, Palette } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, allThemes } = useTheme();

  const ink = '#263024';
  const sub = '#5d6b56';

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Profile Card */}
      <div
        className="relative mb-5 overflow-hidden rounded-2xl p-6 text-white shadow-sm animate-fade-in"
        style={{ background: `linear-gradient(130deg, ${theme.profileGradient[0]}, ${theme.profileGradient[1]})` }}
      >
        <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-15 blur-2xl bg-white" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 border border-white/15 backdrop-blur-sm">
            <span className="text-xl font-bold">{user?.email?.[0]?.toUpperCase() ?? '?'}</span>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">{user?.email}</h2>
            <p className="text-sm text-white/70">TaskFlow Life Member</p>
          </div>
        </div>
      </div>

      {/* Themes */}
      <div className="mb-5">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: sub }}>
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
                  isActive ? 'ring-2 ring-offset-2 scale-[1.02]' : 'ring-1 ring-black/8 hover:ring-black/15'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})`,
                  ['--tw-ring-color' as string]: t.primary,
                  ['--tw-ring-offset-color' as string]: '#f5f7f3',
                } as React.CSSProperties}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: t.primary }}
                  >
                    {t.emoji}
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#3a4a36' }}>{t.name}</span>
                </div>
                {isActive && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: t.primary }}>
                    Active
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Account */}
      <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4 shadow-sm animate-fade-in">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: sub }}>Account</h3>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: theme.gradient[1] + '40' }}>
          <Mail className="h-4 w-4" style={{ color: sub }} />
          <span className="text-sm" style={{ color: ink }}>{user?.email}</span>
        </div>
      </div>

      <button
        onClick={() => signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200/60 bg-red-50/60 py-3 font-semibold text-red-700 transition-all duration-200 hover:bg-red-100/70 active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>

      <p className="mt-5 text-center text-xs" style={{ color: '#9aa897' }}>
        TaskFlow Life v1.0 — Your data syncs automatically
      </p>
    </div>
  );
}
