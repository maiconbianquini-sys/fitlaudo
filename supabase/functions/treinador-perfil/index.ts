import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autorizado.')

    const anonClient = createClient(SUPABASE_URL, authHeader.replace('Bearer ', ''))
    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) throw new Error('Não autorizado.')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('treinadores')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw new Error(error.message)
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'PUT') {
      const body = await req.json()
      const allowed = ['nome', 'cref', 'telefone', 'logo_url']
      const updates: Record<string, string> = {}
      for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key]
      }
      const { data, error } = await supabase
        .from('treinadores')
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
