import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Map, PlusCircle, TrendingUp,
  Leaf, Menu, X, LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/',         label: 'Главная',      icon: Home,        desc: 'Обзор платформы' },
  { to: '/map',      label: 'Карта',        icon: Map,         desc: 'Все точки на карте' },
  { to: '/add',      label: 'Добавить',     icon: PlusCircle,  desc: 'Новое обращение' },
  { to: '/forecast', label: 'Прогноз',      icon: TrendingUp,  desc: 'AI предиктив' },
];

const sidebarVariants = {
  open:   { x: 0,            opacity: 1 },
  closed: { x: '-100%',      opacity: 0 },
};

const itemVariants: import('framer-motion').Variants = {
  hidden:  { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: 0.05 * i, duration: 0.35 },
  }),
};

export default function Sidebar() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('До свидания!');
    navigate('/login');
  };

  const links = navItems;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="border-b"
        style={{ padding: '40px 32px', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center" style={{ gap: '16px' }}>
          <div
            className="rounded-[16px] flex items-center justify-center flex-shrink-0"
            style={{
              width: '48px', height: '48px',
              background: 'linear-gradient(135deg, #4ade80, #22c55e)',
              boxShadow: '0 0 24px rgba(74,222,128,0.35)',
            }}
          >
            <Leaf size={24} color="#0a0f08" />
          </div>
          <div>
            <p className="font-bold leading-tight" style={{ fontSize: '20px', fontFamily: 'Syne, sans-serif', color: 'var(--text-1)' }}>
              EcoMap <span className="gradient-text">KZ</span>
            </p>
            <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--text-muted)' }}>v2.0 · Мониторинг</p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p className="label-caps" style={{ padding: '0 16px', marginBottom: '16px', fontSize: '11px' }}>Навигация</p>
        {links.map(({ to, label, icon: Icon, desc }, i) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);
          return (
            <motion.div
              key={to}
              custom={i}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <NavLink
                to={to}
                end={to === '/'}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setIsOpen(false)}
                style={{ padding: '16px', gap: '16px', borderRadius: '16px' }}
              >
                <div className="link-icon" style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold leading-tight" style={{ fontSize: '15px' }}>{label}</p>
                  <p className="truncate" style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-faint)' }}>{desc}</p>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="rounded-full flex-shrink-0"
                    style={{ width: '8px', height: '8px', background: 'var(--green)', boxShadow: '0 0 10px rgba(74,222,128,0.6)' }}
                  />
                )}
              </NavLink>
            </motion.div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t" style={{ padding: '32px 24px', borderColor: 'var(--border)' }}>
        {user ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-col"
            style={{ gap: '12px' }}
          >
            {/* User card */}
            <div
              className="flex items-center rounded-[20px]"
              style={{ gap: '16px', padding: '16px', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}
            >
              <div
                className="rounded-[14px] flex items-center justify-center font-bold flex-shrink-0"
                style={{
                  width: '44px', height: '44px', fontSize: '18px',
                  background: isAdmin
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    : 'linear-gradient(135deg, #4ade80, #22c55e)',
                  color: '#0a0f08',
                }}
              >
                {user.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-bold truncate" style={{ fontSize: '15px', color: 'var(--text-1)' }}>
                  {user.email?.split('@')[0]}
                </p>
                <p style={{ fontSize: '12px', marginTop: '2px', color: isAdmin ? 'var(--amber)' : 'var(--text-muted)' }}>
                  {isAdmin ? '⚡ Admin' : 'Пользователь'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center rounded-[16px] font-bold transition-all"
              style={{ gap: '12px', padding: '16px', fontSize: '15px', color: 'var(--red)', background: 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-bg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <LogOut size={18} /> Выйти из системы
            </button>
          </motion.div>
        ) : (
          <NavLink to="/login" className="nav-link" style={{ padding: '16px', gap: '16px' }}>
            <div className="link-icon" style={{ width: '40px', height: '40px' }}><LogOut size={20} /></div>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>Войти</span>
          </NavLink>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Global toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        className="fixed z-50 flex items-center justify-center rounded-[16px]"
        style={{ 
          top: '24px', left: '24px', width: '56px', height: '56px',
          background: 'var(--bg-elevated)', 
          border: '1px solid var(--border)', 
          boxShadow: 'var(--shadow-float)',
          backdropFilter: 'blur(10px)'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isOpen ? 'x' : 'menu'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {isOpen ? <X size={24} style={{ color: 'var(--text-1)' }} /> : <Menu size={24} style={{ color: 'var(--text-1)' }} />}
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial="closed"
            animate="open"
            exit="closed"
            variants={sidebarVariants}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed top-0 left-0 h-full z-50"
            style={{
              width: 'var(--sidebar-w)',
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border-md)',
              boxShadow: '0 0 50px rgba(0,0,0,0.5)'
            }}
          >
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
