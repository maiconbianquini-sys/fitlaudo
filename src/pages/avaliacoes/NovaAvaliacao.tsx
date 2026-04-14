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

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

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

// Compress image to max 800px and convert to base64 (jpeg 0.75)
function compressImage(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
      resolve(dataUrl.split(',')[1])
    }
    img.onerror = reject
    img.src = url
  })
}

// Convert base64 to Uint8Array for Supabase Storage upload
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export default function NovaAvaliacao() {
  const { id: alunoId } = useParams<{ id: string }>()
  const { treinador, session } = useAuth()
  const navigate = useNavigate()
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [photos, setPhotos] = useState<Record<PhotoKey, File | null>>({ frente: null, lado: null, costas: null })
  const [previews, setPreviews] = useState<Record<PhotoKey, string | null>>({ frente: null, lado: null, costas: null })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
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
    if (!treinador || !session) {
      setError('Sessão inválida. Faça login novamente.')
      return
    }

    setError(null)
    setIsAnalyzing(true)

    try {
      // Step 1: Compress images
      setStatusMsg('Comprimindo imagens...')
      const [frente64, lado64, costas64] = await Promise.all([
        compressImage(photos.frente),
        compressImage(photos.lado),
        compressImage(photos.costas),
      ])

      // Step 2: Call Gemini directly
      setStatusMsg('Analisando com IA...')
      const imc = (data.peso / Math.pow(data.altura / 100, 2)).toFixed(1)

      const prompt = `Você é um especialista em avaliação corporal e fisiologia do exercício.
Analise as 3 fotos corporais (frente, lateral e costas) de um(a) aluno(a) com os seguintes dados:
- Peso: ${data.peso}kg
- Altura: ${data.altura}cm
- Idade: ${data.idade} anos
- IMC calculado: ${imc}
- Objetivo: ${data.objetivo}

Com base nas fotos e nos dados fornecidos, estime e retorne um JSON com a seguinte estrutura:
{
  "percentual_gordura": número (entre 3 e 50),
  "gordura_kg": número,
  "massa_magra_kg": número,
  "agua_corporal": número (percentual, entre 40 e 70),
  "gordura_visceral": número (entre 1 e 20),
  "taxa_metabolica_basal": número (kcal/dia),
  "idade_fisiologica": número (anos),
  "laudo": "texto completo do laudo corporal em português, com pelo menos 3 parágrafos. Inclua: análise da composição corporal, pontos de atenção, recomendações para atingir o objetivo de ${data.objetivo}. Seja técnico mas acessível."
}

Retorne APENAS o JSON, sem markdown, sem explicações adicionais.`

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/jpeg', data: frente64 } },
                { inline_data: { mime_type: 'image/jpeg', data: lado64 } },
                { inline_data: { mime_type: 'image/jpeg', data: costas64 } },
              ],
            }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
          }),
        }
      )

      if (!geminiRes.ok) {
        const errText = await geminiRes.text()
        throw new Error(`Erro na IA: ${errText}`)
      }

      const geminiData = await geminiRes.json()
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Resposta inválida da IA. Tente novamente.')
      const analise = JSON.parse(jsonMatch[0])

      // Step 3: Upload photos to Storage
      setStatusMsg('Salvando fotos...')
      const timestamp = Date.now()
      const prefix = `avaliacoes/${treinador.id}/${alunoId}/${timestamp}`

      const [fUp, lUp, cUp] = await Promise.all([
        supabase.storage.from('fitlaudo-assets').upload(`${prefix}_frente.jpg`, base64ToUint8Array(frente64), { contentType: 'image/jpeg', upsert: true }),
        supabase.storage.from('fitlaudo-assets').upload(`${prefix}_lado.jpg`, base64ToUint8Array(lado64), { contentType: 'image/jpeg', upsert: true }),
        supabase.storage.from('fitlaudo-assets').upload(`${prefix}_costas.jpg`, base64ToUint8Array(costas64), { contentType: 'image/jpeg', upsert: true }),
      ])

      const getUrl = (path: string) => supabase.storage.from('fitlaudo-assets').getPublicUrl(path).data.publicUrl
      const frenteUrl = fUp.error ? null : getUrl(`${prefix}_frente.jpg`)
      const ladoUrl = lUp.error ? null : getUrl(`${prefix}_lado.jpg`)
      const costasUrl = cUp.error ? null : getUrl(`${prefix}_costas.jpg`)

      // Step 4: Save to database
      setStatusMsg('Salvando avaliação...')
      const { data: avaliacao, error: dbError } = await supabase
        .from('avaliacoes')
        .insert({
          aluno_id: alunoId,
          treinador_id: treinador.id,
          peso: data.peso,
          altura: data.altura,
          idade: data.idade,
          percentual_gordura: analise.percentual_gordura,
          gordura_kg: analise.gordura_kg,
          massa_magra_kg: analise.massa_magra_kg,
          agua_corporal: analise.agua_corporal,
          gordura_visceral: analise.gordura_visceral,
          taxa_metabolica_basal: analise.taxa_metabolica_basal,
          idade_fisiologica: analise.idade_fisiologica,
          laudo_ia: analise.laudo,
          foto_frente_url: frenteUrl,
          foto_lado_url: ladoUrl,
          foto_costas_url: costasUrl,
        })
        .select()
        .single()

      if (dbError) throw new Error(dbError.message)

      navigate(`/avaliacoes/${avaliacao.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.')
    } finally {
      setIsAnalyzing(false)
      setStatusMsg('')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
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
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {statusMsg || 'Analisando...'}
            </span>
          ) : (
            'Gerar Laudo com IA'
          )}
        </Button>
      </form>
    </div>
  )
}
