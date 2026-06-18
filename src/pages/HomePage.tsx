import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getStats } from '../lib/supabase';
import { useReports } from '../hooks/useReports';
import StatCard from '../components/stats/StatCard';
import ReportCard from '../components/reports/ReportCard';
import Loader from '../components/ui/Loader';
import type { Stats } from '../types';
import {
  AlertTriangle, CheckCircle2, MapPin, Zap, ArrowRight,
  TrendingUp, Globe2, Cpu, Leaf
} from 'lucide-react';

/* ── Animation variants ─────────────────────────── */
const containerVariants: import('framer-motion').Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

const fadeUp: import('framer-motion').Variants = {
  hidden:  { opacity: 0, y: 36, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};


/* ── Feature data ───────────────────────────────── */
const features = [
  {
    icon: Cpu,
    title: 'Gemini Vision AI',
    desc: 'Автоматическое определение свалок, классификация типов мусора и оценка уровня загрязнения по фотографии.',
    accent: '#4ade80',
    tag: 'Активен',
  },
  {
    icon: Globe2,
    title: 'Интерактивная карта',
    desc: 'Все зарегистрированные точки в реальном времени на карте Казахстана. Тепловые слои и маркеры.',
    accent: '#fbbf24',
    tag: 'Live данные',
  },
  {
    icon: TrendingUp,
    title: 'Предиктивный анализ',
    desc: 'Расчёт индекса риска по 8 регионам и AI-прогноз появления несанкционированных свалок.',
    accent: '#f87171',
    tag: 'AI Model',
  },
];

/* ── Section header helper ──────────────────────── */
function SectionHeader({
  title, subtitle, extra,
}: { title: string; subtitle?: string; extra?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      style={{
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 32, gap: 16, flexWrap: 'wrap',
      }}
    >
      <div>
        <div className="section-label" style={{ marginBottom: subtitle ? 8 : 0 }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 24, fontWeight: 700,
            color: 'var(--text-1)',
          }}>
            {title}
          </h2>
        </div>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 500, marginLeft: 15 }}>
            {subtitle}
          </p>
        )}
      </div>
      {extra}
    </motion.div>
  );
}

