
import React, { useMemo, useState, useEffect } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Search, User, Clock, FileDown, Trash2, Pencil } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function EscalasHistory() {
    const { scaleBatches, servicos, cancelScaleBatch, centrosCustos } = useWorkshop();
    const { currentUser, userRole } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(id);
    }, []);

    // Filter Batches based on Role and Search
    const filteredBatches = useMemo(() => {
        let batches = [...scaleBatches];

        // 1. Role Filtering
        const canViewAll = userRole === 'admin' || userRole === 'gestor';
        if (!canViewAll && currentUser) {
            batches = batches.filter(batch =>
                batch.created_by === currentUser.email ||
                batch.created_by === currentUser.nome ||
                batch.created_by === currentUser.id
            );
        }

        // 2. Text Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            batches = batches.filter(batch =>
                batch.name?.toLowerCase().includes(lowerTerm) ||
                batch.status?.toLowerCase().includes(lowerTerm) ||
                batch.created_by?.toLowerCase().includes(lowerTerm)
            );
        }

        // 3. Date Filter
        if (filterDate) {
            batches = batches.filter(batch => batch.created_at.startsWith(filterDate));
        }

        return batches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [scaleBatches, userRole, currentUser, searchTerm, filterDate]);

    // Helper to get stats for a batch
    const getBatchStats = (batchId: string) => {
        const batchServices = servicos.filter(s => s.batchId === batchId);
        const total = batchServices.length;
        const assigned = batchServices.filter(s => s.motoristaId).length;
        const completed = batchServices.filter(s => s.concluido).length;
        const pending = total - assigned;

        return { total, assigned, completed, pending, batchServices };
    };

    // --- Actions ---

    // 1. PDF Generation
    const generatePDF = async (batch: any) => {
        const { batchServices } = getBatchStats(batch.id);
        const doc = new jsPDF();

        // 1. Logo Handling
        try {
            const logoUrl = '/logo-algar-frota.png';
            const imgData = await fetch(logoUrl)
                .then(res => res.blob())
                .then(blob => new Promise<string | ArrayBuffer>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                }));

            if (imgData) {
                doc.addImage(imgData as string, 'PNG', 15, 10, 50, 25);
            }
        } catch (e) {
            console.warn('Logo load failed', e);
        }

        // 2. Header Content
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);

        // Schedule ID & Date
        doc.setFontSize(14);
        doc.setTextColor(51, 65, 85);
        if (batch.serial_number) {
            doc.text(`Escala #${batch.serial_number}`, pageWidth - 15, 20, { align: 'right' });
        } else {
            doc.text(`Escala #${batch.id.slice(0, 8)}`, pageWidth - 15, 20, { align: 'right' });
        }

        doc.setFontSize(10);
        doc.setTextColor(100);
        const refDate = new Date(batch.reference_date).toLocaleDateString();
        doc.text(refDate, pageWidth - 15, 26, { align: 'right' });

        // 3. Meta Info
        let currentY = 45;
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);

        const ccName = centrosCustos.find(c => c.id === batch.centro_custo_id)?.nome || 'N/A';
        doc.text(`Centro de Custo: ${ccName}`, 15, currentY);

        const creatorName = batch.created_by || 'Sistema';
        doc.text(`Criado por: ${batch.created_by_role || ''} ${creatorName}`, 15, currentY + 6);

        if (batch.notes) {
            doc.setFont('helvetica', 'italic');
            doc.text(`Obs: ${batch.notes}`, 15, currentY + 12);
            doc.setFont('helvetica', 'normal');
            currentY += 6;
        }

        // --- WATERMARK IF CANCELLED ---
        if (batch.status === 'cancelled') {
            doc.saveGraphicsState();
            doc.setTextColor(255, 0, 0);
            doc.setFontSize(60);
            doc.setGState(new doc.GState({ opacity: 0.15 }));
            doc.text("ESCALA CANCELADA", pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
            doc.restoreGraphicsState();

            // Add red stamp to header too
            doc.setTextColor(220, 38, 38);
            doc.setFontSize(14);
            doc.text("[CANCELADA]", pageWidth - 15, 32, { align: 'right' });
        }

        // 4. Content Tables
        const departments = Array.from(new Set(batchServices.map((s: any) => s.departamento || 'Geral'))).sort();

        currentY += 15;

        // @ts-ignore
        departments.forEach((dept: string) => {
            const deptServices = batchServices.filter((s: any) => (s.departamento || 'Geral') === dept);

            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.setFillColor(241, 245, 249);
            doc.text(dept.toUpperCase(), 15, currentY);

            const tableBody = deptServices.map((s: any) => [
                s.tipo.toUpperCase(),
                s.passageiro,
                s.origem,
                s.destino,
                s.hora,
                s.obs || '-'
            ]);

            autoTable(doc, {
                startY: currentY + 2,
                head: [['TIPO', 'PASSAGEIRO', 'ORIGEM', 'DESTINO', 'HORA', 'OBS']],
                body: tableBody,
                headStyles: {
                    fillColor: batch.status === 'cancelled' ? [127, 29, 29] : [15, 23, 42], // Red header if cancelled
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: { textColor: 50, halign: 'center' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 25, fontStyle: 'bold' },
                    1: { halign: 'left' },
                    2: { halign: 'left' },
                    3: { halign: 'left' },
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 0) {
                        const text = data.cell.raw as string;
                        if (text === 'ENTRADA') data.cell.styles.textColor = [217, 119, 6];
                        else if (text === 'SAIDA' || text === 'SAÍDA') data.cell.styles.textColor = [79, 70, 229];
                    }
                }
            });

            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 15;
        });

        // 5. Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            doc.text("Tropical Inspire App", pageWidth - 15, pageHeight - 10, { align: 'right' });
        }

        doc.save(`Escala_${batch.serial_number || batch.id.slice(0, 4)}_${batch.status === 'cancelled' ? 'CANCELADA_' : ''}${batch.reference_date}.pdf`);
    };

    // 2. Cancellation Logic
    const handleCancel = async (batch: any, assignedCount: number) => {
        if (assignedCount > 0) {
            alert('Não é possível apagar/cancelar esta escala pois existem serviços já associados a motoristas.\n\nPor favor, remova todas as atribuições primeiro.');
            return;
        }

        if (confirm('Tem certeza que deseja CANCELAR esta escala?\n\nEla ficará marcada como cancelada e não poderá ser recuperada.')) {
            const res = await cancelScaleBatch(batch.id);
            if (res.success) {
                alert('Escala cancelada com sucesso!');
            } else {
                alert('Erro ao cancelar escala: ' + res.error);
            }
        }
    };

    // 3. Edit Logic Check
    const getEditStatus = (batch: any) => {
        // Can edit ONLY if created < 1 hour ago
        const createdAt = new Date(batch.created_at).getTime();
        const diffHours = (now - createdAt) / (1000 * 60 * 60);

        const isOwner = batch.created_by === currentUser?.nome || batch.created_by === currentUser?.email || batch.created_by === currentUser?.id;
        const isAdmin = userRole === 'admin' || userRole === 'gestor';

        const hasAccess = isOwner || isAdmin;
        const isEditable = diffHours < 1;

        return { hasAccess, isEditable };
    };


    return (
        <div className="flex flex-col h-full bg-[#0f172a] p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Header / Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Pesquisar histórico..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1e293b] text-slate-200 pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-500 text-sm font-medium"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:flex-none">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="w-full bg-[#1e293b] text-slate-200 pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/50 focus:border-blue-500/50 outline-none transition-all text-sm font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
                        <Calendar className="w-12 h-12 mb-4 opacity-20" />
                        <span className="text-lg font-medium">Nenhum histórico encontrado</span>
                    </div>
                ) : (
                    filteredBatches.map(batch => {
                        const stats = getBatchStats(batch.id);
                        const { hasAccess, isEditable } = getEditStatus(batch);
                        const isCancelled = batch.status === 'cancelled';

                        return (
                            <div key={batch.id} className={`
                                bg-[#1e293b]/50 border rounded-2xl p-5 hover:bg-[#1e293b] transition-all group shadow-lg shadow-black/20
                                ${isCancelled ? 'border-red-900/30 opacity-75' : 'border-slate-700/50 hover:border-blue-500/30'}
                            `}>
                                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                    {/* Icon & ID */}
                                    <div className="flex items-center gap-4 min-w-[200px]">
                                        <div className={`
                                            w-12 h-12 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-110
                                            ${isCancelled ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}
                                        `}>
                                            <Calendar className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-lg flex items-center gap-2 ${isCancelled ? 'text-red-400 line-through' : 'text-white'}`}>
                                                {batch.name || 'Sem Nome'}
                                            </h3>
                                            <span className="text-xs font-mono text-slate-500 flex items-center gap-2">
                                                {batch.id.slice(0, 8)}...
                                                {isCancelled && <span className="text-red-500 font-bold uppercase text-[10px] border border-red-500/30 px-1 rounded">Cancelada</span>}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Creator Info */}
                                    <div className="flex flex-col min-w-[150px]">
                                        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">
                                            <User className="w-3 h-3" /> Criado por
                                        </div>
                                        <span className="text-slate-200 font-medium text-sm">{batch.created_by || 'Desconhecido'}</span>
                                        <span className="text-xs text-slate-500 capitalize">{batch.created_by_role || 'N/A'}</span>
                                    </div>

                                    {/* Date */}
                                    <div className="flex flex-col min-w-[150px]">
                                        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">
                                            <Clock className="w-3 h-3" /> Data
                                        </div>
                                        <span className="text-slate-200 font-medium text-sm">
                                            {new Date(batch.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {new Date(batch.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex-1 flex gap-4 justify-center md:justify-end w-full md:w-auto">
                                        <div className="flex flex-col items-center p-2 bg-slate-900/50 rounded-lg border border-slate-800 min-w-[80px]">
                                            <span className="text-xs text-slate-500 font-bold uppercase">Total</span>
                                            <span className="text-xl font-black text-white">{stats.total}</span>
                                        </div>
                                        <div className="flex flex-col items-center p-2 bg-slate-900/50 rounded-lg border border-slate-800 min-w-[80px]">
                                            <span className="text-xs text-slate-500 font-bold uppercase text-emerald-500">Atrib.</span>
                                            <span className="text-xl font-black text-emerald-400">{stats.assigned}</span>
                                        </div>
                                        <div className="flex flex-col items-center p-2 bg-slate-900/50 rounded-lg border border-slate-800 min-w-[80px]">
                                            <span className="text-xs text-slate-500 font-bold uppercase text-amber-500">Pend.</span>
                                            <span className="text-xl font-black text-amber-400">{stats.pending}</span>
                                        </div>
                                    </div>

                                    {/* ACTIONS */}
                                    <div className="flex items-center gap-2 pl-4 border-l border-slate-700/50">
                                        {/* 1. PDF - Always visible */}
                                        <button
                                            onClick={() => generatePDF(batch)}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors relative group/btn"
                                            title="Baixar PDF"
                                        >
                                            <FileDown className="w-5 h-5" />
                                        </button>

                                        {/* 2. Edit - Only if < 1h AND Owner/Admin AND Active */}
                                        {hasAccess && !isCancelled && (
                                            <button
                                                onClick={() => isEditable ? alert('Funcionalidade de Edição em breve!') : alert('O período de edição expirou (1 hora).')}
                                                disabled={!isEditable}
                                                className={`p-2 rounded-lg transition-colors relative group/btn ${isEditable
                                                    ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                                                    : 'text-slate-600 cursor-not-allowed'
                                                    }`}
                                                title={isEditable ? "Editar Escala" : "Tempo de edição expirado"}
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                        )}

                                        {/* 3. Cancel - Only if Active AND Assigned=0 */}
                                        {hasAccess && !isCancelled && (
                                            <button
                                                onClick={() => handleCancel(batch, stats.assigned)}
                                                className={`p-2 rounded-lg transition-colors relative group/btn ${stats.assigned === 0
                                                    ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                                    : 'text-slate-600 cursor-not-allowed'
                                                    }`}
                                                title={stats.assigned > 0 ? "Remova as atribuições para cancelar" : "Cancelar/Apagar Escala"}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                                {stats.assigned > 0 && (
                                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-slate-500 rounded-full" />
                                                )}
                                            </button>
                                        )}
                                    </div>

                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
