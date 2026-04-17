import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatDate } from '../../lib/utils'
import type { Treino, Aluno, Avaliacao, Exercicio } from '../../types'

export default function VerTreino() {
  const { id } = useParams<{ id: string }>()
  const { treinador } = useAuth()
  const navigate = useNavigate()
  const [treino, setTreino] = useState<Treino | null>(null)
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [loading, setLoading] = useState(true)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('treinos').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setTreino(data as Treino)
        supabase.from('alunos').select('*').eq('id', data.aluno_id).single().then(({ data: a }) => {
          setAluno(a as Aluno)
        })
      }
      setLoading(false)
    })
  }, [id])

  async function handleGerarPdf() {
    if (!treino || !aluno || !treinador) return
    setGerandoPdf(true)
    setError(null)

    try {
      // Buscar dados da avaliação se existir
      let avaliacao: Avaliacao | null = null
      if (treino.avaliacao_id) {
        const { data } = await supabase.from('avaliacoes').select('*').eq('id', treino.avaliacao_id).single()
        avaliacao = data as Avaliacao
      }

      const treinoHTML = treino.treino_completo?.dias?.map((dia) => `
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
      `).join('') ?? ''

      const nomeArquivo = `treino-${aluno.nome.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.html`

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1f2937; background: #fff; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #1f2937; color: white; padding: 10px 24px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .toolbar span { font-size: 14px; font-weight: 600; flex: 1; }
  .toolbar button { padding: 8px 18px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
  .btn-print { background: #2D9D8F; color: white; }
  .btn-print:hover { background: #238a7d; }
  .btn-download { background: #374151; color: white; border: 1px solid #6b7280 !important; }
  .btn-download:hover { background: #4b5563; }
  .page-content { margin-top: 52px; }
  @media print {
    .toolbar { display: none !important; }
    .page-content { margin-top: 0; }
  }
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
<div class="toolbar">
  <span>📄 Treino — ${aluno.nome}</span>
  <button class="btn-print" onclick="window.print()">🖨️ Salvar como PDF</button>
  <a id="dl" style="text-decoration:none"><button class="btn-download">⬇️ Baixar HTML</button></a>
</div>
<script>
  (function(){
    var a = document.getElementById('dl');
    var style = document.querySelector('style').outerHTML;
    var content = document.querySelector('.page-content').outerHTML;
    var cleanHtml = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' + style + '</head><body>' + content + '</body></html>';
    var blob = new Blob([cleanHtml], {type:'text/html'});
    a.href = URL.createObjectURL(blob);
    a.download = '${nomeArquivo}';
  })();
</script>
<div class="page-content">
<div class="header">
  <div>
    <h1>FitLaudo</h1>
    <p>Plano de Treino</p>
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
      <div class="info-item"><p>Data do Treino</p><p>${formatDate(treino.created_at)}</p></div>
      <div class="info-item"><p>Objetivo</p><p>${aluno.objetivo}</p></div>
      <div class="info-item"><p>Frequência</p><p>${treino.frequencia_semanal}x/semana</p></div>
      <div class="info-item"><p>Duração</p><p>${treino.duracao_minutos} min/sessão</p></div>
    </div>
  </div>

  ${avaliacao ? `
  <div class="section-title">Métricas Corporais</div>
  <div class="metrics">
    <div class="metric-card"><div class="value">${avaliacao.peso}kg</div><div class="label">Peso</div></div>
    <div class="metric-card"><div class="value">${avaliacao.altura}cm</div><div class="label">Altura</div></div>
    ${avaliacao.percentual_gordura != null ? `<div class="metric-card"><div class="value">${avaliacao.percentual_gordura}%</div><div class="label">Gordura</div></div>` : ''}
    ${avaliacao.massa_magra_kg != null ? `<div class="metric-card"><div class="value">${avaliacao.massa_magra_kg}kg</div><div class="label">Massa Magra</div></div>` : ''}
    ${avaliacao.taxa_metabolica_basal != null ? `<div class="metric-card"><div class="value">${avaliacao.taxa_metabolica_basal}</div><div class="label">TMB kcal</div></div>` : ''}
  </div>
  ` : ''}

  <div class="section-title">Plano de Treino — ${treino.titulo}</div>
  <p style="font-size:12px;color:#6b7280;margin-bottom:12px">Nível: ${treino.nivel_experiencia} · ${treino.frequencia_semanal}x/semana · ${treino.duracao_minutos} min/sessão</p>
  ${treinoHTML}
</div>

<div class="footer">
  <span>Gerado pelo FitLaudo em ${formatDate(new Date().toISOString())}</span>
  <span>${treinador.nome}${treinador.cref ? ` — CREF: ${treinador.cref}` : ''}</span>
</div>
</div>
</body>
</html>`

      const blob = new Blob([html], { type: 'text/html' })
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>
  if (!treino) return <div className="p-8 text-center text-gray-400">Treino não encontrado.</div>

  const nivelLabel = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{treino.titulo}</h1>
          <p className="text-sm text-gray-500">{aluno?.nome} · {formatDate(treino.created_at)}</p>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-2 mb-5 ml-11">
        <Badge variant="blue">{nivelLabel[treino.nivel_experiencia]}</Badge>
        <Badge variant="gray">{treino.frequencia_semanal}x por semana</Badge>
        <Badge variant="gray">{treino.duracao_minutos} min/sessão</Badge>
        <Badge variant={treino.tipo_criacao === 'ia' ? 'blue' : 'gray'}>{treino.tipo_criacao === 'ia' ? 'Gerado por IA' : 'Manual'}</Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6 ml-11">
        <Button variant="secondary" onClick={handleGerarPdf} disabled={gerandoPdf}>
          {gerandoPdf
            ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Gerando PDF...</span>
            : <><Download className="h-4 w-4" />Gerar PDF</>
          }
        </Button>
        {treino.avaliacao_id && (
          <Button variant="ghost" onClick={() => navigate(`/avaliacoes/${treino.avaliacao_id}`)}>
            Ver Avaliação
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {/* Objective */}
      <Card className="p-4 mb-5">
        <p className="text-sm text-gray-500 font-medium mb-1">Objetivo</p>
        <p className="text-gray-800">{treino.objetivo}</p>
      </Card>

      {/* Training days */}
      {treino.treino_completo?.dias?.map((dia, i) => (
        <Card key={i} className="mb-4 overflow-hidden">
          <div className="px-5 py-3 bg-primary-50 border-b border-primary-100">
            <h3 className="font-semibold text-primary-800">{dia.dia} — {dia.nome}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-2.5 font-medium">Exercício</th>
                  <th className="text-center px-3 py-2.5 font-medium">Séries</th>
                  <th className="text-center px-3 py-2.5 font-medium">Repetições</th>
                  <th className="text-center px-3 py-2.5 font-medium">Descanso</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Obs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dia.exercicios.map((ex, j) => (
                  <tr key={j} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{ex.nome}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{ex.series}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{ex.repeticoes}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{ex.descanso}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{ex.observacao ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
