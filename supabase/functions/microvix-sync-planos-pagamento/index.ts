// Edge Function: sincroniza planos de pagamento do Microvix B2C
// Usa o método B2CConsultaPlanos com timestamp incremental

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MicrovixConfig {
  id: string
  empresa_id: string
  url_saida: string
  chave: string
  usuario: string
  senha: string
  portal: number
  codigo_empresa: number
  cnpj_empresa: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = req.body ? await req.json().catch(() => ({})) : {}
    const empresaIdFiltro = body.empresa_id || null

    // Busca configurações Microvix ativas
    let query = supabase
      .from('empresa_erp_config')
      .select('id, empresa_id, url_saida, chave, usuario, senha, portal, codigo_empresa, cnpj_empresa')
      .eq('erp_tipo', 'microvix')
      .eq('ativo', true)

    if (empresaIdFiltro) {
      query = query.eq('empresa_id', empresaIdFiltro)
    }

    const { data: configs, error: errConfigs } = await query
    if (errConfigs) throw new Error(`Erro ao buscar configs: ${errConfigs.message}`)
    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, motivo: 'sem_configs_ativas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resultados: any[] = []

    for (const config of configs as MicrovixConfig[]) {
      const r = await sincronizarConfig(supabase, config)
      resultados.push({ empresa_id: config.empresa_id, ...r })
    }

    return new Response(
      JSON.stringify({ ok: true, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[sync-planos] erro:', error)
    return new Response(
      JSON.stringify({ ok: false, erro: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sincronizarConfig(supabase: any, config: MicrovixConfig) {
  try {
    // Pega último timestamp sincronizado pra esta empresa
    const { data: maxTs } = await supabase
      .from('planos_pagamento')
      .select('microvix_timestamp')
      .eq('empresa_id', config.empresa_id)
      .order('microvix_timestamp', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const timestampAtual = maxTs?.microvix_timestamp || 0

    // Monta XML pro B2CConsultaPlanos
    const xmlBody = `<?xml version='1.0' encoding='utf-8' ?>
<LinxMicrovix>
  <Authentication user="${config.usuario}" password="${config.senha}"/>
  <ResponseFormat>xml</ResponseFormat>
  <IdPortal>${config.portal}</IdPortal>
  <Command>
    <Name>B2CConsultaPlanos</Name>
    <Parameters>
      <Parameter id="chave">${config.chave}</Parameter>
      <Parameter id="cnpjEmp">${config.cnpj_empresa}</Parameter>
      <Parameter id="timestamp">${timestampAtual}</Parameter>
    </Parameters>
  </Command>
</LinxMicrovix>`

    const resp = await fetch(config.url_saida, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xmlBody
    })

    const xmlResp = await resp.text()

    console.log('[microvix-sync-planos] XML retornado (primeiros 2000 chars):', xmlResp.substring(0, 2000))
    console.log('[microvix-sync-planos] Tamanho total:', xmlResp.length)

    if (!resp.ok) {
      return { ok: false, motivo: `HTTP ${resp.status}`, body: xmlResp.substring(0, 500) }
    }

    // Parser do formato Microvix: <C> = colunas (cabeçalho), <R> = linhas (registros), <D> = células
    const planos: any[] = []

    // 1. Extrai cabeçalho (nomes das colunas em ordem)
    const cabecalhoMatch = xmlResp.match(/<C>([\s\S]*?)<\/C>/)
    if (!cabecalhoMatch) {
      console.log('[microvix-sync-planos] Cabeçalho <C> não encontrado no XML')
      return { ok: true, total: 0, motivo: 'sem_cabecalho' }
    }

    const colunasCabecalho: string[] = []
    const colunaRegex = /<D>([\s\S]*?)<\/D>/g
    let colMatch
    while ((colMatch = colunaRegex.exec(cabecalhoMatch[1])) !== null) {
      colunasCabecalho.push(colMatch[1].trim())
    }

    console.log('[microvix-sync-planos] Colunas:', JSON.stringify(colunasCabecalho))

    // 2. Extrai cada linha <R> e mapeia <D> usando ordem do cabeçalho
    const linhasRegex = /<R>([\s\S]*?)<\/R>/g
    let linhaMatch
    while ((linhaMatch = linhasRegex.exec(xmlResp)) !== null) {
      const inner = linhaMatch[1]
      const valoresRegex = /<D>([\s\S]*?)<\/D>/g
      const valores: string[] = []
      let valMatch
      while ((valMatch = valoresRegex.exec(inner)) !== null) {
        valores.push(valMatch[1].trim())
      }

      // Cria objeto coluna→valor
      const linha: Record<string, string> = {}
      for (let i = 0; i < colunasCabecalho.length; i++) {
        linha[colunasCabecalho[i]] = valores[i] || ''
      }

      const plano = {
        id_microvix: parseInt(linha.plano || '0', 10),
        nome: linha.nome_plano || null,
        qtde_parcelas: parseInt(linha.qtde_parcelas || '1', 10),
        desativado: linha.desativado || 'N',
        tipo_plano: linha.tipo_plano || null,
        microvix_timestamp: parseInt(linha.timestamp || '0', 10)
      }

      if (plano.id_microvix > 0 && plano.nome) {
        planos.push(plano)
      }
    }

    console.log('[microvix-sync-planos] Planos extraídos do XML:', planos.length)
    if (planos.length > 0) {
      console.log('[microvix-sync-planos] Primeiro plano:', JSON.stringify(planos[0]))
    }

    if (planos.length === 0) {
      return { ok: true, total: 0, motivo: 'sem_novos' }
    }

    // Upsert por (empresa_id, id_microvix)
    const agora = new Date().toISOString()
    const registros = planos.map((p, idx) => ({
      empresa_id: config.empresa_id,
      id_microvix: p.id_microvix,
      nome: p.nome,
      qtde_parcelas: p.qtde_parcelas || 1,
      ativo: p.desativado !== 'S',  // 'S' = desativado, 'N' = ativo
      ordem_exibicao: idx,
      microvix_timestamp: p.microvix_timestamp,
      microvix_synced_at: agora,
      updated_at: agora
    }))

    const { error: errUpsert } = await supabase
      .from('planos_pagamento')
      .upsert(registros, { onConflict: 'empresa_id,id_microvix' })

    if (errUpsert) {
      return { ok: false, motivo: errUpsert.message }
    }

    return { ok: true, total: registros.length }
  } catch (error: any) {
    return { ok: false, motivo: error.message }
  }
}
