import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface AnaliseRequest {
  aluno_id: string
  treinador_id: string
  peso: number
  altura: number
  idade: number
  objetivo: string
  foto_frente_base64: string
  foto_lado_base64: string
  foto_costas_base64: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body: AnaliseRequest = await req.json()

    const { aluno_id, treinador_id, peso, altura, idade, objetivo } = body

    const imc = (peso / Math.pow(altura / 100, 2)).toFixed(1)

    const prompt = `Você é um especialista em avaliação corporal e fisiologia do exercício.
Analise as 3 fotos corporais (frente, lateral e costas) de um(a) aluno(a) com os seguintes dados:
- Peso: ${peso}kg
- Altura: ${altura}cm
- Idade: ${idade} anos
- IMC calculado: ${imc}
- Objetivo: ${objetivo}

Com base nas fotos e nos dados fornecidos, estime e retorne um JSON com a seguinte estrutura:
{
  "percentual_gordura": número (entre 3 e 50),
  "gordura_kg": número,
  "massa_magra_kg": número,
  "agua_corporal": número (percentual, entre 40 e 70),
  "gordura_visceral": número (entre 1 e 20),
  "taxa_metabolica_basal": número (kcal/dia),
  "idade_fisiologica": número (anos),
  "laudo": "texto completo do laudo corporal em português, com pelo menos 3 parágrafos. Inclua: análise da composição corporal, pontos de atenção, recomendações para atingir o objetivo de ${objetivo}. Seja técnico mas acessível."
}

Retorne APENAS o JSON, sem markdown, sem explicações adicionais.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/jpeg', data: body.foto_frente_base64 } },
                { inline_data: { mime_type: 'image/jpeg', data: body.foto_lado_base64 } },
                { inline_data: { mime_type: 'image/jpeg', data: body.foto_costas_base64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      throw new Error(`Gemini API error: ${errText}`)
    }

    const geminiData = await geminiResponse.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse JSON from Gemini response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Resposta inválida da IA.')
    const analise = JSON.parse(jsonMatch[0])

    // Upload photos to Storage
    function base64ToUint8Array(base64: string): Uint8Array {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes
    }

    const timestamp = Date.now()
    const photoPrefix = `avaliacoes/${treinador_id}/${aluno_id}/${timestamp}`

    const [frenteUpload, ladoUpload, costasUpload] = await Promise.all([
      supabase.storage.from('fitlaudo-assets').upload(
        `${photoPrefix}_frente.jpg`,
        base64ToUint8Array(body.foto_frente_base64),
        { contentType: 'image/jpeg', upsert: true }
      ),
      supabase.storage.from('fitlaudo-assets').upload(
        `${photoPrefix}_lado.jpg`,
        base64ToUint8Array(body.foto_lado_base64),
        { contentType: 'image/jpeg', upsert: true }
      ),
      supabase.storage.from('fitlaudo-assets').upload(
        `${photoPrefix}_costas.jpg`,
        base64ToUint8Array(body.foto_costas_base64),
        { contentType: 'image/jpeg', upsert: true }
      ),
    ])

    const frenteUrl = frenteUpload.error ? null : supabase.storage.from('fitlaudo-assets').getPublicUrl(`${photoPrefix}_frente.jpg`).data.publicUrl
    const ladoUrl = ladoUpload.error ? null : supabase.storage.from('fitlaudo-assets').getPublicUrl(`${photoPrefix}_lado.jpg`).data.publicUrl
    const costasUrl = costasUpload.error ? null : supabase.storage.from('fitlaudo-assets').getPublicUrl(`${photoPrefix}_costas.jpg`).data.publicUrl

    // Save to database
    const { data: avaliacao, error: dbError } = await supabase
      .from('avaliacoes')
      .insert({
        aluno_id,
        treinador_id,
        peso,
        altura,
        idade,
        percentual_gordura: analise.percentual_gordura,
        gordura_kg: analise.gordura_kg,
        massa_magra_kg: analise.massa_magra_kg,
        agua_corporal: analise.agua_corporal,
        gordura_visceral: analise.gordura_visceral,
        taxa_metabolica_basal: analise.taxa_metabolica_basal,
        idade_fisiologica: analise.idade_fisiologica,
        laudo_ia: analise.laudo,
        foto_frente_url: frenteUrl,
        foto_lado_url: ladoUrl,
        foto_costas_url: costasUrl,
      })
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    return new Response(JSON.stringify(avaliacao), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
