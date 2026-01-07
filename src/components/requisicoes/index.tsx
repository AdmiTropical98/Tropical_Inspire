import { useState } from 'react';
import {
    Plus, Search, FileText, Trash2, Printer, Package, CheckCircle, RotateCcw,
    LayoutTemplate, List, PlusCircle, TrendingUp, Clock, AlertCircle, Calendar
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Requisicao, ItemRequisicao } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Requisicoes() {
    const { requisicoes, fornecedores, viaturas, addRequisicao, deleteRequisicao, toggleRequisicaoStatus, centrosCustos } = useWorkshop();
    const { currentUser, userRole } = useAuth();
    const { hasAccess } = usePermissions();
    const { t } = useTranslation();

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
        setShowConfirmModal(true);
    };

    const handleConfirmRequisition = (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmingId) return;
        if (!invoiceNumber.trim()) {
            alert(t('req.valid.invoice_required'));
            return;
        }

        toggleRequisicaoStatus(confirmingId);
        setShowConfirmModal(false);
        setConfirmingId(null);
        setInvoiceNumber('');
    };

    const addItem = () => {
        if (!newItemDesc.trim()) return;
        setItems([...items, { id: crypto.randomUUID(), descricao: newItemDesc, quantidade: newItemQtd }]);
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
        setActiveTab('list'); // Switch to list view after creating
        setListFilter('pendentes');

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

            if (req.fatura) {
                const col4X = pageWidth - 60;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text('FATURA Nº', col4X, yPos);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text(req.fatura, col4X, yPos + 6);
            }

            yPos += 35;

            const tableBody = req.itens.map(item => [
                item.descricao.toUpperCase(),
                item.quantidade.toString()
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['DESCRIÇÃO DO MATERIAL', 'QTD.']],
                body: tableBody,
                theme: 'grid',
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
                    fillColor: [250, 250, 255]
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
        <div className="h-full overflow-y-auto custom-scrollbar max-w-7xl mx-auto p-4 md:p-8 font-sans">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <FileText className="w-6 h-6 text-blue-500" />
                    </div>
                    {t('req.title')}
                </h1>
                <p className="text-slate-400">{t('req.subtitle')}</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                    ${activeTab === 'overview'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30'
                            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                    <LayoutTemplate className="w-4 h-4" />
                    Visão Geral
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                    ${activeTab === 'list'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 ring-2 ring-blue-500/30'
                            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                    <List className="w-4 h-4" />
                    Lista de Requisições
                </button>
                <button
                    onClick={() => setActiveTab('create')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm
                    ${activeTab === 'create'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/30'
                            : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                    <PlusCircle className="w-4 h-4" />
                    Nova Requisição
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Clock className="w-24 h-24 text-amber-500" />
                            </div>
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pendentes</h3>
                            <p className="text-3xl font-bold text-white">{stats.pending}</p>
                            <div className="mt-4 flex items-center gap-2 text-amber-400 text-xs font-bold px-2 py-1 bg-amber-500/10 w-fit rounded-lg">
                                <AlertCircle className="w-3 h-3" />
                                A aguardar aprovação
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <CheckCircle className="w-24 h-24 text-emerald-500" />
                            </div>
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Concluídas</h3>
                            <p className="text-3xl font-bold text-white">{stats.completed}</p>
                            <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-500/10 w-fit rounded-lg">
                                <TrendingUp className="w-3 h-3" />
                                Processadas com sucesso
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Package className="w-24 h-24 text-blue-500" />
                            </div>
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Requisições</h3>
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                            <div className="mt-4 flex items-center gap-2 text-blue-400 text-xs font-bold px-2 py-1 bg-blue-500/10 w-fit rounded-lg">
                                <Calendar className="w-3 h-3" />
                                Desde o início
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/10 p-5 rounded-3xl relative overflow-hidden">
                            <h3 className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Acesso Rápido</h3>
                            <div className="mt-4 flex flex-col gap-2">
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar Nova
                                </button>
                                <button
                                    onClick={() => { setActiveTab('list'); setListFilter('pendentes'); }}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold border border-slate-700 transition-all"
                                >
                                    Ver Pendentes
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity / Filtered Preview in Overview */}
                    <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Clock className="w-5 h-5 text-slate-400" />
                                Recentes
                            </h3>
                            <button onClick={() => setActiveTab('list')} className="text-xs text-blue-400 font-bold hover:text-blue-300">VER TUDO</button>
                        </div>
                        <div className="space-y-3">
                            {requisicoes.slice(0, 5).map(req => (
                                <div key={req.id} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-lg
                                            ${req.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-700 text-slate-300'}
                                        `}>
                                            R:{req.numero}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{fornecedores.find(f => f.id === req.fornecedorId)?.nome || 'Fornecedor'}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-2">
                                                {req.data} • {(req.itens || []).length} items
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                                        ${req.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
                                    `}>
                                        {req.status === 'concluida' ? 'Concluída' : 'Pendente'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* List Tab */}
            {activeTab === 'list' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/30 p-4 rounded-2xl border border-slate-800">
                        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                            <button
                                onClick={() => setListFilter('pendentes')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${listFilter === 'pendentes' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                Pendentes
                            </button>
                            <button
                                onClick={() => setListFilter('historico')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${listFilter === 'historico' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                Histórico
                            </button>
                        </div>
                        <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Pesquisar requisições..."
                                className="w-full md:w-64 pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-200"
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
                                <div key={req.id} className="bg-slate-800/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800/40 transition-all group">
                                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                                        <div className="flex items-start gap-5">
                                            <div className="bg-slate-800 p-4 rounded-2xl text-blue-400 font-bold text-2xl min-w-[5rem] text-center border border-slate-700 font-mono shadow-sm">
                                                R:{req.numero}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border
                                                        ${req.tipo === 'Oficina' ? 'bg-slate-800 border-slate-600 text-slate-300' : ''}
                                                        ${req.tipo === 'Stock' ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : ''}
                                                        ${req.tipo === 'Viatura' ? 'bg-amber-900/30 border-amber-500/30 text-amber-400' : ''}
                                                    `}>
                                                        {req.tipo}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {req.data}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-white text-lg">{fornecedor?.nome || t('req.card.unknown_supplier')}</h3>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-400">
                                                    <span className="flex items-center gap-2">
                                                        <Package className="w-4 h-4 text-slate-500" />
                                                        {(req.itens || []).length} itens
                                                    </span>
                                                    {viatura && (
                                                        <span className="flex items-center gap-2 text-blue-300/80">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                                            {viatura.matricula}
                                                        </span>
                                                    )}
                                                </div>
                                                {req.fatura && (
                                                    <div className="mt-3 inline-flex items-center gap-2 bg-emerald-950/30 px-3 py-1 rounded-lg border border-emerald-500/20">
                                                        <FileText className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-xs text-emerald-400 font-mono font-bold">FATURA: {req.fatura}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 self-end md:self-center">
                                            <button
                                                onClick={() => generatePDF(req)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-200 bg-blue-900/20 hover:bg-blue-800/30 border border-blue-500/20 rounded-xl transition-colors"
                                            >
                                                <Printer className="w-4 h-4" />
                                                <span>PDF</span>
                                            </button>

                                            {hasAccess(userRole, 'requisicoes_delete') && (
                                                <button
                                                    onClick={() => deleteRequisicao(req.id)}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                                                    title={t('permission.delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}

                                            <div className="w-px h-8 bg-slate-700/50 mx-2"></div>

                                            {hasAccess(userRole, 'requisicoes_edit') && (
                                                <button
                                                    onClick={() => listFilter === 'pendentes' ? handleOpenConfirm(req.id) : toggleRequisicaoStatus(req.id)}
                                                    className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border shadow-lg
                                                        ${listFilter === 'pendentes'
                                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-emerald-900/20'
                                                            : 'bg-slate-800 text-amber-500 border-amber-500/20 hover:bg-amber-500/10'
                                                        }
                                                    `}
                                                >
                                                    {listFilter === 'pendentes' ? (
                                                        <>
                                                            <CheckCircle className="w-4 h-4" />
                                                            Concluir
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RotateCcw className="w-4 h-4" />
                                                            Reabrir
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredItems.length === 0 && (
                            <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-700">
                                <div className="bg-slate-800/50 inline-flex p-6 rounded-full mb-6 border border-slate-700">
                                    <List className="w-12 h-12 text-slate-600" />
                                </div>
                                <h3 className="text-slate-400 text-lg font-medium">Nenhuma requisição encontrada.</h3>
                                {listFilter === 'pendentes' && (
                                    <button onClick={() => setActiveTab('create')} className="mt-4 text-blue-400 hover:text-blue-300 font-bold text-sm">
                                        Criar nova requisição &rarr;
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Tab */}
            {activeTab === 'create' && (
                <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 fade-in">
                    <div className="bg-slate-800/30 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl">
                        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-700/50">
                            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
                                <PlusCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{t('req.form.title')}</h2>
                                <p className="text-slate-400 text-sm">Preencha os dados abaixo para criar uma nova requisição.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Form Fields - Same as before but consistent styling */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('req.form.date')}</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all font-mono"
                                        value={data}
                                        onChange={e => setData(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('req.form.type')}</label>
                                    <select
                                        value={tipo}
                                        onChange={(e) => {
                                            const val = e.target.value as Requisicao['tipo'];
                                            setTipo(val);
                                            setViaturaId('');
                                        }}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all appearance-none"
                                    >
                                        <option value="Oficina">Oficina (Geral)</option>
                                        <option value="Stock">Stock (Armazém)</option>
                                        <option value="Viatura">Viatura</option>
                                    </select>
                                </div>

                                {tipo === 'Viatura' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('req.form.vehicle')}</label>
                                        <select
                                            required
                                            value={viaturaId}
                                            onChange={(e) => setViaturaId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all"
                                        >
                                            <option value="">{t('req.form.vehicle_select')}</option>
                                            {viaturas.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.matricula} - {v.marca} {v.modelo}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">Centro de Custos</label>
                                    <select
                                        value={centroCustoId || ''}
                                        onChange={(e) => setCentroCustoId(e.target.value || undefined)}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all"
                                    >
                                        <option value="">Selecione... (Opcional)</option>
                                        {centrosCustos.map(cc => (
                                            <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('req.form.supplier')}</label>
                                    <select
                                        required
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all"
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

                            {/* Items Section */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pl-1">{t('req.form.items')}</label>
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50">
                                    <div className="flex gap-4 mb-6">
                                        <input
                                            placeholder={t('req.form.desc_placeholder')}
                                            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all placeholder-slate-500"
                                            value={newItemDesc}
                                            onChange={e => setNewItemDesc(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                                        />
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Qtd."
                                            className="w-24 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all placeholder-slate-500 text-center font-mono"
                                            value={newItemQtd}
                                            onChange={e => setNewItemQtd(parseInt(e.target.value) || 1)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                                        />
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-300 px-6 rounded-xl transition-all font-bold border border-slate-600 hover:border-emerald-500"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {items.length === 0 ? (
                                        <div className="text-center py-12 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                                            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                            {t('req.form.no_items')}
                                        </div>
                                    ) : (
                                        <ul className="space-y-2">
                                            {items.map(item => (
                                                <li key={item.id} className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all group">
                                                    <span className="flex-1 font-medium text-slate-200">{item.descricao}</span>
                                                    <span className="mx-4 text-xs font-bold px-3 py-1 bg-slate-900 rounded-lg text-slate-400 font-mono">QTD: {item.quantidade}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.id)}
                                                        className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Obs */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">{t('req.obs')}</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-200 transition-all resize-none"
                                    value={obs}
                                    onChange={e => setObs(e.target.value)}
                                    placeholder="Opcional: Adicione notas ou observações extra..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-4 pt-6 border-t border-slate-700/50">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('list')}
                                    className="px-8 py-4 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={items.length === 0}
                                    className="px-8 py-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Finalizar Requisição
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Invoice Confirmation */}
            {showConfirmModal && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <CheckCircle className="w-32 h-32 text-emerald-500" />
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-2">{t('req.confirm.title')}</h3>
                        <p className="text-slate-400 text-sm mb-6">{t('req.confirm.subtitle')}</p>

                        <form onSubmit={handleConfirmRequisition}>
                            <div className="mb-8">
                                <label className="block text-xs font-bold text-emerald-500 uppercase mb-2">
                                    {t('req.confirm.invoice_label')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="Ex: FT 2024/123"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-xl"
                                    value={invoiceNumber}
                                    onChange={e => setInvoiceNumber(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 py-4 text-slate-400 hover:text-white font-bold hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    {t('common.confirm')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
