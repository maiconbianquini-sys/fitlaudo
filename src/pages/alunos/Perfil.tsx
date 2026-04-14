import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, ClipboardList, Dumbbell, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatDate, formatAge } from '../../lib/utils'
import type { Aluno, Avaliacao, Treino } from '../../types'

type Tab = 'avaliacoes' | 'treinos'

export default function PerfilAluno() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [treinos, setTreinos] = useState<Treino[]>([])
  const [tab, setTab] = useState<Tab>('avaliacoes')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [{ data: alunoData }, { data: avsData }, { data: treData }] = await Promise.all([
        supabase.from('alunos').select('*').eq('id', id).single(),
        supabase.from('avaliacoes').select('*').eq('aluno_id', id).order('created_at', { ascending: false }),
        supabase.from('treinos').select('*').eq('aluno_id', id).order('created_at', { ascending: false }),
      ])
      setAluno(alunoData as Aluno)
      setAvaliacoes((avsData as Avaliacao[]) ?? [])
      setTreinos((treData as Treino[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleDelete() {
    if (!confirm(`Deseja excluir o aluno ${aluno?.nome}? Esta ação não pode ser desfeita.`)) return
    await supabase.from('alunos').delete().eq('id', id!)
    navigate('/alunos')
  }

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
  if (!aluno) return <div className="p-8 text-center text-gray-400 text-sm">Aluno não encontrado.</div>

  const idade = aluno.data_nascimento ? formatAge(aluno.data_nascimento) : null

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/alunos')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{aluno.nome}</h1>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Info card */}
      <Card className="p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-bold text-xl">{aluno.nome[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {idade && <div><p className="text-xs text-gray-500">Idade</p><p className="font-semibold text-gray-900">{idade} anos</p></div>}
            <div><p className="text-xs text-gray-500">Sexo</p><p className="font-semibold text-gray-900">{aluno.sexo === 'M' ? 'Masculino' : 'Feminino'}</p></div>
            <div><p className="text-xs text-gray-500">Objetivo</p><p className="font-semibold text-gray-900">{aluno.objetivo}</p></div>
            <div><p className="text-xs text-gray-500">Status</p><Badge variant={aluno.ativo ? 'green' : 'gray'}>{aluno.ativo ? 'Ativo' : 'Inativo'}</Badge></div>
          </div>
        </div>
        {aluno.observacoes && (
          <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{aluno.observacoes}</p>
        )}
        <div className="mt-4">
          <Button onClick={() => navigate(`/alunos/${id}/nova-avaliacao`)}>
            <Plus className="h-4 w-4" />
            Nova Avaliação
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['avaliacoes', 'treinos'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'avaliacoes' ? <><ClipboardList className="h-4 w-4" />Avaliações ({avaliacoes.length})</> : <><Dumbbell className="h-4 w-4" />Treinos ({treinos.length})</>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'avaliacoes' ? (
        avaliacoes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhuma avaliação ainda.</div>
        ) : (
          <Card>
            <ul className="divide-y divide-gray-50">
              {avaliacoes.map((av) => (
                <li key={av.id}>
                  <button
                    onClick={() => navigate(`/avaliacoes/${av.id}`)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDate(av.created_at)}</p>
                      <p className="text-xs text-gray-500">
                        {av.peso}kg · {av.altura}cm
                        {av.percentual_gordura != null ? ` · ${av.percentual_gordura}% gordura` : ''}
                      </p>
                    </div>
                    <Badge variant={av.pdf_url ? 'green' : 'gray'}>{av.pdf_url ? 'PDF gerado' : 'Sem PDF'}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : (
        treinos.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum treino gerado ainda.</div>
        ) : (
          <Card>
            <ul className="divide-y divide-gray-50">
              {treinos.map((tr) => (
                <li key={tr.id}>
                  <button
                    onClick={() => navigate(`/treinos/${tr.id}`)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tr.titulo}</p>
                      <p className="text-xs text-gray-500">
                        {tr.nivel_experiencia} · {tr.frequencia_semanal}x/semana · {formatDate(tr.created_at)}
                      </p>
                    </div>
                    <Badge variant={tr.tipo_criacao === 'ia' ? 'blue' : 'gray'}>{tr.tipo_criacao === 'ia' ? 'IA' : 'Manual'}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  )
}
