import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Report } from '../../types';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

interface HeatMapLayerProps {
  reports: Report[];
}

/** Haversine distance in km */
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Pollution level → weight multiplier */
const pollutionWeight: Record<string, number> = {
  high:   3.0,
  medium: 2.0,
  low:    1.0,
};

/** Cluster radius: reports within this distance count as neighbours */
const RADIUS_KM = 100;

export default function HeatMapLayer({ reports }: HeatMapLayerProps) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Remove old layer
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    if (reports.length === 0) return;

    // Weight of each individual report based on its pollution level and risk score
    const reportWeight = (r: Report): number => {
      const pollW = pollutionWeight[r.ai_pollution_level ?? 'low'] ?? 1.0;
      // risk_score is 0-100, normalize to 0.5-1.5 range as additional multiplier
      const riskW = r.risk_score > 0 ? 0.5 + (r.risk_score / 100) : 1.0;
      return pollW * riskW;
    };

    // Weighted density: sum of neighbour weights within RADIUS_KM
    const density = reports.map((r) =>
      reports.reduce((sum, other) => {
        const d = distKm(r.latitude, r.longitude, other.latitude, other.longitude);
        return d <= RADIUS_KM ? sum + reportWeight(other) : sum;
      }, 0)
    );

    const maxDensity = Math.max(...density, 1);

    // Build [lat, lng, intensity] — intensity is weighted density
    const points = reports.map((r, i) => [r.latitude, r.longitude, density[i]]);

    const L = window.L;
    if (!L?.heatLayer) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as any).heatLayer(points, {
      radius: 60,
      blur: 50,
      maxZoom: 18,
      max: maxDensity,
      minOpacity: 0.4,
      gradient: {
        0.0:  '#1e40af', // deep blue  — isolated low-risk
        0.25: '#0ea5e9', // sky blue   — small/low cluster
        0.50: '#22c55e', // green      — moderate
        0.70: '#fbbf24', // amber      — notable
        0.85: '#f97316', // orange     — high
        1.0:  '#ef4444', // red        — critical cluster
      },
    });

    heat.addTo(map);
    heatRef.current = heat;

    return () => {
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
        heatRef.current = null;
      }
    };
  }, [map, reports]);

  return null;
}
