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

const normalizeResponse = (raw: any) => {
  const lines = Array.isArray(raw?.lines)
    ? raw.lines
      .map((line: any) => ({
        description: String(line?.description || '').trim(),
        qty: Math.max(0, normalizeNumber(line?.qty || line?.quantity || 1)) || 1,
        unit_price: Math.max(0, normalizeNumber(line?.unit_price || 0)),
        vat_percent: normalizeVat(line?.vat_percent ?? line?.vat ?? line?.iva_rate),
      }))
      .filter((line: any) => line.description)
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
      lines: [{ description: '', qty: 1, unit_price: 0, vat_percent: 23 }],
    }),
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
