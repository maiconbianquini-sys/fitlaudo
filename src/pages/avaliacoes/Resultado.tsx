import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Dumbbell, Loader2, FileText } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { formatDate } from '../../lib/utils'
import type { Avaliacao, Aluno, Treino, Exercicio } from '../../types'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

interface MetricCard { label: string; value: string | number | undefined; unit?: string }

export default function ResultadoAvaliacao() {
  const { id } = useParams<{ id: string }>()
  const { treinador, session } = useAuth()
  const navigate = useNavigate()
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null)
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [treino, setTreino] = useState<Treino | null>(null)
  const [loading, setLoading] = useState(true)
  const [gerandoTreino, setGerandoTreino] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single()
      if (av) {
        setAvaliacao(av as Avaliacao)
        const [{ data: alunoData }, { data: treinoData }] = await Promise.all([
          supabase.from('alunos').select('*').eq('id', av.aluno_id).single(),
          supabase.from('treinos').select('*').eq('avaliacao_id', id).order('created_at', { ascending: false }).limit(1).single(),
        ])
        setAluno(alunoData as Aluno)
        if (treinoData) setTreino(treinoData as Treino)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleGerarTreino() {
    if (!avaliacao || !aluno || !treinador || !session) return
    setGerandoTreino(true)
    setError(null)

    try {
      const nivel = (avaliacao.percentual_gordura ?? 0) > 30 || (avaliacao.massa_magra_kg ?? 0) < 40 ? 'iniciante' : 'intermediario'
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
  "titulo": "Nome do programa (ex: Programa Hipertrofia - ${aluno.nome})",
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

Inclua ${frequencia} dias de treino com 6-8 exercícios cada. Adapte ao objetivo "${aluno.objetivo}".
Retorne APENAS o JSON, sem markdown.`

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 4096,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      )

      if (!geminiRes.ok) {
        const errText = await geminiRes.text()
        throw new Error(`Erro na IA: ${errText}`)
      }

      const geminiData = await geminiRes.json()
      const allParts = geminiData.candidates?.[0]?.content?.parts ?? []
      const rawText = allParts
        .filter((p: { text?: string }) => typeof p.text === 'string')
        .map((p: { text: string }) => p.text)
        .join('')

      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/)
      if (!jsonMatch) throw new Error('Resposta inválida da IA. Tente novamente.')
      const treinoData = JSON.parse(jsonMatch[1] ?? jsonMatch[0])

      const { data: novoTreino, error: dbError } = await supabase
        .from('treinos')
        .insert({
          aluno_id: avaliacao.aluno_id,
          avaliacao_id: id,
          treinador_id: treinador.id,
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

      setTreino(novoTreino as Treino)
      navigate(`/treinos/${novoTreino.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar treino.')
    } finally {
      setGerandoTreino(false)
    }
  }

  async function handleGerarPdf() {
    if (!avaliacao || !aluno || !treinador) return
    setGerandoPdf(true)
    setStatusMsg('Gerando PDF...')
    setError(null)

    try {
      const diasTreino = treino?.treino_completo?.dias ?? []
      const treinoHTML = diasTreino.map((dia) => `
        <div class="dia-treino">
          <h3>${dia.dia} — ${dia.nome}</h3>
          <table>
            <thead><tr><th>Exercício</th><th>Séries</th><th>Repetições</th><th>Descanso</th><th>Obs.</th></tr></thead>
            <tbody>
              ${dia.exercicios.map((ex: Exercicio) => `
                <tr>
                  <td>${ex.nome}</td>
                  <td>${ex.series}</td>
                  <td>${ex.repeticoes}</td>
                  <td>${ex.descanso}</td>
                  <td>${ex.observacao ?? '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1f2937; background: #fff; }
  .header { background: #2D9D8F; color: white; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 24px; font-weight: bold; }
  .header p { font-size: 12px; opacity: 0.85; margin-top: 2px; }
  .logo { max-height: 56px; max-width: 120px; object-fit: contain; }
  .content { padding: 24px 32px; }
  .student-info { background: #f0fdfb; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
  .student-info h2 { font-size: 18px; color: #2D9D8F; margin-bottom: 8px; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .info-item p:first-child { font-size: 11px; color: #6b7280; }
  .info-item p:last-child { font-weight: 600; font-size: 14px; }
  .metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
  .metric-card { background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #e5e7eb; }
  .metric-card .value { font-size: 20px; font-weight: bold; color: #2D9D8F; }
  .metric-card .label { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .section-title { font-size: 16px; font-weight: bold; color: #2D9D8F; border-bottom: 2px solid #2D9D8F; padding-bottom: 6px; margin: 20px 0 12px; }
  .laudo { line-height: 1.7; font-size: 13px; color: #374151; white-space: pre-wrap; }
  .dia-treino { margin-bottom: 16px; }
  .dia-treino h3 { background: #e8f7f5; color: #1a7d71; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-weight: 600; color: #374151; }
  td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
  .footer { margin-top: 32px; padding: 16px 32px; border-top: 2px solid #2D9D8F; display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>FitLaudo</h1>
    <p>Laudo de Avaliação Corporal</p>
  </div>
  <div style="text-align:right">
    ${treinador.logo_url ? `<img src="${treinador.logo_url}" class="logo" alt="logo" />` : ''}
    <p style="font-size:13px;font-weight:600;margin-top:4px">${treinador.nome}</p>
    ${treinador.cref ? `<p style="font-size:11px;opacity:0.85">CREF: ${treinador.cref}</p>` : ''}
  </div>
</div>

<div class="content">
  <div class="student-info">
    <h2>${aluno.nome}</h2>
    <div class="info-grid">
      <div class="info-item"><p>Data da Avaliação</p><p>${formatDate(avaliacao.created_at)}</p></div>
      <div class="info-item"><p>Idade</p><p>${avaliacao.idade} anos</p></div>
      <div class="info-item"><p>Sexo</p><p>${aluno.sexo === 'M' ? 'Masculino' : 'Feminino'}</p></div>
      <div class="info-item"><p>Objetivo</p><p>${aluno.objetivo}</p></div>
    </div>
  </div>

  ${(avaliacao.foto_frente_url || avaliacao.foto_lado_url || avaliacao.foto_costas_url) ? `
  <div class="section-title">Fotos da Avaliação</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    ${avaliacao.foto_frente_url ? `<div style="text-align:center"><img src="${avaliacao.foto_frente_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /><p style="font-size:11px;color:#6b7280;margin-top:4px">Frente</p></div>` : ''}
    ${avaliacao.foto_lado_url ? `<div style="text-align:center"><img src="${avaliacao.foto_lado_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /><p style="font-size:11px;color:#6b7280;margin-top:4px">Lateral</p></div>` : ''}
    ${avaliacao.foto_costas_url ? `<div style="text-align:center"><img src="${avaliacao.foto_costas_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /><p style="font-size:11px;color:#6b7280;margin-top:4px">Costas</p></div>` : ''}
  </div>
  ` : ''}

  <div class="section-title">Métricas Corporais</div>
  <div class="metrics">
    <div class="metric-card"><div class="value">${avaliacao.peso}kg</div><div class="label">Peso</div></div>
    <div class="metric-card"><div class="value">${avaliacao.altura}cm</div><div class="label">Altura</div></div>
    ${avaliacao.percentual_gordura != null ? `<div class="metric-card"><div class="value">${avaliacao.percentual_gordura}%</div><div class="label">Gordura</div></div>` : ''}
    ${avaliacao.massa_magra_kg != null ? `<div class="metric-card"><div class="value">${avaliacao.massa_magra_kg}kg</div><div class="label">Massa Magra</div></div>` : ''}
    ${avaliacao.agua_corporal != null ? `<div class="metric-card"><div class="value">${avaliacao.agua_corporal}%</div><div class="label">Água</div></div>` : ''}
    ${avaliacao.gordura_visceral != null ? `<div class="metric-card"><div class="value">${avaliacao.gordura_visceral}</div><div class="label">G. Visceral</div></div>` : ''}
    ${avaliacao.taxa_metabolica_basal != null ? `<div class="metric-card"><div class="value">${avaliacao.taxa_metabolica_basal}</div><div class="label">TMB kcal</div></div>` : ''}
    ${avaliacao.idade_fisiologica != null ? `<div class="metric-card"><div class="value">${avaliacao.idade_fisiologica}</div><div class="label">Idade Fisiol.</div></div>` : ''}
  </div>

  ${avaliacao.laudo_ia ? `
  <div class="section-title">Laudo Corporal</div>
  <div class="laudo">${avaliacao.laudo_ia}</div>
  ` : ''}

  ${treino ? `
  <div class="section-title">Plano de Treino — ${treino.titulo}</div>
  <p style="font-size:12px;color:#6b7280;margin-bottom:12px">Nível: ${treino.nivel_experiencia} · ${treino.frequencia_semanal}x/semana · ${treino.duracao_minutos} min/sessão</p>
  ${treinoHTML}
  ` : ''}
</div>

<div class="footer">
  <span>Gerado pelo FitLaudo em ${formatDate(new Date().toISOString())}</span>
  <span>${treinador.nome}${treinador.cref ? ` — CREF: ${treinador.cref}` : ''}</span>
</div>
</body>
</html>`

      const fileName = `laudos/${id}.html`
      const blob = new Blob([html], { type: 'text/html' })
      const { error: storageError } = await supabase.storage
        .from('fitlaudo-assets')
        .upload(fileName, blob, { upsert: true, contentType: 'text/html' })

      if (storageError) throw new Error(storageError.message)

      const { data: { publicUrl } } = supabase.storage.from('fitlaudo-assets').getPublicUrl(fileName)

      await supabase.from('avaliacoes').update({ pdf_url: publicUrl }).eq('id', id)

      setAvaliacao((prev) => prev ? { ...prev, pdf_url: publicUrl } : prev)
      window.open(publicUrl, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar PDF.')
    } finally {
      setGerandoPdf(false)
      setStatusMsg('')
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>
  if (!avaliacao) return <div className="p-8 text-center text-gray-400">Avaliação não encontrada.</div>

  const metrics: MetricCard[] = [
    { label: 'Peso', value: avaliacao.peso, unit: 'kg' },
    { label: 'Altura', value: avaliacao.altura, unit: 'cm' },
    { label: '% Gordura', value: avaliacao.percentual_gordura, unit: '%' },
    { label: 'Gordura', value: avaliacao.gordura_kg, unit: 'kg' },
    { label: 'Massa Magra', value: avaliacao.massa_magra_kg, unit: 'kg' },
    { label: 'Água Corporal', value: avaliacao.agua_corporal, unit: '%' },
    { label: 'Gordura Visceral', value: avaliacao.gordura_visceral, unit: '' },
    { label: 'TMB', value: avaliacao.taxa_metabolica_basal, unit: 'kcal' },
    { label: 'Idade Fisiológica', value: avaliacao.idade_fisiologica, unit: 'anos' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Resultado da Avaliação</h1>
          <p className="text-sm text-gray-500">{aluno?.nome} · {formatDate(avaliacao.created_at)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        {treino ? (
          <Button variant="secondary" onClick={() => navigate(`/treinos/${treino.id}`)}>
            <Dumbbell className="h-4 w-4" />
            Ver Treino
          </Button>
        ) : (
          <Button onClick={handleGerarTreino} disabled={gerandoTreino}>
            {gerandoTreino
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Gerando treino...</span>
              : <><Dumbbell className="h-4 w-4" />Gerar Treino com IA</>
            }
          </Button>
        )}
        {avaliacao.pdf_url ? (
          <Button variant="secondary" onClick={() => window.open(avaliacao.pdf_url!, '_blank')}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleGerarPdf} disabled={gerandoPdf}>
            {gerandoPdf
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{statusMsg || 'Gerando PDF...'}</span>
              : <><FileText className="h-4 w-4" />Gerar PDF</>
            }
          </Button>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {metrics.filter(m => m.value != null).map(({ label, value, unit }) => (
          <Card key={label} className="p-3 text-center">
            <p className="text-xl font-bold text-primary-600">{value}{unit}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* AI Report */}
      {avaliacao.laudo_ia && (
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-500 rounded text-white text-xs flex items-center justify-center font-bold">IA</span>
            Laudo Corporal
          </h2>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {avaliacao.laudo_ia}
          </div>
        </Card>
      )}
    </div>
  )
}
