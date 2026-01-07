import { useState } from 'react';
import { Plus, Search, Car, Printer, Trash2, Download } from 'lucide-react';
import type { Fatura } from '../../types';
import { useWorkshop } from '../../contexts/WorkshopContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AlugueresProps {
    invoices: Fatura[];
    onSaveRental: (data: Fatura) => void;
    onDelete: (id: string) => void;
}



export default function Alugueres({ invoices, onSaveRental, onDelete }: AlugueresProps) {
    const { viaturas, centrosCustos, clientes } = useWorkshop();
    const [view, setView] = useState<'list' | 'create'>('list');
    const [searchTerm, setSearchTerm] = useState('');

    // Rental Form State
    const [clienteId, setClienteId] = useState('');
    const [viaturaId, setViaturaId] = useState('');
    const [centroCustoId, setCentroCustoId] = useState('');
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dias, setDias] = useState(1);
    const [precoDiario, setPrecoDiario] = useState(0);

    const filteredInvoices = invoices.filter(inv =>
        (inv.tipo === 'aluguer') &&
        (inv.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.status.includes(searchTerm.toLowerCase()))
    );

    const handleViaturaSelect = (id: string) => {
        setViaturaId(id);
        const v = viaturas.find(vi => vi.id === id);
        if (v && v.precoDiario) {
            setPrecoDiario(v.precoDiario);
        }
    };

    const handleCreateRental = () => {
        if (!clienteId || !viaturaId || dias <= 0 || precoDiario <= 0) {
            alert('Por favor preencha todos os campos obrigatórios.');
            return;
        }

        const vehicle = viaturas.find(v => v.id === viaturaId);
        const costCenter = centrosCustos.find(c => c.id === centroCustoId);
        const total = (dias * precoDiario) * 1.23; // Including 23% Tax
        const subtotal = dias * precoDiario;
        const tax = subtotal * 0.23;

        const description = `Aluguer ${vehicle?.marca} ${vehicle?.modelo} (${vehicle?.matricula})${costCenter ? ` - ${costCenter.nome}` : ''}`;

        const newInvoice: Fatura = {
            id: crypto.randomUUID(),
            numero: `FT 2024/${(invoices.length + 100).toString()}`, // Temporary numbering
            data: dataInicio,
            vencimento: new Date(new Date(dataInicio).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
            clienteId,
            status: 'emitida',
            tipo: 'aluguer',
            aluguerDetails: {
                viaturaId,
                dias,
                dataInicio,
                dataFim: new Date(new Date(dataInicio).getTime() + dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                centroCustoId
            },
            subtotal,
            imposto: tax,
            desconto: 0,
            total,
            itens: [{
                id: crypto.randomUUID(),
                descricao: description,
                quantidade: dias,
                precoUnitario: precoDiario,
                taxaImposto: 23,
                total: total // Note: Item total usually has separate field for tax but simplified here
            }]
        };

        onSaveRental(newInvoice);
        setView('list');
        // Reset form
        setClienteId('');
        setViaturaId('');
        setCentroCustoId('');
        setDias(1);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const generateRentalPDF = async (invoice: Fatura) => {
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
            doc.text(`EMITIDO EM: ${new Date().toLocaleDateString()}`, pageWidth - 10, 44, { align: 'right' });

            // --- TITLE ---
            doc.setFontSize(22);
            doc.setTextColor(20, 60, 140);
            doc.setFont('helvetica', 'bold');
            doc.text('FATURA DE ALUGUER', 10, 70);

            let yPos = 85;

            // --- DETAILS ---
            // Column 1: Invoice Info
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('NÚMERO', 10, yPos);
            doc.text('DATA', 10, yPos + 15);
            doc.text('VENCIMENTO', 10, yPos + 30);

            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold');
            doc.text(invoice.numero, 10, yPos + 6);
            doc.setFontSize(11);
            doc.text(invoice.data, 10, yPos + 21);
            doc.text(invoice.vencimento, 10, yPos + 36);

            // Column 2: Vehicle Info
            const col2X = 70;
            const vehicle = viaturas.find(v => v.id === invoice.aluguerDetails?.viaturaId);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('VIATURA', col2X, yPos);

            if (vehicle) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(0);
                doc.text(`${vehicle.marca} ${vehicle.modelo}`, col2X, yPos + 6);
                doc.setFontSize(10);
                doc.setTextColor(80);
                doc.text(vehicle.matricula, col2X, yPos + 11);
            } else {
                doc.text('N/A', col2X, yPos + 6);
            }

            // Column 3: Client Info
            const col3X = 130;
            const client = clientes.find(c => c.id === invoice.clienteId);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('CLIENTE', col3X, yPos);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(client?.nome || 'Cliente N/A', col3X, yPos + 6);

            if (client?.nif) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(80);
                doc.text(`NIF: ${client.nif}`, col3X, yPos + 11);
            }

            yPos += 50;

            // --- TABLE ---
            const days = invoice.aluguerDetails?.dias || 0;
            const dailyRate = invoice.itens[0]?.precoUnitario || 0;

            const tableBody = [
                [
                    'Aluguer de Viatura',
                    `${days} dias`,
                    formatCurrency(dailyRate),
                    '23%',
                    formatCurrency(invoice.subtotal)
                ]
            ];

            autoTable(doc, {
                startY: yPos,
                head: [['DESCRIÇÃO', 'PERÍODO', 'DIÁRIA', 'TAXA', 'TOTAL LÍQUIDO']],
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
                    1: { cellWidth: 30, halign: 'center' },
                    2: { cellWidth: 30, halign: 'right' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
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
            doc.text('IVA (23%):', totalsX, finalY + 7);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(formatCurrency(invoice.subtotal), pageWidth - 10, finalY, { align: 'right' });
            doc.text(formatCurrency(invoice.imposto), pageWidth - 10, finalY + 7, { align: 'right' });

            // Grand Total Box
            doc.setFillColor(20, 60, 140);
            doc.roundedRect(totalsX - 5, finalY + 15, 90, 12, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text('TOTAL A PAGAR', totalsX, finalY + 23);
            doc.setFontSize(12);
            doc.text(formatCurrency(invoice.total), pageWidth - 10, finalY + 23, { align: 'right' });

            // --- FOOTER ---
            const signY = 270;
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.setTextColor(0);

            doc.line(10, signY, 80, signY);
            doc.setFontSize(9);
            doc.text('O Responsável', 10, signY + 5);

            doc.line(130, signY, pageWidth - 10, signY);
            doc.text('O Cliente', 130, signY + 5);

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Documento processado por computador`, 10, pageWidth - 10);

            doc.save(`Fatura_Aluguer_${invoice.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF');
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
            // Data Aggregation
            const rentals = invoices.filter(inv => inv.tipo === 'aluguer');
            const costCenterStats = new Map<string, { count: number; total: number }>();

            rentals.forEach(rental => {
                const ccId = rental.aluguerDetails?.centroCustoId || 'uncategorized';
                const current = costCenterStats.get(ccId) || { count: 0, total: 0 };
                costCenterStats.set(ccId, {
                    count: current.count + 1,
                    total: current.total + rental.total
                });
            });

            const totalSpend = Array.from(costCenterStats.values()).reduce((sum, item) => sum + item.total, 0);

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
            doc.text('RELATÓRIO DE CUSTOS DE ALUGUER', 10, 70);

            const yPos = 85;

            // --- TABLE ---
            const tableBody = Array.from(costCenterStats.entries()).map(([ccId, stats]) => {
                const ccName = ccId === 'uncategorized'
                    ? 'Sem Centro de Custo'
                    : centrosCustos.find(c => c.id === ccId)?.nome || 'Desconhecido';

                return [
                    ccName.toUpperCase(),
                    stats.count.toString(),
                    ((stats.total / totalSpend) * 100).toFixed(1) + '%',
                    formatCurrency(stats.total)
                ];
            });

            // Sort by Total Value (descending)
            tableBody.sort((a, b) => {
                const valA = parseFloat(a[3].replace(/[^0-9,-]+/g, "").replace(",", "."));
                const valB = parseFloat(b[3].replace(/[^0-9,-]+/g, "").replace(",", "."));
                return valB - valA;
            });

            // Add Total Row
            tableBody.push([
                'TOTAL',
                rentals.length.toString(),
                '100%',
                formatCurrency(totalSpend)
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['CENTRO DE CUSTO', 'QTD. ALUGUERES', '% GASTO', 'TOTAL GASTO']],
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
                    1: { cellWidth: 35, halign: 'center' },
                    2: { cellWidth: 30, halign: 'center' },
                    3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
                },
                alternateRowStyles: {
                    fillColor: [250, 250, 255]
                },
                didParseCell: (data: any) => {
                    if (data.row.index === tableBody.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                        data.cell.styles.textColor = [20, 60, 140];
                    }
                }
            });

            // --- FOOTER ---
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Pág. ${i} de ${pageCount} - Relatório Financeiro`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            doc.save(`Relatorio_Custos_Aluguer_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Erro ao gerar relatorio:', error);
            alert('Erro ao gerar relatório');
        }
    };

    if (view === 'create') {
        return (
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-center justify-between">
                    <button onClick={() => setView('list')} className="text-slate-400 hover:text-white transition-colors">
                        &larr; Voltar
                    </button>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Car className="w-6 h-6 text-amber-500" />
                        Novo Aluguer de Viatura
                    </h2>
                </div>

                <div className="bg-[#1e293b]/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700/50 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Cliente</label>
                            <select
                                value={clienteId}
                                onChange={(e) => setClienteId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="">Selecione o Cliente</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Viatura</label>
                            <select
                                value={viaturaId}
                                onChange={(e) => handleViaturaSelect(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="">Selecione a Viatura</option>
                                {viaturas.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.matricula}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Data de Início</label>
                            <input
                                type="date"
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Dias</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={dias}
                                    onChange={(e) => setDias(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Diária (€)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={precoDiario}
                                    onChange={(e) => setPrecoDiario(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-slate-400">Centro de Custo (Opcional)</label>
                            <select
                                value={centroCustoId}
                                onChange={(e) => setCentroCustoId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="">Selecione o Centro de Custo</option>
                                {centrosCustos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-700 flex justify-between items-center">
                        <div className="text-right">
                            <p className="text-slate-400 text-sm">Total Estimado</p>
                            <p className="text-2xl font-bold text-amber-500">{formatCurrency((dias * precoDiario) * 1.23)}</p>
                        </div>
                        <button
                            onClick={handleCreateRental}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all transform hover:scale-105"
                        >
                            Emitir Fatura de Aluguer
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Pesquisar alugueres..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder:text-slate-500"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={generateCostCenterReport}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-medium border border-slate-700 transition-all shadow-sm"
                    >
                        <Download className="w-5 h-5 text-slate-400" />
                        <span className="hidden sm:inline">Relatório Custos</span>
                    </button>
                    <button
                        onClick={() => setView('create')}
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-amber-900/20 hover:shadow-amber-900/40"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Aluguer
                    </button>
                </div>
            </div>

            <div className="bg-[#1e293b]/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Fatura</th>
                            <th className="px-6 py-4">Viatura</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Período</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                            <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {filteredInvoices.length > 0 ? (
                            filteredInvoices.map((inv) => {
                                const vehicle = viaturas.find(v => v.id === inv.aluguerDetails?.viaturaId);
                                return (
                                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-white group-hover:text-amber-400 transition-colors">
                                            {inv.numero}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Viatura N/A'}
                                            <span className="block text-xs text-slate-500">{vehicle?.matricula}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {clientes.find(c => c.id === inv.clienteId)?.nome || inv.clienteId}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {inv.aluguerDetails?.dias} dias
                                            <span className="block text-xs text-slate-500">
                                                {inv.aluguerDetails?.dataInicio}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-white">
                                            {formatCurrency(inv.total)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${inv.status === 'paga'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    }`}>
                                                    {inv.status.toUpperCase()}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        generateRentalPDF(inv);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    title="Baixar PDF"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(inv.id);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <Car className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    Nenhum aluguer encontrado
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div >
    );
}
