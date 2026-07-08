import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Upload, FileText, RefreshCw, Camera, Image as ImageIcon, ScanSearch, Crop, CheckCircle2, RotateCcw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';
import { ALLOWED_INVOICE_UNITS } from '../types';
import type {
    SupplierInvoice,
    SupplierInvoiceLine,
    InvoiceUnit,
    Fornecedor,
    CentroCusto,
    Viatura,
    Requisicao,
    InvoiceImport,
    InvoiceImportExtractedData,
} from '../types';
import { supabase } from '../lib/supabase';
import StatusBadge from './common/StatusBadge';
import InvoiceFinancialSummary from './InvoiceFinancialSummary';
import ImageCropper from './common/ImageCropper';
import { formatCurrency } from '../utils/format';
import {
    createInvoiceImportFromPdf,
    getInvoiceImport,
    getInvoiceImportPreviewUrl,
    markInvoiceImportConfirmed,
    parseInvoicePdfLocally,
    reparseInvoiceImport,
} from '../services/invoiceImportService';

interface InvoiceFormProps {
    invoice?: SupplierInvoice | null;
    suppliers: Fornecedor[];
    costCenters: CentroCusto[];
    vehicles: Viatura[];
    requisitions: Requisicao[];
    initialRequisition?: Requisicao | null;
    onSave: (invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
    onPersisted?: (payload: {
        savedInvoiceId: string;
        mode: 'create' | 'update';
        hadImport: boolean;
        hadDocument: boolean;
        documentReplaced: boolean;
        invoiceNumber: string;
        issueDate: string;
        totalValue: number;
    }) => Promise<void> | void;
    onCancel: () => void;
}

export default function InvoiceForm({
    invoice,
    suppliers,
    costCenters,
    vehicles,
    requisitions,
    initialRequisition,
    onSave,
    onPersisted,
    onCancel
}: InvoiceFormProps) {
    const allowedUnits = ALLOWED_INVOICE_UNITS;
    const normalizeInvoiceUnit = (value: string): InvoiceUnit | '' => {
        const token = (value || '').trim().toUpperCase();
        if (!token) return '';
        if (token === 'HOR') return 'H';
        if (token === 'HRS' || token === 'HR' || token === 'HOF') return 'H';
        if (token === 'LT' || token === 'LTS') return 'L';
        if (token === 'CAIXA' || token === 'CAIXAS') return 'CX';
        if (token === 'UND' || token === 'UNID' || token === 'UNIDADE' || token === 'UNIDADES' || token === 'UNI') return 'UN';
        return allowedUnits.includes(token as InvoiceUnit) ? (token as InvoiceUnit) : '';
    };

    const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const hasMeaningfulDifference = (a: number, b: number) => Math.abs(a - b) >= 0.01;
    const normalizeName = (value: string) => value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    const parseRate = (value: number): 0 | 6 | 13 | 23 => {
        const rounded = Math.round(value);
        if (rounded === 6 || rounded === 13 || rounded === 23) return rounded;
        return 0;
    };
    const nonItemTextRegex = /(iban|swift|bic|nib|entidade|refer[êe]ncia|multibanco|pagamento|dados\s+banc[aá]rios|transfer[êe]ncia|vencimento|total\s+a\s+pagar|subtotal|iva\s+total|resumo\s+do\s+iva|a\s+transportar)/i;
    const pageMarkerRegex = /^(original|duplicado|triplicado)\s*\d*\s*\/?$/i;

    const calculateLine = useCallback((line: SupplierInvoiceLine) => {
        const quantity = line.quantity || 0;
        const inferredUnitPrice = line.unit_price ?? (quantity !== 0 ? (line.net_value || 0) / quantity : (line.net_value || 0));
        const unitPrice = round2(inferredUnitPrice || 0);
        const discountPercentage = Math.max(0, round2(line.discount_percentage || 0));
        const subtotal = round2(quantity * unitPrice);
        const discountValue = round2(subtotal * (discountPercentage / 100));
        const taxableBase = round2(subtotal - discountValue);
        const ivaValue = round2(taxableBase * ((line.iva_rate || 0) / 100));

        return {
            quantity,
            unitPrice,
            discountPercentage,
            subtotal,
            discountValue,
            taxableBase,
            ivaValue,
            totalValue: round2(taxableBase + ivaValue)
        };
    }, []);

    const emptyLine = (): SupplierInvoiceLine => ({
        description: '',
        unidade_medida: 'UN',
        quantity: 1,
        unit_price: 0,
        discount_percentage: 0,
        net_value: 0,
        iva_rate: 23,
        iva_value: 0,
        total_value: 0
    });

    const normalizeLine = useCallback((line: SupplierInvoiceLine, overrideIvaValue?: string | number | null): SupplierInvoiceLine => {
        const calculated = calculateLine(line);
        const parsedOverride = overrideIvaValue !== undefined && overrideIvaValue !== null
            ? parseFloat(String(overrideIvaValue).replace(',', '.'))
            : null;
        const effectiveIvaValue = Number.isFinite(parsedOverride) ? round2(parsedOverride as number) : calculated.ivaValue;

        return {
            ...line,
            description: line.description || '',
            unidade_medida: normalizeInvoiceUnit(line.unidade_medida || 'UN') || 'UN',
            quantity: calculated.quantity,
            unit_price: calculated.unitPrice,
            discount_percentage: calculated.discountPercentage,
            net_value: calculated.taxableBase,
            iva_value: effectiveIvaValue,
            total_value: round2(calculated.taxableBase + effectiveIvaValue)
        };
    }, [calculateLine]);

    const inferLegacyRate = useCallback((legacyInvoice: SupplierInvoice): 0 | 6 | 13 | 23 => {
        if (legacyInvoice.iva_rate === 0 || legacyInvoice.iva_rate === 6 || legacyInvoice.iva_rate === 13 || legacyInvoice.iva_rate === 23) {
            return legacyInvoice.iva_rate;
        }

        const referenceBase = legacyInvoice.net_value || legacyInvoice.base_amount || 0;
        const referenceIva = legacyInvoice.vat_value || legacyInvoice.iva_value || 0;
        if (referenceBase <= 0 || referenceIva <= 0) return 0;

        const guessedRate = Math.round((referenceIva / referenceBase) * 100);
        if (guessedRate === 6 || guessedRate === 13 || guessedRate === 23) return guessedRate;
        return 0;
    }, []);

    const [formData, setFormData] = useState({
        supplier_id: '',
        requisition_id: '',
        invoice_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        lines: [emptyLine()],
        cost_center_id: '',
        vehicle_id: '',
        payment_status: 'pending' as SupplierInvoice['payment_status'],
        payment_method: '',
        notes: '',
        pdf_url: ''
    });
    const loadedInvoiceIdRef = useRef<string | null>(null);
    const [manualIvaOverrides, setManualIvaOverrides] = useState<(string | null)[]>([null]);
    const [financialImpact, setFinancialImpact] = useState<Array<{
        date: string;
        description: string;
        debit: number;
        credit: number;
        amount: number;
        account_code: string;
    }>>([]);

    const [uploading, setUploading] = useState(false);
    const [activeImport, setActiveImport] = useState<InvoiceImport | null>(null);
    const [importStatusMessage, setImportStatusMessage] = useState('');
    const [hasUserRequestedOcr, setHasUserRequestedOcr] = useState(false);
    const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
    const [isMobileLayout, setIsMobileLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
    const [pendingImageName, setPendingImageName] = useState('fatura.jpg');
    const [captureStep, setCaptureStep] = useState<'chooser' | 'preview' | 'uploading' | 'form'>(() => (
        !invoice ? 'chooser' : 'form'
    ));
    const [showImageCropper, setShowImageCropper] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadPhaseLabel, setUploadPhaseLabel] = useState('');
    const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');
    const pdfInputRef = useRef<HTMLInputElement | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const isCapacitorNative = Capacitor.isNativePlatform();
    const isNewInvoice = !invoice;

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = () => setIsMobileLayout(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isNewInvoice) {
            setCaptureStep('form');
            return;
        }

        if (formData.pdf_url) {
            setCaptureStep('form');
            return;
        }

        if (pendingImageSrc) {
            setCaptureStep('preview');
            return;
        }

        if (!uploading) {
            setCaptureStep((prev) => (prev === 'uploading' ? 'chooser' : prev === 'form' ? 'form' : 'chooser'));
        }
    }, [formData.pdf_url, isNewInvoice, pendingImageSrc, uploading]);

    const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem selecionada.'));
        reader.readAsDataURL(file);
    });

    const dataUrlToFile = async (dataUrl: string, fileName: string) => {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
    };

    const canReplaceExistingDocument = () => {
        if (!formData.pdf_url) return true;
        return confirm('Já existe um documento associado a esta fatura. Pretende substituí-lo?');
    };

    const stagePreviewImage = (dataUrl: string, fileName: string) => {
        setPendingImageName(fileName || `fatura-${Date.now()}.jpg`);
        setPendingImageSrc(dataUrl);
        setUploadSuccessMessage('');
        setCaptureStep('preview');
    };

    const loadNativePhoto = async (source: CameraSource) => {
        if (!canReplaceExistingDocument()) return;

        const photo = await CapacitorCamera.getPhoto({
            quality: 92,
            resultType: CameraResultType.DataUrl,
            source,
            direction: source === CameraSource.Camera ? CameraDirection.Rear : undefined,
            correctOrientation: true,
            presentationStyle: 'fullscreen',
        });

        const dataUrl = photo.dataUrl;
        if (!dataUrl) throw new Error('Não foi possível obter a imagem da câmara.');

        const extension = photo.format || 'jpeg';
        stagePreviewImage(dataUrl, `fatura-${Date.now()}.${extension}`);
    };

    const handleTakePhoto = async () => {
        try {
            if (isCapacitorNative) {
                await loadNativePhoto(CameraSource.Camera);
                return;
            }

            if (!canReplaceExistingDocument()) return;
            cameraInputRef.current?.click();
        } catch (error) {
            console.error('Error opening native camera:', error);
            alert('Não foi possível abrir a câmara do dispositivo.');
        }
    };

    const handleChooseFromGallery = async () => {
        try {
            if (isCapacitorNative) {
                await loadNativePhoto(CameraSource.Photos);
                return;
            }

            if (!canReplaceExistingDocument()) return;
            imageInputRef.current?.click();
        } catch (error) {
            console.error('Error opening mobile gallery:', error);
            alert('Não foi possível abrir a galeria do dispositivo.');
        }
    };

    const handleRetakePhoto = async () => {
        setPendingImageSrc(null);
        await handleTakePhoto();
    };

    const handleRotatePreview = () => {
        if (!pendingImageSrc) return;
        setShowImageCropper(true);
    };

    const pollImportUntilDone = async (importId: string) => {
        for (let attempt = 0; attempt < 60; attempt += 1) {
            const currentImport = await getInvoiceImport(importId);
            setActiveImport(currentImport);

            if (currentImport.status === 'ready' || currentImport.status === 'failed') {
                return currentImport;
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        throw new Error('Timeout ao processar a fatura. Tente novamente.');
    };

    const scoreExtractedPayload = (payload?: InvoiceImportExtractedData | null): number => {
        if (!payload) return -1;

        const validLines = (payload.lines || [])
            .map((line) => {
                const description = String(line.description || '').trim();
                const unidade_medida = normalizeInvoiceUnit(String(line.unidade_medida || ''));
                const qty = Math.max(0, Number(line.qty) || 0);
                const unit_price = Math.max(0, Number(line.unit_price) || 0);
                const vat_percent = parseRate(Number(line.vat_percent) || 0);
                const net = round2(qty * unit_price);
                const vat = round2(net * (vat_percent / 100));
                return { description, unidade_medida, qty, unit_price, vat_percent, net, vat };
            })
            .filter((line) => {
                if (!line.description) return false;
                if (!line.unidade_medida) return false;
                if (nonItemTextRegex.test(line.description)) return false;
                if (pageMarkerRegex.test(line.description)) return false;
                return line.qty > 0 && line.unit_price > 0;
            });

        if (!validLines.length) return 0;

        const netSum = round2(validLines.reduce((sum, line) => sum + line.net, 0));
        const vatSum = round2(validLines.reduce((sum, line) => sum + line.vat, 0));
        const targetNet = round2(Math.max(0, Number(payload.total || 0) - Number(payload.vat_total || 0)));
        const targetVat = round2(Math.max(0, Number(payload.vat_total || 0)));
        const netPenalty = targetNet > 0 ? Math.abs(netSum - targetNet) : 0;
        const vatPenalty = targetVat > 0 ? Math.abs(vatSum - targetVat) : 0;

        return (validLines.length * 100) - netPenalty - vatPenalty;
    };

    const mergeExtractedPayloads = (
        serverExtract: InvoiceImportExtractedData,
        localExtract?: InvoiceImportExtractedData | null
    ): InvoiceImportExtractedData => {
        if (!localExtract) return serverExtract;

        const serverScore = scoreExtractedPayload(serverExtract);
        const localScore = scoreExtractedPayload(localExtract);
        const primary = localScore > serverScore ? localExtract : serverExtract;
        const secondary = localScore > serverScore ? serverExtract : localExtract;

        const mergedLines = [...(primary.lines || [])];
        const seen = new Set(
            mergedLines.map((line) => [
                String(line.description || '').trim().toLowerCase().replace(/\s+/g, ' '),
                normalizeInvoiceUnit(String(line.unidade_medida || '')) || '',
                Number(line.qty || 0).toFixed(2),
                Number(line.unit_price || 0).toFixed(2),
            ].join('|'))
        );

        for (const line of secondary.lines || []) {
            const key = [
                String(line.description || '').trim().toLowerCase().replace(/\s+/g, ' '),
                normalizeInvoiceUnit(String(line.unidade_medida || '')) || '',
                Number(line.qty || 0).toFixed(2),
                Number(line.unit_price || 0).toFixed(2),
            ].join('|');

            if (seen.has(key)) continue;
            seen.add(key);
            mergedLines.push(line);
        }

        return {
            ...primary,
            supplier: primary.supplier || secondary.supplier,
            invoice_number: primary.invoice_number || secondary.invoice_number,
            date: primary.date || secondary.date,
            total: Number(primary.total || 0) > 0 ? primary.total : secondary.total,
            vat_total: Number(primary.vat_total || 0) > 0 ? primary.vat_total : secondary.vat_total,
            lines: mergedLines,
        };
    };

    const applyImportedData = (payload: InvoiceImportExtractedData) => {
        const importedLines: SupplierInvoiceLine[] = (payload.lines || [])
            .map((line) => {
                const quantity = Math.max(0, Number(line.qty) || 0) || 1;
                const inferredLineTotal = Math.max(0, Number((line as any).total_value || (line as any).total || (line as any).net_value || 0));
                const baseUnitPrice = Math.max(0, Number(line.unit_price) || 0);
                const unitPrice = round2(baseUnitPrice > 0 ? baseUnitPrice : (inferredLineTotal > 0 ? inferredLineTotal / quantity : 0));
                const vatPercent = parseRate(Number(line.vat_percent) || 0);
                const netValue = round2(quantity * unitPrice);
                const ivaValue = round2(netValue * (vatPercent / 100));
                const totalValue = round2(netValue + ivaValue);

                return {
                    description: line.description || '',
                    unidade_medida: normalizeInvoiceUnit(line.unidade_medida || 'UN') || 'UN',
                    quantity,
                    unit_price: unitPrice,
                    discount_percentage: 0,
                    net_value: netValue,
                    iva_rate: vatPercent,
                    iva_value: ivaValue,
                    total_value: totalValue,
                };
            })
            .filter((line) => {
                const description = line.description.trim();
                if (!description) return false;
                if (nonItemTextRegex.test(description)) return false;
                if (pageMarkerRegex.test(description)) return false;
                if (!allowedUnits.includes(line.unidade_medida as InvoiceUnit)) return false;
                return line.quantity > 0 || line.unit_price > 0;
            });

        const hasImportedLines = importedLines.length > 0;
        const fallbackLine: SupplierInvoiceLine[] = hasImportedLines ? importedLines : [emptyLine()];
        const normalizedSupplierName = normalizeName(payload.supplier || '');

        const matchedSupplier = normalizedSupplierName
            ? suppliers.find((supplier) => normalizeName(supplier.nome) === normalizedSupplierName)
            || suppliers.find((supplier) => normalizeName(supplier.nome).includes(normalizedSupplierName))
            || suppliers.find((supplier) => normalizedSupplierName.includes(normalizeName(supplier.nome)))
            : undefined;

        setFormData((prev) => ({
            ...prev,
            supplier_id: prev.supplier_id || matchedSupplier?.id || '',
            invoice_number: payload.invoice_number || prev.invoice_number,
            issue_date: payload.date || prev.issue_date,
            lines: hasImportedLines ? fallbackLine : prev.lines,
        }));

        if (hasImportedLines) {
            setManualIvaOverrides(fallbackLine.map(() => null));
        }
        setAiFilledFields(new Set([
            'supplier_id',
            'invoice_number',
            'issue_date',
            ...(hasImportedLines ? fallbackLine.map((_, index) => `line-${index}`) : []),
        ]));
    };

    useEffect(() => {
        if (invoice) {
            if (loadedInvoiceIdRef.current === invoice.id) {
                return;
            }
            loadedInvoiceIdRef.current = invoice.id;

            const linesArray = (invoice.lines || []).filter(line => !!line);
            const sourceLines = linesArray.length > 0
                ? linesArray
                : [{
                    description: invoice.expense_type || 'Linha principal',
                    unidade_medida: 'UN' as const,
                    quantity: 1,
                    unit_price: invoice.total_liquido || invoice.net_value || invoice.base_amount || 0,
                    discount_percentage: 0,
                    net_value: invoice.total_liquido || invoice.net_value || invoice.base_amount || 0,
                    iva_rate: inferLegacyRate(invoice),
                    iva_value: invoice.total_iva || invoice.vat_value || invoice.iva_value || 0,
                    total_value: invoice.total_final || invoice.total_value || invoice.total || 0
                }];

            const detectedOverrides = sourceLines.map((line) => {
                const autoIvaValue = calculateLine(line).ivaValue;
                const incomingIvaValue = round2(line.iva_value || 0);
                return hasMeaningfulDifference(incomingIvaValue, autoIvaValue) ? String(incomingIvaValue) : null;
            });

            const mappedLines = sourceLines.map((line, index) => normalizeLine(line, detectedOverrides[index]));

            setFormData({
                supplier_id: invoice.supplier_id || '',
                requisition_id: invoice.requisition_id || '',
                invoice_number: invoice.invoice_number,
                issue_date: (invoice.issue_date || '').split('T')[0],
                due_date: (invoice.due_date || '').split('T')[0],
                lines: mappedLines,
                cost_center_id: invoice.cost_center_id || '',
                vehicle_id: invoice.vehicle_id || '',
                payment_status: invoice.payment_status as SupplierInvoice['payment_status'],
                payment_method: invoice.payment_method || '',
                notes: invoice.notes || '',
                pdf_url: invoice.pdf_url || ''
            });

            setManualIvaOverrides(mappedLines.map((_, index) => detectedOverrides[index] ?? null));
        } else {
            loadedInvoiceIdRef.current = null;
        }

        setHasUserRequestedOcr(false);
        setImportStatusMessage('');
    }, [invoice, inferLegacyRate, normalizeLine, calculateLine]);

    useEffect(() => {
        if (invoice) return;

        setManualIvaOverrides((prev) => {
            if (prev.length === formData.lines.length) return prev;
            if (prev.length < formData.lines.length) {
                return [...prev, ...Array(formData.lines.length - prev.length).fill(null)];
            }
            return prev.slice(0, formData.lines.length);
        });
    }, [formData.lines.length, invoice]);

    useEffect(() => {
        if (invoice || !initialRequisition) return;

        const items = Array.isArray(initialRequisition.itens) ? initialRequisition.itens.filter(item => !!item) : [];
        const mappedLines = items.length > 0 ? items.map(item => {
            const qty = Number(item.quantidade || 0);
            const price = Number(item.valor_unitario || 0);
            const net = Number(item.valor_total || (qty * price) || 0);
            const iva = round2(net * 0.23); // Default 23% IVA
            const total = round2(net + iva);
            
            return {
                description: item.descricao || '',
                unidade_medida: 'UN' as const,
                quantity: qty,
                unit_price: price,
                discount_percentage: 0,
                net_value: net,
                iva_rate: 23 as const,
                iva_value: iva,
                total_value: total
            };
        }) : [emptyLine()];

        setFormData(prev => ({
            ...prev,
            supplier_id: prev.supplier_id || initialRequisition.fornecedorId || '',
            vehicle_id: prev.vehicle_id || initialRequisition.viaturaId || '',
            cost_center_id: prev.cost_center_id || initialRequisition.centroCustoId || '',
            requisition_id: prev.requisition_id || initialRequisition.id,
            lines: prev.lines.length === 1 && prev.lines[0].description === '' && prev.lines[0].net_value === 0
                ? mappedLines
                : prev.lines
        }));
        
        if (items.length > 0) {
            setManualIvaOverrides(prev => prev.length === 1 && prev[0] === null
                ? Array(items.length).fill(null)
                : prev);
        }
    }, [invoice, initialRequisition]);

    useEffect(() => {
        const loadFinancialImpact = async () => {
            if (!invoice?.id) {
                setFinancialImpact([]);
                return;
            }

            const { data, error } = await supabase
                .from('financial_movements')
                .select('date, description, debit, credit, amount, account_code')
                .eq('document_type', 'invoice')
                .eq('document_id', invoice.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Unable to load financial impact:', error.message);
                setFinancialImpact([]);
                return;
            }

            setFinancialImpact(data || []);
        };

        loadFinancialImpact();
    }, [invoice?.id]);

    const getRequisitionStatusLabel = useCallback((status?: Requisicao['status']) => {
        if (status === 'concluida') return 'Concluída';
        return 'Pendente';
    }, []);

    const requisitionOptions = useMemo(() => {
        const safeReqs = (requisitions || []).filter((req): req is Requisicao => !!req && typeof req === 'object');
        
        const byDateDesc = [...safeReqs].sort((a, b) => {
            const dateA = a.data ? new Date(a.data).getTime() : 0;
            const dateB = b.data ? new Date(b.data).getTime() : 0;
            return dateB - dateA;
        });

        const activeSupplierId = formData.supplier_id || '';
        const activeReqId = formData.requisition_id || '';

        return byDateDesc
            .filter(req => {
                if (!req.id) return false;
                return req.id === activeReqId || !activeSupplierId || req.fornecedorId === activeSupplierId;
            })
            .map(req => {
                const supplier = (suppliers || []).find(item => item && item.id === req.fornecedorId);
                const vehicle = (vehicles || []).find(item => item && item.id === req.viaturaId);
                
                const rawNum = req.numero || '';
                const numberToken = String(rawNum).includes('/')
                    ? String(rawNum).split('/')[1]
                    : String(rawNum);

                return {
                    id: req.id,
                    label: `R:${numberToken || rawNum} — ${supplier?.nome || 'Fornecedor N/D'} — ${vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Sem viatura'} — ${getRequisitionStatusLabel(req.status)}`
                };
            });
    }, [requisitions, formData.supplier_id, formData.requisition_id, suppliers, vehicles, getRequisitionStatusLabel]);

    const lineBreakdowns = formData.lines.map((line, index) => {
        const calculated = calculateLine(line);
        const overrideIvaValue = manualIvaOverrides[index];
        const parsedOverride = overrideIvaValue !== undefined && overrideIvaValue !== null
            ? parseFloat(String(overrideIvaValue).replace(',', '.'))
            : null;
        const ivaValue = Number.isFinite(parsedOverride) ? round2(parsedOverride as number) : calculated.ivaValue;
        return {
            ...calculated,
            ivaValue,
            totalValue: round2(calculated.taxableBase + ivaValue)
        };
    });

    const calculatedLines = formData.lines.map((line, index) => normalizeLine(line, manualIvaOverrides[index]));
    const grossBaseTotal = round2(lineBreakdowns.reduce((sum, line) => sum + line.subtotal, 0));
    const discountTotal = round2(lineBreakdowns.reduce((sum, line) => sum + line.discountValue, 0));
    const totalLiquido = round2(lineBreakdowns.reduce((sum, line) => sum + line.taxableBase, 0));
    const totalIva = round2(lineBreakdowns.reduce((sum, line) => sum + line.ivaValue, 0));
    const totalFinal = round2(totalLiquido + totalIva);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validLines = calculatedLines.filter(line => line.description.trim() && line.net_value !== 0);
        if (!validLines.length) {
            alert('Adicione pelo menos uma linha válida na fatura.');
            return;
        }

        const invalidUnitLine = validLines.find(line => !allowedUnits.includes(line.unidade_medida));
        if (invalidUnitLine) {
            alert(`Unidade inválida na linha "${invalidUnitLine.description}". Use apenas: ${allowedUnits.join(', ')}`);
            return;
        }

        const derivedExpenseType = validLines.map(line => line.description).join(' | ').slice(0, 180) || 'Fatura Fornecedor';

        try {
            const savedInvoiceId = await onSave({
                supplier_id: formData.supplier_id,
                requisition_id: formData.requisition_id || undefined,
                invoice_number: formData.invoice_number,
                issue_date: formData.issue_date,
                due_date: formData.due_date,
                base_amount: grossBaseTotal,
                iva_rate: 23,
                iva_value: totalIva,
                discount: {
                    type: 'amount',
                    value: discountTotal,
                    applied_value: discountTotal
                },
                extra_expenses: [],
                total: totalFinal,
                total_liquido: totalLiquido,
                total_iva: totalIva,
                total_final: totalFinal,
                net_value: totalLiquido,
                vat_value: totalIva,
                total_value: totalFinal,
                lines: validLines,
                expense_type: derivedExpenseType,
                cost_center_id: formData.cost_center_id || undefined,
                vehicle_id: formData.vehicle_id || undefined,
                payment_status: formData.payment_status,
                payment_method: formData.payment_method || undefined,
                notes: formData.notes || undefined,
                pdf_url: formData.pdf_url || undefined
            });

            if (activeImport?.id && savedInvoiceId) {
                await markInvoiceImportConfirmed(activeImport.id, savedInvoiceId);
                setActiveImport((prev) => prev ? { ...prev, status: 'confirmed' } : prev);
            }

            await onPersisted?.({
                savedInvoiceId,
                mode: invoice ? 'update' : 'create',
                hadImport: Boolean(activeImport),
                hadDocument: Boolean(formData.pdf_url),
                documentReplaced: Boolean(invoice?.pdf_url && formData.pdf_url && invoice.pdf_url !== formData.pdf_url),
                invoiceNumber: formData.invoice_number,
                issueDate: formData.issue_date,
                totalValue: totalFinal,
            });

            onCancel();
        } catch (error: any) {
            console.error('Error saving invoice form:', error);
            alert(error.message || 'Erro ao guardar fatura');
        }
    };

    const updateLine = (index: number, field: 'description' | 'unidade_medida' | 'quantity' | 'unit_price' | 'discount_percentage' | 'iva_rate', rawValue: string) => {
        setFormData(prev => {
            const nextLines = prev.lines.map((line, lineIndex) => {
                if (lineIndex !== index) return line;

                const numericValue = parseFloat(rawValue.replace(',', '.'));
                return {
                    ...line,
                    [field]: field === 'description'
                        ? rawValue
                        : field === 'unidade_medida'
                            ? (normalizeInvoiceUnit(rawValue || 'UN') || 'UN')
                        : field === 'iva_rate'
                            ? (Number(rawValue) as 0 | 6 | 13 | 23)
                            : Number.isFinite(numericValue)
                                ? numericValue
                                : 0
                };
            });

            return { ...prev, lines: nextLines };
        });

        if (field !== 'description' && field !== 'unidade_medida') {
            setManualIvaOverrides(prev => prev.map((value, lineIndex) => lineIndex === index ? null : value));
        }
    };

    const updateManualIva = (index: number, rawValue: string) => {
        setManualIvaOverrides(prev => prev.map((value, lineIndex) => {
            if (lineIndex !== index) return value;
            return rawValue.trim() === '' ? null : rawValue;
        }));
    };

    const addLine = () => {
        setFormData(prev => ({
            ...prev,
            lines: [...prev.lines, emptyLine()]
        }));
        setManualIvaOverrides(prev => [...prev, null]);
    };

    const removeLine = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lines: prev.lines.length > 1
                ? prev.lines.filter((_, lineIndex) => lineIndex !== index)
                : [emptyLine()]
        }));
        setManualIvaOverrides(prev => prev.length > 1
            ? prev.filter((_, lineIndex) => lineIndex !== index)
            : [null]);
    };

    const submitPreparedImage = async (croppedBase64: string) => {
        setPendingImageSrc(croppedBase64);
        setShowImageCropper(false);
        setCaptureStep('preview');
    };

    const processSelectedDocument = async (file?: File | null) => {
        if (!file) return;

        if (!canReplaceExistingDocument()) return;

        if (file.type.startsWith('image/')) {
            try {
                const previewSource = await readFileAsDataUrl(file);
                stagePreviewImage(previewSource, file.name || 'fatura.jpg');
            } catch (error) {
                console.error('Error preparing image preview:', error);
                alert('Não foi possível abrir a pré-visualização da imagem.');
            }
            return;
        }

        await onFileUpload(file);
    };

    const onFileUpload = async (file?: File | null, options?: { mobileFlow?: boolean }) => {
        if (!file) return;

        setHasUserRequestedOcr(true);
        setUploading(true);
        setUploadSuccessMessage('');
        setUploadProgress(12);
        setUploadPhaseLabel('A preparar documento...');
        if (options?.mobileFlow) setCaptureStep('uploading');
        try {
            setImportStatusMessage('A ler documento e extrair QR/OCR...');
            setUploadProgress(28);
            setUploadPhaseLabel('A enviar documento...');
            const createdImport = await createInvoiceImportFromPdf(file);
            setActiveImport(createdImport);
            setUploadProgress(48);
            setUploadPhaseLabel('Documento associado à requisição.');
            const previewUrl = await getInvoiceImportPreviewUrl(createdImport.file_path);

            setFormData(prev => ({ ...prev, pdf_url: previewUrl || prev.pdf_url }));

            setUploadProgress(65);
            setUploadPhaseLabel('A executar leitura do QR Code...');
            const completedImport = await pollImportUntilDone(createdImport.id);

            if (completedImport.status === 'failed') {
                setImportStatusMessage(`Documento carregado, mas a extração automática falhou${completedImport.error ? `: ${completedImport.error}` : '.'}`);
                if (options?.mobileFlow) setCaptureStep('preview');
                return;
            }

            if (completedImport.status === 'ready' && completedImport.extracted_json) {
                setUploadProgress(82);
                setUploadPhaseLabel('A executar OCR automático...');
                let bestExtract = completedImport.extracted_json;
                let usedLocalEnhancement = false;

                try {
                    const localExtract = await parseInvoicePdfLocally(file);
                    const localLines = localExtract?.lines?.length || 0;

                    if (localLines > 0) {
                        bestExtract = mergeExtractedPayloads(completedImport.extracted_json, localExtract);
                        usedLocalEnhancement = true;
                    }
                } catch (localEnhanceError) {
                    console.warn('Local parse enhancement skipped:', localEnhanceError);
                }

                applyImportedData(bestExtract);
                setUploadProgress(100);
                setUploadPhaseLabel('Fatura associada com sucesso.');
                setUploadSuccessMessage('Fotografia carregada e associada à requisição com sucesso.');
                setImportStatusMessage(
                    usedLocalEnhancement
                        ? 'Dados extraídos e melhorados localmente. Revise e confirme antes de guardar.'
                        : 'Dados extraídos. Revise e confirme antes de guardar.'
                );
            }

            if (options?.mobileFlow) {
                setPendingImageSrc(null);
                setCaptureStep('form');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            try {
                const localExtract = await parseInvoicePdfLocally(file);
                applyImportedData(localExtract);
                setUploadProgress(100);
                setUploadPhaseLabel('Leitura local concluída.');
                setUploadSuccessMessage('Fotografia carregada e extraída localmente com sucesso.');
                setImportStatusMessage(
                    `OCR indisponível no servidor. Extração local aplicada (data: ${localExtract.date || 'n/a'}, linhas: ${localExtract.lines?.length || 0}). Revise os dados antes de guardar.`
                );
                if (options?.mobileFlow) {
                    setPendingImageSrc(null);
                    setCaptureStep('form');
                }
            } catch (localError) {
                console.error('Local PDF parse also failed:', localError);
                const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
                setImportStatusMessage(`Falha no processamento inteligente da fatura: ${errorMessage}`);
                alert(`Erro ao processar documento da fatura: ${errorMessage}`);
                if (options?.mobileFlow) setCaptureStep('preview');
            }
        } finally {
            setUploading(false);
        }
    };

    const confirmPendingMobileImage = async () => {
        if (!pendingImageSrc) return;

        try {
            const preparedFile = await dataUrlToFile(pendingImageSrc, pendingImageName || 'fatura.jpg');
            await onFileUpload(preparedFile, { mobileFlow: true });
        } catch (error) {
            console.error('Error confirming mobile invoice image:', error);
            alert('Não foi possível preparar a fotografia para upload.');
            setCaptureStep('preview');
        }
    };

    const handleReparse = async () => {
        if (!activeImport?.id || !activeImport?.file_path || uploading) return;

        setUploading(true);
        try {
            setImportStatusMessage('Reading invoice...');
            await reparseInvoiceImport(activeImport.id, activeImport.file_path);

            const completedImport = await pollImportUntilDone(activeImport.id);
            if (completedImport.status === 'failed') {
                setImportStatusMessage(`Reprocessamento falhou${completedImport.error ? `: ${completedImport.error}` : '.'}`);
                return;
            }

            if (completedImport.status === 'ready' && completedImport.extracted_json) {
                let bestExtract = completedImport.extracted_json;
                let usedLocalEnhancement = false;

                try {
                    const previewUrl = await getInvoiceImportPreviewUrl(activeImport.file_path);
                    if (previewUrl) {
                        const response = await fetch(previewUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            const inferredName = activeImport.file_path.split('/').pop() || 'invoice.pdf';
                            const file = new File([blob], inferredName, { type: blob.type || 'application/pdf' });
                            const localExtract = await parseInvoicePdfLocally(file);
                            const localLines = localExtract?.lines?.length || 0;

                            if (localLines > 0) {
                                bestExtract = mergeExtractedPayloads(completedImport.extracted_json, localExtract);
                                usedLocalEnhancement = true;
                            }
                        }
                    }
                } catch (localEnhanceError) {
                    console.warn('Local parse enhancement skipped on reparse:', localEnhanceError);
                }

                applyImportedData(bestExtract);
                setImportStatusMessage(
                    usedLocalEnhancement
                        ? 'Dados reprocessados e melhorados localmente. Revise e confirme antes de guardar.'
                        : 'Dados extraídos novamente. Revise e confirme antes de guardar.'
                );
            }
        } catch (error) {
            console.error('Error reparsing file:', error);
            setImportStatusMessage('Falha no reprocessamento da fatura.');
            alert('Erro ao reprocessar PDF da fatura');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={isMobileLayout ? 'relative w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900' : 'w-full rounded-2xl border border-slate-200/80 bg-white shadow-sm'}>
            <div className={isMobileLayout ? 'flex items-center justify-between border-b border-slate-700 p-6' : 'flex items-center justify-between border-b border-slate-100 p-6'}>
                <h2 className={isMobileLayout ? 'text-xl font-semibold text-white' : 'text-xl font-bold text-slate-800'}>
                    {invoice ? 'Editar Fatura' : 'Nova Fatura de Fornecedor'}
                </h2>
                <button
                    onClick={onCancel}
                    className={isMobileLayout ? 'rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white' : 'rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'}
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {captureStep === 'chooser' && (
                <div className={isMobileLayout ? "flex flex-col justify-between px-5 pb-8 pt-10 min-h-[400px]" : "flex flex-col items-center justify-center p-12 text-center min-h-[500px]"}>
                    {isMobileLayout ? (
                        <>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-400">Adicionar Fatura</p>
                                <h3 className="mt-3 text-3xl font-black tracking-tight text-white">Captura rápida</h3>
                                <p className="mt-4 text-base leading-7 text-slate-300">
                                    Capture a fatura para extração automática via QR Code e OCR.
                                </p>
                            </div>
                            <div className="space-y-4 mt-8 w-full">
                                <button type="button" onClick={handleTakePhoto} className="flex w-full items-center justify-between rounded-[28px] bg-emerald-600 px-6 py-6 text-left text-white shadow-[0_20px_60px_-30px_rgba(16,185,129,0.8)] transition-colors hover:bg-emerald-500">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-100">Câmara</p>
                                        <p className="mt-2 text-xl font-bold">Tirar Fotografia</p>
                                    </div>
                                    <Camera className="h-8 w-8" />
                                </button>
                                <button type="button" onClick={handleTakePhoto} className="flex w-full items-center justify-between rounded-[28px] bg-blue-600 px-6 py-6 text-left text-white shadow-[0_20px_60px_-30px_rgba(37,99,235,0.8)] transition-colors hover:bg-blue-500">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100">Automático</p>
                                        <p className="mt-2 text-xl font-bold">Ler QR Code</p>
                                    </div>
                                    <ScanSearch className="h-8 w-8" />
                                </button>
                                <button type="button" onClick={handleChooseFromGallery} className="flex w-full items-center justify-between rounded-[28px] border border-slate-700 bg-slate-900 px-6 py-6 text-left text-white transition-colors hover:bg-slate-800">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Biblioteca</p>
                                        <p className="mt-2 text-xl font-bold">Escolher da Galeria</p>
                                    </div>
                                    <ImageIcon className="h-8 w-8 text-blue-300" />
                                </button>
                            </div>
                            <button type="button" onClick={() => setCaptureStep('form')} className="mt-8 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
                                Preencher manualmente sem documento
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mb-10">
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Adicionar Documento</h3>
                                <p className="mt-3 text-lg text-slate-500 max-w-lg mx-auto">
                                    Anexe o documento da fatura para preenchimento automático inteligente via QR Code e OCR.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto">
                                <button type="button" onClick={() => cameraInputRef.current?.click()} className="group flex flex-col items-center justify-center p-8 rounded-[28px] border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all">
                                    <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <ScanSearch className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-800">Ler QR Code</h4>
                                    <p className="text-sm text-slate-500 mt-2 text-center">Abrir interface para leitura rápida</p>
                                </button>

                                <button type="button" onClick={() => pdfInputRef.current?.click()} className="group flex flex-col items-center justify-center p-8 rounded-[28px] border-2 border-dashed border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 transition-all">
                                    <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <FileText className="h-8 w-8 text-emerald-600" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-800">Carregar PDF</h4>
                                    <p className="text-sm text-slate-500 mt-2 text-center">Ficheiro PDF da fatura</p>
                                </button>

                                <button type="button" onClick={() => imageInputRef.current?.click()} className="group flex flex-col items-center justify-center p-8 rounded-[28px] border-2 border-dashed border-purple-200 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-400 transition-all">
                                    <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <ImageIcon className="h-8 w-8 text-purple-600" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-800">Carregar Imagem</h4>
                                    <p className="text-sm text-slate-500 mt-2 text-center">PNG, JPG, etc.</p>
                                </button>
                            </div>
                            <button type="button" onClick={() => setCaptureStep('form')} className="mt-10 px-6 py-3 rounded-xl font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                Preencher manualmente sem anexar
                            </button>
                        </>
                    )}
                </div>
            )}

            {captureStep === 'preview' && pendingImageSrc && (
                <div className={isMobileLayout ? "flex min-h-[500px] flex-col" : "flex flex-col p-8 min-h-[500px]"}>
                    <div className={`flex items-center justify-between border-b ${isMobileLayout ? 'border-slate-800 px-5 py-4' : 'border-slate-100 pb-4 mb-4'}`}>
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-[0.24em] ${isMobileLayout ? 'text-blue-400' : 'text-blue-600'}`}>Pré-visualização</p>
                            <p className={`mt-1 text-lg font-semibold ${isMobileLayout ? 'text-white' : 'text-slate-800'}`}>Confirme a fotografia antes do upload</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-5 flex items-center justify-center">
                        <div className={`flex min-h-full items-center justify-center rounded-[28px] p-4 w-full ${isMobileLayout ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-200 shadow-inner'}`}>
                            <img src={pendingImageSrc} alt="Pré-visualização da fatura" className="max-h-[50vh] md:max-h-[60vh] w-full rounded-[22px] object-contain" />
                        </div>
                    </div>
                    <div className={`space-y-3 px-5 py-5 border-t ${isMobileLayout ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto w-full mb-4">
                            <button type="button" onClick={handleRotatePreview} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 font-semibold ${isMobileLayout ? 'border border-slate-700 bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                                <RotateCcw className="h-4 w-4" /> Rodar
                            </button>
                            <button type="button" onClick={() => setShowImageCropper(true)} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 font-semibold ${isMobileLayout ? 'border border-slate-700 bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                                <Crop className="h-4 w-4" /> Cortar
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto w-full">
                            <button type="button" onClick={handleRetakePhoto} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 font-semibold ${isMobileLayout ? 'border border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                                <Camera className="h-4 w-4" /> Capturar de novo
                            </button>
                            <button type="button" onClick={confirmPendingMobileImage} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 font-semibold text-white hover:bg-emerald-500 shadow-md">
                                <CheckCircle2 className="h-4 w-4" /> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {captureStep === 'uploading' && (
                <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center py-12">
                    <div className={`w-full max-w-sm rounded-[30px] border px-6 py-8 shadow-2xl ${isMobileLayout ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl ${isMobileLayout ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
                            <ScanSearch className="h-10 w-10 animate-pulse" />
                        </div>
                        <h3 className={`mt-6 text-2xl font-bold ${isMobileLayout ? 'text-white' : 'text-slate-800'}`}>A processar fatura</h3>
                        <p className={`mt-3 text-sm leading-6 ${isMobileLayout ? 'text-slate-300' : 'text-slate-500'}`}>{uploadPhaseLabel || 'A extrair dados com Inteligência Artificial...'}</p>
                        <div className={`mt-8 h-3 overflow-hidden rounded-full ${isMobileLayout ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-300" style={{ width: `${Math.max(5, uploadProgress)}%` }} />
                        </div>
                        <p className={`mt-3 text-sm font-semibold ${isMobileLayout ? 'text-white' : 'text-slate-700'}`}>{uploadProgress}%</p>
                    </div>
                </div>
            )}

            <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                    processSelectedDocument(e.target.files?.[0] ?? null);
                    e.target.value = '';
                }}
                className="hidden"
                disabled={uploading}
            />
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                    processSelectedDocument(e.target.files?.[0] ?? null);
                    e.target.value = '';
                }}
                className="hidden"
                disabled={uploading}
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                    processSelectedDocument(e.target.files?.[0] ?? null);
                    e.target.value = '';
                }}
                className="hidden"
                disabled={uploading}
            />

            {captureStep === 'form' && (
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
                {/* Supplier and Invoice Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Fornecedor *
                        </label>
                        <select
                            value={formData.supplier_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                            className={`w-full bg-slate-50/50 border rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none ${aiFilledFields.has('supplier_id') ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}
                            required
                        >
                            <option value="">Selecionar fornecedor</option>
                            {suppliers.map(supplier => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.nome}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Número da Fatura *
                        </label>
                        <input
                            type="text"
                            value={formData.invoice_number}
                            onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                            className={`w-full bg-slate-50/50 border rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none ${aiFilledFields.has('invoice_number') ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Requisição Associada (Opcional)
                    </label>
                    <select
                        value={formData.requisition_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, requisition_id: e.target.value }))}
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none"
                    >
                        <option value="">Sem associação</option>
                        {requisitionOptions.map(req => (
                            <option key={req.id} value={req.id}>
                                {req.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Data de Emissão *
                        </label>
                        <input
                            type="date"
                            value={formData.issue_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                            className={`w-full bg-slate-50/50 border rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none ${aiFilledFields.has('issue_date') ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Data de Vencimento *
                        </label>
                        <input
                            type="date"
                            value={formData.due_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                            className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none"
                            required
                        />
                    </div>
                </div>

                {/* 1) Invoice Lines */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-bold text-slate-700">Linhas da Fatura</label>
                        <button
                            type="button"
                            onClick={addLine}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                            + Adicionar Linha
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-14 gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider px-1">
                            <span className="col-span-4">Descrição (artigo/serviço)</span>
                            <span className="col-span-1">Qtd</span>
                            <span className="col-span-1">Unid.</span>
                            <span className="col-span-2">Preço Unit. (€)</span>
                            <span className="col-span-1">Desc %</span>
                            <span className="col-span-2">IVA %</span>
                            <span className="col-span-1">IVA (€) manual</span>
                            <span className="col-span-1">Total Linha</span>
                            <span className="col-span-1 text-right">Ação</span>
                        </div>

                        {calculatedLines.map((line, index) => (
                            <div key={index} className="grid grid-cols-14 gap-2">
                                <input
                                    type="text"
                                    value={formData.lines[index]?.description || ''}
                                    onChange={(e) => updateLine(index, 'description', e.target.value)}
                                    placeholder="Ex.: Serviço de manutenção do veículo"
                                    className={`col-span-4 bg-white border rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none ${aiFilledFields.has(`line-${index}`) ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.lines[index]?.quantity ?? 0}
                                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                    className="col-span-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                />
                                <select
                                    value={formData.lines[index]?.unidade_medida || 'UN'}
                                    onChange={(e) => updateLine(index, 'unidade_medida', e.target.value)}
                                    className="col-span-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                >
                                    {allowedUnits.map((unit) => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={formData.lines[index]?.unit_price ?? 0}
                                    onChange={(e) => updateLine(index, 'unit_price', e.target.value)}
                                    className="col-span-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.lines[index]?.discount_percentage ?? 0}
                                    onChange={(e) => updateLine(index, 'discount_percentage', e.target.value)}
                                    className="col-span-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                />
                                <select
                                    value={formData.lines[index]?.iva_rate ?? 23}
                                    onChange={(e) => updateLine(index, 'iva_rate', e.target.value)}
                                    className="col-span-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                >
                                    <option value={23}>23%</option>
                                    <option value={13}>13%</option>
                                    <option value={6}>6%</option>
                                    <option value={0}>0%</option>
                                </select>
                                <input
                                    type="text"
                                    value={manualIvaOverrides[index] ?? line.iva_value}
                                    onChange={(e) => updateManualIva(index, e.target.value)}
                                    className="col-span-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    title="Pode ajustar manualmente o IVA desta linha"
                                />
                                <input
                                    type="text"
                                    value={line.total_value}
                                    readOnly
                                    className="col-span-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-500 text-sm text-right cursor-not-allowed"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeLine(index)}
                                    className="col-span-1 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remover linha"
                                >
                                    <X className="w-4 h-4 mx-auto" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 mt-8">
                    <InvoiceFinancialSummary
                        grossBaseTotal={grossBaseTotal}
                        discountTotal={discountTotal}
                        taxableBase={totalLiquido}
                        totalIva={totalIva}
                        totalFinal={totalFinal}
                    />
                </div>

                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Impacto Financeiro</h3>
                    {invoice ? (
                        financialImpact.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-200/80 font-semibold uppercase tracking-wider text-xs">
                                            <th className="text-left py-2 pr-3">Data</th>
                                            <th className="text-left py-2 pr-3">Conta</th>
                                            <th className="text-left py-2 pr-3">Descrição</th>
                                            <th className="text-right py-2 pr-3">Débito</th>
                                            <th className="text-right py-2 pr-3">Crédito</th>
                                            <th className="text-right py-2">Líquido</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financialImpact.map((movement, index) => (
                                            <tr key={`${movement.account_code}-${index}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/55 transition-colors">
                                                <td className="py-2.5 pr-3 text-slate-600">{new Date(movement.date).toLocaleDateString('pt-PT')}</td>
                                                <td className="py-2.5 pr-3 text-slate-800 font-medium">{movement.account_code}</td>
                                                <td className="py-2.5 pr-3 text-slate-600">{movement.description}</td>
                                                <td className="py-2.5 pr-3 text-right text-red-600 font-semibold">{formatCurrency(Number(movement.debit || 0))}</td>
                                                <td className="py-2.5 pr-3 text-right text-emerald-600 font-semibold">{formatCurrency(Number(movement.credit || 0))}</td>
                                                <td className="py-2.5 text-right text-slate-800 font-semibold">{formatCurrency(Number(movement.amount || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">Nenhum movimento financeiro encontrado para esta fatura.</p>
                        )
                    ) : (
                        <p className="text-sm text-slate-500">O movimento financeiro será gerado automaticamente ao guardar a fatura.</p>
                    )}
                </div>

                {/* 3) Accounting / Payment */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-700">Contabilístico / Pagamento</h3>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Centro de Custo
                        </label>
                        <select
                            value={formData.cost_center_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, cost_center_id: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        >
                            <option value="">Selecionar centro de custo</option>
                            {costCenters.map(cc => (
                                <option key={cc.id} value={cc.id}>
                                    {cc.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Viatura (Opcional)
                            </label>
                            <select
                                value={formData.vehicle_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, vehicle_id: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            >
                                <option value="">Selecionar viatura</option>
                                {vehicles.map(vehicle => (
                                    <option key={vehicle.id} value={vehicle.id}>
                                        {vehicle.matricula} - {vehicle.marca} {vehicle.modelo}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Status de Pagamento
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={formData.payment_status}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        payment_status: e.target.value as SupplierInvoice['payment_status']
                                    }))}
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                >
                                    <option value="pending">Pendente</option>
                                    <option value="scheduled">Agendado</option>
                                    <option value="paid">Pago</option>
                                    <option value="overdue">Vencido</option>
                                </select>
                                <StatusBadge status={formData.payment_status} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Método de Pagamento
                            </label>
                            <select
                                value={formData.payment_method}
                                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            >
                                <option value="">Selecionar método</option>
                                <option value="transfer">Transferência</option>
                                <option value="check">Cheque</option>
                                <option value="card">Cartão</option>
                                <option value="cash">Dinheiro</option>
                                <option value="direct_debit">Débito Direto</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Notas
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                rows={3}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Simplified Document Overview for Form step */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-slate-700">Documento da Fatura</label>
                        <button
                            type="button"
                            onClick={() => setCaptureStep('chooser')}
                            className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Substituir Documento
                        </button>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        {formData.pdf_url ? (
                            <a
                                href={formData.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-blue-600 hover:text-blue-700 font-semibold shadow-sm"
                            >
                                <FileText className="w-4 h-4" />
                                <span className="text-sm">Ver documento guardado</span>
                            </a>
                        ) : (
                            <p className="text-slate-400 text-sm">Nenhum documento anexado.</p>
                        )}
                        
                        {activeImport?.status && (
                            <span className="text-xs text-slate-600 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-medium shadow-sm">
                                Importação: {activeImport.status}
                            </span>
                        )}
                        {activeImport && (
                            <button
                                type="button"
                                onClick={handleReparse}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-xl shadow-sm transition-colors text-sm font-semibold"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reprocessar
                            </button>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors font-semibold text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors font-semibold text-sm"
                    >
                        {invoice ? 'Atualizar' : 'Criar'} Fatura
                    </button>
                </div>
            </form>
            )}

            {showImageCropper && pendingImageSrc && (
                <ImageCropper
                    imageSrc={pendingImageSrc}
                    onCancel={() => setShowImageCropper(false)}
                    onCropComplete={submitPreparedImage}
                />
            )}
        </div>
    );
}