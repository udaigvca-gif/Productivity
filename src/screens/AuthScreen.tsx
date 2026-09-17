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

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-6"
      style={{ background: `linear-gradient(135deg, ${theme.loginGradient[0]}, ${theme.loginGradient[1]}, ${theme.loginGradient[2]})` }}
    >
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: theme.primary }} />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full opacity-15 blur-3xl" style={{ background: theme.secondary }} />

      <div className="relative w-full max-w-md animate-scale-in rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-xl border border-white/20">
        <div className="mb-7 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            <CheckSquare className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">TaskFlow Life</h1>
          <p className="mt-1.5 text-sm text-slate-500">Organize tasks, track habits, achieve goals</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2.5">
          {[
            { icon: Calendar, label: 'Tasks' },
            { icon: Trophy, label: 'Goals' },
            { icon: Flame, label: 'Habits' },
            { icon: Clock, label: 'Time' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 transition-colors hover:bg-slate-50">
              <f.icon className="h-4 w-4" style={{ color: theme.primary }} strokeWidth={2} />
              <span className="text-xs font-medium text-slate-600">{f.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            {busy ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            className="font-semibold transition-colors hover:underline"
            style={{ color: theme.primary }}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
