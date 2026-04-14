import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dumbbell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const schema = z
  .object({
    nome: z.string().min(2, 'Nome obrigatório'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string(),
    cref: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function Registro() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)

    // 1. Criar conta no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        setServerError('Este e-mail já está cadastrado.')
      } else {
        setServerError(authError.message)
      }
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setServerError('Erro ao criar conta. Tente novamente.')
      return
    }

    // 2. Criar perfil do treinador
    const { error: profileError } = await supabase.from('treinadores').insert({
      id: userId,
      email: data.email,
      nome: data.nome,
      cref: data.cref || null,
      plano: 'basico',
      alunos_limite: 10,
      ativo: true,
    })

    if (profileError) {
      setServerError('Conta criada, mas erro ao salvar perfil. Faça login e complete seu perfil.')
      navigate('/login')
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Dumbbell className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">FitLaudo</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Crie sua conta de profissional
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Criar conta</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Nome completo *"
              placeholder="Dr. João Silva"
              error={errors.nome?.message}
              {...register('nome')}
            />
            <Input
              label="E-mail *"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="CREF"
              placeholder="000000-G/SP"
              helper="Opcional — aparece no PDF do laudo"
              {...register('cref')}
            />
            <Input
              label="Senha *"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirmar senha *"
              type="password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {serverError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
              Criar conta
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já tem conta?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-4">
          © 2026 FitLaudo — Dr. Maicon Bianquini
        </p>
      </div>
    </div>
  )
}
