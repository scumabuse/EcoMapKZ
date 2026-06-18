import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useReports } from '../hooks/useReports';
import ReportMarker from '../components/map/ReportMarker';
import HeatMapLayer from '../components/map/HeatMapLayer';
import Loader from '../components/ui/Loader';
import { Map, Flame, Layers } from 'lucide-react';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import MapSearch from '../components/map/MapSearch';

type TargetLocation = {
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // south, north, west, east
};

function MapController({ targetLocation }: { targetLocation: TargetLocation | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetLocation) {
      if (targetLocation.bbox) {
        const [south, north, west, east] = targetLocation.bbox;
        map.flyToBounds([
          [south, west], // SouthWest
          [north, east]  // NorthEast
        ], {
          duration: 2,
          maxZoom: 18,
          padding: [50, 50]
        });
      } else {
        map.flyTo([targetLocation.lat, targetLocation.lng], 16, {
          duration: 2
        });
      }
    }
  }, [targetLocation, map]);
  return null;
}

function useHeatScript() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const L = (window as any).L;
    if (L?.heatLayer) { setReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);
  return ready;
}

const legendItems = [
  { color: '#0ea5e9', label: 'Единичные точки' },
  { color: '#22c55e', label: 'Небольшое скопление' },
  { color: '#fbbf24', label: 'Среднее скопление' },
  { color: '#f97316', label: 'Высокая плотность' },
  { color: '#ef4444', label: 'Критическая зона' },
];

export default function MapPage() {
  const { reports, loading } = useReports();
  const [mode, setMode] = useState<'markers' | 'heat'>('markers');
  const [targetLocation, setTargetLocation] = useState<TargetLocation | null>(null);
  const heatReady = useHeatScript();

  if (loading) return <Loader text="Загрузка карты..." />;

  return (
    <div className="relative map-full" style={{ overflow: 'hidden' }}>
      {/* ── Search bar: Desktop = next to hamburger, Mobile = full-width below ── */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="map-search-wrap absolute z-[1000]"
        style={{ top: '24px', left: '104px' }}
      >
        <MapSearch
          onLocationSelect={(lat, lng, bbox) => setTargetLocation({ lat, lng, bbox })}
        />
      </motion.div>

      {/* ── Controls (Top Right): Mode toggle + Count ── */}
      <div className="map-controls-top absolute z-[1000] flex flex-col" style={{ top: '24px', right: '24px', gap: '12px' }}>
        {/* Mode toggle — compact icon-only on mobile, full label on desktop */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="map-mode-toggle flex rounded-[20px]"
          style={{ gap: '6px', padding: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-md)', backdropFilter: 'blur(20px)' }}
        >
          {[
            { key: 'markers' as const, label: 'Маркеры', icon: <Map size={18} /> },
            { key: 'heat'    as const, label: 'Тепло',   icon: <Flame size={18} /> },
          ].map(({ key, label, icon }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMode(key)}
              title={label}
              className="map-mode-btn flex items-center rounded-[14px] font-bold transition-all"
              style={mode === key
                ? { gap: '10px', padding: '10px 20px', background: 'rgba(74,222,128,0.12)', color: 'var(--green)', border: '1px solid rgba(74,222,128,0.2)', fontSize: 14 }
                : { gap: '10px', padding: '10px 20px', color: 'var(--text-muted)', fontSize: 14 }
              }
            >
              {icon} <span className="map-mode-label">{label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Count card — hidden on mobile via CSS */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="map-count-card rounded-[20px]"
          style={{ padding: '20px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border-md)', backdropFilter: 'blur(20px)' }}
        >
          <p className="label-caps" style={{ marginBottom: '6px', fontSize: '11px' }}>Точек на карте</p>
          <p className="font-bold" style={{ fontSize: '32px', fontFamily: 'Syne', color: 'var(--green)', lineHeight: 1.1 }}>
            {reports.length}
          </p>
        </motion.div>
      </div>


      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="map-legend-wrap absolute bottom-10 left-8 z-[1000]"
      >
        <div
          className="rounded-[32px] min-w-[300px]"
          style={{ padding: '28px 36px', background: 'var(--bg-surface)', border: '1px solid var(--border-md)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex items-center" style={{ gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <Layers size={16} style={{ color: 'var(--text-muted)' }} />
            <p className="label-caps" style={{ fontSize: '13px' }}>Уровень загрязнения</p>
          </div>
          <div className="flex flex-col" style={{ gap: '16px' }}>
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center" style={{ gap: '16px' }}>
                <div
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: '18px', height: '18px',
                    background: item.color,
                    boxShadow: `0 0 12px ${item.color}`,
                    border: '2px solid rgba(255,255,255,0.15)',
                  }}
                />
                <span className="font-bold tracking-wide" style={{ fontSize: '14px', color: 'var(--text-1)' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <MapContainer
        center={[48.0196, 66.9237]}
        zoom={5}
        minZoom={3}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          noWrap={true}
          bounds={[[-90, -180], [90, 180]]}
        />
        <MapController targetLocation={targetLocation} />
        {mode === 'markers' && reports.map((r) => <ReportMarker key={r.id} report={r} />)}
        {mode === 'heat' && heatReady && <HeatMapLayer reports={reports} />}
      </MapContainer>
    </div>
  );
}
