import { useState, useEffect } from 'react';
import {
    Wallet, TrendingDown, DollarSign,
    Calendar, Download, PieChart, BarChart3,
    ArrowUpRight, FileText, Car
} from 'lucide-react';
import Faturas from './Faturas';
import NovaFatura from './NovaFatura';
import Alugueres from './Alugueres';

import type { Fatura } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';

// MOCK DATA moved from Faturas.tsx
export default function Contabilidade() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'faturas' | 'alugueres'>('dashboard');
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [invoices, setInvoices] = useState<Fatura[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Fatura | null>(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        const { data, error } = await supabase
            .from('faturas')
            .select(`
                *,
                itens:itens_fatura(*)
            `);

        if (data) {
            const mappedInvoices = data.map((inv: any) => ({
                ...inv,
                clienteId: inv.cliente_id,
                itens: inv.itens.map((item: any) => ({
                    ...item,
                    precoUnitario: item.preco_unitario,
                    taxaImposto: item.taxa_imposto,
                    faturaId: item.fatura_id
                }))
            }));
            setInvoices(mappedInvoices);
        }
        if (error) console.error('Error fetching invoices:', error);
    };


    // MOCK DATA for demonstration until we wire up real aggregations
    // ... kept same mock stats ...
    const financialStats = {
        totalRevenue: 125430,
        totalExpenses: 45200,
        netProfit: 80230,
        pendingPayments: 12500
    };

    const expenseBreakdown = [
        { category: 'Combustível', value: 15400, color: 'bg-blue-500' },
        { category: 'Manutenção', value: 8200, color: 'bg-red-500' },
        { category: 'Peças & Pneus', value: 4500, color: 'bg-amber-500' },
        { category: 'Salários', value: 12000, color: 'bg-emerald-500' },
        { category: 'Outros', value: 5100, color: 'bg-slate-500' },
    ];

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const handleSaveInvoice = async (data: any) => {
        if (view === 'edit' && selectedInvoice) {
            // Update existing
            const { error } = await supabase.from('faturas').update({
                numero: data.numero,
                data: data.data,
                vencimento: data.vencimento,
                cliente_id: data.clienteId,
                status: data.status,
                subtotal: data.subtotal,
                imposto: data.imposto,
                total: data.total,
                notas: data.notas,
                desconto: data.desconto
            }).eq('id', selectedInvoice.id);

            if (!error) {
                // Update items: Delete old and insert new (simpler than syncing)
                await supabase.from('itens_fatura').delete().eq('fatura_id', selectedInvoice.id);
                if (data.itens && data.itens.length > 0) {
                    await supabase.from('itens_fatura').insert(data.itens.map((item: any) => ({
                        fatura_id: selectedInvoice.id,
                        descricao: item.descricao,
                        quantidade: item.quantidade,
                        preco_unitario: item.precoUnitario,
                        taxa_imposto: item.taxaImposto,
                        total: item.total
                    })));
                }
                fetchInvoices();
            }
        } else {
            // Create new
            const newId = crypto.randomUUID();
            const { error } = await supabase.from('faturas').insert({
                id: newId,
                numero: `FT 2024/${(invoices.length + 1).toString().padStart(3, '0')}`,
                data: data.data,
                vencimento: data.vencimento,
                cliente_id: data.clienteId,
                status: 'emitida',
                subtotal: data.subtotal,
                imposto: data.imposto,
                total: data.total,
                notas: data.notas,
                desconto: data.desconto || 0
            });

            if (!error) {
                if (data.itens && data.itens.length > 0) {
                    await supabase.from('itens_fatura').insert(data.itens.map((item: any) => ({
                        fatura_id: newId,
                        descricao: item.descricao,
                        quantidade: item.quantidade,
                        preco_unitario: item.precoUnitario,
                        taxa_imposto: item.taxaImposto,
                        total: item.total
                    })));
                }
                fetchInvoices();
            }
        }
        setView('list');
        setSelectedInvoice(null);
    };

    const handleEditInvoice = (invoice: Fatura) => {
        setSelectedInvoice(invoice);
        setView('edit');
    };

    const handleViewInvoice = (invoice: Fatura) => {
        alert(`Detalhes da Fatura ${invoice.numero}\nCliente: ${invoice.clienteId}\nTotal: ${formatCurrency(invoice.total)}`);
    };

    const handleDeleteInvoice = async (id: string) => {
        if (window.confirm('Tem a certeza que deseja eliminar esta fatura? Esta ação não pode ser desfeita.')) {
            const { error } = await supabase.from('faturas').delete().eq('id', id);
            if (!error) {
                setInvoices(prev => prev.filter(i => i.id !== id));
            }
        }
    };

    const generateCostCenterReport = async () => {
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
            // --- HEADER ---
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
            doc.text(`GERADO EM: ${new Date().toLocaleDateString()}`, pageWidth - 10, 44, { align: 'right' });

            // --- TITLE ---
            doc.setFontSize(22);
            doc.setTextColor(20, 60, 140);
            doc.setFont('helvetica', 'bold');
            doc.text('RELATÓRIO DE CENTROS DE CUSTO', 10, 70);

            let yPos = 85;

            // --- TABLE DATA PREPARATION ---
            // In a real app we would aggregate real data here. 
            // Using the mock 'expenseBreakdown' for now to match UI.
            const tableBody = expenseBreakdown.map(item => [
                item.category,
                ((item.value / financialStats.totalExpenses) * 100).toFixed(1) + '%',
                formatCurrency(item.value)
            ]);

            // Add Total Row
            tableBody.push([
                'TOTAL GERAL',
                '100%',
                formatCurrency(financialStats.totalExpenses)
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['CATEGORIA / CENTRO DE CUSTO', '% DO TOTAL', 'VALOR TOTAL']],
                body: tableBody,
                theme: 'grid',
                headStyles: {
                    fillColor: [20, 60, 140],
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'left',
                    cellPadding: 4
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 4,
                    textColor: [40, 40, 40],
                },
                columnStyles: {
                    0: { cellWidth: 'auto', fontStyle: 'bold' },
                    1: { cellWidth: 40, halign: 'center' },
                    2: { cellWidth: 50, halign: 'right' }
                },
                alternateRowStyles: {
                    fillColor: [250, 250, 255]
                },
                didParseCell: (data) => {
                    // Make the last row (Total) bold/different
                    if (data.row.index === tableBody.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                }
            });

            // --- FOOTER ---
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Pág. ${i} de ${pageCount} - Documento Informativo`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            doc.save('Relatorio_Centros_Custo.pdf');

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF');
        }
    };

    const handleDownloadInvoice = async (invoice: Fatura) => {
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
            // --- HEADER (Same style as Requisicoes) ---
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
                // Fallback if no logo
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
            doc.text(`EMITIDO EM: ${new Date().toLocaleDateString()}`, pageWidth - 10, 44, { align: 'right' });

            // --- TITLE ---
            doc.setFontSize(22);
            doc.setTextColor(20, 60, 140);
            doc.setFont('helvetica', 'bold');
            doc.text('FATURA', 10, 70);

            let yPos = 85;

            // --- DETAILS ---
            // Column 1: Invoice Info
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('NÚMERO DA FATURA', 10, yPos);
            doc.text('DATA DE VENCIMENTO', 10, yPos + 15);

            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold');
            doc.text(invoice.numero, 10, yPos + 6);
            doc.setFontSize(11);
            doc.text(invoice.vencimento, 10, yPos + 21);

            // Column 2: Client Info
            const col2X = 85;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('CLIENTE', col2X, yPos);

            // Fetch Mock Client Name (in real app, fetch efficiently)
            // Use ID as fallback or lookup from mock
            const clientName = invoice.clienteId === 'c1' ? 'Cliente Exemplo Lda' :
                invoice.clienteId === 'c2' ? 'Particular' :
                    invoice.clienteId;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(clientName, col2X, yPos + 6);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(80);
            doc.text(`ID: ${invoice.clienteId}`, col2X, yPos + 11);

            // Column 3: Status
            const col3X = 145;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('ESTADO', col3X, yPos);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            if (invoice.status === 'paga') {
                doc.setTextColor(20, 160, 100);
            } else {
                doc.setTextColor(20, 60, 140);
            }
            doc.text(invoice.status.toUpperCase(), col3X, yPos + 6);


            yPos += 35;

            // --- TABLE ---
            const tableBody = invoice.itens.map(item => [
                item.descricao,
                item.quantidade.toString(),
                formatCurrency(item.precoUnitario),
                `${item.taxaImposto}%`,
                formatCurrency(item.total)
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['DESCRIÇÃO', 'QTD', 'PREÇO UNIT.', 'TAXA', 'TOTAL']],
                body: tableBody,
                theme: 'grid',
                headStyles: {
                    fillColor: [20, 60, 140],
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'left',
                    cellPadding: 4
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 4,
                    textColor: [40, 40, 40],
                },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 20, halign: 'center' },
                    2: { cellWidth: 35, halign: 'right' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
                },
                alternateRowStyles: {
                    fillColor: [250, 250, 255]
                }
            });

            // --- TOTALS ---
            const finalY = (doc as any).lastAutoTable.finalY + 10;
            const totalsX = pageWidth - 80;

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.setFont('helvetica', 'normal');

            doc.text('Subtotal:', totalsX, finalY);
            doc.text('Imposto:', totalsX, finalY + 7);
            doc.text('Desconto:', totalsX, finalY + 14);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(formatCurrency(invoice.subtotal), pageWidth - 10, finalY, { align: 'right' });
            doc.text(formatCurrency(invoice.imposto), pageWidth - 10, finalY + 7, { align: 'right' });
            doc.text(formatCurrency(invoice.desconto), pageWidth - 10, finalY + 14, { align: 'right' });

            // Grand Total Box
            doc.setFillColor(20, 60, 140);
            doc.roundedRect(totalsX - 5, finalY + 20, 90, 12, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text('TOTAL A PAGAR', totalsX, finalY + 28);
            doc.setFontSize(12);
            doc.text(formatCurrency(invoice.total), pageWidth - 10, finalY + 28, { align: 'right' });

            // --- FOOTER ---
            const signY = 270;
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.setTextColor(0);

            doc.line(10, signY, 80, signY);
            doc.setFontSize(9);
            doc.text('A Gerência', 10, signY + 5);

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Documento processado por computador`, 10, pageWidth - 10);

            doc.save(`Fatura_${invoice.numero.replace('/', '_')}.pdf`);

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF: ' + (error as Error).message);
        }
    };

    if (view === 'create' || view === 'edit') {
        return (
            <NovaFatura
                onBack={() => { setView('list'); setSelectedInvoice(null); }}
                onSave={handleSaveInvoice}
                initialData={selectedInvoice}
            />
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        Contabilidade
                    </h1>
                    <p className="text-slate-400">
                        Visão geral financeira e analítica da frota.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={generateCostCenterReport}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-medium border border-slate-700 transition-all shadow-lg"
                    >
                        <Download className="w-4 h-4" />
                        Relatório Custos (PDF)
                    </button>
                    {/* Main Navigation Tabs */}
                    <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <BarChart3 className="w-4 h-4" />
                            Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('faturas')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'faturas' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <FileText className="w-4 h-4" />
                            Faturas
                        </button>
                        <button
                            onClick={() => setActiveTab('alugueres')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'alugueres' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Car className="w-4 h-4" />
                            Alugueres
                        </button>
                    </div>
                </div>
            </div>


            {
                activeTab === 'faturas' ? (
                    <Faturas
                        invoices={invoices}
                        onCreateNew={() => setView('create')}
                        onDelete={handleDeleteInvoice}
                        onDownload={handleDownloadInvoice}
                        onEdit={handleEditInvoice}
                        onView={handleViewInvoice}
                    />
                ) : activeTab === 'alugueres' ? (
                    <Alugueres
                        invoices={invoices}
                        onDelete={handleDeleteInvoice}
                        onSaveRental={(inv) => {
                            setInvoices([inv, ...invoices]);
                            setActiveTab('alugueres'); // Stay on rentals tab
                        }}
                    />
                ) : (
                    <>
                        {/* Dashboard Content */}
                        {/* Overview Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-[#1e293b]/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <DollarSign className="w-24 h-24 text-blue-500" />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-slate-400 font-medium mb-1">Receita Total</p>
                                    <h3 className="text-3xl font-bold text-white mb-2">{formatCurrency(financialStats.totalRevenue)}</h3>
                                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full">
                                        <ArrowUpRight className="w-3 h-3" /> +12.5% vs mês anterior
                                    </span>
                                </div>
                            </div>

                            <div className="bg-[#1e293b]/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <TrendingDown className="w-24 h-24 text-red-500" />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-slate-400 font-medium mb-1">Despesas Totais</p>
                                    <h3 className="text-3xl font-bold text-white mb-2">{formatCurrency(financialStats.totalExpenses)}</h3>
                                    <span className="inline-flex items-center gap-1 text-red-400 text-xs font-bold bg-red-500/10 px-2 py-1 rounded-full">
                                        <ArrowUpRight className="w-3 h-3" /> +5.2% vs mês anterior
                                    </span>
                                </div>
                            </div>

                            <div className="bg-[#1e293b]/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Wallet className="w-24 h-24 text-emerald-500" />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-slate-400 font-medium mb-1">Lucro Líquido</p>
                                    <h3 className="text-3xl font-bold text-white mb-2">{formatCurrency(financialStats.netProfit)}</h3>
                                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full">
                                        <ArrowUpRight className="w-3 h-3" /> +8.4% Margem Líquida
                                    </span>
                                </div>
                            </div>

                            <div className="bg-[#1e293b]/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Calendar className="w-24 h-24 text-amber-500" />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-slate-400 font-medium mb-1">Pagamentos Pendentes</p>
                                    <h3 className="text-3xl font-bold text-white mb-2">{formatCurrency(financialStats.pendingPayments)}</h3>
                                    <span className="text-slate-500 text-xs">Total de faturas por liquidar</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Large Chart Area - Monthly Trend */}
                            <div className="lg:col-span-2 bg-[#1e293b]/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-blue-500" />
                                        Evolução Financeira
                                    </h3>
                                    <select className="bg-slate-800 border-none text-slate-300 text-sm rounded-lg focus:ring-0 cursor-pointer">
                                        <option>Últimos 6 Meses</option>
                                        <option>Último Ano</option>
                                    </select>
                                </div>

                                {/* Custom CSS Bar Chart Placeholder */}
                                <div className="h-64 flex items-end justify-between gap-4 py-4 relative">
                                    {/* Lines for grid */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                                        <div className="border-t border-slate-500 w-full"></div>
                                        <div className="border-t border-slate-500 w-full"></div>
                                        <div className="border-t border-slate-500 w-full"></div>
                                        <div className="border-t border-slate-500 w-full"></div>
                                        <div className="border-t border-slate-500 w-full"></div>
                                    </div>

                                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((m) => {
                                        const heightRec = Math.random() * 80 + 20; // Random height 20-100%
                                        const heightExp = heightRec * (Math.random() * 0.5 + 0.3); // Expenses usually lower
                                        return (
                                            <div key={m} className="flex-1 flex flex-col justify-end items-center gap-1 group h-full z-10">
                                                <div className="w-full flex gap-1 items-end justify-center h-full px-2">
                                                    <div
                                                        className="w-full bg-blue-500/80 hover:bg-blue-400 transition-all rounded-t-sm relative group-hover:shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                        style={{ height: `${heightRec}%` }}
                                                    >
                                                        {/* Tooltip */}
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-20">
                                                            Rec: {heightRec.toFixed(0)}k
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="w-full bg-red-500/80 hover:bg-red-400 transition-all rounded-t-sm relative group-hover:shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                                        style={{ height: `${heightExp}%` }}
                                                    >
                                                        {/* Tooltip */}
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-20">
                                                            Desp: {heightExp.toFixed(0)}k
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-slate-400 font-medium mt-2">{m}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center justify-center gap-6 mt-4">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span className="w-3 h-3 bg-blue-500/80 rounded-sm"></span> Receita
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span className="w-3 h-3 bg-red-500/80 rounded-sm"></span> Despesa
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown Chart */}
                            <div className="bg-[#1e293b]/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <PieChart className="w-5 h-5 text-purple-500" />
                                        Distribuição de Custos
                                    </h3>
                                    <button
                                        onClick={generateCostCenterReport}
                                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors bg-slate-800 px-2 py-1 rounded-lg border border-slate-700"
                                    >
                                        <Download className="w-3 h-3" /> PDF
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                                    {expenseBreakdown.map((item, index) => (
                                        <div key={index} className="group">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{item.category}</span>
                                                <span className="text-sm font-bold text-white">{formatCurrency(item.value)}</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${(item.value / financialStats.totalExpenses) * 100}%` }}></div>
                                            </div>
                                            <p className="text-[10px] text-slate-500 text-right mt-1">{((item.value / financialStats.totalExpenses) * 100).toFixed(1)}%</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-800">
                                    <p className="text-xs text-slate-400 mb-2">Maior centro de custo:</p>
                                    <div className="p-3 bg-slate-800/50 rounded-xl flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                            <Fuel className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">Combustível</p>
                                            <p className="text-xs text-slate-500">34% do total de despesas</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Tables Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">

                            {/* Top Cost Centers */}
                            <div className="bg-[#1e293b]/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
                                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                                    <h3 className="font-bold text-white">Top Centros de Custo</h3>
                                    <button className="text-blue-400 text-xs hover:text-blue-300">Ver Todos</button>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                                        <tr>
                                            <th className="px-6 py-3">Nome</th>
                                            <th className="px-6 py-3 text-right">Total</th>
                                            <th className="px-6 py-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-white">Centro Custo A-{i}0</td>
                                                <td className="px-6 py-4 text-right">{formatCurrency(Math.random() * 50000)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full text-xs">Ativo</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Recent Transactions / Alerts */}
                            <div className="bg-[#1e293b]/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
                                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                                    <h3 className="font-bold text-white">Transações Recentes</h3>
                                    <button className="text-blue-400 text-xs hover:text-blue-300">Ver Extrato</button>
                                </div>
                                <div className="divide-y divide-slate-800">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${i % 2 === 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {i % 2 === 0 ? <Download className="w-4 h-4 rotate-180" /> : <Download className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{i % 2 === 0 ? 'Pagamento Cliente' : 'Compra Peças'}</p>
                                                    <p className="text-xs text-slate-500">Hoje, 14:30</p>
                                                </div>
                                            </div>
                                            <span className={`font-bold text-sm ${i % 2 === 0 ? 'text-emerald-400' : 'text-white'}`}>
                                                {i % 2 === 0 ? '+' : '-'}{formatCurrency(Math.random() * 10000)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </>
                )
            }

        </div >
    );
}

// Simple Helper Icon component to avoid import errors if needed in future
function Fuel({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="3" x2="15" y1="22" y2="22" /><line x1="4" x2="14" y1="9" y2="9" /><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" /><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
        </svg>
    );
}
