import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { createReport, uploadPhoto, updateReportAI } from '../lib/supabase';
import { analyzeImageWithGemini } from '../lib/gemini';
import LocationPicker from '../components/map/LocationPicker';
import MapSearch from '../components/map/MapSearch';
import Loader from '../components/ui/Loader';
import toast from 'react-hot-toast';
import {
  Upload, X, Send, AlertCircle, CheckCircle,
  MapPin, FileText, Cpu, Camera, ArrowRight, Navigation
} from 'lucide-react';

const FONT = "'Outfit', sans-serif";

// Ensure Outfit font is loaded
if (!document.getElementById('outfit-font')) {
  const link = document.createElement('link');
  link.id = 'outfit-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap';
  document.head.appendChild(link);
}

type Step = 'idle' | 'uploading' | 'analyzing' | 'saving' | 'done';

const stepConfig: Record<Step, { label: string; color: string }> = {
  idle:      { label: '',                    color: 'var(--green)' },
  uploading: { label: 'Загрузка фото...',    color: 'var(--green)' },
  analyzing: { label: 'Gemini AI анализ...', color: 'var(--amber)' },
  saving:    { label: 'Сохранение...',       color: 'var(--green)' },
  done:      { label: 'Готово!',             color: 'var(--green)' },
};

function SectionCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '28px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 55%)',
      }} />
      {children}
    </motion.div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      {icon}
      <div>
        <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: 'var(--text-1)', lineHeight: 1.2 }}>{title}</p>
        <p style={{ fontFamily: FONT, fontWeight: 500, fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function IconBox({ bg, border, children }: { bg: string; border: string; children: React.ReactNode }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: bg, border: `1px solid ${border}` }}>
      {children}
    </div>
  );
}

