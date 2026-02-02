import { useState } from 'react';
import {
    Plus, Search, FileText, Trash2, Printer, Package, CheckCircle, RotateCcw,
    LayoutTemplate, List, PlusCircle, TrendingUp, Clock, AlertCircle, Calendar,
    ArrowRight, Box, User, Building, Truck, X, Pencil
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Requisicao, ItemRequisicao } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Requisicoes() {
    const { requisicoes, fornecedores, viaturas, addRequisicao, updateRequisicao, deleteRequisicao, toggleRequisicaoStatus, centrosCustos } = useWorkshop();
    const { currentUser, userRole } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();
    const [itemEmEdicao, setItemEmEdicao] = useState<ItemRequisicao | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

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
    const [tipo, setTipo] = useState<Requisicao['tipo']>('Oficina');
    const [fornecedorId, setFornecedorId] = useState('');
    const [viaturaId, setViaturaId] = useState('');
    const [centroCustoId, setCentroCustoId] = useState<string | undefined>(undefined);
    const [obs, setObs] = useState('');

    // Items State
    const [items, setItems] = useState<ItemRequisicao[]>([]);
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemQtd, setNewItemQtd] = useState(1);


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
        setData(req.data);
        setTipo(req.tipo);
        setFornecedorId(req.fornecedorId);
        setViaturaId(req.viaturaId || '');
        setCentroCustoId(req.centroCustoId);
        setObs(req.obs || '');
        setItems(req.itens || []);
        setActiveTab('create');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setData(new Date().toISOString().split('T')[0]);
        setTipo('Oficina');
        setFornecedorId('');
        setViaturaId('');
        setCentroCustoId(undefined);
        setObs('');
        setItems([]);
        setActiveTab('list');
    };

    const addItem = () => {
        if (!newItemDesc.trim()) return;

        // 👉 SE ESTIVER A EDITAR
        if (itemEmEdicao) {
            setItems(items.map(i =>
                i.id === itemEmEdicao.id
                    ? { ...i, descricao: newItemDesc, quantidade: newItemQtd }
                    : i
            ));

            // limpar estado de edição
            setItemEmEdicao(null);
            setNewItemDesc('');
            setNewItemQtd(1);
            return;
        }

        // 👉 SE FOR ITEM NOVO
        setItems([
            ...items,
            {
                id: crypto.randomUUID(),
                descricao: newItemDesc,
                quantidade: newItemQtd
            }
        ]);

        setNewItemDesc('');
        setNewItemQtd(1);
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
        setFornecedorId('');
        setViaturaId('');
        setCentroCustoId(undefined);
        setObs('');
        setItems([]);
    };

    const generatePDF = async (req: Requisicao) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

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

            // INVOICE SECTION
            // INVOICE SECTION
            yPos += 35; // Move down from header details

            // Normalize data: always use array for display
            let displayInvoices = [];

            if (req.faturas_dados && Array.isArray(req.faturas_dados) && req.faturas_dados.length > 0) {
                displayInvoices = req.faturas_dados;
            } else if (req.fatura) {
                // Convert legacy single invoice to array format
                displayInvoices = [{
                    numero: req.fatura,
                    valor_liquido: req.custo || 0,
                    iva_taxa: 0, // Unknown for legacy
                    valor_total: req.custo || 0,
                    isLegacy: true // Mark as legacy
                }];
            }

            if (displayInvoices.length > 0) {
                // Calculate Total
                const grandTotal = displayInvoices.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                autoTable(doc, {
                    startY: yPos,
                    head: [['FATURA', 'BASE', 'IVA', 'TOTAL']],
                    body: displayInvoices.map(f => {
                        // Check if legacy mode (no tax rate)
                        const isLegacy = f.isLegacy || (f.iva_taxa === 0 && (!f.valor_liquido || f.valor_liquido === f.valor_total));

                        return [
                            f.numero,
                            `${f.valor_liquido?.toFixed(2) || '0.00'}€`,
                            isLegacy ? '-' : `${((f.iva_taxa || 0) * 100).toFixed(0)}%`,
                            `${f.valor_total?.toFixed(2) || '0.00'}€`
                        ];
                    }),
                    foot: [[
                        { content: 'TOTAL GERAL:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                        { content: `${grandTotal.toFixed(2)}€`, styles: { halign: 'right', fontStyle: 'bold' } }
                    ]],
                    theme: 'grid',
                    margin: { left: 10, right: 10 },
                    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
                    styles: { fontSize: 8, textColor: 0, lineWidth: 0.1 },
                    columnStyles: {
                        0: { fontStyle: 'bold' },
                        1: { halign: 'right' },
                        2: { halign: 'center' },
                        3: { halign: 'right', fontStyle: 'bold' }
                    },
                    footStyles: {
                        fillColor: [255, 255, 255],
                        textColor: 0,
                        fontStyle: 'bold',
                        halign: 'right'
                    }
                });

                const finalY = (doc as any).lastAutoTable.finalY + 2;
                yPos = finalY + 15; // Set Y for next table (Items)
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

            if (req.obs) {
                doc.setDrawColor(200);
                doc.setLineWidth(0.1);
                doc.rect(10, finalY, pageWidth - 20, 20);

                doc.setFontSize(8);
                doc.setTextColor(120);
                doc.setFont('helvetica', 'bold');
                doc.text('OBSERVAÇÕES', 12, finalY + 5);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(0);
                doc.text(req.obs, 12, finalY + 12);
            }

            const signY = 270;
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);

            doc.line(10, signY, 80, signY);
            doc.setFontSize(9);
            doc.text('O Responsável', 10, signY + 5);

            doc.line(130, signY, pageWidth - 10, signY);
            doc.text('A Gerência', 130, signY + 5);

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Documento processado por computador`, 10, pageWidth - 10);

            doc.save(`Requisicao_${req.numero}.pdf`);

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF.');
        }
    };

    const filteredItems = requisicoes.filter(r => {
        const matchesStatus = listFilter === 'pendentes'
            ? (!r.status || r.status === 'pendente')
            : r.status === 'concluida';

        const numStr = String(r.numero || '');
        const fornecedor = fornecedores.find(f => f.id === r.fornecedorId);
        const fornecedorNome = fornecedor ? fornecedor.nome.toLowerCase() : '';

        const matchesSearch = numStr.toLowerCase().includes(filter.toLowerCase()) ||
            fornecedorNome.includes(filter.toLowerCase());

        return matchesStatus && matchesSearch;
    }).sort((a, b) => String(b.numero || '').localeCompare(String(a.numero || '')));

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden">

            {/* Main Scrollable Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                    <FileText className="w-8 h-8 text-blue-400" />
                                </div>
                                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 text-transparent bg-clip-text">
                                    {t('req.title')}
                                </span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium max-w-2xl">{t('req.subtitle')}</p>
                        </div>

                        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 backdrop-blur-md shadow-lg">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                            >
                                <LayoutTemplate className="w-5 h-5" />
                                Visão Geral
                            </button>
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                            >
                                <List className="w-5 h-5" />
                                Lista
                            </button>
                            <button
                                onClick={() => setActiveTab('create')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'create' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                            >
                                <PlusCircle className="w-5 h-5" />
                                Nova
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-6 rounded-[2rem] relative overflow-hidden group hover:border-amber-500/40 transition-all">
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

                                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-6 rounded-[2rem] relative overflow-hidden group hover:border-emerald-500/40 transition-all">
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

                                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-600/5 border border-blue-500/20 p-6 rounded-[2rem] relative overflow-hidden group hover:border-blue-500/40 transition-all">
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
                        </div>
                    )}

                    {/* List Tab */}
                    {activeTab === 'list' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                            {/* Toolbar */}
                            <div className="flex flex-col lg:flex-row gap-6 justify-between items-center bg-slate-900/50 p-4 rounded-[2rem] border border-slate-800 backdrop-blur-md">
                                <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                                    <button
                                        onClick={() => setListFilter('pendentes')}
                                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${listFilter === 'pendentes' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        Pendentes
                                    </button>
                                    <button
                                        onClick={() => setListFilter('historico')}
                                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${listFilter === 'historico' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        Histórico
                                    </button>
                                </div>

                                <div className="relative w-full lg:w-96 group">
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
                            </div>

                            {/* Cards Grid */}
                            <div className="grid grid-cols-1 gap-4">
                                {filteredItems.map(req => {
                                    const fornecedor = fornecedores.find(f => f.id === req.fornecedorId);
                                    const viatura = viaturas.find(v => v.id === req.viaturaId);
                                    return (
                                        <div key={req.id} className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 hover:border-blue-500/30 transition-all hover:bg-slate-800/40 group relative overflow-hidden">
                                            {/* decorative blob */}
                                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>

                                            <div className="flex flex-col lg:flex-row gap-6 relative z-10">
                                                {/* Left Info */}
                                                <div className="flex-1 flex gap-5">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="h-20 w-24 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center shadow-lg">
                                                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Número</span>
                                                            <span className="text-xl font-mono font-bold text-blue-400">R:{req.numero?.split('/')[1]}</span>
                                                            <span className="text-[10px] text-slate-600">{req.numero?.split('/')[0]}</span>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border w-full text-center
                                                            ${req.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}
                                                        `}>
                                                            {req.status === 'concluida' ? 'Concluída' : 'Pendente'}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wide border flex items-center gap-1.5
                                                                ${req.tipo === 'Oficina' ? 'bg-slate-800 border-slate-700 text-slate-300' : ''}
                                                                ${req.tipo === 'Stock' ? 'bg-purple-900/30 border-purple-500/30 text-purple-400' : ''}
                                                                ${req.tipo === 'Viatura' ? 'bg-indigo-900/30 border-indigo-500/30 text-indigo-400' : ''}
                                                            `}>
                                                                {req.tipo === 'Oficina' && (
                                                                    <Building className="w-3 h-3" />
                                                                )}
                                                                {req.tipo === 'Stock' && <Box className="w-3 h-3" />}
                                                                {req.tipo === 'Viatura' && <Truck className="w-3 h-3" />}
                                                                {req.tipo}
                                                            </span>
                                                            <span className="text-xs text-slate-500 font-medium flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                                                                <Calendar className="w-3 h-3" />
                                                                {req.data}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-bold text-white text-xl leading-snug">{fornecedor?.nome || t('req.card.unknown_supplier')}</h3>
                                                            {viatura && (
                                                                <div className="flex items-center gap-2 mt-1 text-sm text-indigo-300 font-medium">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                                    {viatura.matricula} - {viatura.marca} {viatura.modelo}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-4 text-sm text-slate-400">
                                                            <span className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                                                                <Package className="w-4 h-4 text-slate-500" />
                                                                <span className="text-white font-bold">{(req.itens || []).length}</span> itens
                                                            </span>
                                                            <span className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
                                                                <User className="w-4 h-4 text-slate-500" />
                                                                <span className="text-slate-300">{req.criadoPor?.split(' ')[0] || 'Staff'}</span>
                                                            </span>
                                                        </div>
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
                                                            onClick={() => generatePDF(req)}
                                                            className="p-3 text-blue-300 bg-blue-900/20 hover:bg-blue-800/40 hover:text-white border border-blue-500/20 rounded-xl transition-colors"
                                                            title="Imprimir PDF"
                                                        >
                                                            <Printer className="w-5 h-5" />
                                                        </button>

                                                        {hasAccess(userRole, 'requisicoes_delete') && (
                                                            <button
                                                                onClick={() => deleteRequisicao(req.id)}
                                                                className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                                                                title={t('permission.delete')}
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        )}

                                                        {hasAccess(userRole, 'requisicoes_edit') && (
                                                            <button
                                                                onClick={() => listFilter === 'pendentes' ? handleOpenConfirm(req.id) : toggleRequisicaoStatus(req.id)}
                                                                className={`flex items-center justify-center p-3 rounded-xl transition-all border shadow-lg
                                                                    ${listFilter === 'pendentes'
                                                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-emerald-900/20 hover:scale-105 active:scale-95'
                                                                        : 'bg-slate-800 text-amber-500 border-amber-500/20 hover:bg-amber-500/10'
                                                                    }
                                                                `}
                                                                title={listFilter === 'pendentes' ? 'Concluir' : 'Reabrir'}
                                                            >
                                                                {listFilter === 'pendentes' ? <CheckCircle className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                                                            </button>
                                                        )}

                                                        {/* Edit Button */}
                                                        {listFilter === 'pendentes' && hasAccess(userRole, 'requisicoes_edit') && (
                                                            <button
                                                                onClick={() => handleEdit(req)}
                                                                className="p-3 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors border border-transparent hover:border-blue-500/20"
                                                                title="Editar"
                                                                type="button"
                                                            >
                                                                <Pencil className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
                        </div>
                    )}

                    {/* Create Tab */}
                    {activeTab === 'create' && (
                        <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-8 fade-in pb-10">
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
                                            <div className="flex flex-col md:flex-row gap-4">
                                                <input
                                                    placeholder={t('req.form.desc_placeholder')}
                                                    className="flex-1 px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all placeholder-slate-600 shadow-sm"
                                                    value={newItemDesc}
                                                    onChange={e => setNewItemDesc(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addItem();
                                                        }
                                                    }}
                                                />
                                                <div className="flex gap-4">
                                                    <div className="relative w-32">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all font-mono text-center shadow-sm"
                                                            value={newItemQtd}
                                                            onChange={e => setNewItemQtd(parseInt(e.target.value) || 1)}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-bold uppercase pointer-events-none">Qtd</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={addItem}
                                                        className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                                                    >
                                                        {itemEmEdicao ? 'Guardar alterações' : 'Adicionar item'}
                                                        <Plus className="w-5 h-5" />
                                                        <span className="hidden md:inline">Adicionar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Added Items List */}
                                        <div className="space-y-2">
                                            {items.map(item => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700"
                                                >
                                                    {/* ESQUERDA */}
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center font-mono font-bold">
                                                            {item.quantidade}
                                                        </div>

                                                        <span className="text-slate-200 font-medium">
                                                            {item.descricao}
                                                        </span>
                                                    </div>

                                                    {/* DIREITA — BOTÕES */}
                                                    <div className="flex items-center gap-2">
                                                        {/* EDITAR */}
                                                        <button
                                                            type="button"
                                                            onClick={() => editarItem(item)}
                                                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                                                            title="Editar"
                                                        >
                                                            ✏️
                                                        </button>

                                                        {/* REMOVER */}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(item.id)}
                                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                                            title="Remover"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {items.length === 0 && (
                                                <div className="text-center py-6 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">
                                                    Nenhum item adicionado à lista.
                                                </div>
                                            )}


                                            {items.length === 0 && (
                                                <div className="text-center py-6 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">
                                                    Nenhum item adicionado à lista.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Observações</label>
                                        <textarea
                                            className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-slate-200 transition-all font-medium shadow-sm resize-none h-32"
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
                                            Finalizar Requisição
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                    {/* Edit Item Modal */}
                    {showEditModal && itemEmEdicao && (
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
                                            setItems(items.map(i =>
                                                i.id === itemEmEdicao.id
                                                    ? {
                                                        ...i,
                                                        descricao: newItemDesc,
                                                        quantidade: newItemQtd
                                                    }
                                                    : i
                                            ));
                                            setItemEmEdicao(null);
                                            setShowEditModal(false);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* Confirmation Modal */}
                    {/* Confirmation Modal */}
                    {showConfirmModal && (
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
                    )}

                </main >
            </div >
        </div >
    );
}
