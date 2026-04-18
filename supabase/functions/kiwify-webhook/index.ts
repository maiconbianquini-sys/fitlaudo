import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const KIWIFY_TOKEN = Deno.env.get('KIWIFY_TOKEN')!

// Mapeamento de planos
function detectarPlano(nomeProduto: string): { plano: 'basico' | 'profissional'; alunos_limite: number } {
  const nome = nomeProduto.toLowerCase()
  if (nome.includes('profissional') || nome.includes('pro')) {
    return { plano: 'profissional', alunos_limite: 50 }
  }
  return { plano: 'basico', alunos_limite: 20 }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const body = await req.json()
    console.log('[kiwify-webhook] evento recebido:', JSON.stringify(body))

    // Verificar token do webhook
    if (body.webhook_token !== KIWIFY_TOKEN) {
      console.error('[kiwify-webhook] token inválido')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { order_status, customer, product } = body
    const email = (customer?.email ?? '').toLowerCase().trim()
    const nome = (customer?.name ?? 'Treinador').trim()
    const telefone = customer?.mobile ?? ''

    if (!email) {
      return new Response(JSON.stringify({ ok: true, msg: 'sem email' }))
    }

    // ── COMPRA APROVADA ────────────────────────────────────────────────────
    if (order_status === 'paid') {
      const { plano, alunos_limite } = detectarPlano(product?.name ?? '')

      // Verificar se já existe conta com esse e-mail
      const { data: existente } = await supabase
        .from('treinadores')
        .select('id, ativo')
        .eq('email', email)
        .maybeSingle()

      if (existente) {
        // Reativar conta existente
        await supabase
          .from('treinadores')
          .update({ ativo: true, plano, alunos_limite })
          .eq('id', existente.id)

        console.log(`[kiwify-webhook] conta reativada: ${email}`)
      } else {
        // Criar novo usuário (envia e-mail de convite automático pelo Supabase)
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
          data: { nome }
        })

        if (authError) {
          console.error('[kiwify-webhook] erro ao criar usuário:', authError.message)
          throw new Error(authError.message)
        }

        // Criar registro na tabela treinadores
        const { error: dbError } = await supabase.from('treinadores').insert({
          id: authData.user.id,
          email,
          nome,
          cref: '',
          telefone,
          plano,
          alunos_limite,
          ativo: true,
        })

        if (dbError) {
          console.error('[kiwify-webhook] erro ao criar treinador:', dbError.message)
          throw new Error(dbError.message)
        }

        console.log(`[kiwify-webhook] novo treinador criado: ${email} | plano: ${plano}`)
      }
    }

    // ── REEMBOLSO / CHARGEBACK / CANCELAMENTO ────────────────────────────
    if (['refunded', 'chargedback', 'subscription_canceled'].includes(order_status ?? '')) {
      await supabase
        .from('treinadores')
        .update({ ativo: false })
        .eq('email', email)

      console.log(`[kiwify-webhook] conta desativada: ${email} | motivo: ${order_status}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[kiwify-webhook] erro:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
