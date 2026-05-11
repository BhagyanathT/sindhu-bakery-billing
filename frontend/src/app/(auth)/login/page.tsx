'use client';
// src/app/(auth)/login/page.tsx — Sindhu Bakery Login (Animated Premium UI)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Shield, Lock, Mail, ArrowRight, ChefHat } from 'lucide-react';

const PARTICLES = [
  { emoji: '🍞', x: 8,  y: 15, size: 28, delay: 0,   dur: 6  },
  { emoji: '🥐', x: 85, y: 10, size: 22, delay: 1,   dur: 8  },
  { emoji: '🎂', x: 15, y: 75, size: 26, delay: 2,   dur: 7  },
  { emoji: '🧁', x: 78, y: 80, size: 24, delay: 0.5, dur: 9  },
  { emoji: '🍪', x: 45, y: 5,  size: 20, delay: 3,   dur: 6  },
  { emoji: '☕', x: 92, y: 45, size: 22, delay: 1.5, dur: 8  },
  { emoji: '🥖', x: 5,  y: 50, size: 18, delay: 2.5, dur: 7  },
  { emoji: '🍩', x: 60, y: 88, size: 24, delay: 0.8, dur: 10 },
];

const FEATURES = [
  { emoji: '🧾', title: 'Lightning Fast Billing', desc: 'Complete a full bill in under 10 seconds' },
  { emoji: '📦', title: 'Live Stock Updates', desc: 'Inventory auto-updates on every sale' },
  { emoji: '💰', title: 'GST Ready', desc: 'Toggle GST with per-item tax control' },
  { emoji: '👥', title: 'Multi-User Access', desc: 'Admin & staff with separate permissions' },
];

