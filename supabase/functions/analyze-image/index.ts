import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reportId, imageUrl } = await req.json()

    if (!reportId || !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'reportId and imageUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch image as base64
    const imgResponse = await fetch(imageUrl)
    const imgBuffer = await imgResponse.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
    const mimeType = imgResponse.headers.get('content-type') ?? 'image/jpeg'

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64,
                  },
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
    )

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const analysis = JSON.parse(cleaned)

    // Calculate risk score
    const pollutionMap: Record<string, number> = { low: 10, medium: 30, high: 50 }
    const pollScore = pollutionMap[analysis.pollution_level] ?? 10
    const riskScore = Math.min(
      100,
      Math.round(
        (analysis.confidence * 0.3) +
        pollScore +
        (analysis.hazardous_waste ? 20 : 0)
      )
    )

    // Update report in Supabase
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        ai_is_dump: analysis.dump_detected,
        ai_confidence: analysis.confidence,
        ai_pollution_level: analysis.pollution_level,
        ai_waste_types: analysis.waste_types,
        ai_hazardous: analysis.hazardous_waste,
        risk_score: riskScore,
        status: analysis.dump_detected ? 'pending' : 'rejected',
      }),
    })

    if (!updateRes.ok) {
      const err = await updateRes.text()
      throw new Error(`Failed to update report: ${err}`)
    }

    return new Response(
      JSON.stringify({ success: true, analysis, riskScore }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
