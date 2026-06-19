export interface Report {
  id: string;
  user_id: string;
  photo_url: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  ai_is_dump: boolean | null;
  ai_confidence: number | null;
  ai_pollution_level: 'low' | 'medium' | 'high' | null;
  ai_waste_types: string[] | null;
  ai_hazardous: boolean | null;
  risk_score: number;
  created_at: string;
  status: 'pending' | 'verified' | 'rejected';
}

export interface Profile {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export interface GeminiAnalysis {
  dump_detected: boolean;
  confidence: number;
  waste_types: string[];
  pollution_level: 'low' | 'medium' | 'high';
  hazardous_waste: boolean;
}

export interface ForecastResult {
  risk: number;
  summary: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  factors: string[];
  recommendations: string[];
}

export interface Stats {
  total: number;
  verified: number;
  hazardous: number;
  high_pollution: number;
}

export interface RegionStats {
  name: string;
  lat: number;
  lng: number;
  total: number;
  recent: number;
  avgPollution: number;
  riskScore: number;
}