/* ── Component ──────────────────────────────────── */
export default function HomePage() {
  const { user } = useAuth();
  const { reports, loading: reportsLoading } = useReports();
  const [stats, setStats]         = useState<Stats>({ total: 0, verified: 0, hazardous: 0, high_pollution: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    getStats().then(setStats).catch(console.error).finally(() => setStatsLoading(false));
  }, []);

  const recent = reports.slice(0, 6);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>

      {/* ── Ambient background ────────────────────── */}
      <div style={{
        position: 'absolute', width: 700, height: 700,
        top: '-15%', left: '-10%', borderRadius: '50%',
        background: '#4ade80', filter: 'blur(100px)',
        opacity: 0.04, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500,
        top: '40%', right: '-8%', borderRadius: '50%',
        background: '#fbbf24', filter: 'blur(100px)',
        opacity: 0.035, pointerEvents: 'none',
      }} />

      {/* ── Main container ───────────────────────── */}
      <div className="page-container" style={{ position: 'relative', zIndex: 1 }}>

        {/* ════════════════════════════════════════
            HERO
        ════════════════════════════════════════ */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center',
            paddingTop: 24, marginBottom: 96,
          }}
        >
          {/* Eyebrow pill */}
          <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', borderRadius: 99,
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)',
              color: 'var(--green)',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px rgba(74,222,128,0.8)',
                animation: 'pulse 2s infinite',
              }} />
              Система активна · Казахстан 🇰🇿
            </div>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            variants={fadeUp}
            className="heading-hero"
            style={{
              fontSize: 'clamp(52px, 8vw, 96px)',
              color: 'var(--text-1)',
              marginBottom: 24,
            }}
          >
            Вместе за<br />
            <span className="gradient-text">чистую</span> природу
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            style={{
              fontSize: 18, fontWeight: 500,
              maxWidth: 520, lineHeight: 1.75,
              color: 'var(--text-muted)',
              marginBottom: 44,
            }}
          >
            Платформа для обнаружения и мониторинга несанкционированных свалок
            с использованием искусственного интеллекта Gemini.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            className="btn-stack-mobile"
            style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 56 }}
          >
            {user ? (
              <Link to="/add">
                <motion.button
                  whileHover={{ scale: 1.04, y: -4, boxShadow: '0 16px 40px rgba(74,222,128,0.35)' }}
                  whileTap={{ scale: 0.96 }}
                  className="btn-primary"
                  style={{ padding: '14px 28px', fontSize: 15 }}
                >
                  Добавить обращение <ArrowRight size={17} />
                </motion.button>
              </Link>
            ) : (
              <Link to="/register">
                <motion.button
                  whileHover={{ scale: 1.04, y: -4, boxShadow: '0 16px 40px rgba(74,222,128,0.35)' }}
                  whileTap={{ scale: 0.96 }}
                  className="btn-primary"
                  style={{ padding: '14px 28px', fontSize: 15 }}
                >
                  Начать бесплатно <ArrowRight size={17} />
                </motion.button>
              </Link>
            )}
            <Link to="/map">
              <motion.button
                whileHover={{ scale: 1.03, y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="btn-ghost"
                style={{ padding: '14px 28px', fontSize: 15 }}
              >
                <MapPin size={17} /> Открыть карту
              </motion.button>
            </Link>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            variants={fadeUp}
            className="trust-strip"
            style={{
              display: 'flex', gap: 56, flexWrap: 'wrap', justifyContent: 'center',
              paddingTop: 36,
              borderTop: '1px solid var(--border)',
            }}
          >
            {[
              { n: '1 200+', label: 'Пользователей' },
              { n: '14',     label: 'Регионов' },
              { n: '99.9%',  label: 'Uptime' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
                style={{ textAlign: 'center' }}
              >
                <p style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 30, fontWeight: 700,
                  color: 'var(--text-1)',
                  marginBottom: 4,
                }}>
                  {s.n}
                </p>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                  {s.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ════════════════════════════════════════
            STAT CARDS
        ════════════════════════════════════════ */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader title="Статистика в реальном времени" />
          {statsLoading ? (
            <Loader text="Синхронизация..." />
          ) : (
            <div className="stats-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
            }}>
              <StatCard label="Всего обращений"     value={stats.total}         icon={<MapPin size={22} />}        accent="#4ade80" subtitle="За всё время"       index={0} />
              <StatCard label="Подтверждено"         value={stats.verified}      icon={<CheckCircle2 size={22} />}  accent="#fbbf24" subtitle="Верифицировано"      index={1} />
              <StatCard label="Опасные отходы"       value={stats.hazardous}     icon={<AlertTriangle size={22} />} accent="#f87171" subtitle="Требуют внимания"    index={2} />
              <StatCard label="Высокое загрязнение"  value={stats.high_pollution} icon={<Zap size={22} />}          accent="#a3e635" subtitle="Критический уровень" index={3} />
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════
            FEATURES
        ════════════════════════════════════════ */}
        <section style={{ marginBottom: 80 }}>
          <SectionHeader
            title="Возможности платформы"
            subtitle="Передовые технологии для защиты экологии Казахстана"
          />
          <div className="features-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {features.map(({ icon: Icon, title, desc, accent, tag }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -8, transition: { duration: 0.28, ease: 'easeOut' } }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '32px 28px',
                  boxShadow: 'var(--shadow-card)',
                  position: 'relative', overflow: 'hidden',
                  cursor: 'default',
                  transition: 'border-color 0.25s',
                }}
              >
                {/* Corner glow */}
                <div style={{
                  position: 'absolute', top: -40, right: -30,
                  width: 130, height: 130, borderRadius: '50%',
                  background: accent, filter: 'blur(45px)', opacity: 0.1,
                  pointerEvents: 'none',
                }} />
                {/* Shimmer top line */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                  background: `linear-gradient(90deg, transparent, ${accent}40, transparent)`,
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Icon */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${accent}12`,
                    border: `1px solid ${accent}28`,
                    marginBottom: 20,
                  }}>
                    <Icon size={24} style={{ color: accent }} />
                  </div>

                  {/* Title + tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>
                      {title}
                    </h3>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      padding: '3px 9px', borderRadius: 99,
                      background: `${accent}15`,
                      color: accent,
                      border: `1px solid ${accent}25`,
                      letterSpacing: '0.04em',
                    }}>
                      {tag}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: 14, lineHeight: 1.75,
                    color: 'var(--text-muted)', fontWeight: 500,
                  }}>
                    {desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════
            RECENT REPORTS
        ════════════════════════════════════════ */}
        <section style={{ paddingBottom: 24 }}>
          <SectionHeader
            title="Лента обращений"
            extra={
              <Link to="/map" style={{ textDecoration: 'none' }}>
                <motion.div
                  whileHover={{ x: 5 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 700, color: 'var(--green)',
                  }}
                >
                  Все на карте <ArrowRight size={15} />
                </motion.div>
              </Link>
            }
          />

          {reportsLoading ? (
            <Loader text="Загрузка данных..." />
          ) : recent.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-md)',
                borderRadius: 20, padding: '56px 32px',
                textAlign: 'center',
              }}
            >
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.1)',
              }}>
                <Leaf size={32} style={{ color: 'var(--text-faint)' }} />
              </div>
              <h3 style={{
                fontFamily: 'Syne, sans-serif', fontSize: 20,
                fontWeight: 700, color: 'var(--text-1)', marginBottom: 12,
              }}>
                Пока чисто!
              </h3>
              <p style={{
                fontWeight: 500, maxWidth: 360, margin: '0 auto',
                color: 'var(--text-muted)', marginBottom: 32,
              }}>
                В системе ещё нет зарегистрированных свалок. Будьте первым, кто поможет сделать природу чище.
              </p>
              {user && (
                <Link to="/add">
                  <motion.button
                    whileHover={{ y: -3, boxShadow: '0 12px 30px rgba(74,222,128,0.3)' }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-primary"
                    style={{ padding: '13px 28px', fontSize: 14 }}
                  >
                    Добавить первое обращение
                  </motion.button>
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="reports-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 20,
            }}>
              {recent.map((r, i) => (
                <ReportCard key={r.id} report={r} index={i} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