export default function LoginPage() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted]         = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login, isLoading }          = useAuthStore();
  const router                        = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const role = await login(email, password);
      toast.success('Welcome to Sindhu Bakery! 🍞');
      router.push(role === 'admin' ? '/dashboard' : '/billing');
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    }
  };

  // Inline animation styles — no CSS string content, avoids hydration mismatch
  const animStyle = (name: string, dur: string, delay = '0s', extra = '') =>
    ({ animation: `${name} ${dur} ${delay} ${extra}` }) as React.CSSProperties;

  return (
    <div
      className="min-h-screen flex overflow-hidden relative"
      style={{ background: 'radial-gradient(ellipse at 20% 50%, #2d1a0e 0%, #1c1917 40%, #0f0a08 100%)' }}
    >
      {/* ── Background Orbs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="login-pulse-orb absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.25) 0%, transparent 70%)' }}
        />
        <div
          className="login-pulse-orb absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.2) 0%, transparent 70%)', animationDelay: '2s' }}
        />
        <div
          className="login-pulse-orb absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)', animationDelay: '1s' }}
        />
        {/* Rotating rings */}
        <div className="login-spin-slow absolute top-[20%] right-[25%] w-64 h-64 rounded-full hidden lg:block"
          style={{ border: '1px solid rgba(217,119,6,0.08)' }} />
        <div className="login-spin-reverse absolute hidden lg:block"
          style={{ top: 'calc(20% - 64px)', right: 'calc(25% - 64px)', width: '384px', height: '384px', borderRadius: '9999px', border: '1px solid rgba(217,119,6,0.05)' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* ── Floating Food Particles ── */}
      {mounted && PARTICLES.map((p, i) => (
        <div
          key={i}
          className="login-float-particle absolute pointer-events-none select-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: p.size, '--delay': `${p.delay}s`, '--dur': `${p.dur}s`, opacity: 0.45 } as React.CSSProperties}
        >
          {p.emoji}
        </div>
      ))}

      {/* ══ LEFT PANEL ══ */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative z-10">
        {/* Logo */}
        <div style={mounted ? animStyle('loginSlideInLeft', '0.7s', '0s', 'ease forwards') : { opacity: 0 }}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-2xl shadow-amber-500/30"
                style={{ background: 'linear-gradient(135deg, #1c1917, #292524)' }}>
                <img src="/logo.jpg" alt="Sindhu Bakery" className="w-full h-full object-contain" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-stone-900 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
            <div>
              <p className="text-white font-black text-xl tracking-tight">Sindhu Bakery</p>
              <p className="text-amber-400/60 text-xs font-medium">Marayamuttam, Kerala</p>
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="space-y-8" style={mounted ? animStyle('loginSlideInLeft', '0.8s', '0.1s', 'ease forwards') : { opacity: 0 }}>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-amber-400 border border-amber-500/30"
              style={{ background: 'rgba(217,119,6,0.1)' }}>
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              POS System — Live
            </div>
            <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
              Your bakery,<br />
              <span className="login-shimmer-text">billed smarter ⚡</span>
            </h1>
            <p className="text-stone-400 text-base max-w-sm leading-relaxed">
              The all-in-one billing platform for Sindhu Bakery — fast, smart, and built for your team.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="login-feature-card flex items-center gap-4 p-3 rounded-2xl cursor-default"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  ...(mounted ? animStyle('loginSlideInLeft', '0.6s', `${0.2 + i * 0.1}s`, 'ease forwards') : { opacity: 0 }),
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  {f.emoji}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-stone-500 text-xs mt-0.5">{f.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-600 ml-auto flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-10" style={mounted ? animStyle('loginSlideInLeft', '0.7s', '0.5s', 'ease forwards') : { opacity: 0 }}>
          {[['⚡ Fast', '< 10s per bill'], ['🧾 GST', 'Toggle ON/OFF'], ['🖨️ Print', 'Thermal & A4']].map(([num, label]) => (
            <div key={label}>
              <p className="text-lg font-black text-amber-400">{num}</p>
              <p className="text-stone-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ RIGHT PANEL — Login Form ══ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div
            className="flex items-center gap-3 mb-8 lg:hidden"
            style={mounted ? animStyle('loginSlideUp', '0.6s', '0s', 'ease forwards') : { opacity: 0 }}
          >
            <div className="w-10 h-10 rounded-2xl overflow-hidden border border-amber-500/30 shadow-lg">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-white font-black text-lg">Sindhu Bakery</p>
              <p className="text-amber-400/60 text-xs">Marayamuttam, Kerala</p>
            </div>
          </div>

          {/* Card */}
          <div
            className="relative rounded-3xl p-8 shadow-2xl"
            style={{
              background: 'rgba(28,25,23,0.85)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 25px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
              ...(mounted ? animStyle('loginSlideInRight', '0.8s', '0.1s', 'cubic-bezier(0.22,1,0.36,1) forwards') : { opacity: 0 }),
            }}
          >
            {/* Top glow line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(217,119,6,0.6), transparent)' }} />

            {/* Header */}
            <div className="mb-8">
              <div className="w-14 h-14 rounded-2xl mb-5 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(234,88,12,0.1))', border: '1px solid rgba(217,119,6,0.3)' }}>
                <ChefHat className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Welcome back 👋</h2>
              <p className="text-stone-400 text-sm mt-1.5">Sign in to your Sindhu Bakery account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div style={mounted ? animStyle('loginSlideUp', '0.5s', '0.3s', 'ease forwards') : { opacity: 0 }}>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div
                  className="relative rounded-xl transition-all duration-300"
                  style={{
                    border: `1px solid ${focusedField === 'email' ? 'rgba(217,119,6,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(217,119,6,0.15)' : 'none',
                  }}
                >
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
                    style={{ color: focusedField === 'email' ? '#f59e0b' : '#57534e' }} />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl text-white placeholder-stone-600 focus:outline-none text-sm"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div style={mounted ? animStyle('loginSlideUp', '0.5s', '0.4s', 'ease forwards') : { opacity: 0 }}>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div
                  className="relative rounded-xl transition-all duration-300"
                  style={{
                    border: `1px solid ${focusedField === 'password' ? 'rgba(217,119,6,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(217,119,6,0.15)' : 'none',
                  }}
                >
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
                    style={{ color: focusedField === 'password' ? '#f59e0b' : '#57534e' }} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl text-white placeholder-stone-600 focus:outline-none text-sm"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    id="toggle-password-visibility"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-amber-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div style={mounted ? animStyle('loginSlideUp', '0.5s', '0.5s', 'ease forwards') : { opacity: 0 }}>
                <button
                  id="login-submit"
                  type="submit"
                  disabled={isLoading}
                  className="login-btn w-full py-4 text-white font-black text-sm rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #ea580c)',
                    boxShadow: '0 8px 32px rgba(217,119,6,0.4), 0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>🍞 Enter Bakery Dashboard <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div
              className="mt-7 pt-5 flex items-center justify-center gap-2 text-stone-600 text-xs"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                ...(mounted ? animStyle('loginSlideUp', '0.5s', '0.6s', 'ease forwards') : { opacity: 0 }),
              }}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Secured · Admin &amp; Staff login supported</span>
            </div>
          </div>

          {/* Version */}
          <p
            className="text-center text-stone-700 text-xs mt-4"
            style={mounted ? animStyle('loginSlideUp', '0.5s', '0.7s', 'ease forwards') : { opacity: 0 }}
          >
            Sindhu Bakery POS · v2.0 · Kerala 🌴
          </p>
        </div>
      </div>
    </div>
  );
}
