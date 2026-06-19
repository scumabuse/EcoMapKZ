import { useState } from 'react';
import { motion } from 'framer-motion';
import { useReports } from '../hooks/useReports';
import { getForecastFromGemini } from '../lib/gemini';
import type { RegionStats, ForecastResult } from '../types';
import Loader from '../components/ui/Loader';
import { Brain, Calculator, BarChart3 } from 'lucide-react';
import { format, subDays } from 'date-fns';

/* ── Google Font: Outfit (used only on this page) ─────────────────── */
const outfitLink = document.getElementById('outfit-font');
if (!outfitLink) {
  const link = document.createElement('link');
  link.id = 'outfit-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap';
  document.head.appendChild(link);
}

const FONT = "'Outfit', sans-serif";

const REGIONS = [
  { name: 'Астана',     lat: 51.18, lng: 71.45, radius: 1.5 },
  { name: 'Алматы',    lat: 43.25, lng: 76.95, radius: 1.5 },
  { name: 'Шымкент',   lat: 42.30, lng: 69.59, radius: 1.5 },
  { name: 'Актобе',    lat: 50.27, lng: 57.21, radius: 2   },
  { name: 'Қарағанды', lat: 49.80, lng: 73.10, radius: 2   },
  { name: 'Тараз',     lat: 42.90, lng: 71.36, radius: 1.5 },
  { name: 'Павлодар',  lat: 52.28, lng: 76.97, radius: 1.5 },
  { name: 'Семей',     lat: 50.41, lng: 80.25, radius: 1.5 },
];

function riskColor(risk: number) {
  if (risk < 33) return '#4ade80';
  if (risk < 66) return '#fbbf24';
  return '#f87171';
}

