import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { avaliacao_id, aluno_id, treinador_id } = await req.json()

    // Fetch evaluation + student data
    const [{ data: avaliacao }, { data: aluno }] = await Promise.all([
      supabase.from('avaliacoes').select('*').eq('id', avaliacao_id).single(),
      supabase.from('alunos').select('*').eq('id', aluno_id).single(),
    ])

    if (!avaliacao || !aluno) throw new Error('Dados não encontrados.')

    const nivel = avaliacao.percentual_gordura > 30 || avaliacao.massa_magra_kg < 40 ? 'iniciante' : 'intermediario'
    const frequencia = aluno.objetivo === 'Emagrecimento' ? 4 : 3

    const prompt = `Você é um educador físico especialista em prescrição de treinos personalizados.

Com base na avaliação corporal a seguir, crie um programa de treino completo e personalizado em português:

DADOS DO ALUNO:
- Nome: ${aluno.nome}
- Sexo: ${aluno.sexo === 'M' ? 'Masculino' : 'Feminino'}
- Idade: ${avaliacao.idade} anos
- Peso: ${avaliacao.peso}kg / Altura: ${avaliacao.altura}cm
- % Gordura: ${avaliacao.percentual_gordura ?? 'não estimado'}%
- Massa Magra: ${avaliacao.massa_magra_kg ?? 'não estimado'}kg
- TMB: ${avaliacao.taxa_metabolica_basal ?? 'não estimada'} kcal
- Objetivo: ${aluno.objetivo}
- Observações: ${aluno.observacoes ?? 'nenhuma'}

Retorne APENAS um JSON com esta estrutura exata:
{
  "titulo": "Nome do programa (ex: Programa Hipertrofia - João)",
  "objetivo": "Descrição do objetivo do programa",
  "nivel_experiencia": "${nivel}",
  "frequencia_semanal": ${frequencia},
  "duracao_minutos": 60,
  "dias": [
    {
      "dia": "Segunda-feira",
      "nome": "Treino A - Peito e Tríceps",
      "exercicios": [
        {
          "nome": "Nome do exercício",
          "series": 3,
          "repeticoes": "10-12",
          "descanso": "60s",
          "observacao": "observação opcional"
        }
      ]
    }
  ]
}

Inclua ${frequencia} dias de treino com 6-8 exercícios cada. Adapte os exercícios ao objetivo "${aluno.objetivo}".
Retorne APENAS o JSON, sem markdown.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
        }),
      }
    )

    if (!geminiResponse.ok) throw new Error('Erro ao chamar Gemini.')
    const geminiData = await geminiResponse.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Resposta inválida da IA.')
    const treinoData = JSON.parse(jsonMatch[0])

    const { data: treino, error: dbError } = await supabase
      .from('treinos')
      .insert({
        aluno_id,
        avaliacao_id,
        treinador_id,
        titulo: treinoData.titulo,
        objetivo: treinoData.objetivo,
        nivel_experiencia: treinoData.nivel_experiencia,
        frequencia_semanal: treinoData.frequencia_semanal,
        duracao_minutos: treinoData.duracao_minutos,
        treino_completo: { dias: treinoData.dias },
        tipo_criacao: 'ia',
        ativo: true,
        versao: 1,
      })
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    return new Response(JSON.stringify(treino), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
