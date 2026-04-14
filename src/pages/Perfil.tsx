import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  cref: z.string().optional(),
  telefone: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const planoLabels: Record<string, string> = {
  basico: 'Básico',
  profissional: 'Profissional',
  premium: 'Premium',
}

export default function PerfilPage() {
  const { treinador, user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (treinador) {
      reset({ nome: treinador.nome, cref: treinador.cref ?? '', telefone: treinador.telefone ?? '' })
      setLogoUrl(treinador.logo_url ?? null)
    }
  }, [treinador, reset])

  async function onSubmit(data: FormData) {
    if (!treinador) return
    await supabase.from('treinadores').update({
      nome: data.nome,
      cref: data.cref || null,
      telefone: data.telefone || null,
    }).eq('id', treinador.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleLogoUpload(file: File) {
    if (!treinador) return
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `logos/${treinador.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('fitlaudo-assets').upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('fitlaudo-assets').getPublicUrl(path)
      await supabase.from('treinadores').update({ logo_url: publicUrl }).eq('id', treinador.id)
      setLogoUrl(publicUrl)
    }
    setUploadingLogo(false)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm">Dados profissionais do treinador</p>
      </div>

      {/* Logo */}
      <Card className="p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Logo do Profissional</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Camera className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Aparece no PDF do laudo</p>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                {uploadingLogo ? 'Enviando...' : 'Alterar logo'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Dados Profissionais</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nome completo *" placeholder="Dr. João Silva" error={errors.nome?.message} {...register('nome')} />
          <Input label="CREF" placeholder="000000-G/SP" helper="Aparece no PDF do laudo" {...register('cref')} />
          <Input label="E-mail" type="email" value={user?.email ?? ''} disabled className="bg-gray-50 cursor-not-allowed" />
          <Input label="WhatsApp / Telefone" placeholder="(13) 99999-9999" {...register('telefone')} />

          <Button type="submit" loading={isSubmitting} className={saved ? 'bg-green-500 hover:bg-green-500' : ''}>
            {saved ? <><Check className="h-4 w-4" />Salvo!</> : 'Salvar alterações'}
          </Button>
        </form>
      </Card>

      {/* Plan info */}
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Plano Atual</h2>
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="green">{planoLabels[treinador?.plano ?? ''] ?? treinador?.plano}</Badge>
            <p className="text-sm text-gray-500 mt-2">
              Alunos: {treinador?.alunos_limite === -1 ? 'Ilimitado' : treinador?.alunos_limite}
            </p>
            {treinador?.expira_em && (
              <p className="text-xs text-gray-400 mt-1">
                Expira em: {new Date(treinador.expira_em).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <Badge variant={treinador?.ativo ? 'green' : 'red'}>
            {treinador?.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </Card>
    </div>
  )
}