function RiskGauge({ value, size = 100 }: { value: number; size?: number }) {
  const r = size * 0.42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = riskColor(value);
  const cx = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <motion.circle
          cx={cx} cy={cx} r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          className="risk-ring"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="absolute text-center">
        <p style={{ fontFamily: FONT, color, lineHeight: 1, fontSize: size * 0.22, fontWeight: 800 }}>{value}</p>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>риск</p>
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const { reports, loading: reportsLoading } = useReports();
  const [results, setResults] = useState<(RegionStats & ForecastResult)[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const computeStats = (): RegionStats[] => {
    const ago30 = subDays(new Date(), 30);
    const pollMap: Record<string, number> = { low: 0, medium: 1, high: 2 };
    return REGIONS.map((region) => {
      const inReg = reports.filter((r) =>
        Math.abs(r.latitude - region.lat) < region.radius &&
        Math.abs(r.longitude - region.lng) < region.radius
      );
      const recent = inReg.filter((r) => new Date(r.created_at) >= ago30).length;
      const avgPollution = inReg.length === 0 ? 0
        : inReg.reduce((acc, r) => acc + (pollMap[r.ai_pollution_level ?? 'low'] ?? 0), 0) / inReg.length;
      
      // Считаем риск региона от 0 до 100 на основе статистики:
      // - Общее количество (до 40 баллов, максимум за 20 обращений)
      const totalScore = Math.min(40, (inReg.length / 20) * 40);
      // - Недавняя активность (до 30 баллов, максимум за 10 обращений за 30 дней)
      const recentScore = Math.min(30, (recent / 10) * 30);
      // - Средний уровень загрязнения (до 30 баллов, где 2.0 это high)
      const pollScore = (avgPollution / 2) * 30;
      
      const riskScore = Math.min(100, Math.round(totalScore + recentScore + pollScore));
      return { name: region.name, lat: region.lat, lng: region.lng, total: inReg.length, recent, avgPollution, riskScore };
    });
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzed(false);
    try {
      const stats = computeStats();
      const aiForecasts = await getForecastFromGemini(stats);
      
      // Merge AI predictions with stats, matching by index
      const forecasts = stats.map((rs, i) => {
        const f = aiForecasts[i] || aiForecasts.find((a: any) => a.region === rs.name);
        return { ...rs, ...f };
      });
      setResults(forecasts);
    } catch {
      const stats = computeStats();
      setResults(stats.map((rs) => ({
        ...rs, risk: rs.riskScore,
        summary: rs.riskScore > 66 ? 'Высокий риск. Требуется немедленный контроль.'
          : rs.riskScore > 33 ? 'Умеренный риск. Рекомендуется мониторинг.'
          : 'Низкий риск. Ситуация стабильная.',
        trend: 'stable',
        factors: ['Недостаточно данных'],
        recommendations: ['Требуется дополнительный сбор данных']
      })));
    } finally {
      setAnalyzing(false);
      setAnalyzed(true);
    }
  };

  if (reportsLoading) return <Loader text="Загрузка..." />;

  return (
    <div className="page-container" style={{ fontFamily: FONT, position: 'relative', display: 'flex', flexDirection: 'column', gap: 40 }}>
      <div className="glow-orb" style={{ width: 500, height: 500, top: -80, right: -80, opacity: 0.05, background: '#fbbf24' }} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}
      >
        <div>
          <p style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 12 }}>AI Прогнозирование</p>
          <h1 style={{ fontFamily: FONT, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-1)', lineHeight: 1.05, marginBottom: 14 }}>
            Анализ риска
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 17, fontWeight: 500, color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.6 }}>
            Оценка вероятности появления свалок по 8 ключевым регионам Казахстана на основе исторических данных.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.9 }}
          onClick={handleAnalyze} disabled={analyzing}
          style={{
            fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '16px 32px', fontSize: 16, fontWeight: 700, borderRadius: 16, border: 'none',
            background: 'var(--amber)', color: '#0a0f08', cursor: 'pointer', flexShrink: 0,
            boxShadow: analyzing ? 'none' : '0 0 30px rgba(251,191,36,0.35)',
          }}
        >
          {analyzing ? <Loader text="" /> : <><Brain size={20} /> {analyzed ? 'Обновить' : 'Запустить анализ'}</>}
        </motion.button>
      </motion.div>

      {/* Formula card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 20, padding: '24px 28px',
          borderRadius: 20, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)',
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Calculator size={20} style={{ color: 'var(--amber)' }} />
        </div>
        <div>
          <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 8 }}>Формула расчёта индекса риска</p>
          <code style={{ fontFamily: 'monospace', fontSize: 13, padding: '6px 14px', borderRadius: 10, display: 'inline-block', background: 'rgba(255,255,255,0.05)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.15)' }}>
            R = Очки(Количество) + Очки(За 30 дней) + Очки(Загрязнение)
          </code>
          <p style={{ fontFamily: FONT, fontSize: 12, marginTop: 8, fontWeight: 500, color: 'var(--text-faint)' }}>
            Обновлено: {format(new Date(), 'dd.MM.yyyy HH:mm')} · База: {reports.length} обращений
          </p>
        </div>
      </motion.div>

      {/* Empty state */}
      {!analyzed && !analyzing && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ borderRadius: 24, border: '1.5px dashed rgba(255,255,255,0.1)', padding: '80px 40px', textAlign: 'center', background: 'var(--bg-card)' }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)' }}
          >
            <Brain size={44} style={{ color: 'rgba(251,191,36,0.35)' }} />
          </motion.div>
          <h3 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>Запустите анализ</h3>
          <p style={{ fontFamily: FONT, fontSize: 16, fontWeight: 500, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Нажмите «Запустить анализ», чтобы Gemini AI рассчитал индекс риска для каждого региона.
          </p>
        </motion.div>
      )}

      {/* Skeleton loading */}
      {analyzing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {REGIONS.map((r) => (
            <motion.div
              key={r.name}
              animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ borderRadius: 20, padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
              <div style={{ width: 72, height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
              <div style={{ width: 52, height: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Results */}
      {analyzed && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px rgba(74,222,128,0.7)' }} />
            <h2 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: 'var(--text-1)' }}>Результаты по регионам</h2>
          </div>

          {/* Detailed Cards List */}
          <div className="forecast-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
            {results.map((r, idx) => (
              <motion.div
                key={r.name}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.4, ease: "easeOut" }}
                style={{
                  fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 20,
                  padding: '28px', borderRadius: 20, border: '1px solid',
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header: Gauge + Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <RiskGauge value={r.risk} size={88} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: 'var(--text-1)', margin: 0 }}>{r.name}</h3>
                      {r.trend && (
                        <span style={{ 
                          padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          background: r.trend === 'increasing' ? 'rgba(248,113,113,0.1)' : r.trend === 'decreasing' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                          color: r.trend === 'increasing' ? 'var(--red)' : r.trend === 'decreasing' ? 'var(--green)' : 'var(--amber)'
                        }}>
                          {r.trend === 'increasing' ? '↗ Рост' : r.trend === 'decreasing' ? '↘ Спад' : '→ Стабильно'}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99,
                      background: `${riskColor(r.risk)}12`, color: riskColor(r.risk), border: `1px solid ${riskColor(r.risk)}30`,
                      display: 'inline-block'
                    }}>
                      {r.risk < 33 ? 'Уровень в норме' : r.risk < 66 ? 'Внимание, риск растёт' : 'Опасная ситуация'}
                    </span>
                  </div>
                </div>

                {/* AI Summary */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Brain size={14} style={{ color: 'var(--green)' }} />
                    <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)' }}>Анализ Gemini AI</span>
                  </div>
                  <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-2)', margin: 0 }}>
                    {r.summary}
                  </p>
                </div>

                {/* AI Factors & Recommendations */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {r.factors && r.factors.length > 0 && (
                    <div>
                      <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Факторы риска:</p>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {r.factors.slice(0, 3).map((factor, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.recommendations && r.recommendations.length > 0 && (
                    <div>
                      <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Рекомендации:</p>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {r.recommendations.slice(0, 2).map((rec, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

              </motion.div>
            ))}
          </div>



          {/* Table */}
          <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <BarChart3 size={18} style={{ color: 'var(--amber)' }} />
              <h3 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Сводная таблица</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontFamily: FONT }}>
                <thead>
                  <tr>
                    <th>#</th><th>Регион</th><th>Индекс риска</th>
                    <th>Всего обр.</th><th>За 30 дней</th><th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {[...results].sort((a, b) => b.risk - a.risk).map((r, i) => (
                    <motion.tr key={r.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                      <td><span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{i + 1}</span></td>
                      <td><span style={{ fontFamily: FONT, fontWeight: 700, color: 'var(--text-1)' }}>{r.name}</span></td>
                      <td>
                        <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: riskColor(r.risk) }}>{r.risk}</span>
                        <span style={{ fontSize: 12, marginLeft: 4, color: 'var(--text-faint)' }}>/100</span>
                      </td>
                      <td style={{ fontFamily: FONT, fontWeight: 600 }}>{r.total}</td>
                      <td style={{ fontFamily: FONT, fontWeight: 600 }}>{r.recent}</td>
                      <td>
                        <span className="badge" style={{ fontFamily: FONT, background: `${riskColor(r.risk)}12`, color: riskColor(r.risk), border: `1px solid ${riskColor(r.risk)}30` }}>
                          {r.risk < 33 ? '✓ Норма' : r.risk < 66 ? '⚠ Внимание' : '✕ Опасно'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
