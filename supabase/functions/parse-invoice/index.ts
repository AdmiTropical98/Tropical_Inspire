// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const callGeminiStructurer = async (ocrText, learningRules, fileName, fileUrl) => {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const rulesText = learningRules.length > 0 
    ? `\nHere are some user-defined learning rules for specific suppliers. If the invoice matches these keywords/NIF, prefer these categories and descriptions:\n${JSON.stringify(learningRules, null, 2)}`
    : '';

  const prompt = `You are a strict JSON data extraction assistant for Portuguese supplier invoices (pt-PT).
Your task is to take the provided document/image and text, and organize it into a strict JSON structure.
DO NOT invent financial values. Extract exactly what is printed on the invoice.

Output JSON Format Requirements:
{
  "invoice_number": "String or null (e.g. 'FTA 458126/381')",
  "supplier": "String or null (Supplier Name)",
  "supplier_vat": "String or null (Portuguese NIF/NIPC)",
  "invoice_date": "YYYY-MM-DD or null (Issue Date)",
  "due_date": "YYYY-MM-DD or null (Payment Due Date / Data de Vencimento)",
  "net_amount": Number or null (Total Base Tributável / Total Líquido sem IVA)",
  "vat_amount": Number or null (Total IVA)",
  "total_amount": Number or null (Total Final do Documento)",
  "expense_description": "Short descriptive summary",
  "suggested_category": "Short category",
  "vehicle_registrations": ["XX-XX-XX", ...],
  "products": [
    {
      "description": "String (Product or service description)",
      "qty": Number (Exact quantity, e.g. 1, 2, 10),
      "unidade_medida": "String (e.g. 'UN', 'HOR', 'H', 'L', 'CX')",
      "unit_price": Number (Unit price before discount),
      "discount_percentage": Number (Discount percentage, e.g. 0, 5, 15),
      "net_value": Number (Net total for the line after discount),
      "vat_percent": Number (0, 6, 13, 23),
      "vat_value": Number or null (VAT amount for this line)
    }
  ],
  "confidence_scores": {
    "invoice_number": Number (0-100),
    "supplier": Number (0-100),
    "total_amount": Number (0-100)
  }
}

Important Rules:
1. ONLY return valid JSON without any markdown formatting.
2. In 'products', include ALL billable items from the invoice table grid. Do NOT include Totals, IBANs, or payment details.
3. Preserve exact quantities (e.g. 2, 10), units (UN, HOR, H), unit prices, discounts (15%, 5%), and net line values as printed in the invoice.
4. Confidence scores should reflect your certainty. If the document is blurry or you can't clearly find the invoice number, set its score below 80.${rulesText}`;

  const parts = [
    { text: prompt },
    { text: `FileName: ${fileName}\n\nRaw Extracted Text (if available):\n${ocrText || 'Nenhum texto fornecido'}` }
  ];

  if (fileUrl) {
    try {
      const fileRes = await fetch(fileUrl);
      if (fileRes.ok) {
        const arrayBuffer = await fileRes.arrayBuffer();
        const base64 = base64Encode(arrayBuffer);
        const mimeType = fileUrl.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg';
        parts.push({
          inlineData: {
            mimeType,
            data: base64
          }
        });
      }
    } catch (e) {
      console.error('Falha ao descarregar fileUrl para enviar ao Gemini', e);
    }
  }

  // Temporary debug to fetch available models
  const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const listJson = await listRes.json();
  const availableModels = (listJson.models || []).map(m => m.name).filter(name => name.includes('gemini'));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${text.slice(0, 500)}. AVAILABLE MODELS: ${JSON.stringify(availableModels)}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return { text, prompt };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let importId;
  let currentStep = 'Start';

  try {
    currentStep = '[1] Request recebida';
    console.log(currentStep);
    const { fileUrl, importId: incomingImportId, ocrText: providedOcrText, fileName = '' } = await req.json();
    importId = incomingImportId;

    if (!fileUrl && !providedOcrText) {
        throw new Error('Missing fileUrl or ocrText');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    currentStep = '[2] PDF convertido / Ficheiro analisado';
    console.log(currentStep, { fileUrl, fileName, hasProvidedOcr: !!providedOcrText });

    currentStep = '[3] Texto analisado';
    console.log(currentStep);
    let ocrText = providedOcrText || '';
    
    currentStep = '[4] Texto pronto';
    console.log(currentStep, 'Texto completo extraído:\n' + ocrText);

    let learningRules = [];
    try {
      const { data } = await supabaseAdmin.from('invoice_learning_rules').select('*').limit(50);
      if (data) learningRules = data;
    } catch (e) {
      console.error('Failed to fetch learning rules', e);
    }

    currentStep = '[5] Prompt enviado à IA (Gemini)';
    console.log(currentStep);
    const aiResult = await callGeminiStructurer(ocrText, learningRules, fileName, fileUrl);
    console.log('Prompt Enviado:\n', aiResult.prompt);

    currentStep = '[6] Resposta recebida (Gemini)';
    console.log(currentStep);
    console.log('Resposta Completa da IA:\n', aiResult.text);

    currentStep = '[7] JSON validado';
    console.log(currentStep);
    const structuredJson = JSON.parse(aiResult.text);

    if (structuredJson.products && Array.isArray(structuredJson.products)) {
        structuredJson.products = structuredJson.products.map((p) => {
            const rawQty = Number(p.qty);
            const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : (p.qty !== undefined ? Number(p.qty) || 1 : 1);
            const unitPrice = Number(p.unit_price) || 0;
            const discountPercentage = Number(p.discount_percentage) || 0;
            const calculatedNet = Number((qty * unitPrice * (1 - discountPercentage / 100)).toFixed(2));
            const netValue = p.net_value !== undefined && p.net_value !== null ? Number(p.net_value) : calculatedNet;
            const vatPercent = [0, 6, 13, 23].includes(Number(p.vat_percent)) ? Number(p.vat_percent) : 23;
            const vatValue = p.vat_value !== undefined && p.vat_value !== null ? Number(p.vat_value) : Number((netValue * (vatPercent / 100)).toFixed(2));
            const rawUnit = String(p.unidade_medida || 'UN').trim().toUpperCase();
            const unidade_medida = ['HOR', 'H', 'L', 'CX', 'UN'].includes(rawUnit) ? rawUnit : (rawUnit.startsWith('HOR') ? 'HOR' : (rawUnit.startsWith('L') ? 'L' : 'UN'));

            return {
                description: String(p.description || '').trim(),
                qty,
                unidade_medida,
                unit_price: unitPrice,
                discount_percentage: discountPercentage,
                net_value: netValue,
                vat_percent: vatPercent,
                vat_value: vatValue
            };
        });
    }

    if (!structuredJson.invoice_number) {
        throw new Error('Falha na extração: invoice_number não identificado na fatura.');
    }
    if (!structuredJson.supplier && !structuredJson.supplier_vat) {
        throw new Error('Falha na extração: supplier (fornecedor) não identificado na fatura.');
    }
    if (structuredJson.total_amount === null || structuredJson.total_amount === undefined || isNaN(structuredJson.total_amount) || structuredJson.total_amount === 0) {
        throw new Error('Falha na extração: total_amount não identificado ou zero na fatura.');
    }

    if (importId) {
      currentStep = '[10] Dados gravados';
      console.log(currentStep);
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

      console.log(`Campos gravados:\nNúmero: ${structuredJson.invoice_number}\nFornecedor: ${structuredJson.supplier || structuredJson.supplier_vat}\nData: ${structuredJson.invoice_date}\nLíquido: ${structuredJson.net_amount}\nIVA: ${structuredJson.vat_amount}\nTotal: ${structuredJson.total_amount}\nDescrição: ${structuredJson.expense_description}`);
    }

    return new Response(JSON.stringify({ ...structuredJson, ocr_text: ocrText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error during execution:', error);

    const errorPayload = {
        step: currentStep,
        error: error.message || String(error),
        stack: error.stack || 'No stack trace available'
    };

    try {
      if (importId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseAdmin
          .from('invoice_imports')
          .update({ status: 'failed', error: String(errorPayload.error).slice(0, 1000) })
          .eq('id', importId);
      }
    } catch {
      // ignore
    }

    return new Response(JSON.stringify(errorPayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
