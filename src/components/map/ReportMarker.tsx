import { divIcon } from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Report } from '../../types';
import Badge from '../ui/Badge';

interface ReportMarkerProps {
  report: Report;
}

const pollutionColor: Record<string, string> = {
  low: '#00e676',
  medium: '#ffd600',
  high: '#ff3d00',
  null: '#8b9abf',
};

function makeIcon(color: string) {
  return divIcon({
    className: '',
    html: `
      <div style="
        width:14px; height:14px; border-radius:50%;
        background:${color};
        border:2px solid rgba(255,255,255,0.8);
        box-shadow: 0 0 10px ${color}88, 0 2px 6px rgba(0,0,0,0.4);
        position:relative;
      ">
        <div style="
          position:absolute; inset:-4px; border-radius:50%;
          background:${color}22;
          animation: pulse 2s infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0%,100%{transform:scale(1);opacity:1}
          50%{transform:scale(1.8);opacity:0}
        }
      </style>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

export default function ReportMarker({ report }: ReportMarkerProps) {
  const level = report.ai_pollution_level ?? 'null';
  const color = pollutionColor[level] ?? pollutionColor['null'];
  const icon = makeIcon(color);

  return (
    <Marker position={[report.latitude, report.longitude]} icon={icon}>
      <Popup minWidth={280} maxWidth={320}>
        <div className="p-1 space-y-3">
          {/* Photo */}
          {report.photo_url && (
            <img
              src={report.photo_url}
              alt="Свалка"
              className="w-full rounded-lg object-cover"
              style={{ height: '160px' }}
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          )}

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={report.status} />
            {report.ai_pollution_level && (
              <Badge variant={report.ai_pollution_level} />
            )}
            {report.ai_hazardous && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium badge-high">
                ⚠️ Опасные отходы
              </span>
            )}
          </div>

          {/* Description */}
          {report.description && (
            <p className="text-sm leading-loose" style={{ color: 'var(--text-secondary)' }}>
              {report.description}
            </p>
          )}

          {/* AI Analysis */}
          {report.risk_score !== undefined && (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-green)' }}>
                Уровень риска (AI)
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${report.risk_score}%`,
                      background: `linear-gradient(90deg, var(--accent-green), var(--accent-blue))`,
                    }}
                  />
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {report.risk_score}%
                </span>
              </div>
              {report.ai_waste_types && report.ai_waste_types.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Типы: {report.ai_waste_types.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {format(new Date(report.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}
