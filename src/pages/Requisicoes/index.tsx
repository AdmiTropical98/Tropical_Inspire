import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, FileText, Trash2, Printer, Package, CheckCircle, RotateCcw,
    LayoutTemplate, List, PlusCircle, TrendingUp, Clock, AlertCircle, Calendar,
    ArrowRight, Box, User, Building, Truck, X, Pencil, Settings2, Mail
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Requisicao, ItemRequisicao } from '../../types';
import { useFinancial } from '../../contexts/FinancialContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageHeader from '../../components/common/PageHeader';
import { ClipboardCheck } from 'lucide-react';
import { emailService } from '../../services/emailService';

export default function Requisicoes() {
    const SENDER_EMAIL = 'frota@tropicalinspire.pt';
    const navigate = useNavigate();
    const { requisicoes, fornecedores, viaturas, clientes, addRequisicao, updateRequisicao, deleteRequisicao, toggleRequisicaoStatus, centrosCustos, syncStockRequisitionsToInventory } = useWorkshop();
    const { supplierInvoices } = useFinancial();
    const { currentUser, userRole } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();
    const [itemEmEdicao, setItemEmEdicao] = useState<ItemRequisicao | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSyncingStock, setIsSyncingStock] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [sendingEmailReqId, setSendingEmailReqId] = useState<string | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showEmailPreview, setShowEmailPreview] = useState(false);
    const [emailModalReqId, setEmailModalReqId] = useState<string | null>(null);
    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');

    // Edit Request State
    const [editingId, setEditingId] = useState<string | null>(null);

    const editarItem = (item: ItemRequisicao) => {
        setItemEmEdicao(item);
        setNewItemDesc(item.descricao);
        setNewItemQtd(item.quantidade);
        setShowEditModal(true);
    };


    // Navigation State
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'create'>('overview');
    const [listFilter, setListFilter] = useState<'pendentes' | 'historico'>('pendentes'); // Sub-filter for List tab
    const [filter, setFilter] = useState('');

    // Form State
    const [data, setData] = useState(new Date().toISOString().split('T')[0]);

    const formatSmallDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const buildSupplierEmailMessage = (requisitionId: string, numero: string, matricula: string, dateStr: string) => {
        const encodedId = encodeURIComponent(requisitionId);
        const confirmUrl = `https://algartempo-frota.com/api/confirmar-requisicao.php?id=${encodedId}`;
        const rejectUrl = `https://algartempo-frota.com/api/recusar-requisicao.php?id=${encodedId}`;
        const commentUrl = `https://algartempo-frota.com/api/comentario-requisicao.php?id=${encodedId}`;

        return [
            '<p>Boa tarde,</p>',
            '<p>Venho por este meio informar que foi criada uma nova requisição de serviço.</p>',
            '<p><strong>Detalhes da Requisição:</strong></p>',
            '<ul>',
            `<li>Número: ${numero}</li>`,
            `<li>Viatura: ${matricula || 'N/A'}</li>`,
            `<li>Data: ${formatSmallDate(dateStr)}</li>`,
            '</ul>',
            '<p><strong>Ação do fornecedor:</strong></p>',
            '<p style="margin: 14px 0;">',
            `<a href="${confirmUrl}" style="background:#28a745;color:white;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;margin-right:8px;">Confirmar Rececao</a>`,
            `<a href="${rejectUrl}" style="background:#dc3545;color:white;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;margin-right:8px;">Recusar Requisicao</a>`,
            `<a href="${commentUrl}" style="background:#007bff;color:white;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Enviar Comentario</a>`,
            '</p>',
            '<p>Se necessitar de mais informações, por favor responda a este email.</p>',
            '<p>Com os melhores cumprimentos,<br>Miguel Madeira<br>Tropical Inspire</p>'
        ].join('\n');
    };

    const getSupplierResponseBadge = (req: Requisicao) => {
        if (req.supplier_confirmed) {
            return {
                label: 'Confirmado pelo fornecedor',
                className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            };
        }

        if (req.supplier_rejected) {
            return {
                label: 'Recusado pelo fornecedor',
                className: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            };
        }

        return {
            label: 'Pendente de confirmacao',
            className: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        };
    };

    const isValidEmail = (value: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }

        return btoa(binary);
    };

    const toDateInputValue = (dateValue?: string) => {
        if (!dateValue) return '';
        // Supabase often returns timestamp strings; date inputs require YYYY-MM-DD.
        const raw = String(dateValue);
        if (raw.includes('T')) return raw.split('T')[0];
        return raw;
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value || 0);

    const getEstimatedValue = (req: Requisicao) => {
        const requisitionItems = Array.isArray(req.itens) ? req.itens : [];
        return requisitionItems.reduce((sum, item) => {
            const lineTotal = Number(item?.valor_total ?? 0);
            if (Number.isFinite(lineTotal) && lineTotal > 0) return sum + lineTotal;

            const quantity = Number(item?.quantidade ?? 0);
            const unitPrice = Number(item?.valor_unitario ?? 0);
            if (Number.isFinite(quantity) && Number.isFinite(unitPrice) && quantity > 0 && unitPrice > 0) {
                return sum + (quantity * unitPrice);
            }

            return sum;
        }, 0);
    };

    const getTargetValue = (req: Requisicao) => {
        const approved = Number(req.approved_value ?? 0);
        if (Number.isFinite(approved) && approved > 0) return approved;
        return getEstimatedValue(req);
    };

    const getErpStatus = (req: Requisicao, totalInvoiced: number): Requisicao['erp_status'] => {
        const targetValue = getTargetValue(req);

        if ((totalInvoiced || 0) <= 0) return 'awaiting_invoice';
        if (targetValue > 0 && totalInvoiced < targetValue) return 'invoiced';
        return 'closed';
    };

    const getErpBadge = (status?: Requisicao['erp_status']) => {
        if (status === 'closed') return { label: 'Closed', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
        if (status === 'invoiced') return { label: 'Invoiced', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
        if (status === 'awaiting_invoice') return { label: 'Awaiting Invoice', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
        return { label: 'Pending', className: 'bg-slate-500/10 text-slate-300 border-slate-500/20' };
    };

    const getPaymentStatusLabel = (status?: string) => {
        if (status === 'paid') return 'Pago';
        if (status === 'scheduled') return 'Agendado';
        if (status === 'overdue') return 'Vencido';
        return 'Pendente';
    };
    const [tipo, setTipo] = useState<Requisicao['tipo']>('Oficina');
    const [clienteId, setClienteId] = useState('');
    const [fornecedorId, setFornecedorId] = useState('');
    const [viaturaId, setViaturaId] = useState('');
    const [centroCustoId, setCentroCustoId] = useState<string | undefined>(undefined);
    const [obs, setObs] = useState('');

    // Items State
    const [items, setItems] = useState<ItemRequisicao[]>([]);
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemQtd, setNewItemQtd] = useState(1);
    const [newItemValorUnitario, setNewItemValorUnitario] = useState<string>('');
    const [newItemValorTotal, setNewItemValorTotal] = useState<string>('');

    // Advanced Search State
    const [searchSupplier, setSearchSupplier] = useState('');
    const [searchVehicle, setSearchVehicle] = useState('');
    const [searchCostCenter, setSearchCostCenter] = useState('');
    const [searchStatus, setSearchStatus] = useState<'all' | 'pendente' | 'concluida'>('all');


    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceNetAmount, setInvoiceNetAmount] = useState('');
    const [invoiceVatRate, setInvoiceVatRate] = useState<number>(0.23); // Default 23%

    // NEW: Multiple Invoices State
    const [invoicesList, setInvoicesList] = useState<{
        numero: string;
        valor_liquido: number;
        iva_taxa: number;
        iva_valor: number;
        valor_total: number;
    }[]>([]);

    // Statistics for Overview
    const stats = {
        pending: requisicoes.filter(r => !r.status || r.status === 'pendente').length,
        completed: requisicoes.filter(r => r.status === 'concluida').length,
        total: requisicoes.length,
        myRequests: requisicoes.filter(r => r.criadoPor === currentUser?.nome).length
    };

    const handleOpenConfirm = (id: string) => {
        setConfirmingId(id);
        setInvoiceNumber('');
        setInvoiceNetAmount('');
        setInvoiceVatRate(0.23);
        setInvoicesList([]); // Reset list
        setShowConfirmModal(true);
    };

    const addInvoiceToList = () => {
        if (!invoiceNumber.trim() || !invoiceNetAmount.trim()) return;
        const net = parseFloat(invoiceNetAmount.replace(',', '.'));
        if (isNaN(net)) return alert('Valor inválido');

        const vatAmount = net * invoiceVatRate;
        const total = net + vatAmount;

        setInvoicesList([...invoicesList, {
            numero: invoiceNumber,
            valor_liquido: net,
            iva_taxa: invoiceVatRate,
            iva_valor: vatAmount,
            valor_total: total
        }]);

        setInvoiceNumber('');
        setInvoiceNetAmount('');
        setInvoiceVatRate(0.23); // Reset to default
    };

    const removeInvoiceFromList = (idx: number) => {
        setInvoicesList(invoicesList.filter((_, i) => i !== idx));
    };

    const handleConfirmRequisition = (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmingId) return;

        // If user filled input but didn't click "Add", try to add it seamlessly if list is empty
        // Or if list is not empty but input has data, maybe warn? 
        // Let's assume: if list is empty, use current input. If list has items, use list.

        let finalInvoices = [...invoicesList];

        if (invoiceNumber.trim() && invoiceNetAmount.trim()) {
            const net = parseFloat(invoiceNetAmount.replace(',', '.'));
            if (!isNaN(net)) {
                const vat = net * invoiceVatRate;
                const total = net + vat;
                finalInvoices.push({
                    numero: invoiceNumber,
                    valor_liquido: net,
                    iva_taxa: invoiceVatRate,
                    iva_valor: vat,
                    valor_total: total
                });
            }
        }

        if (finalInvoices.length === 0) {
            alert(t('req.valid.invoice_required'));
            return;
        }

        toggleRequisicaoStatus(confirmingId, finalInvoices);
        setShowConfirmModal(false);
        setConfirmingId(null);
        setInvoiceNumber('');
        setInvoiceNetAmount('');
        setInvoiceVatRate(0.23);
        setInvoicesList([]);
    };

    const handleEdit = (req: Requisicao) => {
        setEditingId(req.id);
        setData(toDateInputValue(req.data));
        setTipo(req.tipo);
        setClienteId(req.clienteId || '');
        setFornecedorId(req.fornecedorId);
        setViaturaId(req.viaturaId || '');
        setCentroCustoId(req.centroCustoId);
        setObs(req.obs || '');
        setItems(req.itens || []);
        setActiveTab('create');
    };

    const handleReopen = (id: string) => {
        // In this project, reopening means moving back to pending/open workflow.
        toggleRequisicaoStatus(id);
        setOpenMenuId(null);
    };

    const handleEditById = (id: string) => {
        const req = requisicoes.find(r => r.id === id);
        if (!req) return;
        handleEdit(req);
        setOpenMenuId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem a certeza que deseja apagar esta requisição?')) return;
        await deleteRequisicao(id);
        setOpenMenuId(null);
    };

    const closeEmailModal = () => {
        setShowEmailModal(false);
        setShowEmailPreview(false);
        setEmailModalReqId(null);
        setEmailTo('');
        setEmailSubject('');
        setEmailMessage('');
    };

    const handleSendSupplierEmail = (req: Requisicao) => {
        const supplier = fornecedores.find(f => f.id === req.fornecedorId);
        if (!supplier?.email) {
            alert('Fornecedor sem email configurado.');
            return;
        }

        const vehicle = viaturas.find(v => v.id === req.viaturaId);
        setEmailModalReqId(req.id);
        setEmailTo(supplier.email);
        setEmailSubject(`Requisição nº ${req.numero}`);
        setEmailMessage(buildSupplierEmailMessage(req.id, req.numero, vehicle?.matricula || '', req.data));
        setShowEmailPreview(false);
        setShowEmailModal(true);
    };

    const handlePreviewSupplierEmail = () => {
        const recipient = emailTo.trim();
        if (!recipient) {
            alert('Indique o email do destinatário.');
            return;
        }
        if (!isValidEmail(recipient)) {
            alert('Indique um email válido no campo destinatário.');
            return;
        }
        if (!emailSubject.trim()) {
            alert('Indique o assunto.');
            return;
        }
        if (!emailMessage.trim()) {
            alert('Indique a mensagem.');
            return;
        }

        setShowEmailPreview(true);
    };

    const handleConfirmSendSupplierEmail = async () => {
        if (!emailModalReqId) return;

        setSendingEmailReqId(emailModalReqId);
        try {
            const req = requisicoes.find(r => r.id === emailModalReqId);
            if (!req) {
                throw new Error('Requisição não encontrada para anexar PDF.');
            }

            const pdfDoc = await buildRequisitionPdfDocument(req);
            const pdfArrayBuffer = pdfDoc.output('arraybuffer');
            const pdfBase64 = arrayBufferToBase64(pdfArrayBuffer);

            await emailService.sendPlainEmail({
                to: emailTo.trim(),
                subject: emailSubject.trim(),
                message: emailMessage,
                numero: req.numero,
                pdfBase64,
                pdfFileName: `requisicao-${req.numero}.pdf`,
            });
            alert('Email enviado com sucesso.');
            closeEmailModal();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Falha inesperada';
            alert(`Erro ao enviar email: ${message}`);
        } finally {
            setSendingEmailReqId(null);
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setData(new Date().toISOString().split('T')[0]);
        setTipo('Oficina');
        setClienteId('');
        setFornecedorId('');
        setViaturaId('');
        setCentroCustoId(undefined);
        setObs('');
        setItems([]);
        setActiveTab('list');
    };

    const handleManualStockSync = async () => {
        if (isSyncingStock) return;

        setIsSyncingStock(true);
        try {
            const result = await syncStockRequisitionsToInventory();
            if (result.failed > 0) {
                alert(`Sincronização concluída com alertas. Processadas: ${result.processed}, falhadas: ${result.failed}.`);
                return;
            }

            if (result.processed === 0) {
                alert('Não existem requisições Stock pendentes de sincronização.');
                return;
            }

            alert(`Sincronização concluída. Requisições Stock processadas: ${result.processed}.`);
        } catch (error) {
            console.error('Erro ao sincronizar requisições Stock:', error);
            alert('Ocorreu um erro ao sincronizar requisições Stock.');
        } finally {
            setIsSyncingStock(false);
        }
    };

    const totalRequisicao = items.reduce((sum, item) => sum + (item.valor_total || 0), 0);

    const addItem = () => {
        if (!newItemDesc.trim()) return;

        const valorUnitario = newItemValorUnitario ? parseFloat(newItemValorUnitario.replace(',', '.')) : 0;
        const valorTotal = newItemValorTotal ? parseFloat(newItemValorTotal.replace(',', '.')) : (valorUnitario * newItemQtd);

        // 👉 SE ESTIVER A EDITAR
        if (itemEmEdicao) {
            setItems(items.map(i =>
                i.id === itemEmEdicao.id
                    ? {
                        ...i,
                        descricao: newItemDesc,
                        quantidade: newItemQtd,
                        valor_unitario: valorUnitario > 0 ? valorUnitario : undefined,
                        valor_total: valorTotal > 0 ? valorTotal : (valorUnitario * newItemQtd > 0 ? valorUnitario * newItemQtd : undefined)
                    }
                    : i
            ));

            // limpar estado de edição
            setItemEmEdicao(null);
            setNewItemDesc('');
            setNewItemQtd(1);
            setNewItemValorUnitario('');
            setNewItemValorTotal('');
            return;
        }

        // 👉 SE FOR ITEM NOVO
        setItems([
            ...items,
            {
                id: crypto.randomUUID(),
                descricao: newItemDesc,
                quantidade: newItemQtd,
                valor_unitario: valorUnitario > 0 ? valorUnitario : undefined,
                valor_total: valorTotal > 0 ? valorTotal : (valorUnitario * newItemQtd > 0 ? valorUnitario * newItemQtd : undefined)
            }
        ]);

        setNewItemDesc('');
        setNewItemQtd(1);
        setNewItemValorUnitario('');
        setNewItemValorTotal('');
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fornecedorId) return alert('Selecione um fornecedor');
        if (tipo === 'Viatura' && !viaturaId) return alert('Selecione uma viatura');
        if (items.length === 0) return alert('Adicione pelo menos um item');

        const currentYear = new Date().getFullYear().toString().slice(-2);
        const prefix = `${currentYear}/`;

        if (editingId) {
            const updatedReq: Requisicao = {
                ...requisicoes.find(r => r.id === editingId)!,
                data,
                tipo,
                clienteId: clienteId || undefined,
                fornecedorId,
                viaturaId: tipo === 'Viatura' ? viaturaId : undefined,
                centroCustoId: centroCustoId,
                itens: items,
                obs
            };
            updateRequisicao(updatedReq);
            setEditingId(null);
            setActiveTab('list');
            setListFilter('pendentes');
        } else {
            const yearRequisicoes = requisicoes.filter(r => {
                const numStr = String(r.numero || '');
                return numStr.startsWith(prefix);
            });

            const maxSeq = yearRequisicoes.reduce((max, r) => {
                const parts = String(r.numero).split('/');
                if (parts.length === 2) {
                    const seq = parseInt(parts[1], 10);
                    return !isNaN(seq) && seq > max ? seq : max;
                }
                return max;
            }, 0);

            const newReq: Requisicao = {
                id: crypto.randomUUID(),
                numero: `${prefix}${(maxSeq + 1).toString().padStart(4, '0')}`,
                data,
                tipo,
                clienteId: clienteId || undefined,
                fornecedorId,
                viaturaId: tipo === 'Viatura' ? viaturaId : undefined,
                centroCustoId: centroCustoId,
                itens: items,
                obs,
                criadoPor: currentUser?.nome || (userRole === 'admin' ? 'Administrador' : 'Staff')
            };

            addRequisicao(newReq);

            setActiveTab('list');
            setListFilter('pendentes');
        }

        // Reset Form
        setData(new Date().toISOString().split('T')[0]);
        setTipo('Oficina');
        setClienteId('');
        setFornecedorId('');
        setViaturaId('');
        setCentroCustoId(undefined);
        setObs('');
        setItems([]);
    };

    const buildRequisitionPdfDocument = async (req: Requisicao) => {

        console.log("REQ COMPLETO PARA PDF:", req);
        console.log("FATURAS_DADOS:", req.faturas_dados);

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = reject;
            });
        };

        try {
            // Header
            try {
                const logoImg = await loadImage('/logo.png');
                const logoWidth = 50;
                const scaleFactor = logoWidth / logoImg.naturalWidth;
                const logoHeight = logoImg.naturalHeight * scaleFactor;

                doc.setFillColor(20, 60, 140);
                doc.rect(0, 0, pageWidth, 50, 'F');
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(10, 2, logoWidth + 10, logoHeight + 8, 1, 1, 'F');
                doc.addImage(logoImg, 'PNG', 15, 6, logoWidth, logoHeight);
            } catch (e) {
                doc.setFillColor(20, 60, 140);
                doc.rect(0, 0, pageWidth, 50, 'F');
            }

            const textCenter = 145;
            doc.setFontSize(26);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text('ALGARTEMPO', textCenter, 20, { align: 'center' });

            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.setCharSpace(2);
            doc.text('GESTÃO DE FROTA', textCenter, 28, { align: 'center' });
            doc.setCharSpace(0);

            doc.setFontSize(10);
            doc.setTextColor(200, 220, 255);
            doc.text(`DATA DA EMISSÃO: ${new Date().toLocaleDateString()}`, pageWidth - 10, 44, { align: 'right' });

            // Title
            doc.setFontSize(22);
            doc.setTextColor(20, 60, 140);
            doc.setFont('helvetica', 'bold');
            doc.text('REQUISIÇÃO DE MATERIAL', 10, 70);

            let yPos = 85;

            // Details
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('NÚMERO', 10, yPos);
            doc.text('ATRIBUÍDO', 10, yPos + 15);
            doc.text('REQUISITADO POR', 42, yPos + 15);

            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold');
            doc.text(`R:${req.numero}`, 10, yPos + 6);

            const createdBy = req.criadoPor || 'Staff';
            const splitName = createdBy.split(' ')[0] + ' ' + (createdBy.split(' ')[1] || '');
            doc.setFontSize(10);
            doc.text(splitName, 42, yPos + 21);

            doc.setFontSize(10);
            let atribuidoText = '';
            if (req.tipo === 'Viatura') {
                const arr = viaturas.find(v => v.id === req.viaturaId);
                atribuidoText = arr ? `${arr.matricula}` : 'Viatura N/D';
            } else if (req.tipo === 'CentroCusto') {
                atribuidoText = 'Centro de Custos';
            } else if (req.tipo === 'Oficina') {
                atribuidoText = 'Oficina';
            } else if (req.tipo === 'Stock') {
                atribuidoText = 'Stock';
            } else {
                atribuidoText = req.tipo;
            }
            doc.text(atribuidoText, 10, yPos + 21);

            const col2X = 85;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            const contextLabel = req.tipo === 'Viatura' ? 'VIATURA' : 'DESTINO';
            doc.text(contextLabel, col2X, yPos);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(0);

            if (req.tipo === 'Viatura') {
                const viatura = viaturas.find(v => v.id === req.viaturaId);
                if (viatura) {
                    doc.text(`${viatura.marca} ${viatura.modelo}`, col2X, yPos + 6);
                    doc.setFontSize(10);
                    doc.setTextColor(80);
                    doc.text(viatura.matricula, col2X, yPos + 11);
                } else {
                    doc.text('---', col2X, yPos + 6);
                }
            } else {
                if (req.tipo === 'Oficina') doc.text('Uso Interno', col2X, yPos + 6);
                else if (req.tipo === 'Stock') doc.text('Reposição', col2X, yPos + 6);
                else doc.text('---', col2X, yPos + 6);
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('CENTRO DE CUSTOS', col2X, yPos + 15);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0);

            if (req.centroCustoId) {
                const cc = centrosCustos.find(c => c.id === req.centroCustoId);
                doc.text(cc?.nome || 'N/D', col2X, yPos + 21);
            } else {
                doc.setTextColor(150);
                doc.text('---', col2X, yPos + 21);
            }

            const col3X = 145;
            const fornecedor = fornecedores.find(f => f.id === req.fornecedorId);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('FORNECEDOR', col3X, yPos);

            if (fornecedor) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(0);
                doc.text(fornecedor.nome, col3X, yPos + 6);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(80);

                let supplierY = yPos + 11;

                if (fornecedor.nif) {
                    doc.text(`NIF: ${fornecedor.nif}`, col3X, supplierY);
                    supplierY += 4;
                }
                if (fornecedor.contacto) {
                    doc.text(`Tel: ${fornecedor.contacto}`, col3X, supplierY);
                }
            } else {
                doc.text('Não Identificado', col3X, yPos + 6);
            }

            // ======================================================
            // INVOICE SECTION (MOSTRA APENAS SE CONCLUÍDA)
            // ======================================================

            yPos += 35;

            // 🔐 Só mostra se estiver concluída
            if (req.status === 'concluida') {

                type InvoiceDisplay = {
                    numero: string;
                    valor_liquido: number;
                    iva_taxa: number;
                    iva_valor?: number;
                    valor_total: number;
                    isLegacy?: boolean;
                };

                let displayInvoices: InvoiceDisplay[] = [];

                // 🔥 Parse Supabase (string ou array)
                if (req.faturas_dados) {
                    try {
                        const parsed =
                            typeof req.faturas_dados === 'string'
                                ? JSON.parse(req.faturas_dados)
                                : req.faturas_dados;

                        if (Array.isArray(parsed)) {
                            displayInvoices = parsed as InvoiceDisplay[];
                        }
                    } catch (e) {
                        console.error('Erro a fazer parse das faturas:', e);
                    }
                }

                // 🧯 Campo legado (APENAS SE NÃO TIVER DADOS ESTRUTURADOS)
                if (displayInvoices.length === 0 && req.fatura) {
                    // Tenta separar por vírgula (sem barra, pois pode fazer parte do número)
                    const parts = req.fatura.split(',').map(s => s.trim()).filter(Boolean);

                    if (parts.length > 0) {
                        const total = req.custo || 0;
                        const count = parts.length;
                        const baseSlice = Math.floor((total / count) * 100) / 100;
                        const remainder = Number((total - (baseSlice * count)).toFixed(2));

                        // Se encontrou separadores, cria várias linhas
                        displayInvoices = parts.map((num, index) => {
                            const valTotal = index === 0 ? baseSlice + remainder : baseSlice;
                            // Assume 23% for legacy/missing data so it doesn't look broken
                            const valNet = valTotal / 1.23;
                            const valIva = valTotal - valNet;

                            return {
                                numero: num,
                                valor_liquido: valNet,
                                iva_taxa: 0.23,
                                iva_valor: valIva,
                                valor_total: valTotal,
                                isLegacy: true
                            };
                        });
                    } else {
                        // Caso contrário, mantém comportamento anterior (mas calcula reverse também)
                        const valTotal = req.custo || 0;
                        const valNet = valTotal / 1.23;
                        const valIva = valTotal - valNet;

                        displayInvoices = [{
                            numero: req.fatura,
                            valor_liquido: valNet,
                            iva_taxa: 0.23,
                            iva_valor: valIva,
                            valor_total: valTotal,
                            isLegacy: true
                        }];
                    }
                }

                if (displayInvoices.length > 0) {
                    // Cálculo do Total Geral
                    const grandTotal = displayInvoices.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                    // 🧪 DEBUG OBRIGATÓRIO
                    console.log("DISPLAY INVOICES FINAL:", displayInvoices);

                    autoTable(doc, {
                        startY: yPos,
                        head: [['FATURA', 'VALOR LÍQUIDO', 'VALOR IVA', 'VALOR COM IVA']],
                        body: displayInvoices.map(f => {
                            // Helper to safely get values from potentially different field names
                            const getVal = (obj: any, keys: string[]) => {
                                if (!obj) return 0;
                                for (const key of keys) {
                                    const val = obj[key];
                                    if (val !== undefined && val !== null && val !== '') {
                                        const num = Number(val);
                                        if (!isNaN(num)) return num;
                                    }
                                }
                                return 0;
                            };

                            console.log("Processing invoice row for PDF:", f);

                            let base = getVal(f, ['valor_liquido', 'valorLiquido', 'net', 'Net', 'value', 'Value', 'base']);
                            let iva = getVal(f, ['iva_valor', 'ivaValor', 'tax', 'Tax', 'iva', 'Iva']);
                            const total = getVal(f, ['valor_total', 'valorTotal', 'total', 'Total', 'gross', 'Gross']);

                            // 🚑 EMERGENCY FIX: If Net/VAT are 0 but Total exists, calculate them (Assume 23%)
                            // This fixes records that were saved with 0s
                            if ((base === 0 && total > 0) || (iva === 0 && total > 0)) {
                                base = total / 1.23;
                                iva = total - base;
                            }

                            return [
                                f.numero,
                                `${base.toFixed(2)} €`,
                                `${iva.toFixed(2)} €`,
                                `${total.toFixed(2)} €`
                            ];
                        }),
                        foot: [[
                            { content: 'TOTAL GERAL:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0, fillColor: [255, 255, 255] } },
                            { content: `${grandTotal.toFixed(2)}€`, styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0, fillColor: [255, 255, 255] } }
                        ]],
                        theme: 'grid',
                        margin: { left: 10, right: 10 },
                        headStyles: { fillColor: [20, 60, 140], textColor: 255, fontStyle: 'bold', lineWidth: 0.1 },
                        styles: { fontSize: 8, textColor: 0, lineWidth: 0.1 },
                        columnStyles: {
                            0: { fontStyle: 'bold' },
                            1: { halign: 'right' },
                            2: { halign: 'right' },
                            3: { halign: 'right', fontStyle: 'bold' }
                        },
                        footStyles: {
                            fillColor: [255, 255, 255],
                            textColor: 0,
                            fontStyle: 'bold',
                            halign: 'right',
                            lineColor: [255, 255, 255],
                            lineWidth: 0
                        }
                    });

                    yPos = (doc as any).lastAutoTable.finalY + 15;
                }
            }

            const tableBody = req.itens.map(item => [
                item.descricao.toUpperCase(),
                item.quantidade.toString()
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['DESCRIÇÃO DO MATERIAL', 'QTD.']],
                body: tableBody,
                theme: 'grid',
                margin: { left: 10, right: 10 },
                headStyles: {
                    fillColor: [20, 60, 140],
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'left',
                    cellPadding: 4,
                    lineWidth: 0.1,
                    lineColor: [20, 60, 140]
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 4,
                    textColor: [40, 40, 40],
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1
                },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245]
                }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 15;
            let currentY = finalY;

            if (req.obs) {
                const textWidth = pageWidth - 24;
                const splitObs = doc.splitTextToSize(req.obs, textWidth);
                const obsHeight = splitObs.length * 5 + 10; // 5 pt per line approx + padding

                // Check if obs fits on page
                if (currentY + obsHeight + 20 > pageHeight - 20) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setDrawColor(200);
                doc.setLineWidth(0.1);
                doc.rect(10, currentY, pageWidth - 20, obsHeight + 10);

                doc.setFontSize(8);
                doc.setTextColor(120);
                doc.setFont('helvetica', 'bold');
                doc.text('OBSERVAÇÕES', 12, currentY + 5);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0);
                doc.text(splitObs, 12, currentY + 12);

                currentY += obsHeight + 15;
            }

            // Signature Section - Dynamic Positioning
            // Ensure there is space for signatures (approx 30 units height)
            if (currentY + 40 > pageHeight - 20) {
                doc.addPage();
                currentY = 40; // Start a bit lower on new page
            } else {
                // Push to bottom if plenty of space, otherwise just below content
                // But don't force it to 270 if content is already past that or close to it
                if (currentY < 250) {
                    currentY = 270;
                } else {
                    currentY += 10; // Add some padding if we are flowing naturally
                }
            }

            const signY = currentY;
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);

            doc.line(10, signY, 80, signY);
            doc.setFontSize(9);
            doc.text('O Responsável', 10, signY + 5);

            doc.line(130, signY, pageWidth - 10, signY);
            doc.text('A Gerência', 130, signY + 5);

            return doc;

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            throw error;
        }
    };

    const generatePDF = async (req: Requisicao) => {
        try {
            const doc = await buildRequisitionPdfDocument(req);
            doc.save(`Requisicao_${req.numero}.pdf`);
        } catch (error) {
            alert('Erro ao gerar PDF.');
        }
    };


    const filteredItems = requisicoes.filter(r => {
        const matchesTab = listFilter === 'pendentes'
            ? (!r.status || r.status === 'pendente')
            : r.status === 'concluida';

        const sTerm = filter.toLowerCase();
        const sSupplier = searchSupplier.toLowerCase();
        const sVehicle = searchVehicle.toLowerCase();
        const sCostCenter = searchCostCenter.toLowerCase();

        const fornecedor = fornecedores.find(f => f.id === r.fornecedorId);
        const viatura = viaturas.find(v => v.id === r.viaturaId);
        const centroCusto = centrosCustos.find(cc => cc.id === r.centroCustoId);

        const matchGeneral = filter === '' ||
            (r.numero && r.numero.toLowerCase().includes(sTerm)) ||
            (fornecedor?.nome && fornecedor.nome.toLowerCase().includes(sTerm)) ||
            (viatura?.matricula && viatura.matricula.toLowerCase().includes(sTerm));

        const matchSupplier = searchSupplier === '' || (fornecedor?.nome && fornecedor.nome.toLowerCase().includes(sSupplier));
        const matchVehicle = searchVehicle === '' || (viatura?.matricula && viatura.matricula.toLowerCase().includes(sVehicle));
        const matchCostCenter = searchCostCenter === '' || (centroCusto?.nome && centroCusto.nome.toLowerCase().includes(sCostCenter));
        const matchStatusSearch = searchStatus === 'all' || r.status === searchStatus;

        return matchesTab && matchGeneral && matchSupplier && matchVehicle && matchCostCenter && matchStatusSearch;
    }).sort((a, b) => {
        const numA = (a.numero || '').split('/')[1] || '0';
        const numB = (b.numero || '').split('/')[1] || '0';
        return parseInt(numB) - parseInt(numA);
    });

    return (
        <div className="w-full min-w-0 space-y-6 animate-in fade-in duration-500">
            <PageHeader
                title={t('req.title')}
                subtitle={t('req.subtitle')}
                icon={ClipboardCheck}
            >
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 backdrop-blur-md shadow-lg overflow-x-auto max-w-full scrollbar-none">
                        {[
                            { id: 'overview', icon: LayoutTemplate, label: 'Geral' },
                            { id: 'list', icon: List, label: 'Lista' },
                            { id: 'create', icon: PlusCircle, label: 'Nova' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-3 md:px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap text-sm
                            ${activeTab === tab.id
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {hasAccess(userRole, 'requisicoes_edit') && (
                        <button
                            type="button"
                            onClick={handleManualStockSync}
                            disabled={isSyncingStock}
                            className="px-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 w-fit"
                            title="Sincronizar requisições Stock para Stock de Peças"
                        >
                            <RotateCcw className={`w-4 h-4 ${isSyncingStock ? 'animate-spin' : ''}`} />
                            {isSyncingStock ? 'A sincronizar...' : 'Sincronizar Stock'}
                        </button>
                    )}
                </div>
            </PageHeader>

            <div className="p-4 md:p-8 space-y-8">

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Content ... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div
                                className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-6 rounded-[2rem] relative overflow-hidden group hover:border-amber-500/40 transition-all cursor-pointer"
                                onClick={() => { setActiveTab('list'); setListFilter('pendentes'); }}
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Clock className="w-24 h-24 text-amber-500" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-amber-200/60 text-xs font-bold uppercase tracking-wider mb-2">Pendentes</h3>
                                    <p className="text-4xl font-black text-white mb-4">{stats.pending}</p>
                                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold px-3 py-1.5 bg-amber-500/10 w-fit rounded-lg border border-amber-500/20">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        A aguardar aprovação
                                    </div>
                                </div>
                            </div>

                            <div
                                className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-6 rounded-[2rem] relative overflow-hidden group hover:border-emerald-500/40 transition-all cursor-pointer"
                                onClick={() => { setActiveTab('list'); setListFilter('historico'); }}
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <CheckCircle className="w-24 h-24 text-emerald-500" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-emerald-200/60 text-xs font-bold uppercase tracking-wider mb-2">Concluídas</h3>
                                    <p className="text-4xl font-black text-white mb-4">{stats.completed}</p>
                                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold px-3 py-1.5 bg-emerald-500/10 w-fit rounded-lg border border-emerald-500/20">
                                        <TrendingUp className="w-3.5 h-3.5" />
                                        Processadas com sucesso
                                    </div>
                                </div>
                            </div>

                            <div
                                className="bg-gradient-to-br from-blue-500/10 to-indigo-600/5 border border-blue-500/20 p-6 rounded-[2rem] relative overflow-hidden group hover:border-blue-500/40 transition-all cursor-pointer"
                                onClick={() => { setActiveTab('list'); }}
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Package className="w-24 h-24 text-blue-500" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-blue-200/60 text-xs font-bold uppercase tracking-wider mb-2">Total</h3>
                                    <p className="text-4xl font-black text-white mb-4">{stats.total}</p>
                                    <div className="flex items-center gap-2 text-blue-300 text-xs font-bold px-3 py-1.5 bg-blue-500/10 w-fit rounded-lg border border-blue-500/20">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Requisições criadas
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex flex-col justify-center gap-4 relative overflow-hidden">
                                <div className="absolute inset-0 bg-blue-500/5 opacity-50"></div>
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className="relative w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-md font-bold shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3 group active:scale-95"
                                >
                                    <div className="bg-white/20 p-1 rounded-lg">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    Criar Nova
                                    <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                                <button
                                    onClick={() => { setActiveTab('list'); setListFilter('pendentes'); }}
                                    className="relative w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl text-md font-bold border border-slate-700 hover:border-slate-600 transition-all active:scale-95"
                                >
                                    Ver Pendentes
                                </button>
                            </div>
                        </div>

                        {/* Dashboard Chart & Recent Requisitions */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 relative overflow-hidden">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">Volume de Requisições</h3>
                                        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            Últimos meses
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold text-blue-400">
                                        Auto-Gerado
                                    </div>
                                </div>

                                <div className="flex items-end justify-between gap-4 h-48 mt-4">
                                    {[45, 60, 35, 80, 55, 70, 90].map((height, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                            <div className="w-full relative">
                                                <div
                                                    style={{ height: `${height}%` }}
                                                    className="w-full bg-gradient-to-t from-blue-600 to-indigo-400 rounded-t-xl opacity-40 group-hover:opacity-100 transition-all duration-500 shadow-lg shadow-blue-900/20"
                                                ></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600 group-hover:text-blue-400 transition-colors uppercase">Mês {i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-white">Recentes</h3>
                                    <button
                                        onClick={() => setActiveTab('list')}
                                        className="text-blue-400 text-xs font-bold hover:text-blue-300 transition-colors"
                                    >
                                        Ver Todas
                                    </button>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {requisicoes.slice(0, 4).map(req => (
                                        <div
                                            key={req.id}
                                            className="flex items-center gap-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 hover:border-slate-700 transition-colors cursor-pointer group"
                                            onClick={() => handleEdit(req)}
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-blue-400 group-hover:border-blue-500/30 transition-colors">
                                                R:{req.numero?.split('/')[1]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">
                                                    {fornecedores.find(f => f.id === req.fornecedorId)?.nome || 'Fornecedor'}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                    {formatSmallDate(req.data)}
                                                </p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-700 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* List Tab */}
                {activeTab === 'list' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                        {/* Toolbar */}
                        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center bg-slate-900/50 p-4 rounded-[2rem] border border-slate-800 backdrop-blur-md">
                            <div className="flex-1 flex flex-col md:flex-row gap-4 w-full">
                                <div className="relative flex-1 group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Pesquisar por número, fornecedor..."
                                        className="block w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl leading-5 text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 sm:text-sm transition-all shadow-inner"
                                        value={filter}
                                        onChange={e => setFilter(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={() => {
                                        setSearchSupplier('');
                                        setSearchVehicle('');
                                        setSearchCostCenter('');
                                        setSearchStatus('all');
                                        setFilter('');
                                    }}
                                    className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl border border-slate-700 transition-all flex items-center justify-center"
                                    title="Limpar filtros"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Advanced Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-900/30 p-4 rounded-3xl border border-slate-800/50">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Fornecedor</label>
                                <input
                                    type="text"
                                    placeholder="Filtrar fornecedor..."
                                    value={searchSupplier}
                                    onChange={e => setSearchSupplier(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Matrícula</label>
                                <input
                                    type="text"
                                    placeholder="Filtrar veículo..."
                                    value={searchVehicle}
                                    onChange={e => setSearchVehicle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Centro de Custo</label>
                                <input
                                    type="text"
                                    placeholder="Filtrar CC..."
                                    value={searchCostCenter}
                                    onChange={e => setSearchCostCenter(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Estado</label>
                                <select
                                    value={searchStatus}
                                    onChange={e => setSearchStatus(e.target.value as any)}
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                >
                                    <option value="all">Todos os Estados</option>
                                    <option value="pendente">Pendentes</option>
                                    <option value="concluida">Concluídas</option>
                                </select>
                            </div>
                        </div>


                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 gap-4">
                            {filteredItems.map(req => {
                                const fornecedor = fornecedores.find(f => f.id === req.fornecedorId);
                                const viatura = viaturas.find(v => v.id === req.viaturaId);
                                const associatedInvoices = supplierInvoices
                                    .filter(invoice => invoice.requisition_id === req.id)
                                    .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime());
                                const totalInvoicedAmount = associatedInvoices.reduce((sum, invoice) => {
                                    return sum + Number(invoice.total_final ?? invoice.total ?? invoice.total_value ?? 0);
                                }, 0);
                                const erpStatus = req.erp_status || getErpStatus(req, totalInvoicedAmount);
                                const erpBadge = getErpBadge(erpStatus);
                                const supplierBadge = getSupplierResponseBadge(req);

                                return (
                                    <div key={req.id} className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/70 rounded-3xl p-6 hover:border-blue-500/30 transition-all hover:bg-slate-800/40 group relative overflow-visible">
                                        {/* decorative blob */}
                                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>
                                        <div className={`absolute left-0 top-0 h-full w-1.5 ${req.status === 'concluida' ? 'bg-emerald-500/70' : 'bg-amber-500/70'}`} />

                                        <div className="flex flex-col lg:flex-row gap-6 relative z-10">
                                            {/* Left Info */}
                                            <div className="flex-1 min-w-0 space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <span className="h-10 px-4 inline-flex items-center rounded-xl border border-slate-700 bg-slate-950 text-sm font-mono font-bold text-blue-300">
                                                            R:{req.numero?.split('/')[1]}
                                                        </span>
                                                        <span className={`h-10 px-4 inline-flex items-center rounded-xl text-xs font-bold uppercase tracking-wider border
                                                            ${req.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}
                                                        `}>
                                                            {req.status === 'concluida' ? 'Concluída' : 'Pendente'}
                                                        </span>
                                                        <span className={`h-10 px-4 inline-flex items-center rounded-xl text-xs font-bold uppercase tracking-wide border gap-1.5
                                                            ${req.tipo === 'Oficina' ? 'bg-slate-800 border-slate-700 text-slate-300' : ''}
                                                            ${req.tipo === 'Stock' ? 'bg-purple-900/30 border-purple-500/30 text-purple-400' : ''}
                                                            ${req.tipo === 'Viatura' ? 'bg-indigo-900/30 border-indigo-500/30 text-indigo-400' : ''}
                                                        `}>
                                                            {req.tipo === 'Oficina' && <Building className="w-3 h-3" />}
                                                            {req.tipo === 'Stock' && <Box className="w-3 h-3" />}
                                                            {req.tipo === 'Viatura' && <Truck className="w-3 h-3" />}
                                                            {req.tipo}
                                                        </span>
                                                    </div>

                                                    <span className="h-10 px-4 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 text-sm text-slate-300">
                                                        <Calendar className="w-4 h-4 text-slate-400" />
                                                        {formatSmallDate(req.data)}
                                                    </span>
                                                </div>

                                                <div>
                                                    <h3 className="font-bold text-white text-xl leading-snug">{fornecedor?.nome || t('req.card.unknown_supplier')}</h3>
                                                    {viatura && (
                                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-indigo-300 font-medium">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                            {viatura.matricula} - {viatura.marca} {viatura.modelo}
                                                            <button
                                                                onClick={() => navigate(`/viaturas/${viatura.id}`)}
                                                                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20 transition-colors text-[11px]"
                                                                title="Abrir perfil da viatura"
                                                            >
                                                                Perfil <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                                                    <span className="h-9 flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                                                        <Package className="w-4 h-4 text-slate-500" />
                                                        <span className="text-white font-bold">{(req.itens || []).length}</span> itens
                                                    </span>
                                                    <span className="h-9 flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                                                        <User className="w-4 h-4 text-slate-500" />
                                                        <span className="text-slate-300">{req.criadoPor?.split(' ')[0] || 'Staff'}</span>
                                                    </span>
                                                    <span className={`h-9 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${erpBadge.className}`}>
                                                        <TrendingUp className="w-4 h-4" />
                                                        <span className="font-semibold">{erpBadge.label}</span>
                                                    </span>
                                                    <span className={`h-9 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${supplierBadge.className}`}>
                                                        <ClipboardCheck className="w-4 h-4" />
                                                        <span className="font-semibold">{supplierBadge.label}</span>
                                                    </span>
                                                </div>

                                                {req.supplier_response_date && (
                                                    <p className="text-xs text-slate-400">
                                                        Resposta do fornecedor em {formatSmallDate(req.supplier_response_date)}
                                                    </p>
                                                )}

                                                {req.supplier_comment && (
                                                    <p className="text-sm text-slate-300 bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2">
                                                        Comentario fornecedor: {req.supplier_comment}
                                                    </p>
                                                )}

                                                <div className="mt-2 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                                            <FileText className="w-4 h-4 text-slate-400" />
                                                            Faturas associadas
                                                        </h4>
                                                        <span className="text-xs text-slate-400">
                                                            Total faturado: <span className="text-white font-semibold">{formatCurrency(totalInvoicedAmount)}</span>
                                                        </span>
                                                    </div>

                                                    {associatedInvoices.length === 0 ? (
                                                        <p className="text-xs text-slate-500">Sem faturas associadas.</p>
                                                    ) : (
                                                        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-slate-950/70">
                                                                    <tr className="text-slate-400 border-b border-slate-800">
                                                                        <th className="text-left py-2.5 px-3 font-semibold">Nº Fatura</th>
                                                                        <th className="text-left py-2.5 px-3 font-semibold">Data</th>
                                                                        <th className="text-right py-2.5 px-3 font-semibold">Total</th>
                                                                        <th className="text-left py-2.5 px-3 font-semibold">Estado</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {associatedInvoices.map(invoice => (
                                                                        <tr key={invoice.id} className="border-b border-slate-900/80 last:border-0 hover:bg-slate-900/40">
                                                                            <td className="py-2.5 px-3 text-slate-200 font-medium">{invoice.invoice_number}</td>
                                                                            <td className="py-2.5 px-3 text-slate-300">{formatSmallDate(invoice.issue_date)}</td>
                                                                            <td className="py-2.5 px-3 text-right text-slate-200">{formatCurrency(Number(invoice.total_final ?? invoice.total ?? invoice.total_value ?? 0))}</td>
                                                                            <td className="py-2.5 px-3 text-slate-300">{getPaymentStatusLabel(invoice.payment_status)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Actions */}
                                            <div className="flex lg:flex-col lg:items-end justify-between items-center gap-3 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6 min-w-[180px]">
                                                {req.fatura && (
                                                    <div className="flex items-center gap-2 bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/20 mb-auto">
                                                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                                        <span className="text-xs text-emerald-400 font-mono font-bold">{req.fatura}</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 mt-auto">
                                                    <button
                                                        onClick={() => navigate(`/finance/faturas/nova?requisitionId=${req.id}`)}
                                                        className="flex items-center gap-2 px-3 py-3 text-indigo-300 bg-indigo-900/20 hover:bg-indigo-800/40 hover:text-white border border-indigo-500/20 rounded-xl transition-colors"
                                                        title="Criar fatura a partir desta requisição"
                                                    >
                                                        <PlusCircle className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Create Invoice from Requisition</span>
                                                    </button>

                                                    <button
                                                        onClick={() => generatePDF(req)}
                                                        className="p-3 text-blue-300 bg-blue-900/20 hover:bg-blue-800/40 hover:text-white border border-blue-500/20 rounded-xl transition-colors"
                                                        title="Imprimir PDF"
                                                    >
                                                        <Printer className="w-5 h-5" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleSendSupplierEmail(req)}
                                                        disabled={sendingEmailReqId === req.id}
                                                        className="flex items-center gap-2 px-3 py-3 text-cyan-300 bg-cyan-900/20 hover:bg-cyan-800/40 hover:text-white border border-cyan-500/20 rounded-xl transition-colors disabled:opacity-60"
                                                        title="Enviar por Email"
                                                    >
                                                        <Mail className="w-5 h-5" />
                                                        <span className="text-sm font-medium">Enviar Email</span>
                                                    </button>

                                                    {hasAccess(userRole, 'requisicoes_edit') && (
                                                        <div className="flex items-center gap-2">
                                                            {req.status !== 'concluida' ? (
                                                                <button
                                                                    onClick={() => handleOpenConfirm(req.id)}
                                                                    className="flex items-center justify-center px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all border border-emerald-500/20 shadow-lg shadow-emerald-900/20 hover:scale-105 active:scale-95 gap-2"
                                                                >
                                                                    <CheckCircle className="w-5 h-5" />
                                                                    Concluir
                                                                </button>
                                                            ) : (
                                                                <div className="relative overflow-visible">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setOpenMenuId(prev => prev === req.id ? null : req.id)}
                                                                        className="p-3 text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                                                                    >
                                                                        <Clock className="w-5 h-5" />
                                                                    </button>
                                                                    {openMenuId === req.id && (
                                                                    <div className="absolute bottom-full mb-2 right-0 z-[9999] w-44 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-lg p-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleReopen(req.id)}
                                                                            className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-amber-500 hover:bg-slate-800 rounded-md transition-colors"
                                                                        >
                                                                            <RotateCcw className="w-4 h-4" />
                                                                            Reabrir
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleEditById(req.id)}
                                                                            className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 rounded-md transition-colors"
                                                                        >
                                                                            <Pencil className="w-4 h-4" />
                                                                            Editar
                                                                        </button>
                                                                        {hasAccess(userRole, 'requisicoes_delete') && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDelete(req.id)}
                                                                                className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-md transition-colors"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                                Apagar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {req.status !== 'concluida' && (
                                                                <div className="relative overflow-visible">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setOpenMenuId(prev => prev === req.id ? null : req.id)}
                                                                        className="p-3 text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                                                                    >
                                                                        <Settings2 className="w-5 h-5" />
                                                                    </button>
                                                                    {openMenuId === req.id && (
                                                                    <div className="absolute bottom-full mb-2 right-0 z-[9999] w-44 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-lg p-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleEditById(req.id)}
                                                                            className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 rounded-md transition-colors"
                                                                        >
                                                                            <Pencil className="w-4 h-4" />
                                                                            Editar
                                                                        </button>
                                                                        {hasAccess(userRole, 'requisicoes_delete') && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDelete(req.id)}
                                                                                className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-md transition-colors"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                                Apagar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {filteredItems.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 bg-slate-900/20 rounded-[2rem] border border-dashed border-slate-700">
                                <div className="bg-slate-800 p-6 rounded-full mb-6 shadow-inner">
                                    <Search className="w-12 h-12 text-slate-600" />
                                </div>
                                <h3 className="text-slate-400 text-lg font-medium">Nenhuma requisição encontrada.</h3>
                                {listFilter === 'pendentes' && (
                                    <button onClick={() => setActiveTab('create')} className="mt-4 text-blue-400 hover:text-blue-300 font-bold text-sm tracking-wide uppercase border-b border-transparent hover:border-blue-300 transition-all">
                                        Criar nova requisição
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Create Tab */}
                {activeTab === 'create' && (
                    <div className="w-full min-w-0 animate-in slide-in-from-bottom-8 fade-in pb-10">
                        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-700/50 shadow-2xl relative">
                            {/* Decorative Glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>

                            <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-800">
                                <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-900/20 rotate-3">
                                    <PlusCircle className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight">
                                        {editingId ? 'Editar Requisição' : t('req.form.title')}
                                        <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">v2.2</span>
                                    </h2>
                                    <p className="text-slate-400 text-md">{editingId ? 'Atualize os dados da requisição.' : 'Preencha os dados para processar o pedido de material.'}</p>
                                </div>
                            </div>

                            {editingId && (
                                <div className="absolute top-8 right-8">
                                    <button
                                        onClick={cancelEdit}
                                        className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all font-bold text-sm"
                                    >
                                        Cancelar Edição
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* Form Fields Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('req.form.date')}</label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                            <input
                                                type="date"
                                                required
                                                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all font-medium shadow-sm"
                                                value={data}
                                                onChange={e => setData(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('req.form.type')}</label>
                                        <div className="relative group">
                                            <LayoutTemplate className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                            <select
                                                value={tipo}
                                                onChange={(e) => {
                                                    const val = e.target.value as Requisicao['tipo'];
                                                    setTipo(val);
                                                    setViaturaId('');
                                                }}
                                                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all appearance-none font-medium shadow-sm"
                                            >
                                                <option value="Oficina">Oficina (Geral)</option>
                                                <option value="Stock">Stock (Armazém)</option>
                                                <option value="Viatura">Viatura</option>
                                            </select>
                                        </div>
                                    </div>

                                    {tipo === 'Viatura' && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('req.form.vehicle')}</label>
                                            <div className="relative group">
                                                <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                                <select
                                                    required
                                                    value={viaturaId}
                                                    onChange={(e) => setViaturaId(e.target.value)}
                                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all font-medium shadow-sm"
                                                >
                                                    <option value="">{t('req.form.vehicle_select')}</option>
                                                    {viaturas.map(v => (
                                                        <option key={v.id} value={v.id}>
                                                            {v.matricula} - {v.marca} {v.modelo}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Cliente (Opcional)</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                            <select
                                                value={clienteId}
                                                onChange={(e) => setClienteId(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all appearance-none font-medium shadow-sm"
                                            >
                                                <option value="">Nenhum / Custo interno</option>
                                                {(() => {
                                                    const sorted = [...clientes].sort((a, b) => {
                                                        const rank = (name: string) => {
                                                            const n = name.toLowerCase();
                                                            if (n.includes('algartempo')) return 0;
                                                            if (n.includes('stratego')) return 1;
                                                            return 2;
                                                        };
                                                        return rank(a.nome) - rank(b.nome) || a.nome.localeCompare(b.nome, 'pt');
                                                    });
                                                    return sorted.map(c => (
                                                        <option key={c.id} value={c.id}>{c.nome}</option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Centro de Custos</label>
                                        <div className="relative group">
                                            <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                            <select
                                                value={centroCustoId || ''}
                                                onChange={(e) => setCentroCustoId(e.target.value || undefined)}
                                                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all font-medium shadow-sm"
                                            >
                                                <option value="">Selecione... (Opcional)</option>
                                                {centrosCustos.map(cc => (
                                                    <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{t('req.form.supplier')}</label>
                                        <div className="relative group">
                                            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                            <select
                                                required
                                                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all font-medium shadow-sm"
                                                value={fornecedorId}
                                                onChange={e => setFornecedorId(e.target.value)}
                                            >
                                                <option value="">{t('req.form.supplier_select')}</option>
                                                {fornecedores.map(f => (
                                                    <option key={f.id} value={f.id}>{f.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Section */}
                                <div className="bg-slate-950/30 rounded-3xl p-6 border border-slate-800/50">
                                    <label className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider mb-4">
                                        <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                                            <List className="w-4 h-4 text-blue-400" />
                                        </div>
                                        {t('req.form.items')}
                                    </label>

                                    <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-inner mb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-end">
                                            <div className="md:col-span-12 xl:col-span-4 space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descrição</label>
                                                <input
                                                    placeholder={t('req.form.desc_placeholder')}
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all placeholder-slate-600 shadow-sm"
                                                    value={newItemDesc}
                                                    onChange={e => setNewItemDesc(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addItem();
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="md:col-span-4 xl:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qtd</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all font-mono text-center shadow-sm"
                                                    value={newItemQtd}
                                                    onChange={e => setNewItemQtd(parseInt(e.target.value) || 1)}
                                                />
                                            </div>

                                            <div className="md:col-span-4 xl:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Unitário (€)</label>
                                                <input
                                                    type="text"
                                                    placeholder="0,00"
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all font-mono text-right shadow-sm"
                                                    value={newItemValorUnitario}
                                                    onChange={e => setNewItemValorUnitario(e.target.value)}
                                                />
                                            </div>

                                            <div className="md:col-span-4 xl:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total (€)</label>
                                                <input
                                                    type="text"
                                                    placeholder="0,00"
                                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all font-mono text-right shadow-sm"
                                                    value={newItemValorTotal}
                                                    onChange={e => setNewItemValorTotal(e.target.value)}
                                                />
                                            </div>

                                            <div className="md:col-span-12 xl:col-span-2">
                                                <button
                                                    type="button"
                                                    onClick={addItem}
                                                    className="w-full h-[46px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-900/20 active:scale-[0.98] inline-flex items-center justify-center gap-2"
                                                >
                                                    {itemEmEdicao ? <CheckCircle className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                                    <span>{itemEmEdicao ? 'Guardar' : 'Adicionar'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Added Items List - Mini Table */}
                                    <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/20">
                                        <table className="w-full text-left border-collapse" style={{ minWidth: '520px' }}>
                                            <thead>
                                                <tr className="bg-slate-950/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                                                    <th className="px-4 py-4">Item / Descrição</th>
                                                    <th className="px-3 py-4 text-center w-20">Qtd</th>
                                                    <th className="px-3 py-4 text-right w-28">Unitário</th>
                                                    <th className="px-3 py-4 text-right w-28">Subtotal</th>
                                                    <th className="px-3 py-4 text-center w-16">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {items.map(item => (
                                                    <tr key={item.id} className="hover:bg-slate-800/20 transition-colors group">
                                                        <td className="px-6 py-4 text-sm font-medium text-slate-200">{item.descricao}</td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className="px-2.5 py-1 bg-slate-900 rounded-lg text-xs font-mono font-bold text-blue-400 border border-slate-800">
                                                                {item.quantidade}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-xs font-mono text-slate-400">
                                                            {item.valor_unitario ? `${item.valor_unitario.toFixed(2)}€` : '---'}
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-sm font-mono font-bold text-white">
                                                            {item.valor_total ? `${item.valor_total.toFixed(2)}€` : '---'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => editarItem(item)}
                                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItem(item.id)}
                                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {items.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm italic">
                                                            Nenhum item adicionado à lista.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            {items.length > 0 && (
                                                <tfoot>
                                                    <tr className="bg-slate-950/50 border-t border-slate-800">
                                                        <td colSpan={3} className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Total Estimado</td>
                                                        <td className="px-4 py-4 text-right">
                                                            <span className="text-lg font-black text-blue-400 font-mono">
                                                                {totalRequisicao.toFixed(2)}€
                                                            </span>
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-slate-950/30 rounded-3xl p-6 border border-slate-800/50 space-y-3">
                                    <label className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
                                        <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                                            <FileText className="w-4 h-4 text-blue-400" />
                                        </div>
                                        Observações
                                    </label>
                                    <textarea
                                        className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all font-medium shadow-sm resize-none h-36"
                                        placeholder="Notas ou instruções adicionais..."
                                        value={obs}
                                        onChange={e => setObs(e.target.value)}
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-slate-800">
                                    <button
                                        type="submit"
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-12 rounded-xl shadow-xl shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-3 text-lg"
                                    >
                                        <CheckCircle className="w-6 h-6" />
                                        {editingId ? 'Guardar Alterações' : 'Finalizar Requisição'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {
                    showEditModal && itemEmEdicao && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl">
                                <h3 className="text-2xl font-bold text-white mb-6">
                                    Editar Item
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">
                                            Descrição
                                        </label>
                                        <input
                                            type="text"
                                            value={newItemDesc}
                                            onChange={e => setNewItemDesc(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">
                                                Quantidade
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={newItemQtd}
                                                onChange={e => setNewItemQtd(Number(e.target.value))}
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">
                                                Unitário (€)
                                            </label>
                                            <input
                                                type="text"
                                                value={newItemValorUnitario}
                                                onChange={e => setNewItemValorUnitario(e.target.value)}
                                                placeholder="0,00"
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">
                                            Total do Item (€)
                                        </label>
                                        <input
                                            type="text"
                                            value={newItemValorTotal}
                                            onChange={e => setNewItemValorTotal(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-end mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                                    >
                                        Cancelar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const vUnit = newItemValorUnitario ? parseFloat(newItemValorUnitario.replace(',', '.')) : 0;
                                            const vTotal = newItemValorTotal ? parseFloat(newItemValorTotal.replace(',', '.')) : (vUnit * newItemQtd);

                                            setItems(items.map(i =>
                                                i.id === itemEmEdicao.id
                                                    ? {
                                                        ...i,
                                                        descricao: newItemDesc,
                                                        quantidade: newItemQtd,
                                                        valor_unitario: vUnit > 0 ? vUnit : undefined,
                                                        valor_total: vTotal > 0 ? vTotal : (vUnit * newItemQtd > 0 ? vUnit * newItemQtd : undefined)
                                                    }
                                                    : i
                                            ));
                                            setItemEmEdicao(null);
                                            setNewItemDesc('');
                                            setNewItemQtd(1);
                                            setNewItemValorUnitario('');
                                            setNewItemValorTotal('');
                                            setShowEditModal(false);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }



                {/* Email Modal */}
                {
                    showEmailModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="relative z-10 shrink-0 mb-6">
                                    <h3 className="text-2xl font-bold text-white mb-2">Enviar Email</h3>
                                    <p className="text-slate-400">Edite o email antes de enviar para o fornecedor.</p>
                                </div>

                                {!showEmailPreview ? (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 relative z-10 min-h-0 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Para</label>
                                            <input
                                                type="email"
                                                value={emailTo}
                                                onChange={e => setEmailTo(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-white transition-all"
                                                placeholder="fornecedor@email.com"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Assunto</label>
                                            <input
                                                type="text"
                                                value={emailSubject}
                                                onChange={e => setEmailSubject(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-white transition-all"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Mensagem (HTML)</label>
                                            <textarea
                                                value={emailMessage}
                                                onChange={e => setEmailMessage(e.target.value)}
                                                rows={12}
                                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-white transition-all font-mono text-sm"
                                            />
                                        </div>

                                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-900/10 px-4 py-3 text-sm text-cyan-200">
                                            Um PDF da requisição será anexado automaticamente ao email.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 relative z-10 min-h-0">
                                        <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                                            <p className="text-sm text-slate-300 mb-1"><span className="text-slate-500">De:</span> {SENDER_EMAIL}</p>
                                            <p className="text-sm text-slate-300 mb-1"><span className="text-slate-500">Para:</span> {emailTo}</p>
                                            <p className="text-sm text-slate-300 mb-4"><span className="text-slate-500">Assunto:</span> {emailSubject}</p>
                                            <div className="text-sm text-slate-200 leading-6" dangerouslySetInnerHTML={{ __html: emailMessage }} />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2 shrink-0 relative z-10">
                                    {!showEmailPreview ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={closeEmailModal}
                                                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePreviewSupplierEmail}
                                                className="flex-1 py-3 px-4 bg-cyan-700 hover:bg-cyan-600 text-white rounded-xl font-bold transition-all"
                                            >
                                                Preview
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setShowEmailPreview(false)}
                                                className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
                                            >
                                                Voltar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={closeEmailModal}
                                                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleConfirmSendSupplierEmail}
                                                disabled={sendingEmailReqId === emailModalReqId}
                                                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-60"
                                            >
                                                Enviar Email
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Confirmation Modal */}
                {
                    showConfirmModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                    <FileText className="w-32 h-32 text-emerald-500" />
                                </div>

                                <div className="relative z-10 shrink-0">
                                    <h3 className="text-2xl font-bold text-white mb-2">Confirmar Requisição</h3>
                                    <p className="text-slate-400 mb-6">Adicione uma ou mais faturas para concluir.</p>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 relative z-10 min-h-0 space-y-4">
                                    {/* LIST OF ADDED INVOICES */}
                                    {invoicesList.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase mb-2">
                                                <span>Faturas Adicionadas</span>
                                                <span className="text-emerald-500">Total: {(invoicesList.reduce((acc, curr) => acc + curr.valor_total, 0)).toFixed(2)} €</span>
                                            </div>
                                            {invoicesList.map((inv, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                                    <div>
                                                        <div className="text-sm font-bold text-white">{inv.numero}</div>
                                                        <div className="text-xs text-slate-400 font-mono">
                                                            {inv.valor_liquido.toFixed(2)} € + {(inv.iva_taxa * 100).toFixed(0)}% IVA
                                                        </div>
                                                        <div className="text-sm text-emerald-400 font-mono font-bold">
                                                            = {inv.valor_total.toFixed(2)} €
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeInvoiceFromList(idx)}
                                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* INPUT FORM FOR NEW INVOICE */}
                                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Número da Fatura</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white transition-all shadow-inner"
                                                value={invoiceNumber}
                                                onChange={e => setInvoiceNumber(e.target.value)}
                                                placeholder="Ex: FT 2024/123"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        // Focus next field or add
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Valor Líquido (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white transition-all shadow-inner font-mono"
                                                    value={invoiceNetAmount}
                                                    onChange={e => setInvoiceNetAmount(e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Taxa IVA</label>
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white transition-all shadow-inner"
                                                    value={invoiceVatRate}
                                                    onChange={e => setInvoiceVatRate(parseFloat(e.target.value))}
                                                >
                                                    <option value={0.23}>23%</option>
                                                    <option value={0.13}>13%</option>
                                                    <option value={0.06}>6%</option>
                                                    <option value={0}>Isento</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Auto-calculated Total Preview */}
                                        {invoiceNetAmount && (
                                            <div className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-800">
                                                <span className="text-xs text-slate-500 font-bold uppercase">Total com IVA</span>
                                                <span className="text-emerald-400 font-mono font-bold">
                                                    {(parseFloat(invoiceNetAmount.replace(',', '.')) * (1 + invoiceVatRate)).toFixed(2)} €
                                                </span>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={addInvoiceToList}
                                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all font-bold flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-5 h-5" /> Adicionar Fatura
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2 shrink-0 relative z-10">
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmModal(false)}
                                        className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmRequisition}
                                        className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                                    >
                                        Confirmar Conclusão
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
                <div className="pb-12"></div>
            </div>
        </div>
    );
}
