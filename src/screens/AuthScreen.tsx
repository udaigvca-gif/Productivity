import { useState } from 'react';
import { CheckSquare, Calendar, Trophy, Flame, Clock, Mail, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { theme } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) {
      setError(
        error.includes('Invalid login credentials')
          ? 'Wrong email or password. If you are new, switch to Sign Up.'
          : error
      );
    }
  };

  const ink = '#263024';
  const sub = '#5d6b56';

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-6"
      style={{ background: `linear-gradient(150deg, ${theme.loginGradient[0]}, ${theme.loginGradient[1]}, ${theme.loginGradient[2]})` }}
    >
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-25 blur-3xl" style={{ background: theme.secondary }} />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: theme.primary }} />

      <div className="relative w-full max-w-md animate-scale-in rounded-3xl border border-black/5 bg-white/80 p-8 shadow-[0_24px_60px_-20px_rgba(38,48,36,0.25)] backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            <CheckSquare className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: ink }}>TaskFlow Life</h1>
          <p className="mt-1.5 text-sm" style={{ color: sub }}>Organize tasks, track habits, achieve goals</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2">
          {[
            { icon: Calendar, label: 'Tasks' },
            { icon: Trophy, label: 'Goals' },
            { icon: Flame, label: 'Habits' },
            { icon: Clock, label: 'Time' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 rounded-xl border border-black/5 bg-white/60 px-3 py-2.5">
              <f.icon className="h-4 w-4" style={{ color: theme.primary }} strokeWidth={2} />
              <span className="text-xs font-medium" style={{ color: sub }}>{f.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#9aa897' }} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-black/8 bg-white/90 py-3 pl-11 pr-4 text-sm outline-none transition-all duration-200 focus:border-[#5f744e] focus:ring-2 focus:ring-[#5f744e]/15"
              style={{ color: ink }}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#9aa897' }} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-black/8 bg-white/90 py-3 pl-11 pr-4 text-sm outline-none transition-all duration-200 focus:border-[#5f744e] focus:ring-2 focus:ring-[#5f744e]/15"
              style={{ color: ink }}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl py-3 font-semibold text-white shadow-[0_6px_20px_-6px_rgba(95,116,78,0.5)] transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm" style={{ color: sub }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: theme.primary }}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
