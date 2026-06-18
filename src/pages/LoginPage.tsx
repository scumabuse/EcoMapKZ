import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Leaf } from 'lucide-react';
import Loader from '../components/ui/Loader';

const floatVariants = {
  initial: { opacity: 0, y: 40, scale: 0.94 },
  animate: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const fieldVariants = {
  initial: { opacity: 0, x: -16 },
  animate: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: 0.3 + i * 0.1, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export default function LoginPage() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Заполните все поля'); return; }
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Добро пожаловать!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message ?? 'Неверный email или пароль');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* ── Ambient glows ─────────────────────────── */}
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.07, 0.14, 0.07] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 700, height: 700, top: '-20%', left: '-20%',
          background: 'radial-gradient(circle, #4ade80, transparent)',
          filter: 'blur(80px)',
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 500, height: 500, bottom: '-15%', right: '-10%',
          background: 'radial-gradient(circle, #fbbf24, transparent)',
          filter: 'blur(80px)',
        }}
      />

      {/* ── Card ──────────────────────────────────── */}
      <motion.div
        variants={floatVariants}
        initial="initial"
        animate="animate"
        className="relative z-10 w-full"
        style={{ maxWidth: 460, padding: '0 20px' }}
      >
        {/* Logo section */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}
            style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}
          >
            <div style={{
              width: 72, height: 72,
              borderRadius: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #4ade80, #22c55e)',
              boxShadow: '0 0 60px rgba(74,222,128,0.45), 0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <Leaf size={32} color="#060d05" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 40, fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-1)',
              marginBottom: 10,
            }}
          >
            EcoMap <span className="gradient-text">KZ</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            style={{ color: 'var(--text-muted)', fontSize: 16, fontWeight: 500 }}
          >
            Вход в платформу
          </motion.p>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={handleSubmit}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: '40px 36px',
            boxShadow: 'var(--shadow-lg)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle top highlight */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.3), transparent)',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
            {/* Email field */}
            <motion.div custom={0} variants={fieldVariants} initial="initial" animate="animate">
              <label className="label-caps" style={{ display: 'block', marginBottom: 10 }}>Email</label>
              <div className="input-wrap">
                <Mail size={17} className="ico" />
                <input
                  type="email"
                  className="eco-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </motion.div>

            {/* Password field */}
            <motion.div custom={1} variants={fieldVariants} initial="initial" animate="animate">
              <label className="label-caps" style={{ display: 'block', marginBottom: 10 }}>Пароль</label>
              <div className="input-wrap">
                <Lock size={17} className="ico" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="eco-input"
                  style={{ paddingRight: 48 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 16, top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={showPass ? 'eye' : 'eyeoff'}
                      initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.5, rotate: 15 }}
                      transition={{ duration: 0.18 }}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </motion.div>
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>
          </div>

          {/* Submit button */}
          <motion.button
            whileHover={{ scale: 1.025, y: -3, boxShadow: '0 14px 40px rgba(74,222,128,0.35)' }}
            whileTap={{ scale: 0.96 }}
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '16px 28px', fontSize: 16, borderRadius: 14 }}
          >
            {loading
              ? <Loader text="" />
              : <><span>Войти в систему</span><ArrowRight size={18} /></>
            }
          </motion.button>

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'var(--border)',
            margin: '28px 0',
          }} />

          {/* Footer link */}
          <p style={{
            textAlign: 'center', fontSize: 14,
            fontWeight: 500, color: 'var(--text-muted)',
          }}>
            Нет аккаунта?{' '}
            <Link
              to="/register"
              style={{
                color: 'var(--green)', fontWeight: 700,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Зарегистрироваться
            </Link>
          </p>
        </motion.form>
      </motion.div>
    </div>
  );
}
