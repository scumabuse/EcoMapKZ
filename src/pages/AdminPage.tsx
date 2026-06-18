import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useReports } from '../hooks/useReports';
import { updateReportStatus, deleteReport, updateReportAI, supabase } from '../lib/supabase';
import { analyzeImageWithGemini } from '../lib/gemini';
import ReportCard from '../components/reports/ReportCard';
import Loader from '../components/ui/Loader';
import toast from 'react-hot-toast';
import {
  Shield, Filter, CheckCircle2, XCircle, Clock,
  Search, List, Grid, Trash2, BarChart3, Cpu
} from 'lucide-react';
import type { Report } from '../types';


type FilterStatus = 'all' | 'pending' | 'verified' | 'rejected';

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { reports, loading, refetch } = useReports();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const handleStatusChange = async (id: string, status: 'pending' | 'verified' | 'rejected') => {
    try {
      await updateReportStatus(id, status);
      toast.success('Статус обновлён');
      await refetch();
    } catch { toast.error('Ошибка'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить обращение?')) return;
    try {
      await deleteReport(id);
      toast.success('Удалено');
      await refetch();
    } catch { toast.error('Ошибка удаления'); }
  };

  const handleBulkAnalyze = async () => {
    if (bulkRunning) return;
    // Fetch reports that have a photo but no AI analysis yet
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .not('photo_url', 'is', null)
      .is('ai_confidence', null);
    if (error || !data || data.length === 0) {
      toast('Нет репортов без AI-анализа', { icon: 'ℹ️' });
      return;
    }
    const queue = data as Report[];
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: queue.length });
    toast(`Запускаю анализ ${queue.length} фото...`, { icon: '🤖', duration: 4000 });

    let success = 0;
    let failed = 0;
    for (let i = 0; i < queue.length; i++) {
      const report = queue[i];
      try {
        // Fetch image → base64
        const imgRes = await fetch(report.photo_url!);
        const buf = await imgRes.arrayBuffer();
        const uint8 = new Uint8Array(buf);
        let bin = '';
        for (let b = 0; b < uint8.length; b++) bin += String.fromCharCode(uint8[b]);
        const base64 = btoa(bin);
        const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg';

        const analysis = await analyzeImageWithGemini(base64, mimeType);
        const pollMap: Record<string, number> = { low: 10, medium: 30, high: 50 };
        const risk = Math.min(100, Math.round(
          (analysis.confidence * 0.3) +
          (pollMap[analysis.pollution_level] ?? 10) +
          (analysis.hazardous_waste ? 20 : 0)
        ));
        await updateReportAI(report.id, {
          ai_is_dump: analysis.dump_detected,
          ai_confidence: analysis.confidence,
          ai_pollution_level: analysis.pollution_level,
          ai_waste_types: analysis.waste_types,
          ai_hazardous: analysis.hazardous_waste,
          risk_score: risk,
          status: analysis.dump_detected && analysis.confidence >= 70 ? 'verified' : (analysis.dump_detected ? 'pending' : 'rejected'),
        });
        success++;
      } catch {
        failed++;
      }
      setBulkProgress({ done: i + 1, total: queue.length });
      // 2s pause between requests to avoid rate limiting
      if (i < queue.length - 1) await new Promise((r) => setTimeout(r, 2000));
    }

    setBulkRunning(false);
    setBulkProgress(null);
    toast.success(`Готово: ${success} проанализировано, ${failed} ошибок`);
    await refetch();
  };

  if (authLoading) return <Loader />;

  if (!isAdmin) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[80vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-14 text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <Shield size={40} style={{ color: 'var(--red)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Syne', color: 'var(--text-1)' }}>
            Доступ запрещён
          </h2>
          <p className="mb-8 font-medium" style={{ color: 'var(--text-muted)' }}>
            Эта страница доступна только администраторам.
          </p>
          <button onClick={() => navigate('/')} className="btn-ghost">← На главную</button>
        </motion.div>
      </div>
    );
  }

  if (!passwordOk) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[80vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-14 text-center max-w-md w-full"
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <Shield size={40} style={{ color: 'var(--green)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Syne', color: 'var(--text-1)' }}>
            Вход в админку
          </h2>
          <p className="mb-6 font-medium" style={{ color: 'var(--text-muted)' }}>
            Введите пароль для доступа
          </p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput === '123456') {
              setPasswordOk(true);
            } else {
              toast.error('Неверный пароль');
            }
          }} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Пароль..."
              className="eco-input"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary w-full justify-center">
              Войти
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const counts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    verified: reports.filter((r) => r.status === 'verified').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
  };

  const filtered: Report[] = reports.filter((r) => {
    const matchStatus = filter === 'all' || r.status === filter;
    const matchSearch = !search ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.id.includes(search);
    return matchStatus && matchSearch;
  });

  const filterTabs = [
    { key: 'all'      as const, label: 'Все',       count: counts.all,      icon: <Filter size={14} />,      color: 'var(--text-2)' },
    { key: 'pending'  as const, label: 'Ожидают',   count: counts.pending,  icon: <Clock size={14} />,       color: 'var(--amber)'  },
    { key: 'verified' as const, label: 'Одобрено',  count: counts.verified, icon: <CheckCircle2 size={14} />,color: 'var(--green)'  },
    { key: 'rejected' as const, label: 'Отклонено', count: counts.rejected, icon: <XCircle size={14} />,     color: 'var(--red)'    },
  ];

  return (
    <div className="page-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 48 }}>
      <div className="glow-orb w-[500px] h-[500px] -top-20 -right-20 opacity-[0.04]" style={{ background: '#4ade80' }} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="admin-header flex flex-col md:flex-row md:items-end justify-between gap-8"
      >
        <div>
          <p className="label-caps mb-3" style={{ color: 'var(--green)' }}>Только для администраторов</p>
          <h1 className="text-5xl font-bold" style={{ fontFamily: 'Syne', color: 'var(--text-1)' }}>
            Центр управления
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Bulk AI button */}
          <motion.button
            whileHover={{ scale: bulkRunning ? 1 : 1.03, y: bulkRunning ? 0 : -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBulkAnalyze}
            disabled={bulkRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12, cursor: bulkRunning ? 'not-allowed' : 'pointer',
              background: bulkRunning ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.12)',
              color: 'var(--green)', fontWeight: 700, fontSize: 13,
              border: '1px solid rgba(74,222,128,0.2)',
              opacity: bulkRunning ? 0.7 : 1,
            }}
          >
            <Cpu size={15} />
            {bulkRunning && bulkProgress
              ? `${bulkProgress.done} / ${bulkProgress.total}`
              : 'Анализировать все'}
          </motion.button>

          {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          {(['table', 'grid'] as const).map((v) => (
            <motion.button
              key={v}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView(v)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all"
              style={view === v
                ? { background: 'rgba(74,222,128,0.12)', color: 'var(--green)', border: '1px solid rgba(74,222,128,0.2)' }
                : { color: 'var(--text-muted)' }
              }
            >
              {v === 'table' ? <List size={16} /> : <Grid size={16} />}
              {v === 'table' ? 'Таблица' : 'Карточки'}
            </motion.button>
          ))}
          </div>
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="admin-filter-grid grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {filterTabs.map(({ key, label, count, icon, color }, i) => (
          <motion.button
            key={key}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setFilter(key)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card p-7 text-left relative"
            style={filter === key
              ? { borderColor: color, boxShadow: `0 0 20px ${color}20` }
              : {}
            }
          >
            <div className="flex items-center justify-between mb-3">
              <span style={{ color }}>{icon}</span>
              {filter === key && (
                <motion.div
                  layoutId="filter-dot"
                  className="w-2 h-2 rounded-full"
                  style={{ background: color }}
                />
              )}
            </div>
            <p className="text-3xl font-bold mb-1" style={{ fontFamily: 'Syne', color: 'var(--text-1)' }}>
              {count}
            </p>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </motion.button>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
        <input
          type="text"
          className="eco-input"
          style={{ paddingLeft: '46px' }}
          placeholder="Поиск по описанию или ID обращения..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </motion.div>

      {/* Content */}
      {loading ? (
        <Loader text="Загрузка базы данных..." />
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-16 text-center"
          style={{ borderStyle: 'dashed' }}
        >
          <Filter size={40} style={{ color: 'var(--text-faint)', margin: '0 auto 16px' }} />
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Syne', color: 'var(--text-1)' }}>
            Ничего не найдено
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>Измените фильтр или поисковый запрос</p>
        </motion.div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
          {filtered.map((r, i) => (
            <ReportCard key={r.id} report={r} showActions onDelete={handleDelete}
              onStatusChange={handleStatusChange} index={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card overflow-hidden"
        >
          <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <BarChart3 size={18} style={{ color: 'var(--green)' }} />
              <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>
                {filtered.length} обращений
              </h3>
            </div>
          </div>
          <div className="table-wrapper overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Фото</th>
                  <th>Описание</th>
                  <th>Координаты</th>
                  <th>Gemini AI</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td>
                      {r.photo_url ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden"
                          style={{ border: '1px solid var(--border)' }}>
                          <img src={r.photo_url} alt="" className="w-full h-full object-cover"
                            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-faint)', fontSize: '20px' }}>📷</span>
                        </div>
                      )}
                    </td>
                    <td className="max-w-[180px]">
                      <p className="truncate font-semibold" style={{ color: 'var(--text-1)' }}
                        title={r.description ?? ''}>
                        {r.description ?? <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>—</span>}
                      </p>
                    </td>
                    <td>
                      <code className="text-[11px] font-mono px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </code>
                    </td>
                    <td>
                      {r.ai_confidence !== null ? (
                        <div>
                          <p className="text-[11px] font-bold mb-1"
                            style={{ color: r.ai_is_dump ? 'var(--red)' : 'var(--green)' }}>
                            {r.ai_is_dump ? '⚠ Свалка' : '✓ Чисто'}
                          </p>
                          <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            {r.ai_confidence}% · {r.ai_pollution_level}
                          </p>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={r.status}
                        onChange={(e) => handleStatusChange(r.id, e.target.value as 'pending' | 'verified' | 'rejected')}
                        className="status-select"
                        style={{
                          color: r.status === 'verified' ? 'var(--green)'
                               : r.status === 'rejected' ? 'var(--red)' : 'var(--amber)',
                        }}
                      >
                        <option value="pending">⏳ Ожидает</option>
                        <option value="verified">✓ Одобрено</option>
                        <option value="rejected">✕ Отклонено</option>
                      </select>
                    </td>
                    <td>
                      <p className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {new Date(r.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </td>
                    <td>
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => handleDelete(r.id)}
                        className="btn-red"
                      >
                        <Trash2 size={13} /> Удалить
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
