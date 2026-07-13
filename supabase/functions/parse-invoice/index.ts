// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const callOpenAIVisionForText = async (fileUrl: string) => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please extract all the raw text from this document accurately. Do not format it or add markdown. Just return the pure extracted text.' },
            { type: 'image_url', image_url: { url: fileUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI Vision error (${response.status}): ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  return payload.choices?.[0]?.message?.content || '';
};

const callOpenAIStructurer = async (ocrText: string, qrData: any, learningRules: any[], fileName: string) => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const rulesText = learningRules.length > 0 
    ? `\nHere are some user-defined learning rules for specific suppliers. If the invoice matches these keywords/NIF, prefer these categories and descriptions:\n${JSON.stringify(learningRules, null, 2)}`
    : '';

  const prompt = `You are a strict JSON data extraction assistant for Portuguese invoices (pt-PT).
Your task is to take the provided raw OCR text, filename, and QR code data, and organize it into a strict JSON structure.
DO NOT invent financial values. If you are unsure, output null.

Output JSON Format Requirements:
{
  "invoice_number": "String or null",
  "supplier": "String or null",
  "supplier_vat": "String or null",
  "invoice_date": "YYYY-MM-DD or null",
  "net_amount": Number or null,
  "vat_amount": Number or null,
  "total_amount": Number or null,
  "expense_description": "Short descriptive summary (e.g. 'Abastecimento de combustível', 'Portagens', 'Subscrição GPS')",
  "suggested_category": "Short category (e.g. 'Combustível', 'Manutenção', 'Portagens')",
  "vehicle_registrations": ["XX-XX-XX", ...],
  "products": [
    {
      "description": "String",
      "qty": Number,
      "unit_price": Number,
      "vat_percent": Number (0, 6, 13, 23)
    }
  ],
  "confidence_scores": {
    "invoice_number": Number (0-100),
    "supplier": Number (0-100),
    "total_amount": Number (0-100)
  }
}

Important Rules:
1. ONLY return valid JSON. Do not include markdown \`\`\`json.
2. In 'products', include ONLY billable items. Do NOT include Totals, IBANs, or payment details.
3. If QR Code data is provided, trust it above OCR text for totals and NIF.
4. Confidence scores should reflect your certainty. If the OCR text is blurry or you can't clearly find the invoice number, set its score below 80.${rulesText}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `FileName: ${fileName}\nQR Data: ${JSON.stringify(qrData)}\n\nRaw OCR Text:\n${ocrText}` }
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI Chat error (${response.status}): ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || '{}';
  return JSON.parse(text);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let importId: string | undefined;

  try {
    const { fileUrl, importId: incomingImportId, ocrText: providedOcrText, qrData = {}, fileName = '' } = await req.json();
    importId = incomingImportId;

    if (!fileUrl && !providedOcrText) throw new Error('Missing fileUrl or ocrText');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get OCR Text (use provided from PDF, or extract via Vision for Image)
    let ocrText = providedOcrText;
    if (!ocrText || ocrText.trim() === '') {
      ocrText = await callOpenAIVisionForText(fileUrl);
    }

    // 2. Fetch learning rules
    let learningRules = [];
    try {
      const { data } = await supabaseAdmin.from('invoice_learning_rules').select('*').limit(50);
      if (data) learningRules = data;
    } catch (e) {
      console.error('Failed to fetch learning rules', e);
    }

    // 3. Optional: Specific Local TypeScript Parsers could run here.
    // We will let the AI handle it alongside the learning rules for maximum flexibility,
    // as the prompt now supports the strict schema and rules injection.

    // 4. Organize with AI
    const structuredJson = await callOpenAIStructurer(ocrText, qrData, learningRules, fileName);

    // Normalize basic numbers just to be safe
    if (structuredJson.products && Array.isArray(structuredJson.products)) {
        structuredJson.products = structuredJson.products.map((p: any) => ({
            ...p,
            qty: Number(p.qty) || 1,
            unit_price: Number(p.unit_price) || 0,
            vat_percent: [0, 6, 13, 23].includes(Number(p.vat_percent)) ? Number(p.vat_percent) : 23
        }));
    }

    if (importId) {
      await supabaseAdmin
        .from('invoice_imports')
        .update({ 
            extracted_json: structuredJson, 
            ocr_text: ocrText,
            confidence_scores: structuredJson.confidence_scores || null,
            status: 'ready', 
            error: null 
        })
        .eq('id', importId);
    }

    return new Response(JSON.stringify({ ...structuredJson, ocr_text: ocrText }), {
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
