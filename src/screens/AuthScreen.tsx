import { useState } from 'react';
import { CheckSquare, Calendar, Trophy, Flame, Clock, Mail, Lock, User as UserIcon } from 'lucide-react';
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
      className="flex min-h-screen w-full items-center justify-center p-6"
      style={{ background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})` }}
    >
      <div className="w-full max-w-md animate-scale-in rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            <CheckSquare className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">TaskFlow Life</h1>
          <p className="mt-2 text-slate-500">Organize tasks, track habits, achieve goals</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          {[
            { icon: Calendar, label: 'Tasks' },
            { icon: Trophy, label: 'Goals' },
            { icon: Flame, label: 'Habits' },
            { icon: Clock, label: 'Time' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
              <f.icon className="h-5 w-5" style={{ color: theme.primary }} />
              <span className="text-sm font-medium text-slate-600">{f.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-slate-700 outline-none transition focus:border-slate-400"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-slate-700 outline-none transition focus:border-slate-400"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            {busy ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            className="font-semibold hover:underline"
            style={{ color: theme.primary }}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
