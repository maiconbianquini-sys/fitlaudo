import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, ClipboardList, Dumbbell, Trash2, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatDate, formatAge } from '../../lib/utils'
import type { Aluno, Avaliacao, Treino } from '../../types'

type Tab = 'avaliacoes' | 'treinos'

// ── Gráfico de linha SVG puro ──────────────────────────────────────────────
interface LineChartProps {
  values: number[]
  labels: string[]
  color: string
  unit: string
  title: string
}

function LineChart({ values, labels, color, unit, title }: LineChartProps) {
  const W = 280, H = 110
  const PAD = { top: 14, right: 16, bottom: 28, left: 40 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const xOf = (i: number) => PAD.left + (i / (values.length - 1)) * cW
  const yOf = (v: number) => PAD.top + cH - ((v - min) / range) * cH

  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${xOf(values.length - 1).toFixed(1)} ${(PAD.top + cH).toFixed(1)} L ${PAD.left} ${(PAD.top + cH).toFixed(1)} Z`

  const first = values[0]
  const last = values[values.length - 1]
  const diff = last - first
  const diffSign = diff > 0 ? '+' : ''
  const diffColor = diff === 0 ? '#6b7280' : (color === '#ef4444' ? (diff < 0 ? '#16a34a' : '#ef4444') : (diff > 0 ? '#16a34a' : '#ef4444'))

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{title}</span>
        <span className="text-xs font-bold" style={{ color: diffColor }}>
          {diffSign}{diff.toFixed(1)}{unit}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((t, i) => {
          const y = PAD.top + cH * (1 - t)
          const val = min + range * t
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={PAD.left + cW} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
                {val.toFixed(1)}
              </text>
            </g>
          )
        })}
        {/* Area */}
        <path d={areaPath} fill={color} fillOpacity="0.08" />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {values.map((v, i) => (
          <circle key={i} cx={xOf(i)} cy={yOf(v)} r="3" fill="white" stroke={color} strokeWidth="2" />
        ))}
        {/* X labels */}
        {labels.map((label, i) => (
          <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">
            {label}
          </text>
        ))}
        {/* Last value */}
        <text x={xOf(values.length - 1) + 6} y={yOf(last) + 4} fontSize="10" fontWeight="bold" fill={color}>
          {last}{unit}
        </text>
      </svg>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
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

  // Dados para os gráficos (ordem cronológica)
  const evolucao = [...avaliacoes].reverse()
  const temEvolucao = evolucao.length >= 2
  const chartLabels = evolucao.map((av) => {
    const d = new Date(av.created_at)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  })

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

      {/* Gráficos de Evolução */}
      {temEvolucao && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-bold text-gray-800">Evolução Corporal</h2>
            <span className="text-xs text-gray-400 ml-1">{evolucao.length} avaliações</span>
          </div>

          {/* Linha 1: Peso e Gordura */}
          <div className="flex gap-4 mb-2">
            <LineChart
              title="Peso"
              values={evolucao.map((av) => av.peso)}
              labels={chartLabels}
              color="#2D9D8F"
              unit="kg"
            />
            {evolucao.some((av) => av.percentual_gordura != null) && (
              <LineChart
                title="% Gordura"
                values={evolucao.map((av) => av.percentual_gordura ?? 0)}
                labels={chartLabels}
                color="#ef4444"
                unit="%"
              />
            )}
          </div>

          {/* Linha 2: Massa Magra e IMC */}
          <div className="flex gap-4">
            {evolucao.some((av) => av.massa_magra_kg != null) && (
              <LineChart
                title="Massa Magra"
                values={evolucao.map((av) => av.massa_magra_kg ?? 0)}
                labels={chartLabels}
                color="#6366f1"
                unit="kg"
              />
            )}
            {evolucao.some((av) => av.agua_corporal != null) && (
              <LineChart
                title="Água Corporal"
                values={evolucao.map((av) => av.agua_corporal ?? 0)}
                labels={chartLabels}
                color="#0ea5e9"
                unit="%"
              />
            )}
          </div>

          {/* Resumo comparativo */}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(() => {
              const first = evolucao[0]
              const last = evolucao[evolucao.length - 1]
              const items = [
                { label: 'Peso', v1: first.peso, v2: last.peso, unit: 'kg', invertColor: false },
                ...(first.percentual_gordura != null && last.percentual_gordura != null
                  ? [{ label: '% Gordura', v1: first.percentual_gordura, v2: last.percentual_gordura, unit: '%', invertColor: true }]
                  : []),
                ...(first.massa_magra_kg != null && last.massa_magra_kg != null
                  ? [{ label: 'Massa Magra', v1: first.massa_magra_kg, v2: last.massa_magra_kg, unit: 'kg', invertColor: false }]
                  : []),
                ...(first.taxa_metabolica_basal != null && last.taxa_metabolica_basal != null
                  ? [{ label: 'TMB', v1: first.taxa_metabolica_basal, v2: last.taxa_metabolica_basal, unit: 'kcal', invertColor: false }]
                  : []),
              ]
              return items.map(({ label, v1, v2, unit, invertColor }) => {
                const diff = v2 - v1
                const positive = invertColor ? diff < 0 : diff > 0
                const color = diff === 0 ? 'text-gray-500' : positive ? 'text-green-600' : 'text-red-500'
                const sign = diff > 0 ? '+' : ''
                return (
                  <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-sm font-bold text-gray-800">{v2}{unit}</p>
                    <p className={`text-xs font-semibold ${color}`}>{sign}{diff.toFixed(1)}{unit}</p>
                  </div>
                )
              })
            })()}
          </div>
        </Card>
      )}

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
