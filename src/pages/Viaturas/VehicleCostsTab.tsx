import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Car, ClipboardList, ExternalLink, FileSearch, Fuel,
    Loader2, Plus, Receipt, ShieldCheck, Trash2, Upload, Wrench, X,
    Download, FileSpreadsheet, Check, CheckCircle2, Copy, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type {
    FuelTransaction, Manutencao, Motorista, Viatura,
    VehicleInsurancePolicy, VehicleInspection, VehicleIucRecord, VehicleOtherCost,
} from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CostSubTab = 'seguros' | 'manutencoes' | 'ipo' | 'iuc' | 'outros' | 'combustivel' | 'portagens';

interface TollRow {
    id: string;
    vehicle_id: string;
    entry_point: string;
    exit_point: string;
    entry_time: string;
    amount: number;
    type?: string;
    receipt_url?: string;
}

export interface VehicleCostsTabProps {
    viaturaId: string;
    viatura: Viatura;
    motoristas: Motorista[];
    vehicleFuelTransactions: FuelTransaction[];
    onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtEur = (n?: number | null) =>
    `${Number(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;

const ptDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString('pt-PT') : '—';

const OTHER_LABELS: Record<string, string> = {
    lavagem: 'Lavagem',
    pneus: 'Pneus',
    estacionamento: 'Estacionamento',
    multa: 'Multa',
    pecas: 'Peças',
    reparacao_extraordinaria: 'Reparação Extraordinária',
    outros: 'Outros',
};

const STORAGE_BUCKETS = ['vehicle-documents', 'uploads', 'documents', 'invoices'];

async function tryUpload(file: File, path: string): Promise<string | null> {
    for (const bucket of STORAGE_BUCKETS) {
        try {
            const { error } = await supabase.storage
                .from(bucket)
                .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
            if (!error) {
                const { data } = supabase.storage.from(bucket).getPublicUrl(path);
                return data?.publicUrl ?? null;
            }
        } catch { /* try next bucket */ }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Bulk Import Helpers & Config
// ---------------------------------------------------------------------------

const parseBulkDateToIso = (rawDate: string): string | null => {
    const value = String(rawDate || '').trim();
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const parseBulkValue = (rawValue: string): number | null => {
    const source = String(rawValue || '').trim().replace(/\s+/g, '').replace(/€/g, '');
    if (!source) return null;

    let normalized = source;

    if (normalized.includes(',') && normalized.includes('.')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
        normalized = normalized.replace(',', '.');
    }

    const value = Number.parseFloat(normalized);
    if (Number.isNaN(value) || !Number.isFinite(value)) return null;
    return value;
};

const detectBulkDelimiter = (line: string): string => {
    if (line.includes('\t')) return '\t';
    if (line.includes(';')) return ';';
    if (line.includes('|')) return '|';
    if (line.includes(',')) return ',';
    return '\t';
};

const BULK_SCHEMAS = {
    seguros: {
        headers: ['Seguradora', 'Apólice', 'Data Início', 'Data Fim', 'Prémio', 'Frequência', 'Documento URL'],
        example: 'Fidelidade;987654321;2026-01-01;2026-12-31;450.00;anual;https://exemplo.com/doc.pdf',
        description: 'Frequência deve ser: anual, mensal ou trimestral. Datas no formato AAAA-MM-DD ou DD/MM/AAAA.'
    },
    manutencoes: {
        headers: ['Data', 'Tipo', 'Km', 'Oficina', 'Custo', 'Descrição', 'Documento URL'],
        example: '2026-06-15;preventiva;120000;Oficina Central;150.00;Mudança de óleo e filtros;https://exemplo.com/fatura.pdf',
        description: 'Tipo deve ser: preventiva, corretiva, inspecao ou outros.'
    },
    ipo: {
        headers: ['Data Inspeção', 'Resultado', 'Válido até', 'Custo', 'Documento URL'],
        example: '2026-06-15;aprovada;2027-06-15;35.50;https://exemplo.com/relatorio.pdf',
        description: 'Resultado deve ser: aprovada, condicional ou reprovada.'
    },
    iuc: {
        headers: ['Ano Fiscal', 'Valor', 'Data Limite', 'Data Pagamento', 'Estado', 'Documento URL'],
        example: '2026;124.50;2026-06-30;2026-06-25;pago;https://exemplo.com/comprovativo.pdf',
        description: 'Estado deve ser: pago ou pendente.'
    },
    outros: {
        headers: ['Data', 'Categoria', 'Descrição', 'Km', 'Valor', 'Motorista', 'Documento URL'],
        example: '2026-06-15;lavagem;Lavagem interior e exterior;120000;15.00;João Silva;https://exemplo.com/recibo.pdf',
        description: 'Categoria deve ser: lavagem, pneus, estacionamento, multa, pecas, reparacao_extraordinaria ou outros. Motorista é opcional e tentará ser correspondido pelo nome.'
    }
};

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function DocLink({ url }: { url?: string | null }) {
    if (!url) return <span className="text-slate-400 text-xs">—</span>;
    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-500 hover:underline text-xs"
        >
            <ExternalLink className="w-3 h-3" /> Abrir
        </a>
    );
}

function UploadBtn({
    viaturaId,
    category,
    onUploaded,
}: {
    viaturaId: string;
    category: string;
    onUploaded: (url: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        const ext = file.name.split('.').pop() || 'pdf';
        const path = `vehicles/${viaturaId}/${category}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const url = await tryUpload(file, path);
        setBusy(false);
        if (url) {
            onUploaded(url);
        } else {
            alert('Upload falhou. Introduza o URL manualmente.');
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer shrink-0">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {busy ? 'Envio...' : 'Upload'}
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handle}
                disabled={busy}
            />
        </label>
    );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs uppercase text-slate-500 font-medium tracking-wide">{label}</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 leading-tight">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
        </div>
    );
}

