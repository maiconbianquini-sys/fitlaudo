import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ClipboardList, Dumbbell, Plus, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { formatDate } from '../lib/utils'
import type { AvaliacaoComAluno } from '../types'

interface Stats {
  totalAlunos: number
  avaliacoesMes: number
  treinosGerados: number
}

export default function Dashboard() {
  const { treinador } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({ totalAlunos: 0, avaliacoesMes: 0, treinosGerados: 0 })
  const [recentAvaliacoes, setRecentAvaliacoes] = useState<AvaliacaoComAluno[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!treinador) return
    async function loadData() {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [{ count: totalAlunos }, { count: avaliacoesMes }, { count: treinosGerados }, { data: avaliacoes }] = await Promise.all([
        supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('treinador_id', treinador!.id).eq('ativo', true),
        supabase.from('avaliacoes').select('*', { count: 'exact', head: true }).eq('treinador_id', treinador!.id).gte('created_at', startOfMonth),
        supabase.from('treinos').select('*', { count: 'exact', head: true }).eq('treinador_id', treinador!.id),
        supabase.from('avaliacoes').select('*, aluno:alunos(*)').eq('treinador_id', treinador!.id).order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        totalAlunos: totalAlunos ?? 0,
        avaliacoesMes: avaliacoesMes ?? 0,
        treinosGerados: treinosGerados ?? 0,
      })
      setRecentAvaliacoes((avaliacoes as unknown as AvaliacaoComAluno[]) ?? [])
      setLoading(false)
    }
    loadData()
  }, [treinador])

  const statCards = [
    { label: 'Total de Alunos', value: stats.totalAlunos, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Avaliações este Mês', value: stats.avaliacoesMes, icon: ClipboardList, color: 'bg-primary-50 text-primary-600' },
    { label: 'Treinos Gerados', value: stats.treinosGerados, icon: Dumbbell, color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {treinador?.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo ao FitLaudo</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <Button onClick={() => navigate('/alunos/novo')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Avaliação
        </Button>
        <Button variant="secondary" onClick={() => navigate('/alunos/novo')}>
          Cadastrar Aluno
        </Button>
      </div>

      {/* Recent Evaluations */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Avaliações Recentes</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : recentAvaliacoes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhuma avaliação realizada ainda.</p>
            <Button className="mt-3" size="sm" onClick={() => navigate('/alunos/novo')}>
              Fazer primeira avaliação
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentAvaliacoes.map((av) => (
              <li key={av.id}>
                <button
                  onClick={() => navigate(`/avaliacoes/${av.id}`)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{av.aluno?.nome}</p>
                    <p className="text-xs text-gray-500">{formatDate(av.created_at)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
