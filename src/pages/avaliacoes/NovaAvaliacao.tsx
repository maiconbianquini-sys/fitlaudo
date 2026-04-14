import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Camera, Loader2, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { Aluno } from '../../types'

interface FormData {
  peso: number
  altura: number
  idade: number
  objetivo: string
}

type PhotoKey = 'frente' | 'lado' | 'costas'
const PHOTOS: { key: PhotoKey; label: string }[] = [
  { key: 'frente', label: 'Frente' },
  { key: 'lado', label: 'Lateral' },
  { key: 'costas', label: 'Costas' },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function NovaAvaliacao() {
  const { id: alunoId } = useParams<{ id: string }>()
  const { treinador, session } = useAuth()
  const navigate = useNavigate()
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [photos, setPhotos] = useState<Record<PhotoKey, File | null>>({ frente: null, lado: null, costas: null })
  const [previews, setPreviews] = useState<Record<PhotoKey, string | null>>({ frente: null, lado: null, costas: null })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<Record<PhotoKey, HTMLInputElement | null>>({ frente: null, lado: null, costas: null })

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (!alunoId) return
    supabase.from('alunos').select('*').eq('id', alunoId).single().then(({ data }) => {
      if (data) {
        setAluno(data as Aluno)
        setValue('objetivo', data.objetivo)
        if (data.data_nascimento) {
          const age = Math.floor((Date.now() - new Date(data.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
          setValue('idade', age)
        }
      }
    })
  }, [alunoId, setValue])

  function handlePhotoChange(key: PhotoKey, file: File | null) {
    setPhotos((prev) => ({ ...prev, [key]: file }))
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviews((prev) => ({ ...prev, [key]: url }))
    } else {
      setPreviews((prev) => ({ ...prev, [key]: null }))
    }
  }

  async function onSubmit(data: FormData) {
    if (!photos.frente || !photos.lado || !photos.costas) {
      setError('Por favor, adicione as 3 fotos (frente, lateral e costas).')
      return
    }
    setError(null)
    setIsAnalyzing(true)

    try {
      const [foto_frente_base64, foto_lado_base64, foto_costas_base64] = await Promise.all([
        fileToBase64(photos.frente),
        fileToBase64(photos.lado),
        fileToBase64(photos.costas),
      ])

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/analise-corporal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          aluno_id: alunoId,
          treinador_id: treinador!.id,
          peso: data.peso,
          altura: data.altura,
          idade: data.idade,
          objetivo: data.objetivo,
          foto_frente_base64,
          foto_lado_base64,
          foto_costas_base64,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao processar análise.')
      }

      const result = await response.json()
      navigate(`/avaliacoes/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Avaliação</h1>
          {aluno && <p className="text-gray-500 text-sm">Aluno: {aluno.nome}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Body data */}
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Dados Corporais</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Input
              label="Peso (kg) *"
              type="number"
              step="0.1"
              placeholder="75.5"
              error={errors.peso?.message}
              {...register('peso', { required: 'Obrigatório', valueAsNumber: true, min: { value: 20, message: 'Peso inválido' }, max: { value: 300, message: 'Peso inválido' } })}
            />
            <Input
              label="Altura (cm) *"
              type="number"
              placeholder="175"
              error={errors.altura?.message}
              {...register('altura', { required: 'Obrigatório', valueAsNumber: true, min: { value: 100, message: 'Altura inválida' } })}
            />
            <Input
              label="Idade *"
              type="number"
              placeholder="30"
              error={errors.idade?.message}
              {...register('idade', { required: 'Obrigatório', valueAsNumber: true, min: { value: 10, message: 'Idade inválida' } })}
            />
          </div>
          <div className="mt-4 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Objetivo *</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 bg-white"
              {...register('objetivo', { required: 'Objetivo obrigatório' })}
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
        </Card>

        {/* Photos */}
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Fotos do Aluno *</h2>
          <p className="text-xs text-gray-500 mb-4">Adicione 3 fotos: frente, lateral e costas. A IA usará essas imagens para a análise corporal.</p>
          <div className="grid grid-cols-3 gap-3">
            {PHOTOS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">{label}</span>
                {previews[key] ? (
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-primary-300">
                    <img src={previews[key]!} alt={label} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handlePhotoChange(key, null)}
                      className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRefs.current[key]?.click()}
                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                  >
                    <Camera className="h-6 w-6 text-gray-400" />
                    <span className="text-xs text-gray-400">Adicionar</span>
                  </button>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={(el) => { inputRefs.current[key] = el }}
                  onChange={(e) => handlePhotoChange(key, e.target.files?.[0] ?? null)}
                />
              </div>
            ))}
          </div>
        </Card>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analisando com IA... isso pode levar alguns segundos
            </>
          ) : (
            'Gerar Laudo com IA'
          )}
        </Button>
      </form>
    </div>
  )
}
