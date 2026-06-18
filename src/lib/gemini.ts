import type { GeminiAnalysis, ForecastResult, RegionStats } from '../types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
// gemini-2.5-flash is the current working model for this key
const MODEL = 'gemini-2.5-flash';
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// ─── Core fetch with exponential backoff on 429 ───────────────────────────────

async function geminiRequest(
  parts: object[],
  maxRetries = 1,
  baseDelayMs = 3000
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
      }),
    });

    if (res.status === 429) {
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt); // 6s → 12s → 24s → 48s
        console.warn(`Gemini 429 – retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error('429: Gemini API rate limit exceeded. Try again in a minute.');
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return text;
  }
  throw new Error('Gemini: max retries exceeded');
}

// ─── Image Analysis ──────────────────────────────────────────────────────────

export async function analyzeImageWithGemini(
  imageBase64: string,
  mimeType: string
): Promise<GeminiAnalysis> {
  const text = await geminiRequest([
    {
      inlineData: { mimeType, data: imageBase64 },
    },
    {
      text: `Ты — строгий экологический инспектор. Оцени изображение объективно и честно.

ЗАДАЧА: определи наличие несанкционированной свалки мусора.

КРИТЕРИИ ДЛЯ dump_detected:
- true: видны явные кучи мусора, свалка, брошенные отходы
- false: чистая природа, мусора почти нет или он незначителен

КРИТЕРИИ ДЛЯ confidence (0–100):
- 90–100: мусор абсолютно очевиден, занимает большую часть кадра
- 70–89: мусор хорошо виден, но есть некоторые сомнения
- 50–69: мусор есть, но его немного или изображение нечёткое
- 0–49: мусора почти нет или изображение не позволяет сделать вывод

КРИТЕРИИ ДЛЯ pollution_level:
- "low": единичные предметы мусора, небольшой объём (1–2 пакета / несколько предметов)
- "medium": заметное скопление мусора, несколько куч или значительная площадь загрязнения
- "high": крупная свалка, мусор занимает большую площадь, возможно разносится ветром

КРИТЕРИИ ДЛЯ hazardous_waste:
- true: только если чётко видны химикаты, медицинские отходы, батареи, шины в большом количестве
- false: обычный бытовой мусор

ВАЖНО: не завышай оценки. Будь объективен. Если на фото мусора мало — ставь low и confidence ≤ 50.

Верни ТОЛЬКО валидный JSON без пояснений и markdown:
{
  "dump_detected": false,
  "confidence": 30,
  "waste_types": [],
  "pollution_level": "low",
  "hazardous_waste": false
}`,
    },
  ]);

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as GeminiAnalysis;
}


// ─── Forecast Analysis ───────────────────────────────────────────────────────

export async function getForecastFromGemini(
  regions: RegionStats[]
): Promise<ForecastResult[]> {
  const statsJson = JSON.stringify(
    regions.map((r) => ({
      region: r.name,
      total_reports: r.total,
      recent_30d: r.recent,
      avg_pollution: r.avgPollution,
      risk_score: r.riskScore,
    })),
    null,
    2
  );

  const text = await geminiRequest([
    {
      text: `Ты экологический аналитик по Казахстану.

На основе статистики по регионам оцени вероятность появления новых несанкционированных свалок.

Статистика:
${statsJson}

Для КАЖДОГО региона верни JSON массив (без пояснений, только JSON):
[
  {
    "region": "Астана",
    "risk": 75,
    "summary": "Краткое объяснение на русском языке (1-2 предложения)"
  }
]`,
    },
  ]);

  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    const arr = JSON.parse(cleaned) as Array<{
      region: string;
      risk: number;
      summary: string;
    }>;
    return arr.map((item) => ({ risk: item.risk, summary: item.summary }));
  } catch {
    return regions.map(() => ({ risk: 50, summary: 'Данные недоступны' }));
  }
}

// ─── Single region forecast ──────────────────────────────────────────────────

export async function getSingleForecast(
  stats: RegionStats
): Promise<ForecastResult> {
  const text = await geminiRequest([
    {
      text: `Ты экологический аналитик.
Регион: ${stats.name}
Всего обращений: ${stats.total}
За последние 30 дней: ${stats.recent}
Средний уровень загрязнения (0-2): ${stats.avgPollution.toFixed(2)}
Расчётный риск-балл: ${stats.riskScore}

Оцени вероятность появления новых несанкционированных свалок.
Верни ТОЛЬКО JSON без пояснений:
{"risk": 0, "summary": ""}`,
    },
  ]);

  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned) as ForecastResult;
  } catch {
    return { risk: stats.riskScore, summary: 'Анализ недоступен.' };
  }
}