export default function AddReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number; bbox?: [number, number, number, number] } | null>(null);
  const [step, setStep] = useState<'idle' | 'uploading' | 'analyzing' | 'saving' | 'success'>('idle');
  const [isLocating, setIsLocating] = useState(false);
  const [aiResult, setAiResult] = useState<{
    dump_detected: boolean; confidence: number;
    waste_types: string[]; pollution_level: string; hazardous_waste: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Ваш браузер не поддерживает геолокацию');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setFlyToLocation({ lat: latitude, lng: longitude });
        toast.success('Геолокация определена!', { icon: '📍' });
      },
      (err) => {
        setIsLocating(false);
        toast.error('Не удалось определить местоположение. Проверьте разрешения.', { icon: '⚠️' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Только изображения'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Максимум 10MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('Войдите в систему'); return; }
    if (!file) { toast.error('Добавьте фотографию'); return; }
    if (!location) { toast.error('Выберите местоположение'); return; }
    if (!description.trim()) { toast.error('Добавьте описание'); return; }

    try {
      setStep('uploading');
      const photoUrl = await uploadPhoto(file, user.id);

      setStep('saving');
      const report = await createReport({
        user_id: user.id, photo_url: photoUrl,
        description: description.trim(), latitude: location.lat, longitude: location.lng,
      });

      setStep('analyzing');
      let analysis = null;
      try {
        const base64 = await fileToBase64(file);
        analysis = await analyzeImageWithGemini(base64, file.type);
        setAiResult(analysis);
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : '';
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
          toast('AI превысил лимит запросов, повтор через 5с...', { icon: '⏳', duration: 6000 });
        } else {
          toast('AI недоступен, данные сохранены', { icon: '⚠️' });
        }
      }

      if (analysis) {
        setStep('saving');
        const pollMap: Record<string, number> = { low: 10, medium: 30, high: 50 };
        const risk = Math.round(
          (analysis.confidence * 0.3) +
          (pollMap[analysis.pollution_level] ?? 10) +
          (analysis.hazardous_waste ? 20 : 0)
        );
        await updateReportAI(report.id, {
          ai_is_dump: analysis.dump_detected, ai_confidence: analysis.confidence,
          ai_pollution_level: analysis.pollution_level, ai_waste_types: analysis.waste_types,
          ai_hazardous: analysis.hazardous_waste, risk_score: Math.min(100, risk),
          status: analysis.dump_detected && analysis.confidence >= 70 ? 'verified' : (analysis.dump_detected ? 'pending' : 'rejected'),
        });
      }

      setStep('done');
      toast.success('Обращение зарегистрировано!');
      setTimeout(() => navigate('/map'), 3000);
    } catch (err) {
      setStep('idle');
      toast.error(err instanceof Error ? err.message : 'Произошла ошибка');
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '40px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: '48px', textAlign: 'center', maxWidth: 440 }}>
          <AlertCircle size={48} style={{ color: 'var(--amber)', margin: '0 auto 20px' }} />
          <h2 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>Требуется авторизация</h2>
          <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 32 }}>
            Войдите в систему, чтобы добавлять обращения о свалках.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            Войти <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '40px' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 28, padding: '56px 48px', textAlign: 'center', maxWidth: 520, width: '100%' }}
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
            style={{ width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', background: 'rgba(74,222,128,0.1)', border: '2px solid rgba(74,222,128,0.3)', boxShadow: '0 0 40px rgba(74,222,128,0.15)' }}
          >
            <CheckCircle size={48} style={{ color: 'var(--green)' }} />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>
            Отличная работа!
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ fontFamily: FONT, fontSize: 16, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 32 }}>
            Ваше обращение зарегистрировано и отправлено на модерацию.
          </motion.p>

          {aiResult && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              style={{ textAlign: 'left', borderRadius: 20, padding: '24px 28px', marginBottom: 24, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Cpu size={16} style={{ color: 'var(--green)' }} />
                <p style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)' }}>Результаты Gemini AI</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: 'Свалка обнаружена', value: aiResult.dump_detected ? '⚠️ Да' : '✅ Нет' },
                  { label: 'Уверенность', value: `${aiResult.confidence}%` },
                  { label: 'Загрязнение', value: aiResult.pollution_level },
                  { label: 'Типы мусора', value: aiResult.waste_types.join(', ') || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: 'var(--text-faint)' }}>Перенаправление на карту...</p>
        </motion.div>
      </div>
    );
  }

  const isProcessing = step !== 'idle';

  return (
    <div style={{ fontFamily: FONT, padding: '104px 40px 80px', position: 'relative' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, top: -80, right: -80, opacity: 0.04, background: '#4ade80', position: 'absolute' }} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 12 }}>Новое обращение</p>
        <h1 style={{ fontFamily: FONT, fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-1)', lineHeight: 1.05, marginBottom: 14 }}>
          Сообщить о свалке
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 17, fontWeight: 500, color: 'var(--text-muted)', maxWidth: 540, lineHeight: 1.6 }}>
          Загрузите фото, добавьте описание и отметьте точку на карте. Gemini AI автоматически проанализирует изображение.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit}>
        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Left column: Photo + Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Photo */}
            <SectionCard delay={0.1}>
              <SectionHeader
                icon={<IconBox bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.2)"><Camera size={20} style={{ color: 'var(--green)' }} /></IconBox>}
                title="Фотография"
                subtitle="JPG, PNG, WEBP · до 10MB"
              />
              <AnimatePresence mode="wait">
                {preview ? (
                  <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', height: 260 }}>
                    <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button"
                      onClick={() => { setFile(null); setPreview(null); }}
                      style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', color: 'white', border: 'none', cursor: 'pointer' }}>
                      <X size={16} />
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    whileHover={{ borderColor: 'rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.03)' }}
                    style={{ borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, cursor: 'pointer', padding: '48px 20px', transition: 'all 0.2s', border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
                    onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
                    <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
                      <Upload size={28} style={{ color: 'var(--green)' }} />
                    </motion.div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>Нажмите или перетащите</p>
                      <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: 'var(--text-faint)' }}>JPG, PNG, WEBP · до 10MB</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>

            {/* Description */}
            <SectionCard delay={0.15}>
              <SectionHeader
                icon={<IconBox bg="rgba(251,191,36,0.1)" border="rgba(251,191,36,0.2)"><FileText size={20} style={{ color: 'var(--amber)' }} /></IconBox>}
                title="Описание"
                subtitle="Опишите ситуацию подробно"
              />
              <textarea
                rows={6}
                placeholder="Опишите масштаб загрязнения, тип мусора, возможный источник и другие важные детали..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  fontFamily: FONT, width: '100%', padding: '14px 18px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-md)', borderRadius: 14, color: 'var(--text-1)',
                  fontSize: 15, fontWeight: 500, lineHeight: 1.6, resize: 'none', outline: 'none',
                  transition: 'border-color 0.22s, box-shadow 0.22s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--green-dim)'; e.target.style.boxShadow = '0 0 0 3px var(--green-glow)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none'; }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: description.length > 450 ? 'var(--red)' : 'var(--text-faint)' }}>
                  {description.length}/500
                </span>
              </div>
            </SectionCard>
          </div>

          {/* Right column: Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 24,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Card header */}
            <div style={{ padding: '20px 24px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                <IconBox bg="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.2)">
                  <MapPin size={20} style={{ color: 'var(--red)' }} />
                </IconBox>
                <div>
                  <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: 'var(--text-1)', lineHeight: 1.2 }}>Местоположение</p>
                  <p style={{ fontFamily: FONT, fontWeight: 500, fontSize: 13, color: location ? 'var(--green)' : 'var(--text-muted)', marginTop: 2 }}>
                    {location ? `📍 ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Нажмите на карту или найдите адрес'}
                  </p>
                </div>
              </div>
              {/* Address search bar */}
              <MapSearch
                onLocationSelect={(lat, lng, bbox) => setFlyToLocation({ lat, lng, bbox })}
              />
            </div>

            {/* Map fills remaining height */}
            <div style={{ flex: 1, minHeight: 480, position: 'relative' }}>
              <LocationPicker value={location} onChange={setLocation} flyToLocation={flyToLocation} />
            </div>
            
            {/* Find my location button */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGetLocation}
                disabled={isLocating}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '14px', borderRadius: 14, fontFamily: FONT, fontWeight: 700, fontSize: 14,
                  background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)',
                  cursor: isLocating ? 'not-allowed' : 'pointer', opacity: isLocating ? 0.7 : 1
                }}
              >
                {isLocating ? <Loader text="" /> : <Navigation size={18} />}
                {isLocating ? 'Поиск спутников...' : 'Где я сейчас нахожусь?'}
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Processing status */}
        <AnimatePresence>
          {step !== 'idle' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '24px 32px', borderRadius: 20, marginBottom: 24, background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <Loader text="" />
              <div>
                <p style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{stepConfig[step].label}</p>
                <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, marginTop: 4, color: 'var(--text-muted)' }}>Пожалуйста, не закрывайте вкладку</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
          <motion.button
            whileHover={{ scale: isProcessing ? 1 : 1.02, y: isProcessing ? 0 : -2 }}
            whileTap={{ scale: isProcessing ? 1 : 0.97 }}
            type="submit" disabled={isProcessing}
            style={{
              fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '18px 40px', fontSize: 16, fontWeight: 700, borderRadius: 16, border: 'none',
              background: 'var(--green)', color: '#060d05', cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.5 : 1, boxShadow: isProcessing ? 'none' : '0 0 30px rgba(74,222,128,0.3)',
              transition: 'all 0.22s',
            }}
          >
            {isProcessing ? 'Обработка...' : <><Send size={18} /> Отправить на модерацию</>}
          </motion.button>
        </motion.div>
      </form>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
