// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const defaultJson = {
  supplier: '',
  invoice_number: '',
  date: '',
  total: 0,
  vat_total: 0,
  lines: [],
};

const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;

  const parsed = Number.parseFloat(
    value
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.')
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return new Date().toISOString().split('T')[0];

  const date = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const parts = date.replace(/[.]/g, '/').split('/');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0];
};

const normalizeVat = (value: unknown): 0 | 6 | 13 | 23 => {
  const n = Math.round(normalizeNumber(value));
  if (n === 6 || n === 13 || n === 23) return n;
  return 0;
};

const normalizeUnit = (value: unknown) => {
  const token = String(value || '').trim().toUpperCase();
  if (!token) return '';
  if (['UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES', 'UNI'].includes(token)) return 'UN';
  if (['H', 'HR', 'HRS', 'HORA', 'HORAS', 'HOF', 'HOR'].includes(token)) return 'H';
  if (['L', 'LT', 'LTS', 'LITRO', 'LITROS'].includes(token)) return 'L';
  if (['CX', 'CAIXA', 'CAIXAS'].includes(token)) return 'CX';
  return '';
};

const NON_ITEM_TEXT_REGEX = /(iban|swift|bic|nib|entidade|refer[êe]ncia|multibanco|pagamento|dados\s+banc[aá]rios|transfer[êe]ncia|vencimento|total\s+a\s+pagar|subtotal|iva\s+total|resumo\s+do\s+iva|a\s+transportar)/i;
const LABOR_DESCRIPTION_REGEX = /m[aã]o\s*obra|mao\s*(de\s*)?obra|labor|serralharia|mecanica|mec[aâ]nica/i;

const inferAllowedUnit = (description: string, rawUnit: unknown) => {
  const normalized = normalizeUnit(rawUnit);
  if (normalized) return normalized;
  if (LABOR_DESCRIPTION_REGEX.test(description)) return 'H';
  return 'UN';
};

const normalizeResponse = (raw: any) => {
  const lines = Array.isArray(raw?.lines)
    ? raw.lines
      .map((line: any) => {
        const description = String(line?.description || '').trim();
        const unidade_medida = inferAllowedUnit(description, line?.unidade_medida || line?.unit || line?.uom);
        const qtyRaw = Math.max(0, normalizeNumber(line?.qty || line?.quantity || 0));
        const lineTotal = Math.max(0, normalizeNumber(line?.total || line?.total_value || line?.net || line?.net_value || 0));
        const unitPriceRaw = Math.max(0, normalizeNumber(line?.unit_price || line?.price || line?.valor_unitario || 0));
        const qty = qtyRaw > 0 ? qtyRaw : (lineTotal > 0 ? 1 : 0);
        const unit_price = unitPriceRaw > 0
          ? unitPriceRaw
          : (lineTotal > 0 && qty > 0 ? Number((lineTotal / qty).toFixed(2)) : 0);

        return {
          description,
          unidade_medida,
          qty,
          unit_price,
          vat_percent: normalizeVat(line?.vat_percent ?? line?.vat ?? line?.iva_rate),
        };
      })
      .filter((line: any) => {
        if (!line.description) return false;
        if (NON_ITEM_TEXT_REGEX.test(line.description)) return false;

        return line.qty > 0 || line.unit_price > 0;
      })
    : [];

  return {
    supplier: String(raw?.supplier || raw?.supplier_name || '').trim(),
    invoice_number: String(raw?.invoice_number || raw?.number || '').trim(),
    date: normalizeDate(raw?.date || raw?.issue_date || raw?.invoice_date),
    total: Math.max(0, normalizeNumber(raw?.total)),
    vat_total: Math.max(0, normalizeNumber(raw?.vat_total || raw?.vat || raw?.iva_total)),
    lines,
  };
};

const callOpenAIVision = async (fileUrl: string) => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const prompt = [
    'Extrai os dados de uma fatura de fornecedor portuguesa (pt-PT).',
    'Responde APENAS JSON válido sem markdown nem texto adicional.',
    'Formato obrigatório:',
    JSON.stringify({
      supplier: '',
      invoice_number: '',
      date: 'YYYY-MM-DD',
      total: 0,
      vat_total: 0,
      lines: [{ description: '', unidade_medida: 'UN', qty: 1, unit_price: 0, vat_percent: 23 }],
    }),
    'IMPORTANTE: em lines incluir APENAS linhas faturáveis da grelha de itens/serviços (descrição + quantidade + unidade + preço).',
    'IMPORTANTE 2: devolve TODAS as linhas da grelha (não resumir, não agrupar, não truncar), mesmo que sejam >50 linhas.',
    'NÃO incluir IBAN, NIB, SWIFT/BIC, dados bancários, referências de pagamento, totais, subtotais, observações ou rodapé.',
    'Se faltar algum campo, usa string vazia ou 0.',
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      max_output_tokens: 12000,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: fileUrl },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error (${response.status}): ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  const text = payload?.output_text || '';

  if (!text) return defaultJson;

  try {
    return JSON.parse(text);
  } catch {
    const jsonBlock = text.match(/\{[\s\S]*\}/);
    if (jsonBlock?.[0]) {
      try {
        return JSON.parse(jsonBlock[0]);
      } catch {
        return defaultJson;
      }
    }
    return defaultJson;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let importId: string | undefined;

  try {
    const { fileUrl, importId: incomingImportId } = await req.json();
    importId = incomingImportId;

    if (!fileUrl) throw new Error('Missing fileUrl');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const aiRaw = await callOpenAIVision(fileUrl);
    const parsed = normalizeResponse(aiRaw);

    if (importId) {
      await supabaseAdmin
        .from('invoice_imports')
        .update({ extracted_json: parsed, status: 'ready', error: null })
        .eq('id', importId);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    try {
      if (importId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseAdmin
          .from('invoice_imports')
          .update({ status: 'failed', error: String(error?.message || 'Parsing failed').slice(0, 1000) })
          .eq('id', importId);
      }
    } catch {
      // ignore secondary errors
    }

    return new Response(JSON.stringify({ error: error?.message || 'Unexpected parse error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
