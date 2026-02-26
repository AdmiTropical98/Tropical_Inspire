// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STORAGE_BUCKETS = ['invoices', 'documents'];

const downloadInvoiceFile = async (supabaseAdmin: any, storagePath: string) => {
    let lastError: any = null;

    for (const bucket of STORAGE_BUCKETS) {
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .download(storagePath);

        if (!error && data) return data;
        lastError = error;
    }

    throw new Error(lastError?.message || 'Unable to download uploaded PDF');
};

type ImportedLine = {
    description: string;
    unidade_medida?: string;
    quantity: number;
    unit_price: number;
    iva_rate: 0 | 6 | 13 | 23;
    iva_value: number;
    total_value: number;
};

const NON_ITEM_TEXT_REGEX = /(iban|swift|bic|nib|entidade|refer[êe]ncia|multibanco|pagamento|dados\s+banc[aá]rios|transfer[êe]ncia|vencimento|total\s+a\s+pagar|subtotal|iva\s+total|resumo\s+do\s+iva|a\s+transportar)/i;
const LABOR_DESCRIPTION_REGEX = /m[aã]o\s*obra|mao\s*(de\s*)?obra|labor|serralharia|mecanica|mec[aâ]nica/i;

const normalizeUnit = (value: unknown): string => {
    const token = String(value || '').trim().toUpperCase();
    if (!token) return '';
    if (['UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES', 'UNI'].includes(token)) return 'UN';
    if (['H', 'HR', 'HRS', 'HORA', 'HORAS', 'HOF', 'HOR'].includes(token)) return 'H';
    if (['L', 'LT', 'LTS', 'LITRO', 'LITROS'].includes(token)) return 'L';
    if (['CX', 'CAIXA', 'CAIXAS'].includes(token)) return 'CX';
    return '';
};

const inferAllowedUnit = (description: string, rawUnit: unknown): string => {
    const normalized = normalizeUnit(rawUnit);
    if (normalized) return normalized;
    if (LABOR_DESCRIPTION_REGEX.test(description)) return 'H';
    return 'UN';
};

type ParsedInvoice = {
    supplier_name: string;
    invoice_number: string;
    issue_date: string;
    due_date?: string;
    totals: {
        net: number;
        vat: number;
        total: number;
    };
    vat_breakdown?: Array<{ rate: number; base: number; vat: number }>;
    lines: ImportedLine[];
    raw_text?: string;
};

const toNumber = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return 0;

    const normalized = value
        .replace(/\s/g, '')
        .replace(/€/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const clampIvaRate = (value: unknown): 0 | 6 | 13 | 23 => {
    const n = Math.round(toNumber(value));
    if (n === 6 || n === 13 || n === 23) return n;
    return 0;
};

const toIsoDate = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return new Date().toISOString().split('T')[0];

    const v = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    const parts = v.replace(/[.]/g, '/').split('/');
    if (parts.length === 3) {
        const [a, b, c] = parts;
        if (a.length === 2 && b.length === 2 && c.length === 4) {
            return `${c}-${b}-${a}`;
        }
    }

    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
};

const normalizeParsedInvoice = (raw: any): ParsedInvoice => {
    const rawLines = Array.isArray(raw?.lines) ? raw.lines : [];

    const lines: ImportedLine[] = rawLines
        .map((line: any) => {
            const description = String(line?.description || '').trim();
            const quantityRaw = Math.max(0, toNumber(line?.quantity || line?.qty));
            const unitPriceRaw = Math.max(0, toNumber(line?.unit_price || line?.price || line?.valor_unitario));
            const totalValueRaw = Math.max(0, toNumber(line?.total_value || line?.total || line?.net_value || line?.net));
            const quantity = quantityRaw > 0 ? quantityRaw : (totalValueRaw > 0 ? 1 : 0);
            const unitPrice = unitPriceRaw > 0
                ? unitPriceRaw
                : (totalValueRaw > 0 && quantity > 0 ? Number((totalValueRaw / quantity).toFixed(2)) : 0);
            const totalValue = totalValueRaw > 0 ? totalValueRaw : Math.max(0, quantity * unitPrice);
            const ivaValue = Math.max(0, toNumber(line?.iva_value));
            return {
                description,
                unidade_medida: inferAllowedUnit(description, line?.unidade_medida || line?.unit || line?.uom),
                quantity,
                unit_price: unitPrice,
                iva_rate: clampIvaRate(line?.iva_rate),
                iva_value: ivaValue,
                total_value: totalValue,
            };
        })
        .filter((line: ImportedLine) => {
            if (line.description.length === 0) return false;
            if (NON_ITEM_TEXT_REGEX.test(line.description)) return false;
            return line.quantity > 0 || line.unit_price > 0 || line.total_value > 0;
        });

    const netFromLines = lines.reduce((sum, line) => sum + Math.max(0, line.total_value - line.iva_value), 0);
    const vatFromLines = lines.reduce((sum, line) => sum + Math.max(0, line.iva_value), 0);

    const net = Math.max(0, toNumber(raw?.totals?.net || raw?.net_total || raw?.subtotal || netFromLines));
    const vat = Math.max(0, toNumber(raw?.totals?.vat || raw?.vat_total || raw?.iva || vatFromLines));
    const total = Math.max(0, toNumber(raw?.totals?.total || raw?.total || raw?.total_final || (net + vat)));

    return {
        supplier_name: String(raw?.supplier_name || raw?.supplier || '').trim(),
        invoice_number: String(raw?.invoice_number || raw?.number || '').trim(),
        issue_date: toIsoDate(raw?.issue_date || raw?.invoice_date),
        due_date: raw?.due_date ? toIsoDate(raw?.due_date) : undefined,
        totals: { net, vat, total },
        vat_breakdown: Array.isArray(raw?.vat_breakdown)
            ? raw.vat_breakdown.map((row: any) => ({
                rate: toNumber(row?.rate),
                base: toNumber(row?.base),
                vat: toNumber(row?.vat),
            }))
            : [],
        lines,
        raw_text: typeof raw?.raw_text === 'string' ? raw.raw_text : undefined,
    };
};

