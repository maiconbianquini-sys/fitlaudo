import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useState } from 'react'

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  data_nascimento: z.string().min(1, 'Data de nascimento obrigatória'),
  sexo: z.enum(['M', 'F'] as const),
  objetivo: z.string().min(2, 'Objetivo obrigatório'),
  observacoes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NovoAluno() {
  const { treinador } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const { data: aluno, error } = await supabase
      .from('alunos')
      .insert({
        treinador_id: treinador!.id,
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        data_nascimento: data.data_nascimento,
        sexo: data.sexo,
        objetivo: data.objetivo,
        observacoes: data.observacoes || null,
        ativo: true,
      })
      .select()
      .single()

    if (error) {
      setServerError('Erro ao cadastrar aluno. Tente novamente.')
      return
    }
    navigate(`/alunos/${aluno.id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Aluno</h1>
          <p className="text-gray-500 text-sm">Preencha os dados do aluno</p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nome completo *" placeholder="Ex: João Silva" error={errors.nome?.message} {...register('nome')} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="E-mail" type="email" placeholder="joao@email.com" error={errors.email?.message} {...register('email')} />
            <Input label="Telefone / WhatsApp" placeholder="(11) 99999-9999" {...register('telefone')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Data de nascimento *" type="date" error={errors.data_nascimento?.message} {...register('data_nascimento')} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Sexo *</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 bg-white"
                {...register('sexo')}
              >
                <option value="">Selecione...</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
              {errors.sexo && <p className="text-xs text-red-500">{errors.sexo.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Objetivo principal *</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 bg-white"
              {...register('objetivo')}
            >
              <option value="">Selecione...</option>
              <option value="Emagrecimento">Emagrecimento</option>
              <option value="Ganho de massa muscular">Ganho de massa muscular</option>
              <option value="Condicionamento físico">Condicionamento físico</option>
              <option value="Saúde e bem-estar">Saúde e bem-estar</option>
              <option value="Definição muscular">Definição muscular</option>
              <option value="Reabilitação">Reabilitação</option>
            </select>
            {errors.objetivo && <p className="text-xs text-red-500">{errors.objetivo.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Observações</label>
            <textarea
              rows={3}
              placeholder="Lesões, limitações, histórico de saúde..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 bg-white resize-none"
              {...register('observacoes')}
            />
          </div>

          {serverError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Cadastrar Aluno
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
