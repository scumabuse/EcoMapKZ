import { createClient } from '@supabase/supabase-js';
import type { Report, Profile, Stats } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Reports ────────────────────────────────────────────────────────────────

export async function getReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Report[]) ?? [];
}

export async function getReportById(id: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Report;
}

export async function createReport(payload: {
  user_id: string;
  photo_url: string | null;
  description: string;
  latitude: number;
  longitude: number;
}): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .insert([{ ...payload, status: 'pending' }])
    .select()
    .single();
  if (error) throw error;
  return data as Report;
}

export async function updateReportStatus(
  id: string,
  status: 'pending' | 'verified' | 'rejected'
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
}

export async function updateReportAI(
  id: string,
  ai: {
    ai_is_dump: boolean;
    ai_confidence: number;
    ai_pollution_level: string;
    ai_waste_types: string[];
    ai_hazardous: boolean;
    risk_score: number;
    status: string;
  }
): Promise<void> {
  const { error } = await supabase.from('reports').update(ai).eq('id', id);
  if (error) throw error;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  const { data, error } = await supabase.from('reports').select('*');
  if (error) throw error;
  const reports = (data as Report[]) ?? [];
  return {
    total: reports.length,
    verified: reports.filter((r) => r.status === 'verified').length,
    hazardous: reports.filter((r) => r.ai_hazardous === true).length,
    high_pollution: reports.filter((r) => r.ai_pollution_level === 'high').length,
  };
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function uploadPhoto(
  file: File,
  userId: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('dump-photos')
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('dump-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

// ─── AI Analysis (direct Gemini API call) ────────────────────────────────────

export async function analyzeImageEdge(
  reportId: string,
  imageUrl: string
): Promise<void> {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (!geminiKey) throw new Error('VITE_GEMINI_API_KEY is not set');

  // Fetch image and convert to base64
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) throw new Error('Failed to fetch image');
  const imgBuffer = await imgResponse.arrayBuffer();
  const uint8 = new Uint8Array(imgBuffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  const base64 = btoa(binary);
  const mimeType = imgResponse.headers.get('content-type') ?? 'image/jpeg';

  // Call Gemini Vision API
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: { mime_type: mimeType, data: base64 },
              },
              {
                text: `Проанализируй изображение. Определи:
1. Есть ли на фото несанкционированная свалка.
2. Вероятность от 0 до 100.
3. Типы мусора.
4. Уровень загрязнения: low, medium, high.
5. Есть ли опасные отходы.

Верни ТОЛЬКО валидный JSON без пояснений и markdown:
{
  "dump_detected": true,
  "confidence": 92,
  "waste_types": ["plastic", "construction"],
  "pollution_level": "high",
  "hazardous_waste": false
}`,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    throw new Error(`Gemini API error: ${errText}`);
  }

  const geminiData = await geminiRes.json();
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const analysis = JSON.parse(cleaned);

  // Calculate risk score
  const pollutionMap: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const pollScore = pollutionMap[analysis.pollution_level] ?? 0;
  const riskScore = Math.min(
    100,
    Math.round(
      analysis.confidence * 0.5 +
      pollScore * 10 * 0.3 +
      (analysis.hazardous_waste ? 20 : 0)
    )
  );

  // Update report in Supabase
  await updateReportAI(reportId, {
    ai_is_dump: analysis.dump_detected,
    ai_confidence: analysis.confidence,
    ai_pollution_level: analysis.pollution_level,
    ai_waste_types: analysis.waste_types,
    ai_hazardous: analysis.hazardous_waste,
    risk_score: riskScore,
    status: analysis.dump_detected ? 'pending' : 'rejected',
  });
}