const readJsonFromResponse = async (response: Response) => {
    const text = await response.text();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        const jsonBlock = text.match(/\{[\s\S]*\}/);
        if (jsonBlock?.[0]) {
            try {
                return JSON.parse(jsonBlock[0]);
            } catch {
                return { raw_text: text };
            }
        }
        return { raw_text: text };
    }
};

const callAiOcrService = async (fileBase64: string, language: string) => {
    const endpoint = Deno.env.get('AI_OCR_ENDPOINT');
    const apiKey = Deno.env.get('AI_OCR_API_KEY');

    if (!endpoint) {
        throw new Error('AI_OCR_ENDPOINT is not configured');
    }

    const prompt = `Extrai os dados desta fatura de fornecedor em português (Portugal). Responde APENAS JSON com o formato: {"supplier_name":"","invoice_number":"","issue_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD opcional","totals":{"net":0,"vat":0,"total":0},"vat_breakdown":[{"rate":23,"base":0,"vat":0}],"lines":[{"description":"","unidade_medida":"UN","quantity":1,"unit_price":0,"iva_rate":23,"iva_value":0,"total_value":0}],"raw_text":"opcional"}. Usa números decimais reais e datas ISO. Em lines inclui APENAS itens/serviços faturáveis da grelha. DEVOLVER TODAS as linhas da grelha (não resumir, não agrupar, não truncar), mesmo que sejam >50 linhas. NÃO incluir IBAN, NIB, SWIFT/BIC, dados bancários, referências de pagamento, totais, subtotais, observações ou rodapé.`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
            file_base64: fileBase64,
            mime_type: 'application/pdf',
            language,
            prompt,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI OCR service error (${response.status}): ${errorText.slice(0, 400)}`);
    }

    return readJsonFromResponse(response);
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let importId: string | undefined;

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: { autoRefreshToken: false, persistSession: false },
            }
        );

        const requestBody = await req.json();
        importId = requestBody?.importId;
        if (!importId) {
            throw new Error('Missing importId');
        }

        const { data: importRow, error: importError } = await supabaseAdmin
            .from('invoice_imports')
            .select('id,file_path,storage_path,language,status')
            .eq('id', importId)
            .single();

        if (importError || !importRow) {
            throw new Error(importError?.message || 'Import not found');
        }

        await supabaseAdmin
            .from('invoice_imports')
            .update({ status: 'processing', error_message: null })
            .eq('id', importId);

        const storagePath = importRow.file_path || importRow.storage_path;
        if (!storagePath) throw new Error('Missing storage path for invoice import');

        const fileData = await downloadInvoiceFile(supabaseAdmin, storagePath);

        const fileBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(fileBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const fileBase64 = btoa(binary);

        const rawExtraction = await callAiOcrService(fileBase64, importRow.language || 'pt-PT');
        const parsed = normalizeParsedInvoice(rawExtraction);

        const { error: updateError } = await supabaseAdmin
            .from('invoice_imports')
            .update({
                status: 'ready',
                extracted_json: parsed,
                processed_at: new Date().toISOString(),
                error_message: null,
            })
            .eq('id', importId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, importId, parsed }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error: any) {
        try {
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
                {
                    auth: { autoRefreshToken: false, persistSession: false },
                }
            );

            if (importId) {
                await supabaseAdmin
                    .from('invoice_imports')
                    .update({
                        status: 'error',
                        error_message: String(error?.message || 'Unknown OCR error').slice(0, 1000),
                        processed_at: new Date().toISOString(),
                    })
                    .eq('id', importId);
            }
        } catch {
            // ignore logging failures
        }

        return new Response(JSON.stringify({ error: error?.message || 'Unexpected error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
