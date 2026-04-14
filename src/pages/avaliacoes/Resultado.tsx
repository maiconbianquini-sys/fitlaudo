import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Dumbbell, Loader2, FileText } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { formatDate } from '../../lib/utils'
import type { Avaliacao, Aluno, Treino } from '../../types'

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
    setGerandoTreino(true)
    setError(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/gerar-treino-ia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ avaliacao_id: id, aluno_id: avaliacao?.aluno_id, treinador_id: treinador!.id }),
      })
      if (!response.ok) throw new Error('Erro ao gerar treino.')
      const tr = await response.json()
      setTreino(tr)
      navigate(`/treinos/${tr.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar treino.')
    } finally {
      setGerandoTreino(false)
    }
  }

  async function handleGerarPdf() {
    setGerandoPdf(true)
    setError(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/gerar-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ avaliacao_id: id }),
      })
      if (!response.ok) throw new Error('Erro ao gerar PDF.')
      const result = await response.json()
      if (result.pdf_url) {
        setAvaliacao((prev) => prev ? { ...prev, pdf_url: result.pdf_url } : prev)
        window.open(result.pdf_url, '_blank')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar PDF.')
    } finally {
      setGerandoPdf(false)
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
          <Button onClick={handleGerarTreino} loading={gerandoTreino}>
            {gerandoTreino ? 'Gerando treino...' : <><Dumbbell className="h-4 w-4" />Gerar Treino com IA</>}
          </Button>
        )}
        {avaliacao.pdf_url ? (
          <Button variant="secondary" onClick={() => window.open(avaliacao.pdf_url!, '_blank')}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleGerarPdf} loading={gerandoPdf}>
            {gerandoPdf ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando PDF...</> : <><FileText className="h-4 w-4" />Gerar PDF</>}
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
