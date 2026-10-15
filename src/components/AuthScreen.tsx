import React, { FormEvent, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured } from '../lib/supabase';

export const AuthScreen: React.FC = () => {
  const { lang, setLang, signIn, signUp } = useApp();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  const isVietnamese = lang === 'vi';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setNotice('');
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const needsEmailConfirmation = await signUp(email, password);
        if (needsEmailConfirmation) {
          setNotice(
            isVietnamese
              ? 'Tài khoản đã được tạo. Hãy xác nhận email trước khi đăng nhập.'
              : 'Account created. Confirm your email before signing in.'
          );
          setIsSignUp(false);
          return;
        }
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      console.error('Supabase authentication failed:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isVietnamese
            ? 'Không thể xác thực. Vui lòng thử lại.'
            : 'Authentication failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl shadow-indigo-950/30">
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                TalentMatch <span className="text-indigo-400">AI</span>
              </h1>
              <p className="text-xs text-slate-400">
                {isVietnamese ? 'Nền tảng tuyển dụng thông minh' : 'Intelligent recruitment platform'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLang(isVietnamese ? 'en' : 'vi')}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold uppercase text-slate-300 hover:border-slate-500"
            aria-label={isVietnamese ? 'Switch to English' : 'Chuyển sang tiếng Việt'}
          >
            {lang}
          </button>
        </div>

        <h2 className="text-2xl font-semibold text-white">
          {isSignUp
            ? isVietnamese ? 'Tạo tài khoản' : 'Create account'
            : isVietnamese ? 'Đăng nhập' : 'Sign in'}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {isSignUp
            ? isVietnamese ? 'Đăng ký bằng email và mật khẩu.' : 'Register with your email and password.'
            : isVietnamese ? 'Đăng nhập bằng tài khoản Supabase của bạn.' : 'Sign in with your Supabase account.'}
        </p>

        {!isSupabaseConfigured ? (
          <p role="alert" className="mt-6 rounded-lg border border-amber-700/50 bg-amber-950/40 p-3 text-sm text-amber-200">
            {isVietnamese
              ? 'Chưa cấu hình Supabase cho giao diện. Hãy đặt VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong .env rồi khởi động lại server.'
              : 'Supabase is not configured for the client. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart the server.'}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>{isVietnamese ? 'Email' : 'Email'}</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="you@example.com"
              />
            </label>

            <label className="block space-y-1.5 text-sm text-slate-300">
              <span>{isVietnamese ? 'Mật khẩu' : 'Password'}</span>
              <input
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder={isVietnamese ? 'Ít nhất 6 ký tự' : 'At least 6 characters'}
              />
            </label>

            {errorMessage && (
              <p role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">
                {errorMessage}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 text-sm text-emerald-200">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? isVietnamese ? 'Đang xử lý...' : 'Please wait...'
                : isSignUp
                  ? isVietnamese ? 'Tạo tài khoản' : 'Create account'
                  : isVietnamese ? 'Đăng nhập' : 'Sign in'}
            </button>
          </form>
        )}

        {isSupabaseConfigured && (
          <p className="mt-6 text-center text-sm text-slate-400">
            {isSignUp
              ? isVietnamese ? 'Đã có tài khoản?' : 'Already have an account?'
              : isVietnamese ? 'Chưa có tài khoản?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage('');
                setNotice('');
              }}
              className="font-semibold text-indigo-300 hover:text-indigo-200"
            >
              {isSignUp
                ? isVietnamese ? 'Đăng nhập' : 'Sign in'
                : isVietnamese ? 'Đăng ký' : 'Sign up'}
            </button>
          </p>
        )}
      </section>
    </main>
  );
};
