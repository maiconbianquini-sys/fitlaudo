import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, Users } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatAge } from '../../lib/utils'
import type { Aluno } from '../../types'

export default function ListaAlunos() {
  const { treinador } = useAuth()
  const navigate = useNavigate()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!treinador) return
    async function loadAlunos() {
      const { data } = await supabase
        .from('alunos')
        .select('*')
        .eq('treinador_id', treinador!.id)
        .order('nome')
      setAlunos((data as Aluno[]) ?? [])
      setLoading(false)
    }
    loadAlunos()
  }, [treinador])

  const filtered = alunos.filter((a) =>
    a.nome.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alunos</h1>
          <p className="text-gray-500 text-sm">{alunos.length} aluno{alunos.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('/alunos/novo')}>
          <Plus className="h-4 w-4" />
          Novo Aluno
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar aluno..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 bg-white"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">
            {search ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => navigate('/alunos/novo')}>
              Cadastrar primeiro aluno
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-gray-50">
            {filtered.map((aluno) => (
              <li key={aluno.id}>
                <button
                  onClick={() => navigate(`/alunos/${aluno.id}`)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 font-bold text-sm">
                        {aluno.nome[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{aluno.nome}</p>
                      <p className="text-xs text-gray-500">
                        {aluno.data_nascimento ? `${formatAge(aluno.data_nascimento)} anos` : ''}
                        {aluno.data_nascimento && aluno.objetivo ? ' · ' : ''}
                        {aluno.objetivo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={aluno.ativo ? 'green' : 'gray'}>
                      {aluno.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
