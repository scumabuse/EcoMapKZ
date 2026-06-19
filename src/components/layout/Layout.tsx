import { Outlet, useLocation, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Map, PlusCircle, TrendingUp } from 'lucide-react';

const mobileNavItems = [
  { to: '/',         label: 'Главная',  icon: Home },
  { to: '/map',      label: 'Карта',    icon: Map },
  { to: '/add',      label: 'Добавить', icon: PlusCircle },
  { to: '/forecast', label: 'Прогноз',  icon: TrendingUp },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            style={{ minHeight: '100%' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom navigation — hidden on desktop via CSS */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {mobileNavItems.map(({ to, label, icon: Icon }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`mobile-nav-btn${isActive ? ' active' : ''}`}
              >
                <Icon size={22} />
                {label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