function EmptyState({ msg }: { msg: string }) {
    return (
        <div className="py-10 text-center text-slate-400 text-sm">{msg}</div>
    );
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 outline-none transition-colors';
const LABEL = 'block text-xs font-medium text-slate-500 mb-1';
const BTN_SAVE = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-60 transition-colors';
const BTN_DEL = 'p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VehicleCostsTab({
    viaturaId,
    viatura,
    motoristas,
    vehicleFuelTransactions,
    onRefresh,
}: VehicleCostsTabProps) {

    // --- Sub-tab ---
    const [subTab, setSubTab] = useState<CostSubTab>('seguros');

    // --- Data ---
    const [insurance, setInsurance] = useState<VehicleInsurancePolicy[]>([]);
    const [maintenances, setMaintenances] = useState<Manutencao[]>([]);
    const [inspections, setInspections] = useState<VehicleInspection[]>([]);
    const [iucList, setIucList] = useState<VehicleIucRecord[]>([]);
    const [otherCosts, setOtherCosts] = useState<VehicleOtherCost[]>([]);
    const [tolls, setTolls] = useState<TollRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // --- UI ---
    const [showAdd, setShowAdd] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [otherCatFilter, setOtherCatFilter] = useState('all');

    // --- Bulk Import ---
    const [showBulk, setShowBulk] = useState(false);
    const [bulkInput, setBulkInput] = useState('');
    const [bulkRows, setBulkRows] = useState<any[]>([]);
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);
    const [copiedTemplate, setCopiedTemplate] = useState(false);

    // --- Forms ---
    const blankIns = { insurer: '', policy_number: '', start_date: '', end_date: '', premium_amount: '', payment_frequency: 'annual' as const, document_url: '' };
    const blankMaint = { data: '', tipo: 'preventiva', km: '', oficina: '', custo: '', descricao: '', pdf_url: '' };
    const blankInsp = { inspection_date: '', valid_until: '', result: 'approved', cost: '', document_url: '' };
    const blankIuc = { fiscal_year: String(new Date().getFullYear()), amount: '', due_date: '', payment_date: '', status: 'pending' as const, document_url: '' };
    const blankOther = { cost_category: 'outros' as VehicleOtherCost['cost_category'], cost_date: new Date().toISOString().slice(0, 10), description: '', amount: '', km: '', driver_id: '', document_url: '' };

    const [insForm, setInsForm] = useState(blankIns);
    const [maintForm, setMaintForm] = useState(blankMaint);
    const [inspForm, setInspForm] = useState(blankInsp);
    const [iucForm, setIucForm] = useState(blankIuc);
    const [otherForm, setOtherForm] = useState(blankOther);

    // --- Load ---
    const loadData = useCallback(async () => {
        if (!viaturaId) return;
        setIsLoading(true);
        try {
            const [r1, r2, r3, r4, r5, r6] = await Promise.all([
                supabase.from('vehicle_insurance_policies').select('*').eq('vehicle_id', viaturaId).order('end_date', { ascending: false }),
                supabase.from('manutencoes').select('id,data,tipo,km,oficina,custo,descricao,pdf_url,vehicle_id').eq('vehicle_id', viaturaId).order('data', { ascending: false }),
                supabase.from('vehicle_inspections').select('*').eq('vehicle_id', viaturaId).order('inspection_date', { ascending: false }),
                supabase.from('vehicle_iuc_records').select('*').eq('vehicle_id', viaturaId).order('fiscal_year', { ascending: false }),
                supabase.from('vehicle_other_costs').select('*').eq('vehicle_id', viaturaId).order('cost_date', { ascending: false }),
                supabase.from('via_verde_toll_records').select('id,vehicle_id,entry_point,exit_point,entry_time,amount,type,receipt_url').eq('vehicle_id', viaturaId).order('entry_time', { ascending: false }),
            ]);

            if (!r1.error) setInsurance((r1.data ?? []) as VehicleInsurancePolicy[]);

            if (!r2.error) {
                setMaintenances((r2.data ?? []).map((row: any) => ({
                    id: row.id,
                    data: row.data ?? '',
                    tipo: row.tipo ?? 'outros',
                    km: Number(row.km ?? 0),
                    oficina: row.oficina ?? '',
                    custo: Number(row.custo ?? 0),
                    descricao: row.descricao ?? '',
                    pdfUrl: row.pdf_url ?? undefined,
                })) as Manutencao[]);
            }

            if (!r3.error) setInspections((r3.data ?? []) as VehicleInspection[]);
            if (!r4.error) setIucList((r4.data ?? []) as VehicleIucRecord[]);

            if (!r5.error) {
                setOtherCosts((r5.data ?? []).map((row: any) => ({
                    ...row,
                    amount: Number(row.amount ?? 0),
                    km: row.km != null ? Number(row.km) : undefined,
                })) as VehicleOtherCost[]);
            }

            if (!r6.error) {
                setTolls((r6.data ?? []).map((row: any) => ({
                    ...row,
                    amount: Number(row.amount ?? 0),
                })));
            }
        } finally {
            setIsLoading(false);
        }
    }, [viaturaId]);

    useEffect(() => { void loadData(); }, [loadData]);
    
    useEffect(() => {
        setShowAdd(false);
        setShowBulk(false);
        setBulkInput('');
        setBulkRows([]);
        setBulkError(null);
    }, [subTab]);

    // --- Bulk parsing reactive effect ---
    useEffect(() => {
        const handleParseBulk = () => {
            setBulkError(null);
            if (!bulkInput.trim()) {
                setBulkRows([]);
                return;
            }

            const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) {
                setBulkRows([]);
                return;
            }

            const currentSchema = BULK_SCHEMAS[subTab as keyof typeof BULK_SCHEMAS];
            if (!currentSchema) return;

            let dataLines = lines;
            const firstLine = lines[0];
            const firstDelimiter = detectBulkDelimiter(firstLine);
            const firstCols = firstLine.split(firstDelimiter).map(c => c.trim().toLowerCase());

            const isHeader = currentSchema.headers.some(h => 
                firstCols.includes(h.toLowerCase())
            );

            if (isHeader) {
                dataLines = lines.slice(1);
            }

            const parsed: any[] = dataLines.map((line, idx) => {
                const delimiter = detectBulkDelimiter(line);
                const cols = line.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
                const errors: string[] = [];

                let rowData: any = {
                    index: idx + (isHeader ? 2 : 1),
                    raw: line,
                    errors: errors
                };

                if (subTab === 'seguros') {
                    const [insurer, policy_number, start_date_raw, end_date_raw, premium_amount_raw, payment_frequency_raw, document_url] = cols;
                    
                    if (!insurer) errors.push('Seguradora é obrigatória.');
                    if (!policy_number) errors.push('Nº de Apólice é obrigatório.');
                    
                    const start_date = parseBulkDateToIso(start_date_raw);
                    if (!start_date) errors.push('Data Início inválida (use DD/MM/AAAA ou AAAA-MM-DD).');
                    
                    const end_date = parseBulkDateToIso(end_date_raw);
                    if (!end_date) errors.push('Data Fim inválida (use DD/MM/AAAA ou AAAA-MM-DD).');
                    
                    const premium_amount = parseBulkValue(premium_amount_raw) ?? 0;
                    
                    let payment_frequency: 'monthly' | 'quarterly' | 'annual' = 'annual';
                    const freq = String(payment_frequency_raw || '').toLowerCase().trim();
                    if (freq.includes('mens') || freq.includes('month')) payment_frequency = 'monthly';
                    else if (freq.includes('trim') || freq.includes('quart')) payment_frequency = 'quarterly';
                    else if (freq.includes('an') || freq.includes('year')) payment_frequency = 'annual';
                    
                    rowData = {
                        ...rowData,
                        insurer: insurer || '',
                        policy_number: policy_number || '',
                        start_date: start_date || '',
                        end_date: end_date || '',
                        premium_amount,
                        payment_frequency,
                        document_url: document_url || null
                    };
                } else if (subTab === 'manutencoes') {
                    const [date_raw, tipo_raw, km_raw, oficina, custo_raw, descricao, pdf_url] = cols;
                    
                    const data = parseBulkDateToIso(date_raw);
                    if (!data) errors.push('Data inválida.');
                    
                    let tipo = 'outros';
                    const t = String(tipo_raw || '').toLowerCase().trim();
                    if (t.includes('prev')) tipo = 'preventiva';
                    else if (t.includes('corr')) tipo = 'corretiva';
                    else if (t.includes('insp') || t.includes('ipo')) tipo = 'inspecao';
                    else if (t.includes('outr') || t.includes('oth')) tipo = 'outros';

                    const km = km_raw ? (parseInt(km_raw.replace(/\D/g, ''), 10) || null) : null;
                    const custo = parseBulkValue(custo_raw) ?? 0;
                    if (!custo_raw) errors.push('Custo é obrigatório.');

                    rowData = {
                        ...rowData,
                        data: data || '',
                        tipo,
                        km,
                        oficina: oficina || '',
                        custo,
                        descricao: descricao || '',
                        pdf_url: pdf_url || null
                    };
                } else if (subTab === 'ipo') {
                    const [inspection_date_raw, result_raw, valid_until_raw, cost_raw, document_url] = cols;
                    
                    const inspection_date = parseBulkDateToIso(inspection_date_raw);
                    if (!inspection_date) errors.push('Data de inspeção inválida.');
                    
                    const valid_until = parseBulkDateToIso(valid_until_raw);
                    
                    let result = 'approved';
                    const r = String(result_raw || '').toLowerCase().trim();
                    if (r.includes('aprov') || r.includes('appr')) result = 'approved';
                    else if (r.includes('cond')) result = 'conditional';
                    else if (r.includes('reprov') || r.includes('fail')) result = 'failed';

                    const cost = parseBulkValue(cost_raw) ?? 0;

                    rowData = {
                        ...rowData,
                        inspection_date: inspection_date || '',
                        result,
                        valid_until: valid_until || null,
                        cost,
                        document_url: document_url || null
                    };
                } else if (subTab === 'iuc') {
                    const [fiscal_year_raw, amount_raw, due_date_raw, payment_date_raw, status_raw, document_url] = cols;
                    
                    const fiscal_year = parseInt(String(fiscal_year_raw || '').replace(/\D/g, ''), 10);
                    if (!fiscal_year || fiscal_year < 1900 || fiscal_year > 2100) errors.push('Ano Fiscal inválido (ex: 2026).');
                    
                    const amount = parseBulkValue(amount_raw) ?? 0;
                    const due_date = parseBulkDateToIso(due_date_raw);
                    const payment_date = parseBulkDateToIso(payment_date_raw);
                    
                    let status: 'paid' | 'pending' = 'pending';
                    const s = String(status_raw || '').toLowerCase().trim();
                    if (s.includes('pag') || s.includes('paid')) status = 'paid';
                    else if (s.includes('pend') || s.includes('wait')) status = 'pending';

                    rowData = {
                        ...rowData,
                        fiscal_year: fiscal_year || new Date().getFullYear(),
                        amount,
                        due_date: due_date || null,
                        payment_date: payment_date || null,
                        status,
                        document_url: document_url || null
                    };
                } else if (subTab === 'outros') {
                    const [cost_date_raw, cost_category_raw, description, km_raw, amount_raw, driver_raw, document_url] = cols;
                    
                    const cost_date = parseBulkDateToIso(cost_date_raw);
                    if (!cost_date) errors.push('Data inválida.');
                    
                    let cost_category = 'outros';
                    const c = String(cost_category_raw || '').toLowerCase().trim();
                    if (c.includes('lav')) cost_category = 'lavagem';
                    else if (c.includes('pneu')) cost_category = 'pneus';
                    else if (c.includes('est') || c.includes('park')) cost_category = 'estacionamento';
                    else if (c.includes('mult') || c.includes('fine')) cost_category = 'multa';
                    else if (c.includes('pec') || c.includes('part')) cost_category = 'pecas';
                    else if (c.includes('extra') || c.includes('rep')) cost_category = 'reparacao_extraordinaria';
                    else if (c.includes('outr') || c.includes('oth')) cost_category = 'outros';

                    const amount = parseBulkValue(amount_raw) ?? 0;
                    if (!amount_raw) errors.push('Valor é obrigatório.');

                    const km = km_raw ? (parseInt(km_raw.replace(/\D/g, ''), 10) || null) : null;
                    
                    let driver_id = null;
                    if (driver_raw) {
                        const matched = motoristas.find(m => 
                            m.nome.toLowerCase().includes(driver_raw.toLowerCase())
                        );
                        if (matched) {
                            driver_id = matched.id;
                            rowData._driverName = matched.nome;
                        } else {
                            rowData._driverName = `${driver_raw} (Não encontrado)`;
                        }
                    }

                    rowData = {
                        ...rowData,
                        cost_date: cost_date || '',
                        cost_category,
                        description: description || '',
                        km,
                        amount,
                        driver_id,
                        document_url: document_url || null
                    };
                }

                return rowData;
            });

            setBulkRows(parsed);
        };

        handleParseBulk();
    }, [bulkInput, subTab, motoristas]);

    // --- Bulk CRUD / Actions ---
    const handleCopyTemplate = () => {
        const schema = BULK_SCHEMAS[subTab as keyof typeof BULK_SCHEMAS];
        if (!schema) return;
        
        const templateText = `${schema.headers.join(';')}\n${schema.example}`;
        navigator.clipboard.writeText(templateText);
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 2000);
    };

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            if (!text) return;
            setBulkInput(text);
        };
        reader.readAsText(file, 'utf-8');
        e.target.value = '';
    };

    const handleImportBulk = async () => {
        if (isBulkSaving) return;
        if (bulkRows.length === 0) {
            alert('Não existem dados para importar.');
            return;
        }

        const rowsWithErrors = bulkRows.filter(r => r.errors.length > 0);
        if (rowsWithErrors.length > 0) {
            alert(`Existem ${rowsWithErrors.length} linha(s) com erros. Corrija-os antes de importar.`);
            return;
        }

        setIsBulkSaving(true);
        setBulkError(null);

        try {
            let errorMsg = '';
            
            if (subTab === 'seguros') {
                const payload = bulkRows.map(r => ({
                    vehicle_id: viaturaId,
                    insurer: r.insurer,
                    policy_number: r.policy_number,
                    start_date: r.start_date,
                    end_date: r.end_date,
                    premium_amount: r.premium_amount,
                    payment_frequency: r.payment_frequency,
                    document_url: r.document_url
                }));
                const { error } = await supabase.from('vehicle_insurance_policies').insert(payload);
                if (error) errorMsg = error.message;
            } else if (subTab === 'manutencoes') {
                const payload = bulkRows.map(r => ({
                    vehicle_id: viaturaId,
                    license_plate: viatura.matricula,
                    matricula: viatura.matricula,
                    data: r.data,
                    tipo: r.tipo,
                    km: r.km,
                    oficina: r.oficina,
                    custo: r.custo,
                    descricao: r.descricao,
                    pdf_url: r.pdf_url
                }));
                const { error } = await supabase.from('manutencoes').insert(payload);
                if (error) errorMsg = error.message;
            } else if (subTab === 'ipo') {
                const payload = bulkRows.map(r => ({
                    vehicle_id: viaturaId,
                    inspection_date: r.inspection_date,
                    valid_until: r.valid_until,
                    result: r.result,
                    cost: r.cost,
                    document_url: r.document_url
                }));
                const { error } = await supabase.from('vehicle_inspections').insert(payload);
                if (error) errorMsg = error.message;
            } else if (subTab === 'iuc') {
                const payload = bulkRows.map(r => ({
                    vehicle_id: viaturaId,
                    fiscal_year: r.fiscal_year,
                    amount: r.amount,
                    due_date: r.due_date,
                    payment_date: r.payment_date,
                    status: r.status,
                    document_url: r.document_url
                }));
                const { error } = await supabase.from('vehicle_iuc_records').insert(payload);
                if (error) errorMsg = error.message;
            } else if (subTab === 'outros') {
                const payload = bulkRows.map(r => ({
                    vehicle_id: viaturaId,
                    cost_category: r.cost_category,
                    cost_date: r.cost_date,
                    description: r.description,
                    amount: r.amount,
                    km: r.km,
                    driver_id: r.driver_id,
                    document_url: r.document_url
                }));
                const { error } = await supabase.from('vehicle_other_costs').insert(payload);
                if (error) errorMsg = error.message;
            }

            if (errorMsg) {
                setBulkError(`Erro ao guardar no Supabase: ${errorMsg}`);
                alert(`Erro ao guardar: ${errorMsg}`);
            } else {
                alert(`✅ Importação de ${bulkRows.length} registo(s) concluída com sucesso!`);
                setShowBulk(false);
                setBulkInput('');
                setBulkRows([]);
                await loadData();
                await onRefresh();
            }
        } catch (err: any) {
            setBulkError(err.message || 'Erro inesperado durante a importação.');
            alert(`Erro: ${err.message || 'Erro inesperado'}`);
        } finally {
            setIsBulkSaving(false);
        }
    };

    const handleExportCSV = () => {
        let headers: string[] = [];
        let rows: any[][] = [];
        let filename = `viatura_${viatura.matricula}_${subTab}`;

        if (subTab === 'seguros') {
            headers = ['Seguradora', 'Apólice', 'Data Início', 'Data Fim', 'Prémio (€)', 'Frequência', 'Documento URL'];
            rows = insurance.map(r => [
                r.insurer,
                r.policy_number,
                r.start_date,
                r.end_date,
                r.premium_amount,
                r.payment_frequency === 'monthly' ? 'Mensal' : r.payment_frequency === 'quarterly' ? 'Trimestral' : 'Anual',
                r.document_url || ''
            ]);
        } else if (subTab === 'manutencoes') {
            headers = ['Data', 'Tipo', 'Km', 'Oficina', 'Custo (€)', 'Descrição', 'Documento URL'];
            rows = maintenances.map(r => [
                r.data,
                r.tipo,
                r.km || '',
                r.oficina || '',
                r.custo,
                r.descricao || '',
                r.pdfUrl || ''
            ]);
        } else if (subTab === 'ipo') {
            headers = ['Data Inspeção', 'Resultado', 'Válido até', 'Custo (€)', 'Documento URL'];
            rows = inspections.map(r => [
                r.inspection_date,
                r.result === 'approved' ? 'Aprovada' : r.result === 'failed' ? 'Reprovada' : 'Com anotações',
                r.valid_until || '',
                r.cost,
                r.document_url || ''
            ]);
        } else if (subTab === 'iuc') {
            headers = ['Ano Fiscal', 'Valor (€)', 'Data Limite', 'Data Pagamento', 'Estado', 'Documento URL'];
            rows = iucList.map(r => [
                r.fiscal_year,
                r.amount,
                r.due_date || '',
                r.payment_date || '',
                r.status === 'paid' ? 'Pago' : 'Pendente',
                r.document_url || ''
            ]);
        } else if (subTab === 'outros') {
            headers = ['Data', 'Categoria', 'Descrição', 'Km', 'Valor (€)', 'Motorista', 'Documento URL'];
            rows = otherCosts.map(r => {
                const mot = motoristas.find(m => m.id === r.driver_id);
                return [
                    r.cost_date,
                    OTHER_LABELS[r.cost_category] || r.cost_category,
                    r.description || '',
                    r.km || '',
                    r.amount,
                    mot?.nome || '',
                    r.document_url || ''
                ];
            });
        } else if (subTab === 'combustivel') {
            headers = ['Data / Hora', 'Litros', '€/L', 'Custo (€)', 'Km', 'Tipo', 'Motorista', 'Comprovativo'];
            rows = vehicleFuelTransactions.map(tx => {
                const mot = motoristas.find(m => m.id === tx.driverId);
                return [
                    tx.timestamp,
                    tx.liters,
                    (tx as any).pricePerLiter ?? (tx as any).price_per_liter ?? 0,
                    (tx as any).totalCost ?? (tx as any).total_cost ?? 0,
                    tx.km,
                    (tx as any).fuelType || '',
                    mot?.nome || (tx as any).staffName || '',
                    (tx as any).receiptUrl || ''
                ];
            });
        } else if (subTab === 'portagens') {
            headers = ['Data / Hora', 'Tipo', 'Entrada', 'Saída', 'Valor (€)', 'Comprovativo'];
            rows = tolls.map(r => [
                r.entry_time,
                r.type === 'parking' ? 'Estacionamento' : 'Portagem',
                r.entry_point || '',
                r.exit_point || '',
                r.amount,
                r.receipt_url || ''
            ]);
        }

        if (headers.length === 0) return;

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(val => {
                const str = val === null || val === undefined ? '' : String(val);
                if (str.includes(';') || str.includes('\n') || str.includes('"')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(';'))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- CRUD helpers ---
    const withSave = async (fn: () => Promise<boolean>) => {
        setIsSaving(true);
        try { await fn(); } finally { setIsSaving(false); }
    };

    const confirmAndDelete = (label: string) =>
        confirm(`Eliminar "${label}"?`);

    // Seguros
    const addIns = () => withSave(async () => {
        if (!insForm.insurer || !insForm.policy_number || !insForm.start_date || !insForm.end_date) { alert('Preencha os campos obrigatórios.'); return false; }
        const { error } = await supabase.from('vehicle_insurance_policies').insert({
            vehicle_id: viaturaId, insurer: insForm.insurer, policy_number: insForm.policy_number,
            start_date: insForm.start_date, end_date: insForm.end_date,
            premium_amount: Number(insForm.premium_amount || 0),
            payment_frequency: insForm.payment_frequency,
            document_url: insForm.document_url || null,
        });
        if (error) { alert(error.message); return false; }
        setInsForm(blankIns); setShowAdd(false);
        await loadData(); await onRefresh(); return true;
    });

    const delIns = async (id: string, insurer: string) => {
        if (!confirmAndDelete(insurer)) return;
        await supabase.from('vehicle_insurance_policies').delete().eq('id', id);
        setInsurance(p => p.filter(r => r.id !== id));
        await onRefresh();
    };

    // Manutenções
    const addMaint = () => withSave(async () => {
        if (!maintForm.data) { alert('Indique a data.'); return false; }
        const { error } = await supabase.from('manutencoes').insert({
            vehicle_id: viaturaId, license_plate: viatura.matricula, matricula: viatura.matricula,
            data: maintForm.data, tipo: maintForm.tipo,
            km: maintForm.km ? Number(maintForm.km) : null,
            oficina: maintForm.oficina || null,
            custo: Number(maintForm.custo || 0),
            descricao: maintForm.descricao || null,
            pdf_url: maintForm.pdf_url || null,
        });
        if (error) { alert(error.message); return false; }
        setMaintForm(blankMaint); setShowAdd(false);
        await loadData(); await onRefresh(); return true;
    });

    const delMaint = async (id: string) => {
        if (!confirmAndDelete('manutenção')) return;
        await supabase.from('manutencoes').delete().eq('id', id);
        setMaintenances(p => p.filter(r => r.id !== id));
        await onRefresh();
    };

    // IPO
    const addInsp = () => withSave(async () => {
        if (!inspForm.inspection_date) { alert('Indique a data.'); return false; }
        const { error } = await supabase.from('vehicle_inspections').insert({
            vehicle_id: viaturaId, inspection_date: inspForm.inspection_date,
            valid_until: inspForm.valid_until || null, result: inspForm.result,
            cost: Number(inspForm.cost || 0), document_url: inspForm.document_url || null,
        });
        if (error) { alert(error.message); return false; }
        setInspForm(blankInsp); setShowAdd(false);
        await loadData(); await onRefresh(); return true;
    });

    const delInsp = async (id: string) => {
        if (!confirmAndDelete('inspeção')) return;
        await supabase.from('vehicle_inspections').delete().eq('id', id);
        setInspections(p => p.filter(r => r.id !== id));
        await onRefresh();
    };

    // IUC
    const addIuc = () => withSave(async () => {
        if (!iucForm.fiscal_year) { alert('Indique o ano fiscal.'); return false; }
        const { error } = await supabase.from('vehicle_iuc_records').insert({
            vehicle_id: viaturaId, fiscal_year: Number(iucForm.fiscal_year),
            amount: Number(iucForm.amount || 0), due_date: iucForm.due_date || null,
            payment_date: iucForm.payment_date || null, status: iucForm.status,
            document_url: iucForm.document_url || null,
        });
        if (error) { alert(error.message); return false; }
        setIucForm(blankIuc); setShowAdd(false);
        await loadData(); await onRefresh(); return true;
    });

    const delIuc = async (id: string, year: number) => {
        if (!confirmAndDelete(`IUC ${year}`)) return;
        await supabase.from('vehicle_iuc_records').delete().eq('id', id);
        setIucList(p => p.filter(r => r.id !== id));
        await onRefresh();
    };

    // Outros
    const addOther = () => withSave(async () => {
        if (!otherForm.cost_date) { alert('Indique a data.'); return false; }
        const { error } = await supabase.from('vehicle_other_costs').insert({
            vehicle_id: viaturaId, cost_category: otherForm.cost_category,
            cost_date: otherForm.cost_date, description: otherForm.description || null,
            amount: Number(otherForm.amount || 0),
            km: otherForm.km ? Number(otherForm.km) : null,
            driver_id: otherForm.driver_id || null,
            document_url: otherForm.document_url || null,
        });
        if (error) { alert(error.message); return false; }
        setOtherForm(blankOther); setShowAdd(false);
        await loadData(); await onRefresh(); return true;
    });

    const delOther = async (id: string, cat: string) => {
        if (!confirmAndDelete(OTHER_LABELS[cat] ?? cat)) return;
        await supabase.from('vehicle_other_costs').delete().eq('id', id);
        setOtherCosts(p => p.filter(r => r.id !== id));
        await onRefresh();
    };

    // --- Sub-tab config ---
    const SUB_TABS: { id: CostSubTab; label: string; Icon: React.FC<any>; count: number; total: number }[] = [
        { id: 'seguros', label: 'Seguros', Icon: ShieldCheck, count: insurance.length, total: insurance.reduce((a, r) => a + Number(r.premium_amount ?? 0), 0) },
        { id: 'manutencoes', label: 'Manutenções', Icon: Wrench, count: maintenances.length, total: maintenances.reduce((a, r) => a + Number(r.custo ?? 0), 0) },
        { id: 'ipo', label: 'IPO', Icon: FileSearch, count: inspections.length, total: inspections.reduce((a, r) => a + Number(r.cost ?? 0), 0) },
        { id: 'iuc', label: 'IUC', Icon: Receipt, count: iucList.length, total: iucList.reduce((a, r) => a + Number(r.amount ?? 0), 0) },
        { id: 'outros', label: 'Outros Custos', Icon: ClipboardList, count: otherCosts.length, total: otherCosts.reduce((a, r) => a + Number(r.amount ?? 0), 0) },
        { id: 'combustivel', label: 'Combustível', Icon: Fuel, count: vehicleFuelTransactions.length, total: vehicleFuelTransactions.reduce((a, t) => a + Number(t.totalCost ?? (t as any).total_cost ?? 0), 0) },
        { id: 'portagens', label: 'Portagens', Icon: Car, count: tolls.length, total: tolls.reduce((a, r) => a + Number(r.amount ?? 0), 0) },
    ];

    // --- Section header with add button ---
    const SectionHeader = ({ noun, hideImport }: { noun: string; hideImport?: boolean }) => (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Lista de {SUB_TABS.find(t => t.id === subTab)?.label}
            </h3>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Exportar CSV
                </button>
                
                {!hideImport && (
                    <button
                        onClick={() => { setShowBulk(v => !v); setShowAdd(false); }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                            showBulk
                                ? 'bg-slate-200 border-slate-300 text-slate-700'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" /> Importação em Massa
                    </button>
                )}

                {!hideImport && (
                    <button
                        onClick={() => { setShowAdd(v => !v); setShowBulk(false); }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors shadow-sm"
                    >
                        {showAdd ? (
                            <><X className="w-3.5 h-3.5" /> Cancelar</>
                        ) : (
                            <><Plus className="w-3.5 h-3.5" /> Adicionar {noun}</>
                        )}
                    </button>
                )}
            </div>
        </div>
    );

    const renderBulkPreview = () => {
        if (bulkRows.length === 0) return null;
        
        return (
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">Pré-visualização dos Dados ({bulkRows.length} linhas)</span>
                    {bulkRows.some(r => r.errors.length > 0) ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {bulkRows.filter(r => r.errors.length > 0).length} linha(s) com erro
                        </span>
                    ) : (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Todos os registos são válidos
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                                <th className="p-2 w-12 text-center">Linha</th>
                                {subTab === 'seguros' && (
                                    <>
                                        <th className="p-2">Seguradora</th>
                                        <th className="p-2">Apólice</th>
                                        <th className="p-2">Início</th>
                                        <th className="p-2">Fim</th>
                                        <th className="p-2 text-right">Prémio</th>
                                        <th className="p-2">Frequência</th>
                                    </>
                                )}
                                {subTab === 'manutencoes' && (
                                    <>
                                        <th className="p-2">Data</th>
                                        <th className="p-2">Tipo</th>
                                        <th className="p-2 text-right">Km</th>
                                        <th className="p-2">Oficina</th>
                                        <th className="p-2 text-right">Custo</th>
                                        <th className="p-2">Descrição</th>
                                    </>
                                )}
                                {subTab === 'ipo' && (
                                    <>
                                        <th className="p-2">Data IPO</th>
                                        <th className="p-2">Resultado</th>
                                        <th className="p-2">Validade</th>
                                        <th className="p-2 text-right">Custo</th>
                                    </>
                                )}
                                {subTab === 'iuc' && (
                                    <>
                                        <th className="p-2">Ano</th>
                                        <th className="p-2 text-right">Valor</th>
                                        <th className="p-2">Data Limite</th>
                                        <th className="p-2">Data Pag.</th>
                                        <th className="p-2">Estado</th>
                                    </>
                                )}
                                {subTab === 'outros' && (
                                    <>
                                        <th className="p-2">Data</th>
                                        <th className="p-2">Categoria</th>
                                        <th className="p-2">Descrição</th>
                                        <th className="p-2 text-right">Km</th>
                                        <th className="p-2 text-right">Valor</th>
                                        <th className="p-2">Motorista</th>
                                    </>
                                )}
                                <th className="p-2">Documento</th>
                                <th className="p-2">Erros / Avisos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bulkRows.map((r, i) => {
                                const hasErr = r.errors.length > 0;
                                return (
                                    <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${hasErr ? 'bg-red-50/50' : ''}`}>
                                        <td className="p-2 text-center font-bold text-slate-500">{r.index}</td>
                                        {subTab === 'seguros' && (
                                            <>
                                                <td className="p-2 font-semibold">{r.insurer || <span className="text-red-500 font-normal">Vazio</span>}</td>
                                                <td className="p-2 font-mono">{r.policy_number || <span className="text-red-500 font-normal">Vazio</span>}</td>
                                                <td className="p-2">{r.start_date || <span className="text-red-500 font-normal">Inválido</span>}</td>
                                                <td className="p-2">{r.end_date || <span className="text-red-500 font-normal">Inválido</span>}</td>
                                                <td className="p-2 text-right font-semibold">{fmtEur(r.premium_amount)}</td>
                                                <td className="p-2 capitalize">{r.payment_frequency}</td>
                                            </>
                                        )}
                                        {subTab === 'manutencoes' && (
                                            <>
                                                <td className="p-2">{r.data || <span className="text-red-500">Inválido</span>}</td>
                                                <td className="p-2 capitalize">{r.tipo}</td>
                                                <td className="p-2 text-right">{r.km ? `${r.km.toLocaleString()} km` : '—'}</td>
                                                <td className="p-2">{r.oficina || '—'}</td>
                                                <td className="p-2 text-right font-semibold">{fmtEur(r.custo)}</td>
                                                <td className="p-2 truncate max-w-[150px]" title={r.descricao}>{r.descricao || '—'}</td>
                                            </>
                                        )}
                                        {subTab === 'ipo' && (
                                            <>
                                                <td className="p-2">{r.inspection_date || <span className="text-red-500">Inválido</span>}</td>
                                                <td className="p-2 capitalize">{r.result === 'approved' ? 'Aprovada' : r.result === 'failed' ? 'Reprovada' : 'Condicional'}</td>
                                                <td className="p-2">{r.valid_until || '—'}</td>
                                                <td className="p-2 text-right font-semibold">{fmtEur(r.cost)}</td>
                                            </>
                                        )}
                                        {subTab === 'iuc' && (
                                            <>
                                                <td className="p-2 font-bold">{r.fiscal_year}</td>
                                                <td className="p-2 text-right font-semibold">{fmtEur(r.amount)}</td>
                                                <td className="p-2">{r.due_date || '—'}</td>
                                                <td className="p-2">{r.payment_date || '—'}</td>
                                                <td className="p-2 capitalize">{r.status === 'paid' ? 'Pago' : 'Pendente'}</td>
                                            </>
                                        )}
                                        {subTab === 'outros' && (
                                            <>
                                                <td className="p-2">{r.cost_date || <span className="text-red-500 font-normal">Inválido</span>}</td>
                                                <td className="p-2 capitalize">{OTHER_LABELS[r.cost_category] || r.cost_category}</td>
                                                <td className="p-2 truncate max-w-[150px]" title={r.description}>{r.description || '—'}</td>
                                                <td className="p-2 text-right">{r.km ? `${r.km.toLocaleString()} km` : '—'}</td>
                                                <td className="p-2 text-right font-semibold">{fmtEur(r.amount)}</td>
                                                <td className="p-2">{r._driverName || '—'}</td>
                                            </>
                                        )}
                                        <td className="p-2 truncate max-w-[100px]" title={r.document_url || r.pdf_url || ''}>
                                            {(r.document_url || r.pdf_url) ? (
                                                <span className="text-blue-500 font-semibold">Sim</span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            {hasErr ? (
                                                <div className="text-red-600 font-medium space-y-0.5">
                                                    {r.errors.map((err: string, errIdx: number) => (
                                                        <div key={errIdx} className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                            {err}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-emerald-600 font-medium">OK</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderBulkPanel = () => {
        if (!showBulk) return null;
        
        const schema = BULK_SCHEMAS[subTab as keyof typeof BULK_SCHEMAS];
        if (!schema) return null;
        
        return (
            <div className="mb-6 border border-blue-200 bg-blue-50/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Importação em Massa - {SUB_TABS.find(t => t.id === subTab)?.label}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Cole linhas do Excel/Google Sheets ou faça o upload de um ficheiro CSV.</p>
                    </div>
                    <button
                        onClick={() => { setShowBulk(false); setBulkInput(''); setBulkRows([]); }}
                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-slate-700">Formato das Colunas:</p>
                    <div className="flex flex-wrap gap-1.5 font-mono select-all bg-slate-50 border border-slate-100 p-2 rounded">
                        {schema.headers.map((h, i) => (
                            <span key={i} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-slate-800">
                                {h}
                            </span>
                        ))}
                    </div>
                    <p className="text-slate-500 leading-relaxed mt-1">
                        <strong>Nota:</strong> {schema.description} Pode incluir a linha de cabeçalho na colagem, o sistema irá ignorá-la automaticamente.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleCopyTemplate}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition-all text-xs"
                        >
                            {copiedTemplate ? (
                                <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado!</>
                            ) : (
                                <><Copy className="w-3.5 h-3.5 text-slate-500" /> Copiar Modelo Excel</>
                            )}
                        </button>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold cursor-pointer transition-all text-xs">
                            <Upload className="w-3.5 h-3.5 text-slate-500" /> Carregar Ficheiro CSV
                            <input
                                type="file"
                                accept=".csv,.txt"
                                onChange={handleCSVUpload}
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className={LABEL}>Cole os dados aqui (delimitados por Tabulação do Excel, ponto e vírgula ou vírgula):</label>
                    <textarea
                        className="w-full h-40 px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 outline-none"
                        placeholder={`Exemplo:\n${schema.example}`}
                        value={bulkInput}
                        onChange={e => setBulkInput(e.target.value)}
                    />
                </div>

                {bulkError && (
                    <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {bulkError}
                    </div>
                )}

                {renderBulkPreview()}

                <div className="flex gap-3 justify-end pt-2">
                    <button
                        onClick={() => { setShowBulk(false); setBulkInput(''); setBulkRows([]); }}
                        className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={isBulkSaving || bulkRows.length === 0 || bulkRows.some(r => r.errors.length > 0)}
                        onClick={handleImportBulk}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-60 disabled:pointer-events-none transition-colors shadow-sm"
                    >
                        {isBulkSaving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> A Guardar...</>
                        ) : (
                            <><CheckCircle2 className="w-4 h-4" /> Importar {bulkRows.length > 0 ? `(${bulkRows.length} registos)` : ''}</>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    const FormWrap = ({ children, onSave }: { children: React.ReactNode; onSave: () => void }) => (
        <div className="mb-4 border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
            {children}
            <button disabled={isSaving} onClick={onSave} className={BTN_SAVE}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Guardar
            </button>
        </div>
    );

    // -----------------------------------------------------------------------
    // SEGUROS
    // -----------------------------------------------------------------------
    const renderSeguros = () => {
        const active = insurance.find(r => new Date(r.end_date) >= new Date());
        const nextExpiry = [...insurance]
            .filter(r => new Date(r.end_date) >= new Date())
            .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())[0];

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryCard label="Registos" value={String(insurance.length)} />
                    <SummaryCard label="Custo Total" value={fmtEur(insurance.reduce((a, r) => a + Number(r.premium_amount ?? 0), 0))} />
                    <SummaryCard label="Seguradora Ativa" value={active?.insurer ?? '—'} sub={active?.policy_number} />
                    <SummaryCard label="Próximo Vencimento" value={nextExpiry ? ptDate(nextExpiry.end_date) : '—'} />
                </div>

                <SectionHeader noun="Seguro" />

                {renderBulkPanel()}

                {showAdd && (
                    <FormWrap onSave={() => void addIns()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className={LABEL}>Seguradora *</label><input className={INPUT} value={insForm.insurer} onChange={e => setInsForm(p => ({ ...p, insurer: e.target.value }))} placeholder="Ex: Fidelidade" /></div>
                            <div><label className={LABEL}>Nº Apólice *</label><input className={INPUT} value={insForm.policy_number} onChange={e => setInsForm(p => ({ ...p, policy_number: e.target.value }))} placeholder="Ex: 12345" /></div>
                            <div><label className={LABEL}>Data Início *</label><input type="date" className={INPUT} value={insForm.start_date} onChange={e => setInsForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                            <div><label className={LABEL}>Data Fim *</label><input type="date" className={INPUT} value={insForm.end_date} onChange={e => setInsForm(p => ({ ...p, end_date: e.target.value }))} /></div>
                            <div><label className={LABEL}>Prémio (€)</label><input type="number" step="0.01" min="0" className={INPUT} value={insForm.premium_amount} onChange={e => setInsForm(p => ({ ...p, premium_amount: e.target.value }))} placeholder="0.00" /></div>
                            <div><label className={LABEL}>Frequência</label>
                                <select className={INPUT} value={insForm.payment_frequency} onChange={e => setInsForm(p => ({ ...p, payment_frequency: e.target.value as any }))}>
                                    <option value="monthly">Mensal</option>
                                    <option value="quarterly">Trimestral</option>
                                    <option value="annual">Anual</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className={LABEL}>Documento (PDF/JPG/PNG)</label>
                                <div className="flex gap-2">
                                    <input className={INPUT} value={insForm.document_url} onChange={e => setInsForm(p => ({ ...p, document_url: e.target.value }))} placeholder="URL ou faça upload →" />
                                    <UploadBtn viaturaId={viaturaId} category="seguros" onUploaded={url => setInsForm(p => ({ ...p, document_url: url }))} />
                                </div>
                            </div>
                        </div>
                    </FormWrap>
                )}

                {insurance.length === 0 && !showAdd && !showBulk ? <EmptyState msg="Sem apólices registadas. Clique em «Adicionar Seguro» para começar." /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                                    <th className="text-left py-2 pr-4">Seguradora</th>
                                    <th className="text-left py-2 pr-4">Apólice</th>
                                    <th className="text-left py-2 pr-4">Início</th>
                                    <th className="text-left py-2 pr-4">Fim</th>
                                    <th className="text-left py-2 pr-4">Frequência</th>
                                    <th className="text-right py-2 pr-4">Prémio</th>
                                    <th className="text-center py-2 pr-4">Doc.</th>
                                    <th className="py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {insurance.map(r => {
                                    const expired = new Date(r.end_date) < new Date();
                                    const soon = !expired && new Date(r.end_date) <= new Date(Date.now() + 30 * 86400000);
                                    return (
                                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 pr-4 font-semibold text-slate-800">{r.insurer}</td>
                                            <td className="py-2.5 pr-4 font-mono text-slate-600 text-xs">{r.policy_number}</td>
                                            <td className="py-2.5 pr-4 text-slate-600">{ptDate(r.start_date)}</td>
                                            <td className="py-2.5 pr-4">
                                                <span className={`font-medium ${expired ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-600'}`}>
                                                    {ptDate(r.end_date)}
                                                </span>
                                                {expired && <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Expirado</span>}
                                                {soon && !expired && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Em breve</span>}
                                            </td>
                                            <td className="py-2.5 pr-4 text-slate-600 capitalize">
                                                {r.payment_frequency === 'monthly' ? 'Mensal' : r.payment_frequency === 'quarterly' ? 'Trimestral' : 'Anual'}
                                            </td>
                                            <td className="py-2.5 pr-4 text-right font-bold text-slate-900">{fmtEur(r.premium_amount)}</td>
                                            <td className="py-2.5 pr-4 text-center"><DocLink url={r.document_url} /></td>
                                            <td className="py-2.5">
                                                <button onClick={() => void delIns(r.id, r.insurer)} className={BTN_DEL}><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // MANUTENÇÕES
    // -----------------------------------------------------------------------
    const renderManutencoes = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Registos" value={String(maintenances.length)} />
                <SummaryCard label="Custo Total" value={fmtEur(maintenances.reduce((a, r) => a + Number(r.custo ?? 0), 0))} />
                <SummaryCard label="Última" value={ptDate(maintenances[0]?.data)} />
                <SummaryCard label="Última Km" value={maintenances[0]?.km ? `${Number(maintenances[0].km).toLocaleString('pt-PT')} km` : '—'} />
            </div>

            <SectionHeader noun="Manutenção" />

            {renderBulkPanel()}

            {showAdd && (
                <FormWrap onSave={() => void addMaint()}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className={LABEL}>Data *</label><input type="date" className={INPUT} value={maintForm.data} onChange={e => setMaintForm(p => ({ ...p, data: e.target.value }))} /></div>
                        <div><label className={LABEL}>Tipo</label>
                            <select className={INPUT} value={maintForm.tipo} onChange={e => setMaintForm(p => ({ ...p, tipo: e.target.value }))}>
                                <option value="preventiva">Preventiva</option>
                                <option value="corretiva">Corretiva</option>
                                <option value="inspecao">Inspeção</option>
                                <option value="outros">Outros</option>
                            </select>
                        </div>
                        <div><label className={LABEL}>Quilometragem</label><input type="number" className={INPUT} placeholder="Ex: 420000" value={maintForm.km} onChange={e => setMaintForm(p => ({ ...p, km: e.target.value }))} /></div>
                        <div><label className={LABEL}>Oficina / Fornecedor</label><input className={INPUT} placeholder="Ex: Oficina Central" value={maintForm.oficina} onChange={e => setMaintForm(p => ({ ...p, oficina: e.target.value }))} /></div>
                        <div><label className={LABEL}>Custo (€)</label><input type="number" step="0.01" min="0" className={INPUT} placeholder="0.00" value={maintForm.custo} onChange={e => setMaintForm(p => ({ ...p, custo: e.target.value }))} /></div>
                        <div><label className={LABEL}>Descrição dos trabalhos</label><input className={INPUT} placeholder="Ex: Mudança de óleo e filtros" value={maintForm.descricao} onChange={e => setMaintForm(p => ({ ...p, descricao: e.target.value }))} /></div>
                        <div className="md:col-span-2">
                            <label className={LABEL}>Fatura / Documento</label>
                            <div className="flex gap-2">
                                <input className={INPUT} value={maintForm.pdf_url} onChange={e => setMaintForm(p => ({ ...p, pdf_url: e.target.value }))} placeholder="URL ou faça upload →" />
                                <UploadBtn viaturaId={viaturaId} category="manutencoes" onUploaded={url => setMaintForm(p => ({ ...p, pdf_url: url }))} />
                            </div>
                        </div>
                    </div>
                </FormWrap>
            )}

            {maintenances.length === 0 && !showAdd && !showBulk ? <EmptyState msg="Sem manutenções registadas." /> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                                <th className="text-left py-2 pr-4">Data</th>
                                <th className="text-left py-2 pr-4">Tipo</th>
                                <th className="text-right py-2 pr-4">Km</th>
                                <th className="text-left py-2 pr-4">Descrição</th>
                                <th className="text-left py-2 pr-4">Oficina</th>
                                <th className="text-right py-2 pr-4">Custo</th>
                                <th className="text-center py-2 pr-4">Doc.</th>
                                <th className="py-2 w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {maintenances.map(r => (
                                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="py-2.5 pr-4 text-slate-600">{ptDate(r.data)}</td>
                                    <td className="py-2.5 pr-4 text-slate-600 capitalize">{r.tipo}</td>
                                    <td className="py-2.5 pr-4 text-right text-slate-600">{r.km ? Number(r.km).toLocaleString('pt-PT') : '—'}</td>
                                    <td className="py-2.5 pr-4 text-slate-800 max-w-[220px] truncate" title={r.descricao}>{r.descricao || '—'}</td>
                                    <td className="py-2.5 pr-4 text-slate-600">{r.oficina || '—'}</td>
                                    <td className="py-2.5 pr-4 text-right font-bold text-slate-900">{fmtEur(r.custo)}</td>
                                    <td className="py-2.5 pr-4 text-center"><DocLink url={r.pdfUrl} /></td>
                                    <td className="py-2.5">
                                        <button onClick={() => void delMaint(r.id)} className={BTN_DEL}><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // -----------------------------------------------------------------------
    // IPO
    // -----------------------------------------------------------------------
    const renderIPO = () => {
        const nextValid = [...inspections]
            .filter(r => r.valid_until && new Date(r.valid_until) >= new Date())
            .sort((a, b) => new Date(a.valid_until!).getTime() - new Date(b.valid_until!).getTime())[0];

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryCard label="Registos" value={String(inspections.length)} />
                    <SummaryCard label="Custo Total" value={fmtEur(inspections.reduce((a, r) => a + Number(r.cost ?? 0), 0))} />
                    <SummaryCard label="Última Inspeção" value={ptDate(inspections[0]?.inspection_date)} />
                    <SummaryCard label="Validade Atual" value={nextValid ? ptDate(nextValid.valid_until) : '—'} />
                </div>

                <SectionHeader noun="Inspeção" />

                {renderBulkPanel()}

                {showAdd && (
                    <FormWrap onSave={() => void addInsp()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className={LABEL}>Data Inspeção *</label><input type="date" className={INPUT} value={inspForm.inspection_date} onChange={e => setInspForm(p => ({ ...p, inspection_date: e.target.value }))} /></div>
                            <div><label className={LABEL}>Válida até</label><input type="date" className={INPUT} value={inspForm.valid_until} onChange={e => setInspForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
                            <div><label className={LABEL}>Resultado</label>
                                <select className={INPUT} value={inspForm.result} onChange={e => setInspForm(p => ({ ...p, result: e.target.value }))}>
                                    <option value="approved">Aprovada</option>
                                    <option value="conditional">Aprovada c/ anotações</option>
                                    <option value="failed">Reprovada</option>
                                </select>
                            </div>
                            <div><label className={LABEL}>Custo (€)</label><input type="number" step="0.01" min="0" className={INPUT} placeholder="0.00" value={inspForm.cost} onChange={e => setInspForm(p => ({ ...p, cost: e.target.value }))} /></div>
                            <div className="md:col-span-2">
                                <label className={LABEL}>Documento</label>
                                <div className="flex gap-2">
                                    <input className={INPUT} value={inspForm.document_url} onChange={e => setInspForm(p => ({ ...p, document_url: e.target.value }))} placeholder="URL ou faça upload →" />
                                    <UploadBtn viaturaId={viaturaId} category="ipo" onUploaded={url => setInspForm(p => ({ ...p, document_url: url }))} />
                                </div>
                            </div>
                        </div>
                    </FormWrap>
                )}

                {inspections.length === 0 && !showAdd && !showBulk ? <EmptyState msg="Sem inspeções registadas." /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                                    <th className="text-left py-2 pr-4">Data</th>
                                    <th className="text-left py-2 pr-4">Resultado</th>
                                    <th className="text-left py-2 pr-4">Válida até</th>
                                    <th className="text-right py-2 pr-4">Custo</th>
                                    <th className="text-center py-2 pr-4">Doc.</th>
                                    <th className="py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {inspections.map(r => {
                                    const expired = r.valid_until && new Date(r.valid_until) < new Date();
                                    const soon = r.valid_until && !expired && new Date(r.valid_until) <= new Date(Date.now() + 30 * 86400000);
                                    return (
                                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 pr-4 text-slate-600">{ptDate(r.inspection_date)}</td>
                                            <td className="py-2.5 pr-4">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.result === 'approved' ? 'bg-emerald-100 text-emerald-700' : r.result === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {r.result === 'approved' ? 'Aprovada' : r.result === 'failed' ? 'Reprovada' : 'Com anotações'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-4">
                                                <span className={`font-medium ${expired ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-600'}`}>
                                                    {ptDate(r.valid_until)}
                                                    {expired && <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Expirada</span>}
                                                    {!expired && soon && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Em breve</span>}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-4 text-right font-bold text-slate-900">{fmtEur(r.cost)}</td>
                                            <td className="py-2.5 pr-4 text-center"><DocLink url={r.document_url} /></td>
                                            <td className="py-2.5">
                                                <button onClick={() => void delInsp(r.id)} className={BTN_DEL}><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // IUC
    // -----------------------------------------------------------------------
    const renderIUC = () => {
        const pending = iucList.filter(r => r.status === 'pending').reduce((a, r) => a + Number(r.amount ?? 0), 0);

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryCard label="Registos" value={String(iucList.length)} />
                    <SummaryCard label="Total Pago" value={fmtEur(iucList.filter(r => r.status === 'paid').reduce((a, r) => a + Number(r.amount ?? 0), 0))} />
                    <SummaryCard label="Pendente" value={fmtEur(pending)} />
                    <SummaryCard label="Ano Mais Recente" value={iucList[0]?.fiscal_year ? String(iucList[0].fiscal_year) : '—'} />
                </div>

                <SectionHeader noun="IUC" />

                {renderBulkPanel()}

                {showAdd && (
                    <FormWrap onSave={() => void addIuc()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className={LABEL}>Ano Fiscal *</label><input type="number" className={INPUT} placeholder="Ex: 2026" value={iucForm.fiscal_year} onChange={e => setIucForm(p => ({ ...p, fiscal_year: e.target.value }))} /></div>
                            <div><label className={LABEL}>Valor (€)</label><input type="number" step="0.01" min="0" className={INPUT} placeholder="0.00" value={iucForm.amount} onChange={e => setIucForm(p => ({ ...p, amount: e.target.value }))} /></div>
                            <div><label className={LABEL}>Data Limite</label><input type="date" className={INPUT} value={iucForm.due_date} onChange={e => setIucForm(p => ({ ...p, due_date: e.target.value }))} /></div>
                            <div><label className={LABEL}>Data Pagamento</label><input type="date" className={INPUT} value={iucForm.payment_date} onChange={e => setIucForm(p => ({ ...p, payment_date: e.target.value }))} /></div>
                            <div><label className={LABEL}>Estado</label>
                                <select className={INPUT} value={iucForm.status} onChange={e => setIucForm(p => ({ ...p, status: e.target.value as any }))}>
                                    <option value="pending">Pendente</option>
                                    <option value="paid">Pago</option>
                                </select>
                            </div>
                            <div>
                                <label className={LABEL}>Comprovativo</label>
                                <div className="flex gap-2">
                                    <input className={INPUT} value={iucForm.document_url} onChange={e => setIucForm(p => ({ ...p, document_url: e.target.value }))} placeholder="URL ou faça upload →" />
                                    <UploadBtn viaturaId={viaturaId} category="iuc" onUploaded={url => setIucForm(p => ({ ...p, document_url: url }))} />
                                </div>
                            </div>
                        </div>
                    </FormWrap>
                )}

                {iucList.length === 0 && !showAdd && !showBulk ? <EmptyState msg="Sem registos de IUC." /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                                    <th className="text-left py-2 pr-4">Ano</th>
                                    <th className="text-right py-2 pr-4">Valor</th>
                                    <th className="text-left py-2 pr-4">Data Limite</th>
                                    <th className="text-left py-2 pr-4">Data Pagamento</th>
                                    <th className="text-left py-2 pr-4">Estado</th>
                                    <th className="text-center py-2 pr-4">Doc.</th>
                                    <th className="py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {iucList.map(r => (
                                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 pr-4 font-bold text-slate-900">{r.fiscal_year}</td>
                                        <td className="py-2.5 pr-4 text-right font-bold text-slate-900">{fmtEur(r.amount)}</td>
                                        <td className="py-2.5 pr-4 text-slate-600">{ptDate(r.due_date)}</td>
                                        <td className="py-2.5 pr-4 text-slate-600">{ptDate(r.payment_date)}</td>
                                        <td className="py-2.5 pr-4">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {r.status === 'paid' ? 'Pago' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 pr-4 text-center"><DocLink url={r.document_url} /></td>
                                        <td className="py-2.5">
                                            <button onClick={() => void delIuc(r.id, r.fiscal_year)} className={BTN_DEL}><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // OUTROS CUSTOS
    // -----------------------------------------------------------------------
    const renderOutros = () => {
        const filtered = otherCatFilter === 'all' ? otherCosts : otherCosts.filter(r => r.cost_category === otherCatFilter);

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryCard label="Registos" value={String(otherCosts.length)} />
                    <SummaryCard label="Custo Total" value={fmtEur(otherCosts.reduce((a, r) => a + Number(r.amount ?? 0), 0))} />
                    <SummaryCard label="Multas" value={fmtEur(otherCosts.filter(r => r.cost_category === 'multa').reduce((a, r) => a + Number(r.amount ?? 0), 0))} />
                    <SummaryCard label="Pneus" value={fmtEur(otherCosts.filter(r => r.cost_category === 'pneus').reduce((a, r) => a + Number(r.amount ?? 0), 0))} />
                </div>

                {/* Filter chips */}
                <div className="flex flex-wrap gap-2">
                    {['all', ...Object.keys(OTHER_LABELS)].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setOtherCatFilter(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${otherCatFilter === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            {cat === 'all' ? 'Todos' : OTHER_LABELS[cat]}
                            {cat !== 'all' && (
                                <span className="ml-1 opacity-70">
                                    ({otherCosts.filter(r => r.cost_category === cat).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <SectionHeader noun="Custo" />

                {renderBulkPanel()}

                {showAdd && (
                    <FormWrap onSave={() => void addOther()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className={LABEL}>Categoria</label>
                                <select className={INPUT} value={otherForm.cost_category} onChange={e => setOtherForm(p => ({ ...p, cost_category: e.target.value as any }))}>
                                    {Object.entries(OTHER_LABELS).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                                </select>
                            </div>
                            <div><label className={LABEL}>Data *</label><input type="date" className={INPUT} value={otherForm.cost_date} onChange={e => setOtherForm(p => ({ ...p, cost_date: e.target.value }))} /></div>
                            <div><label className={LABEL}>Valor (€)</label><input type="number" step="0.01" min="0" className={INPUT} placeholder="0.00" value={otherForm.amount} onChange={e => setOtherForm(p => ({ ...p, amount: e.target.value }))} /></div>
                            <div><label className={LABEL}>Quilometragem (opcional)</label><input type="number" className={INPUT} placeholder="Ex: 450000" value={otherForm.km} onChange={e => setOtherForm(p => ({ ...p, km: e.target.value }))} /></div>
                            <div><label className={LABEL}>Motorista (opcional)</label>
                                <select className={INPUT} value={otherForm.driver_id} onChange={e => setOtherForm(p => ({ ...p, driver_id: e.target.value }))}>
                                    <option value="">Sem motorista</option>
                                    {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                </select>
                            </div>
                            <div><label className={LABEL}>Descrição</label><input className={INPUT} placeholder="Descrição livre" value={otherForm.description} onChange={e => setOtherForm(p => ({ ...p, description: e.target.value }))} /></div>
                            <div className="md:col-span-2">
                                <label className={LABEL}>Comprovativo</label>
                                <div className="flex gap-2">
                                    <input className={INPUT} value={otherForm.document_url} onChange={e => setOtherForm(p => ({ ...p, document_url: e.target.value }))} placeholder="URL ou faça upload →" />
                                    <UploadBtn viaturaId={viaturaId} category="outros" onUploaded={url => setOtherForm(p => ({ ...p, document_url: url }))} />
                                </div>
                            </div>
                        </div>
                    </FormWrap>
                )}

                {filtered.length === 0 && !showAdd && !showBulk ? <EmptyState msg="Sem custos registados nesta categoria." /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                                    <th className="text-left py-2 pr-4">Data</th>
                                    <th className="text-left py-2 pr-4">Categoria</th>
                                    <th className="text-left py-2 pr-4">Descrição</th>
                                    <th className="text-right py-2 pr-4">Km</th>
                                    <th className="text-right py-2 pr-4">Valor</th>
                                    <th className="text-center py-2 pr-4">Doc.</th>
                                    <th className="py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(r => (
                                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 pr-4 text-slate-600">{ptDate(r.cost_date)}</td>
                                        <td className="py-2.5 pr-4">
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                                {OTHER_LABELS[r.cost_category] ?? r.cost_category}
                                            </span>
                                        </td>
                                        <td className="py-2.5 pr-4 text-slate-800 max-w-[200px] truncate" title={r.description ?? ''}>{r.description || '—'}</td>
                                        <td className="py-2.5 pr-4 text-right text-slate-600">{r.km ? Number(r.km).toLocaleString('pt-PT') : '—'}</td>
                                        <td className="py-2.5 pr-4 text-right font-bold text-slate-900">{fmtEur(r.amount)}</td>
                                        <td className="py-2.5 pr-4 text-center"><DocLink url={r.document_url} /></td>
                                        <td className="py-2.5">
                                            <button onClick={() => void delOther(r.id, r.cost_category)} className={BTN_DEL}><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // COMBUSTÍVEL (read-only)
    // -----------------------------------------------------------------------
    const renderCombustivel = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Abastecimentos" value={String(vehicleFuelTransactions.length)} />
                <SummaryCard label="Custo Total" value={fmtEur(vehicleFuelTransactions.reduce((a, t) => a + Number(t.totalCost ?? (t as any).total_cost ?? 0), 0))} />
                <SummaryCard label="Total Litros" value={`${vehicleFuelTransactions.reduce((a, t) => a + Number(t.liters ?? 0), 0).toFixed(2)} L`} />
                <SummaryCard label="Último" value={vehicleFuelTransactions[0] ? new Date(vehicleFuelTransactions[0].timestamp).toLocaleDateString('pt-PT') : '—'} />
            </div>

            <SectionHeader noun="Combustível" hideImport={true} />

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                Os abastecimentos são geridos no módulo <strong>Combustível</strong>. Aqui visualiza os registos desta viatura de forma consolidada.
            </div>

            {vehicleFuelTransactions.length === 0 ? <EmptyState msg="Sem abastecimentos registados para esta viatura." /> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                                <th className="text-left py-2 pr-4">Data / Hora</th>
                                <th className="text-right py-2 pr-4">Litros</th>
                                <th className="text-right py-2 pr-4">€/L</th>
                                <th className="text-right py-2 pr-4">Custo</th>
                                <th className="text-right py-2 pr-4">Km</th>
                                <th className="text-left py-2 pr-4">Tipo</th>
                                <th className="text-left py-2 pr-4">Motorista</th>
                                <th className="text-center py-2">Doc.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vehicleFuelTransactions.map(tx => {
                                const mot = motoristas.find(m => m.id === tx.driverId);
                                const d = new Date(tx.timestamp);
                                return (
                                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 pr-4 text-slate-600">
                                            {d.toLocaleDateString('pt-PT')} <span className="text-slate-400 text-xs">{d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="py-2.5 pr-4 text-right text-slate-700">{Number(tx.liters ?? 0).toFixed(2)}</td>
                                        <td className="py-2.5 pr-4 text-right text-slate-700">{Number((tx as any).pricePerLiter ?? (tx as any).price_per_liter ?? 0).toFixed(3)}</td>
                                        <td className="py-2.5 pr-4 text-right font-bold text-slate-900">{fmtEur(Number((tx as any).totalCost ?? (tx as any).total_cost ?? 0))}</td>
                                        <td className="py-2.5 pr-4 text-right text-slate-600">{Number(tx.km ?? 0).toLocaleString('pt-PT')}</td>
                                        <td className="py-2.5 pr-4 text-slate-600 capitalize">{(tx as any).fuelType ?? '—'}</td>
                                        <td className="py-2.5 pr-4 text-slate-600">{mot?.nome ?? (tx as any).staffName ?? '—'}</td>
                                        <td className="py-2.5 text-center"><DocLink url={(tx as any).receiptUrl} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // -----------------------------------------------------------------------
    // PORTAGENS (read-only)
    // -----------------------------------------------------------------------
    const renderPortagens = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SummaryCard label="Registos" value={String(tolls.length)} />
                <SummaryCard label="Custo Total" value={fmtEur(tolls.reduce((a, r) => a + Number(r.amount ?? 0), 0))} />
                <SummaryCard label="Estacionamentos" value={String(tolls.filter(r => r.type === 'parking').length)} />
            </div>

            <SectionHeader noun="Portagem" hideImport={true} />

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
                As portagens são geridas no módulo <strong>Via Verde</strong>. Aqui visualiza os registos desta viatura de forma consolidada.
            </div>

            {tolls.length === 0 ? <EmptyState msg="Sem portagens registadas para esta viatura." /> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                                <th className="text-left py-2 pr-4">Data / Hora</th>
                                <th className="text-left py-2 pr-4">Tipo</th>
                                <th className="text-left py-2 pr-4">Entrada</th>
                                <th className="text-left py-2 pr-4">Saída</th>
                                <th className="text-right py-2 pr-4">Valor</th>
                                <th className="text-center py-2">Doc.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tolls.map(r => (
                                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="py-2.5 pr-4 text-slate-600">{ptDate(r.entry_time)}</td>
                                    <td className="py-2.5 pr-4">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.type === 'parking' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {r.type === 'parking' ? 'Estacionamento' : 'Portagem'}
                                        </span>
                                    </td>
                                    <td className="py-2.5 pr-4 text-slate-700">{r.entry_point || '—'}</td>
                                    <td className="py-2.5 pr-4 text-slate-700">{r.exit_point || '—'}</td>
                                    <td className="py-2.5 pr-4 text-right font-bold text-slate-900">{fmtEur(r.amount)}</td>
                                    <td className="py-2.5 text-center"><DocLink url={r.receipt_url} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // -----------------------------------------------------------------------
    // Render map
    // -----------------------------------------------------------------------
    const RENDERS: Record<CostSubTab, () => React.ReactNode> = {
        seguros: renderSeguros,
        manutencoes: renderManutencoes,
        ipo: renderIPO,
        iuc: renderIUC,
        outros: renderOutros,
        combustivel: renderCombustivel,
        portagens: renderPortagens,
    };

    // -----------------------------------------------------------------------
    // Main render
    // -----------------------------------------------------------------------
    return (
        <div className="space-y-0">
            {/* Sub-tab navigation */}
            <div className="overflow-x-auto border-b border-slate-200">
                <div className="flex min-w-max">
                    {SUB_TABS.map(({ id, label, Icon, count, total }) => {
                        const active = subTab === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setSubTab(id)}
                                className={`group flex flex-col items-start px-5 py-3.5 border-b-2 transition-all whitespace-nowrap ${active ? 'border-blue-600 text-blue-700 bg-blue-50/60' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span className="text-sm font-semibold">{label}</span>
                                    {count > 0 && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                            {count}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-xs mt-0.5 font-medium ${active ? 'text-blue-500' : 'text-slate-400'}`}>
                                    {total > 0 ? fmtEur(total) : '—'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="bg-white/90 border-x border-b border-slate-200 rounded-b-2xl p-5">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> A carregar dados...
                    </div>
                ) : RENDERS[subTab]()}
            </div>
        </div>
    );
}
