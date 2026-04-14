import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatDate } from '../../lib/utils'
import type { Treino, Aluno } from '../../types'

export default function VerTreino() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
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
    if (!treino?.avaliacao_id) return
    setGerandoPdf(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/gerar-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ avaliacao_id: treino.avaliacao_id }),
      })
      if (!response.ok) throw new Error('Erro ao gerar PDF.')
      const result = await response.json()
      if (result.pdf_url) window.open(result.pdf_url, '_blank')
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
        {treino.avaliacao_id && (
          <Button variant="secondary" onClick={handleGerarPdf} loading={gerandoPdf}>
            {gerandoPdf ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando PDF...</> : <><Download className="h-4 w-4" />Gerar PDF</>}
          </Button>
        )}
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
