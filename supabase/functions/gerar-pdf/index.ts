import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { avaliacao_id } = await req.json()

    // Fetch all data
    const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', avaliacao_id).single()
    if (!av) throw new Error('Avaliação não encontrada.')

    const [{ data: aluno }, { data: treinador }, { data: treino }] = await Promise.all([
      supabase.from('alunos').select('*').eq('id', av.aluno_id).single(),
      supabase.from('treinadores').select('*').eq('id', av.treinador_id).single(),
      supabase.from('treinos').select('*').eq('avaliacao_id', avaliacao_id).order('created_at', { ascending: false }).limit(1).single(),
    ])

    // Build PDF HTML
    const diasTreino = treino?.treino_completo?.dias ?? []
    const treinoHTML = diasTreino.map((dia: { dia: string; nome: string; exercicios: Array<{ nome: string; series: number; repeticoes: string; descanso: string; observacao?: string }> }) => `
      <div class="dia-treino">
        <h3>${dia.dia} — ${dia.nome}</h3>
        <table>
          <thead><tr><th>Exercício</th><th>Séries</th><th>Repetições</th><th>Descanso</th><th>Obs.</th></tr></thead>
          <tbody>
            ${dia.exercicios.map((ex: { nome: string; series: number; repeticoes: string; descanso: string; observacao?: string }) => `
              <tr>
                <td>${ex.nome}</td>
                <td>${ex.series}</td>
                <td>${ex.repeticoes}</td>
                <td>${ex.descanso}</td>
                <td>${ex.observacao ?? '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1f2937; background: #fff; }
  .header { background: #2D9D8F; color: white; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 24px; font-weight: bold; }
  .header p { font-size: 12px; opacity: 0.85; margin-top: 2px; }
  .logo { max-height: 56px; max-width: 120px; object-fit: contain; }
  .content { padding: 24px 32px; }
  .student-info { background: #f0fdfb; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
  .student-info h2 { font-size: 18px; color: #2D9D8F; margin-bottom: 8px; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .info-item p:first-child { font-size: 11px; color: #6b7280; }
  .info-item p:last-child { font-weight: 600; font-size: 14px; }
  .metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
  .metric-card { background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #e5e7eb; }
  .metric-card .value { font-size: 20px; font-weight: bold; color: #2D9D8F; }
  .metric-card .label { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .section-title { font-size: 16px; font-weight: bold; color: #2D9D8F; border-bottom: 2px solid #2D9D8F; padding-bottom: 6px; margin: 20px 0 12px; }
  .laudo { line-height: 1.7; font-size: 13px; color: #374151; white-space: pre-wrap; }
  .dia-treino { margin-bottom: 16px; }
  .dia-treino h3 { background: #e8f7f5; color: #1a7d71; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-weight: 600; color: #374151; }
  td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
  .footer { margin-top: 32px; padding: 16px 32px; border-top: 2px solid #2D9D8F; display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>FitLaudo</h1>
    <p>Laudo de Avaliação Corporal</p>
  </div>
  <div style="text-align:right">
    ${treinador?.logo_url ? `<img src="${treinador.logo_url}" class="logo" alt="logo" />` : ''}
    <p style="font-size:13px;font-weight:600;margin-top:4px">${treinador?.nome ?? ''}</p>
    ${treinador?.cref ? `<p style="font-size:11px;opacity:0.85">CREF: ${treinador.cref}</p>` : ''}
  </div>
</div>

<div class="content">
  <div class="student-info">
    <h2>${aluno?.nome}</h2>
    <div class="info-grid">
      <div class="info-item"><p>Data da Avaliação</p><p>${formatDate(av.created_at)}</p></div>
      <div class="info-item"><p>Idade</p><p>${av.idade} anos</p></div>
      <div class="info-item"><p>Sexo</p><p>${aluno?.sexo === 'M' ? 'Masculino' : 'Feminino'}</p></div>
      <div class="info-item"><p>Objetivo</p><p>${aluno?.objetivo}</p></div>
    </div>
  </div>

  ${(av.foto_frente_url || av.foto_lado_url || av.foto_costas_url) ? `
  <div class="section-title">Fotos da Avaliação</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    ${av.foto_frente_url ? `<div style="text-align:center"><img src="${av.foto_frente_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /><p style="font-size:11px;color:#6b7280;margin-top:4px">Frente</p></div>` : ''}
    ${av.foto_lado_url ? `<div style="text-align:center"><img src="${av.foto_lado_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /><p style="font-size:11px;color:#6b7280;margin-top:4px">Lateral</p></div>` : ''}
    ${av.foto_costas_url ? `<div style="text-align:center"><img src="${av.foto_costas_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /><p style="font-size:11px;color:#6b7280;margin-top:4px">Costas</p></div>` : ''}
  </div>
  ` : ''}

  <div class="section-title">Métricas Corporais</div>
  <div class="metrics">
    <div class="metric-card"><div class="value">${av.peso}kg</div><div class="label">Peso</div></div>
    <div class="metric-card"><div class="value">${av.altura}cm</div><div class="label">Altura</div></div>
    ${av.percentual_gordura != null ? `<div class="metric-card"><div class="value">${av.percentual_gordura}%</div><div class="label">Gordura</div></div>` : ''}
    ${av.massa_magra_kg != null ? `<div class="metric-card"><div class="value">${av.massa_magra_kg}kg</div><div class="label">Massa Magra</div></div>` : ''}
    ${av.agua_corporal != null ? `<div class="metric-card"><div class="value">${av.agua_corporal}%</div><div class="label">Água</div></div>` : ''}
    ${av.gordura_visceral != null ? `<div class="metric-card"><div class="value">${av.gordura_visceral}</div><div class="label">G. Visceral</div></div>` : ''}
    ${av.taxa_metabolica_basal != null ? `<div class="metric-card"><div class="value">${av.taxa_metabolica_basal}</div><div class="label">TMB kcal</div></div>` : ''}
    ${av.idade_fisiologica != null ? `<div class="metric-card"><div class="value">${av.idade_fisiologica}</div><div class="label">Idade Fisiol.</div></div>` : ''}
  </div>

  ${av.laudo_ia ? `
  <div class="section-title">Laudo Corporal</div>
  <div class="laudo">${av.laudo_ia}</div>
  ` : ''}

  ${treino ? `
  <div class="section-title">Plano de Treino — ${treino.titulo}</div>
  <p style="font-size:12px;color:#6b7280;margin-bottom:12px">Nível: ${treino.nivel_experiencia} · ${treino.frequencia_semanal}x/semana · ${treino.duracao_minutos} min/sessão</p>
  ${treinoHTML}
  ` : ''}
</div>

<div class="footer">
  <span>Gerado pelo FitLaudo em ${formatDate(new Date().toISOString())}</span>
  <span>${treinador?.nome}${treinador?.cref ? ` — CREF: ${treinador.cref}` : ''}</span>
</div>
</body>
</html>`

    // Store HTML as file in Supabase Storage and return URL
    const fileName = `laudos/${avaliacao_id}.html`
    const { error: storageError } = await supabase.storage
      .from('fitlaudo-assets')
      .upload(fileName, new Blob([html], { type: 'text/html' }), { upsert: true })

    if (storageError) throw new Error(storageError.message)

    const { data: { publicUrl } } = supabase.storage.from('fitlaudo-assets').getPublicUrl(fileName)

    // Update avaliacao with pdf_url
    await supabase.from('avaliacoes').update({ pdf_url: publicUrl }).eq('id', avaliacao_id)

    return new Response(JSON.stringify({ pdf_url: publicUrl, html }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
