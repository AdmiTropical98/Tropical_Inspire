import { useState } from 'react';
import { Plus, Search, Car, Printer, Trash2, Download, X, Edit, ChevronDown, ChevronUp } from 'lucide-react'; // Added ChevronDown, ChevronUp
import type { Fatura } from '../../types';
import { useWorkshop } from '../../contexts/WorkshopContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import VehicleSelectionModal from './VehicleSelectionModal';

interface AlugueresProps {
    invoices: Fatura[];
    onSaveRental: (data: Fatura) => void;
    onDelete: (id: string) => void;
}

export default function Alugueres({ invoices, onSaveRental, onDelete }: AlugueresProps) {
    const { viaturas, centrosCustos, clientes } = useWorkshop();

    // Filter duplicates: Keep only used vehicles if duplicates exist
    const filteredDisplayViaturas = (() => {
        const activeViaturaIds = new Set(
            invoices
                .filter(i => i.tipo === 'aluguer' && i.aluguerDetails)
                .flatMap(i => {
                    const details = i.aluguerDetails!;
                    return [...(details.viaturasIds || []), details.viaturaId].filter(Boolean);
                })
        );

        const byPlate: Record<string, typeof viaturas> = {};
        viaturas.forEach(v => {
            const plate = v.matricula.trim().toUpperCase();
            if (!byPlate[plate]) byPlate[plate] = [];
            byPlate[plate].push(v);
        });

        return Object.values(byPlate).map(group => {
            if (group.length === 1) return group[0];

            // If duplicates, prioritize those with specific rental history
            const used = group.filter(v => activeViaturaIds.has(v.id));

            // If we have used ones, pick the last one (assuming newest/most relevant)
            if (used.length > 0) return used[used.length - 1];

            // If none used, keep the last one from the original group
            return group[group.length - 1];
        });
    })();

    const [view, setView] = useState<'list' | 'create'>('list');
    const [searchTerm, setSearchTerm] = useState('');

    // Rental Form State
    const [editingId, setEditingId] = useState<string | null>(null); // EDIT MODE ID
    const [clienteId, setClienteId] = useState('');
    const [selectedViaturaIds, setSelectedViaturaIds] = useState<string[]>([]);

    // Custom Reference
    const [periodoReferencia, setPeriodoReferencia] = useState(''); // YYYY-MM

    // Per-vehicle customization state
    const [vehicleSettings, setVehicleSettings] = useState<Record<string, { dias: number, dataInicio: string }>>({});

    const [tempViaturaId, setTempViaturaId] = useState(''); // For the dropdown select before adding
    const [centroCustoId, setCentroCustoId] = useState('');
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dias, setDias] = useState(1);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);

    // Templates State
    const [templates, setTemplates] = useState<{ name: string, vehicleIds: string[] }[]>(() => {
        const saved = localStorage.getItem('rental_templates');
        return saved ? JSON.parse(saved) : [];
    });
    const [newTemplateName, setNewTemplateName] = useState('');
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);

    // Grouping State
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (groupId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    // ... (keep handleSaveTemplate, handleLoadTemplate, filteredInvoices, handleAddViatura, handleRemoveViatura, getVehicleSettings, updateVehicleDetails, calculateTotalDaily, calculateGrandTotal) ...

    const handleEdit = (invoice: Fatura) => {
        setEditingId(invoice.id);
        setClienteId(invoice.clienteId);

        // Restore Vehicle IDs
        const details = invoice.aluguerDetails;
        const vIds = details?.viaturasIds || (details?.viaturaId ? [details?.viaturaId] : []);
        setSelectedViaturaIds(vIds);

        // Restore Settings
        const newSettings: Record<string, { dias: number, dataInicio: string }> = {};
        if (details?.detalhesViaturas) {
            details.detalhesViaturas.forEach(d => {
                newSettings[d.viaturaId] = { dias: d.dias, dataInicio: d.dataInicio };
            });
        }
        setVehicleSettings(newSettings);

        // Restore General Defaults (for fallback UI)
        if (details) {
            setDataInicio(details.dataInicio);
            setDias(details.dias);
            setCentroCustoId(details.centroCustoId || '');
            setPeriodoReferencia(details.periodoReferencia || '');
        }

        setView('create');
    };

    const handleSaveTemplate = () => {
        if (!newTemplateName) return;
        const newTemplate = { name: newTemplateName, vehicleIds: selectedViaturaIds };
        const updated = [...templates, newTemplate];
        setTemplates(updated);
        localStorage.setItem('rental_templates', JSON.stringify(updated));
        setNewTemplateName('');
        setShowSaveTemplate(false);
    };

    const handleLoadTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const template = templates.find(t => t.name === e.target.value);
        if (template) {
            setSelectedViaturaIds(template.vehicleIds);
            // Reset individual settings when loading template
            setVehicleSettings({});
        }
    };

    const filteredInvoices = invoices.filter(inv =>
        (inv.tipo === 'aluguer') &&
        (inv.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.status.includes(searchTerm.toLowerCase()))
    );

    // Group rentals by Client and Month (Consolidated)
    const groupedRentals = (() => {
        const groups: Record<string, {
            id: string;
            clienteId: string;
            periodoReferencia: string;
            centroCustoIds: Set<string>; // Changed to Set
            rawDate: Date; // for sorting
            invoices: Fatura[];
            total: number;
        }> = {};

        filteredInvoices.forEach(inv => {
            const ref = inv.aluguerDetails?.periodoReferencia || '';
            const monthKey = ref || inv.data.substring(0, 7); // YYYY-MM
            const ccId = inv.aluguerDetails?.centroCustoId || 'uncategorized';

            // Key based ONLY on Client and Month
            const key = `${inv.clienteId}-${monthKey}`;

            if (!groups[key]) {
                const dateObj = ref ? new Date(ref + '-01') : new Date(inv.data);
                groups[key] = {
                    id: key,
                    clienteId: inv.clienteId,
                    periodoReferencia: monthKey,
                    centroCustoIds: new Set(),
                    rawDate: dateObj,
                    invoices: [],
                    total: 0
                };
            }
            groups[key].invoices.push(inv);
            groups[key].centroCustoIds.add(ccId);
            groups[key].total += inv.total;
        });

        return Object.values(groups).sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
    })();

    const handleAddViatura = () => {
        if (tempViaturaId && !selectedViaturaIds.includes(tempViaturaId)) {
            setSelectedViaturaIds([...selectedViaturaIds, tempViaturaId]);
            setTempViaturaId('');
        }
    };

    const handleRemoveViatura = (id: string) => {
        setSelectedViaturaIds(selectedViaturaIds.filter(vId => vId !== id));
        const newSettings = { ...vehicleSettings };
        delete newSettings[id];
        setVehicleSettings(newSettings);
    };

    const getVehicleSettings = (id: string) => {
        return vehicleSettings[id] || { dias: dias, dataInicio: dataInicio };
    };

    const updateVehicleDetails = (id: string, field: 'dias' | 'dataInicio', value: string | number) => {
        setVehicleSettings(prev => ({
            ...prev,
            [id]: {
                ...getVehicleSettings(id),
                [field]: value
            }
        }));
    };

    const calculateTotalDaily = () => {
        return selectedViaturaIds.reduce((acc, id) => {
            const v = viaturas.find(vi => vi.id === id);
            return acc + (v?.precoDiario || 0);
        }, 0);
    };

    const calculateGrandTotal = () => {
        return selectedViaturaIds.reduce((acc, id) => {
            const v = viaturas.find(vi => vi.id === id);
            const settings = getVehicleSettings(id);
            return acc + ((v?.precoDiario || 0) * settings.dias);
        }, 0);
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
            const viaturasIds = invoice.aluguerDetails?.viaturasIds;
            const singleViaturaId = invoice.aluguerDetails?.viaturaId;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(viaturasIds && viaturasIds.length > 1 ? 'VIATURAS' : 'VIATURA', col2X, yPos);

            if (viaturasIds && viaturasIds.length > 0) {
                let currentY = yPos + 6;
                viaturasIds.forEach((vid: string) => {
                    const v = viaturas.find(vi => vi.id === vid);
                    if (v) {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(10);
                        doc.setTextColor(0);
                        doc.text(`${v.marca} ${v.modelo}`, col2X, currentY);
                        doc.setFontSize(8);
                        doc.setTextColor(80);
                        doc.text(v.matricula, col2X + 35, currentY); // Offset plate slightly
                        currentY += 5;
                    }
                });
            } else if (singleViaturaId) {
                const vehicle = viaturas.find(v => v.id === singleViaturaId);
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
            // Use invoice.itens directly as they are already broken down by vehicle in handleCreateRental
            const tableBody = invoice.itens?.map(item => [
                item.descricao,
                `${item.quantidade} dias`,
                formatCurrency(item.precoUnitario),
                `${item.taxaImposto}%`,
                formatCurrency(item.total) // Note: item.total in handleCreateRental already includes tax, but let's be careful. 
                // Wait, item.total in handleCreateRental is (daily * days * 1.23). 
                // The column header says "TOTAL LÍQUIDO" (Net Total)? Or Total with Tax?
                // The previous code showed `formatCurrency(invoice.subtotal)` in the total line, so the main table probably expects Net?
                // The headers are DESCRIÇÃO | PERÍODO | DIÁRIA | TAXA | TOTAL LÍQUIDO.
                // "Total Líquido" usually means Net. 
                // Let's recalculate Net for the row: (qty * price)
            ]) || [];

            if (tableBody.length === 0) {
                // Fallback if no items
                const days = invoice.aluguerDetails?.dias || 0;
                const dailyRate = invoice.itens?.[0]?.precoUnitario || 0;
                tableBody.push([
                    'Aluguer de Viatura',
                    `${days} dias`,
                    formatCurrency(dailyRate),
                    '23%',
                    formatCurrency(invoice.subtotal)
                ]);
            } else {
                // Correct the "Total Líquido" column to be Net
                tableBody.forEach((row, index) => {
                    const item = invoice.itens![index];
                    // Column 4 (index 4) should be Net Total
                    row[4] = formatCurrency(item.quantidade * item.precoUnitario);
                });
            }

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
        const doc = new jsPDF({ orientation: 'landscape' });
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
            // Group rentals by Cost Center
            const rentals = invoices.filter(inv => inv.tipo === 'aluguer');
            const costCenterGroups = new Map<string, { total: number; items: Fatura[] }>();

            rentals.forEach(rental => {
                const ccId = rental.aluguerDetails?.centroCustoId || 'uncategorized';
                const current = costCenterGroups.get(ccId) || { total: 0, items: [] };

                current.items.push(rental);
                current.total += rental.total;

                costCenterGroups.set(ccId, current);
            });

            const totalSpend = Array.from(costCenterGroups.values()).reduce((sum, item) => sum + item.total, 0);

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
                // Fallback header background
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
            doc.text('RELATÓRIO DETALHADO DE CUSTOS', 10, 70);

            let currentY = 85;

            // Iterate over each Cost Center and create a table
            const entries = Array.from(costCenterGroups.entries());

            // Sort entries? Optional. Let's sort by name if possible, or total amount desc.
            entries.sort((a, b) => b[1].total - a[1].total);

            for (const [ccId, group] of entries) {

                // Cost Center Header
                const ccName = ccId === 'uncategorized'
                    ? 'Sem Centro de Custo Definido'
                    : centrosCustos.find(c => c.id === ccId)?.nome || 'Centro de Custo Removido';

                // Check page break: Force new page for each Cost Center (except the first one)
                if (entries.indexOf([ccId, group]) > 0) {
                    doc.addPage();
                    currentY = 20;
                } else if (currentY + 30 > doc.internal.pageSize.height) {
                    // Safety check for the very first one if header pushed it down too much (unlikely but safe)
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(20, 60, 140);
                doc.setFont('helvetica', 'bold');
                doc.text(ccName.toUpperCase(), 10, currentY);
                currentY += 8;


                // Prepare table data for this group
                const bodyData: any[][] = [];

                group.items.forEach(pdfInv => {
                    const vehicleIds = pdfInv.aluguerDetails?.viaturasIds || (pdfInv.aluguerDetails?.viaturaId ? [pdfInv.aluguerDetails?.viaturaId] : []);

                    if (vehicleIds.length > 0) {
                        vehicleIds.forEach(vid => {
                            const v = viaturas.find(veh => veh.id === vid);
                            const details = pdfInv.aluguerDetails?.detalhesViaturas?.find(d => d.viaturaId === vid);

                            let vehicleTotal = 0;
                            if (details) {
                                // Calculate specific total for this vehicle: (daily * days) * 1.23 (tax)
                                vehicleTotal = (details.precoDiario * details.dias) * 1.23;
                            } else if (v && pdfInv.aluguerDetails?.dias) {
                                // Fallback logic
                                vehicleTotal = ((v.precoDiario || 0) * pdfInv.aluguerDetails.dias) * 1.23;
                            }

                            // Format Reference Month
                            const refDate = pdfInv.aluguerDetails?.periodoReferencia
                                ? new Date(pdfInv.aluguerDetails.periodoReferencia + '-01')
                                : new Date(pdfInv.data);

                            const refMonthStr = refDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                            const capitalRef = refMonthStr.charAt(0).toUpperCase() + refMonthStr.slice(1);

                            // Calculate Start/End based on specific vehicle details if available
                            let startRef: Date;
                            let endRef: Date;

                            if (details && details.dataInicio) {
                                startRef = new Date(details.dataInicio);
                                endRef = new Date(startRef);
                                endRef.setDate(startRef.getDate() + (details.dias - 1));
                            } else {
                                // Fallback to Reference Month logic
                                startRef = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
                                endRef = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
                            }

                            const dateRangeStr = `${startRef.toLocaleDateString('pt-PT')} -> ${endRef.toLocaleDateString('pt-PT')}`;

                            const netVal = vehicleTotal / 1.23;
                            const vatVal = vehicleTotal - netVal;
                            const days = details ? details.dias : (pdfInv.aluguerDetails?.dias || 0);

                            bodyData.push([
                                dateRangeStr,
                                capitalRef,
                                v ? v.matricula : 'Viatura Removida',
                                days,
                                formatCurrency(netVal),
                                formatCurrency(vatVal),
                                formatCurrency(vehicleTotal)
                            ]);
                        });
                    } else {
                        // Fallback
                        const netVal = pdfInv.total / 1.23;
                        const vatVal = pdfInv.total - netVal;
                        const refDate = pdfInv.aluguerDetails?.periodoReferencia
                            ? new Date(pdfInv.aluguerDetails.periodoReferencia + '-01')
                            : new Date(pdfInv.data);
                        const refMonthStr = refDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                        const capitalRef = refMonthStr.charAt(0).toUpperCase() + refMonthStr.slice(1);

                        // Calculate Start/End of Reference Month
                        const startRef = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
                        const endRef = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
                        const dateRangeStr = `${startRef.toLocaleDateString('pt-PT')} -> ${endRef.toLocaleDateString('pt-PT')}`;
                        const days = pdfInv.aluguerDetails?.dias || 0;

                        bodyData.push([
                            dateRangeStr,
                            capitalRef,
                            'Sem Viatura',
                            days,
                            formatCurrency(netVal),
                            formatCurrency(vatVal),
                            formatCurrency(pdfInv.total)
                        ]);
                    }
                });

                // Add Subtotal Row
                const groupNet = group.total / 1.23;
                const groupVat = group.total - groupNet;
                bodyData.push([
                    '',
                    '',
                    'SUBTOTAL',
                    '',
                    formatCurrency(groupNet),
                    formatCurrency(groupVat),
                    formatCurrency(group.total)
                ]);

                // Render Table for this CC
                autoTable(doc, {
                    startY: currentY,
                    head: [['DATA', 'MÊS REF.', 'VIATURA', 'DIAS', 'VALOR LIQ.', 'IVA (23%)', 'TOTAL']],
                    body: bodyData,
                    theme: 'striped',
                    headStyles: {
                        fillColor: [100, 100, 100],
                        textColor: 255,
                        fontStyle: 'bold',
                        halign: 'left'
                    },
                    columnStyles: {
                        0: { cellWidth: 50 }, // Data (Date Range)
                        1: { cellWidth: 40 }, // Mes Ref
                        2: { cellWidth: 35 }, // Viatura
                        3: { cellWidth: 20, halign: 'center' }, // Dias
                        4: { cellWidth: 40, halign: 'right' }, // Liq
                        5: { cellWidth: 35, halign: 'right' }, // IVA
                        6: { cellWidth: 'auto', halign: 'right' } // Total (Fill rest)
                    },
                    margin: { left: 10, right: 10 },
                    tableWidth: 'auto',
                    didParseCell: (data) => {
                        // Bold the subtotal row
                        if (data.row.index === bodyData.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [240, 240, 240];
                            if (data.column.index >= 3) {
                                data.cell.styles.textColor = [20, 60, 140];
                            }
                        }
                    },
                });

                currentY = (doc as any).lastAutoTable.finalY + 15;
            }

            // --- GRAND TOTAL ---
            if (currentY + 30 > doc.internal.pageSize.height) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFillColor(20, 60, 140);
            doc.roundedRect(pageWidth - 90, currentY, 80, 14, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('TOTAL GERAL', pageWidth - 85, currentY + 9);
            doc.text(formatCurrency(totalSpend), pageWidth - 15, currentY + 9, { align: 'right' });


            // --- FOOTER ---
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Pág. ${i} de ${pageCount} - Relatório Detalhado de Custos`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            }

            doc.save(`Relatorio_Detalhado_Aluguer_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Erro ao gerar relatorio:', error);
            alert('Erro ao gerar relatório');
        }
    };

    const generateRentalContract = async (invoice: Fatura) => {
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
            // --- HEADER ---
            try {
                const logoImg = await loadImage('/logo.png');
                const logoWidth = 40;
                const scaleFactor = logoWidth / logoImg.naturalWidth;
                const logoHeight = logoImg.naturalHeight * scaleFactor;

                doc.addImage(logoImg, 'PNG', 15, 10, logoWidth, logoHeight);
            } catch (e) {
                // Fallback text if logo fails
                doc.setFontSize(20);
                doc.setTextColor(20, 60, 140);
                doc.text('ALGARTEMPO', 15, 20);
            }

            // Company Info (Right aligned)
            doc.setFontSize(9);
            doc.setTextColor(80);
            doc.text('ALGARTEMPO - Gestão de Frota, Lda.', pageWidth - 15, 15, { align: 'right' });
            doc.text('NIF: 500 000 000', pageWidth - 15, 20, { align: 'right' });
            doc.text('Estrada Nacional 125, Almancil', pageWidth - 15, 25, { align: 'right' });

            // Title
            doc.setFontSize(18);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold');
            doc.text('CONTRATO DE ALUGUER', pageWidth / 2, 45, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Nº Contrato: ${invoice.numero}`, pageWidth / 2, 52, { align: 'center' });

            // --- PARTIES ---
            let yPos = 70;

            // PRIMEIRO OUTORGANTE
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('ENTRE:', 15, yPos);
            yPos += 7;

            doc.text('PRIMEIRO OUTORGANTE: ALGARTEMPO - Gestão de Frota, Lda.', 15, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text('Adiante designado por "LOCADOR".', 15, yPos + 5);

            // SEGUNDO OUTORGANTE
            yPos += 15;
            const client = clientes.find(c => c.id === invoice.clienteId);
            doc.setFont('helvetica', 'bold');
            doc.text(`E O SEGUNDO OUTORGANTE: ${client?.nome || '...................................................'}`, 15, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIF: ${client?.nif || '...................'}`, 15, yPos + 5);
            doc.text('Adiante designado por "LOCATÁRIO".', 15, yPos + 10);

            yPos += 20;
            doc.text('É celebrado o presente contrato de aluguer de viatura(s) sem condutor, que se rege pelas seguintes cláusulas:', 15, yPos);

            // --- DETAILS ---
            yPos += 15;
            doc.setFont('helvetica', 'bold');
            doc.text('1. OBJETO DO ALUGUER (VIATURAS)', 15, yPos);
            yPos += 7;

            const viaturasIds = invoice.aluguerDetails?.viaturasIds || (invoice.aluguerDetails?.viaturaId ? [invoice.aluguerDetails?.viaturaId] : []);

            if (viaturasIds.length > 0) {
                viaturasIds.forEach(vid => {
                    const v = viaturas.find(vi => vi.id === vid);
                    if (v) {
                        doc.setFont('helvetica', 'normal');
                        doc.text(`• ${v.marca} ${v.modelo} - Matrícula: ${v.matricula}`, 20, yPos);
                        yPos += 6;
                    }
                });
            } else {
                doc.text('• Nenhuma viatura especificada', 20, yPos);
                yPos += 6;
            }

            // --- DATES ---
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('2. PERÍODO DE ALUGUER', 15, yPos);
            yPos += 7;
            doc.setFont('helvetica', 'normal');
            doc.text(`Início: ${new Date(invoice.aluguerDetails?.dataInicio || '').toLocaleDateString('pt-PT')}`, 20, yPos);
            doc.text(`Fim Previsto: ${new Date(invoice.aluguerDetails?.dataFim || '').toLocaleDateString('pt-PT')}`, 80, yPos);
            doc.text(`Duração: ${invoice.aluguerDetails?.dias} dias`, 140, yPos);

            // --- CONDITIONS PLACEHOLDER ---
            yPos += 15;
            doc.setFont('helvetica', 'bold');
            doc.text('3. CONDIÇÕES GERAIS', 15, yPos);
            yPos += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            const clauses = [
                "a) O Locatário recebe a(s) viatura(s) em perfeito estado de funcionamento e conservação.",
                "b) O Locatário compromete-se a não utilizar a viatura para fins ilícitos ou transporte de mercadorias proibidas.",
                "c) O combustível é da responsabilidade do Locatário.",
                "d) Em caso de acidente, o Locatário deve comunicar imediatamente ao Locador e às autoridades competentes.",
                "e) O atraso na devolução implicará o pagamento de dias adicionais à taxa em vigor.",
                "f) O Locador não se responsabiliza por bens deixados no interior da viatura.",
                "g) Qualquer multa ou infração de trânsito durante o período é da inteira responsabilidade do Locatário."
            ];

            clauses.forEach(clause => {
                doc.text(clause, 20, yPos, { maxWidth: pageWidth - 40 });
                yPos += 6;
            });

            // --- SIGNATURES ---
            const signY = pageHeight - 50;

            doc.setFontSize(10);
            doc.text('Feito em duplicado e assinado,', 15, signY - 20);
            doc.text(`Almancil, ${new Date().toLocaleDateString('pt-PT')}`, 15, signY - 15);

            doc.setLineWidth(0.5);
            doc.line(20, signY, 90, signY);
            doc.line(120, signY, 190, signY);

            doc.setFont('helvetica', 'bold');
            doc.text('O LOCADOR', 35, signY + 5);
            doc.text('O LOCATÁRIO', 135, signY + 5);

            doc.save(`Contrato_Aluguer_${invoice.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

        } catch (error) {
            console.error('Erro ao gerar contrato:', error);
            alert('Erro ao gerar contrato');
        }
    };

    const handleCreateRental = () => {
        if (!clienteId || selectedViaturaIds.length === 0) {
            alert('Por favor, selecione um cliente e pelo menos uma viatura.');
            return;
        }

        const detailsMap = selectedViaturaIds.map(vid => {
            const v = viaturas.find(vi => vi.id === vid);
            const settings = vehicleSettings[vid];
            return {
                viaturaId: vid,
                dias: settings?.dias || 1,
                dataInicio: settings?.dataInicio || new Date().toISOString().split('T')[0],
                dataFim: new Date(new Date(settings?.dataInicio || new Date()).getTime() + (settings?.dias || 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                precoDiario: v?.precoDiario || 0
            };
        });

        // --- VALIDATION: CHECK AVAILABILITY ---
        const conflicts: string[] = [];

        detailsMap.forEach(newRental => {
            const newStart = new Date(newRental.dataInicio).getTime();
            const newEnd = new Date(newRental.dataFim).getTime();

            // Check against all existing invoices
            invoices.forEach(existingInv => {
                // Skip if not rental or if it's the one we are editing
                if (existingInv.tipo !== 'aluguer' || existingInv.id === editingId) return;

                const existingDetails = existingInv.aluguerDetails;
                if (!existingDetails) return;

                // Check against specific vehicle details in existing invoice
                if (existingDetails.detalhesViaturas) {
                    existingDetails.detalhesViaturas.forEach(existingV => {
                        if (existingV.viaturaId === newRental.viaturaId) {
                            const exStart = new Date(existingV.dataInicio).getTime();
                            const exEnd = new Date(existingV.dataFim || existingV.dataInicio).getTime(); // Fallback end

                            // Overlap Check
                            if (newStart <= exEnd && newEnd >= exStart) {
                                const vName = viaturas.find(v => v.id === newRental.viaturaId)?.matricula || '???';
                                const ccName = centrosCustos.find(c => c.id === existingDetails.centroCustoId)?.nome || 'Sem C.Custo';
                                conflicts.push(`Viatura ${vName} já alugada em ${ccName} (${existingV.dataInicio} a ${existingV.dataFim})`);
                            }
                        }
                    });
                } else if (existingDetails.viaturasIds?.includes(newRental.viaturaId) || existingDetails.viaturaId === newRental.viaturaId) {
                    // Fallback for legacy rentals without per-vehicle details
                    const exStart = new Date(existingDetails.dataInicio).getTime();
                    const exEnd = new Date(existingDetails.dataFim).getTime();

                    if (newStart <= exEnd && newEnd >= exStart) {
                        const vName = viaturas.find(v => v.id === newRental.viaturaId)?.matricula || '???';
                        const ccName = centrosCustos.find(c => c.id === existingDetails.centroCustoId)?.nome || 'Sem C.Custo';
                        conflicts.push(`Viatura ${vName} já alugada em ${ccName} (${existingDetails.dataInicio} a ${existingDetails.dataFim})`);
                    }
                }
            });
        });

        if (conflicts.length > 0) {
            alert(`Conflito de Disponibilidade:\n\n${conflicts.join('\n')}`);
            return;
        }

        const invoiceItems = detailsMap.map(detail => {
            const v = viaturas.find(vi => vi.id === detail.viaturaId);
            const netTotal = detail.precoDiario * detail.dias;
            return {
                id: crypto.randomUUID(),
                descricao: `${v?.marca} ${v?.modelo} (${v?.matricula}) - ${detail.dias} dias`,
                quantidade: 1,
                precoUnitario: netTotal,
                taxaImposto: 23,
                total: netTotal * 1.23
            };
        });

        // Calculate totals from detailsMap (Net Values)
        const subtotal = detailsMap.reduce((sum, item) => sum + (item.precoDiario * item.dias), 0);
        const amountVat = subtotal * 0.23;
        const total = subtotal + amountVat;

        const startDates = detailsMap.map(d => new Date(d.dataInicio).getTime());
        const endDates = detailsMap.map(d => new Date(d.dataFim).getTime());

        // Use Custom Reference OR Format based on Date
        const referenceToSave = periodoReferencia || '';

        const rentalData: Fatura = {
            id: editingId || crypto.randomUUID(), // Use existing ID if editing
            numero: editingId ? (invoices.find(i => i.id === editingId)?.numero || 'REG ERR') : `REG 2024/${invoices.filter(i => i.tipo === 'aluguer').length + 100}`,
            data: new Date().toISOString().split('T')[0], // Invoice Date
            vencimento: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            clienteId,
            status: 'emitida',
            itens: invoiceItems,
            subtotal,
            imposto: amountVat,
            desconto: 0,
            total,
            tipo: 'aluguer',
            aluguerDetails: {
                viaturaId: selectedViaturaIds[0], // Primary for legacy compatibility
                viaturasIds: selectedViaturaIds,
                dias: detailsMap.reduce((sum, d) => sum + d.dias, 0), // Sum of all vehicle days
                dataInicio: new Date(Math.min(...startDates)).toISOString().split('T')[0],
                dataFim: new Date(Math.max(...endDates)).toISOString().split('T')[0],
                centroCustoId: centroCustoId || undefined,
                periodoReferencia: referenceToSave, // Save Custom Reference
                detalhesViaturas: detailsMap.map(d => ({
                    viaturaId: d.viaturaId,
                    dias: d.dias,
                    dataInicio: d.dataInicio,
                    dataFim: d.dataFim,
                    precoDiario: d.precoDiario
                }))
            }
        };

        onSaveRental(rentalData);
        setView('list');
        // Reset Form
        setEditingId(null);
        setClienteId('');
        setSelectedViaturaIds([]);
        setVehicleSettings({});
        setCentroCustoId('');
        setPeriodoReferencia('');
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
                        Registar Novo Aluguer
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

                        {/* Reference Month Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Mês/Ano de Referência (Opcional)</label>
                            <input
                                type="month"
                                value={periodoReferencia}
                                onChange={(e) => setPeriodoReferencia(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-xs text-slate-500">Opcional: Selecione manualmenente se diferente da data atual.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Viaturas</label>
                            <div className="flex gap-2">
                                <select
                                    value={tempViaturaId}
                                    onChange={(e) => setTempViaturaId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="">Adicionar Viatura...</option>
                                    {filteredDisplayViaturas.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.matricula}</option>)}
                                </select>
                                <button
                                    onClick={handleAddViatura}
                                    disabled={!tempViaturaId}
                                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-lg border border-slate-700 disabled:opacity-50"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            <button
                                onClick={() => setIsSelectionModalOpen(true)}
                                className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 py-2 rounded-lg border border-slate-700 border-dashed transition-all text-sm font-medium"
                            >
                                <Car className="w-4 h-4" />
                                Selecionar Múltiplas Viaturas
                            </button>

                            {/* Selected Vehicles List */}
                            <div className="mt-3 space-y-2">
                                {selectedViaturaIds.map(id => {
                                    const v = viaturas.find(vi => vi.id === id);
                                    const settings = getVehicleSettings(id);

                                    return (
                                        <div key={id} className="flex flex-col gap-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-white font-medium">{v?.marca} {v?.modelo}</p>
                                                    <p className="text-xs text-slate-400">{v?.matricula} • {formatCurrency(v?.precoDiario || 0)}/dia</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveViatura(id)}
                                                    className="text-slate-400 hover:text-red-400 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="flex gap-2 text-sm pt-2 border-t border-slate-700/50">
                                                <div className="flex-1">
                                                    <label className="text-xs text-slate-500 mb-1 block">Data Início</label>
                                                    <input
                                                        type="date"
                                                        value={settings.dataInicio}
                                                        onChange={(e) => updateVehicleDetails(id, 'dataInicio', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                                                    />
                                                </div>
                                                <div className="w-24">
                                                    <label className="text-xs text-slate-500 mb-1 block">Dias</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={settings.dias}
                                                        onChange={(e) => updateVehicleDetails(id, 'dias', Number(e.target.value))}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                                                    />
                                                </div>
                                                <div className="w-24 text-right">
                                                    <label className="text-xs text-slate-500 mb-1 block">Subtotal</label>
                                                    <div className="py-1 text-amber-500 font-medium">
                                                        {formatCurrency((v?.precoDiario || 0) * settings.dias)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {selectedViaturaIds.length === 0 && (
                                    <p className="text-sm text-slate-500 italic">Nenhuma viatura selecionada</p>
                                )}
                            </div>

                            {/* Templates Control */}
                            <div className="mt-4 pt-4 border-t border-slate-800">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Kits / Templates</label>
                                <div className="flex gap-2 mb-2">
                                    <select
                                        onChange={handleLoadTemplate}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                    >
                                        <option value="">Carregar Kit Salvo...</option>
                                        {templates.map(t => <option key={t.name} value={t.name}>{t.name} ({t.vehicleIds.length} viaturas)</option>)}
                                    </select>
                                    <button
                                        onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                                        disabled={selectedViaturaIds.length === 0}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 text-sm disabled:opacity-50"
                                    >
                                        {showSaveTemplate ? 'Cancelar' : 'Salvar Kit'}
                                    </button>
                                </div>

                                {showSaveTemplate && (
                                    <div className="flex gap-2 animate-in slide-in-from-top-2">
                                        <input
                                            type="text"
                                            placeholder="Nome do Kit (ex: Frota Verão)"
                                            value={newTemplateName}
                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button
                                            onClick={handleSaveTemplate}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium"
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                )}
                            </div>
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
                                <label className="text-sm font-medium text-slate-400">Total Diário (€)</label>
                                <div className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-300">
                                    {formatCurrency(calculateTotalDaily())}
                                </div>
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
                            <p className="text-2xl font-bold text-amber-500">{formatCurrency((calculateGrandTotal()) * 1.23)}</p>
                        </div>
                        <button
                            onClick={handleCreateRental}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all transform hover:scale-105"
                        >
                            Registar Aluguer
                        </button>
                    </div>
                </div>
                <VehicleSelectionModal
                    isOpen={isSelectionModalOpen}
                    onClose={() => setIsSelectionModalOpen(false)}
                    viaturas={filteredDisplayViaturas}
                    selectedIds={selectedViaturaIds}
                    onConfirm={(ids) => {
                        setSelectedViaturaIds(ids);
                        setIsSelectionModalOpen(false);
                    }}
                />
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
                            <th className="px-6 py-4 w-12"></th>
                            <th className="px-6 py-4">Referência</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Centro de Custo</th>
                            <th className="px-6 py-4">Relatórios</th>
                            <th className="px-6 py-4 text-right">Total Grupo</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {groupedRentals.length > 0 ? (
                            groupedRentals.map((group) => {
                                const isExpanded = expandedGroups.has(group.id);
                                const clientName = clientes.find(c => c.id === group.clienteId)?.nome || 'Cliente Desconhecido';

                                let ccName = '';
                                if (group.centroCustoIds.size > 1) {
                                    ccName = 'Vários Centros de Custo';
                                } else if (group.centroCustoIds.size === 1) {
                                    const id = Array.from(group.centroCustoIds)[0];
                                    ccName = id === 'uncategorized'
                                        ? 'Sem Centro de Custo'
                                        : centrosCustos.find(c => c.id === id)?.nome || 'C.Custo Removido';
                                } else {
                                    ccName = 'N/A';
                                }

                                // Format Month
                                const dateObj = new Date(group.periodoReferencia + '-01');
                                // fallback if invalid date string (e.g. if we just used YYYY-MM)
                                const isValidDate = !isNaN(dateObj.getTime());
                                const displayDate = isValidDate
                                    ? dateObj.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
                                    : group.periodoReferencia;

                                const displayRef = `Referente a ${displayDate}`;

                                return (
                                    <>
                                        {/* GROUP ROW */}
                                        <tr key={group.id} className="bg-slate-800/20 hover:bg-slate-800/40 transition-colors border-b border-slate-700/50">
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => toggleGroup(group.id)}
                                                    className="p-1 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
                                                >
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-white tracking-wide">
                                                {displayRef.charAt(0).toUpperCase() + displayRef.slice(1)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300 font-medium">
                                                {clientName}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                <span className="bg-slate-700/50 px-2 py-1 rounded text-xs border border-slate-600">
                                                    {ccName}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">
                                                {group.invoices.length} relatório(s)
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-400 text-lg">
                                                {formatCurrency(group.total)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {/* Group Actions could go here maybe simple print all? for now empty */}
                                            </td>
                                        </tr>

                                        {/* DETAIL ROWS */}
                                        {isExpanded && group.invoices.map(inv => {
                                            const vehicle = viaturas.find(v => v.id === inv.aluguerDetails?.viaturaId);
                                            return (
                                                <tr key={inv.id} className="bg-slate-900/30 hover:bg-slate-800/30 transition-colors animate-in fade-in slide-in-from-top-1 border-b border-slate-800/50">
                                                    <td className="px-6 py-4 pl-12 border-l-4 border-slate-800" colSpan={7}>
                                                        <div className="grid grid-cols-12 items-center gap-4">
                                                            <div className="col-span-3">
                                                                <p className="text-xs text-slate-500 uppercase font-bold">Viatura(s)</p>
                                                                <div className="text-slate-300 mt-1">
                                                                    {inv.aluguerDetails?.viaturasIds ? (
                                                                        <div className="space-y-1">
                                                                            {inv.aluguerDetails.viaturasIds.map((vid: string) => {
                                                                                const v = viaturas.find(vi => vi.id === vid);
                                                                                return v ? (
                                                                                    <div key={vid} className="text-sm flex items-center gap-2">
                                                                                        <span>{v.marca} {v.modelo}</span>
                                                                                        <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{v.matricula}</span>
                                                                                    </div>
                                                                                ) : null;
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-sm flex items-center gap-2">
                                                                            <span>{vehicle ? `${vehicle.marca} ${vehicle.modelo}` : 'Viatura N/A'}</span>
                                                                            {vehicle && <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{vehicle.matricula}</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="col-span-3">
                                                                <p className="text-xs text-slate-500 uppercase font-bold">Período</p>
                                                                <p className="text-slate-400 text-sm mt-1">
                                                                    {new Date(inv.aluguerDetails?.dataInicio || inv.data).toLocaleDateString('pt-PT')}
                                                                    <span className="mx-2 text-slate-600">→</span>
                                                                    {new Date(inv.aluguerDetails?.dataFim || inv.vencimento).toLocaleDateString('pt-PT')}
                                                                </p>
                                                                {inv.aluguerDetails?.dias && (
                                                                    <p className="text-xs text-slate-500 mt-0.5">{inv.aluguerDetails.dias} dias</p>
                                                                )}
                                                            </div>

                                                            <div className="col-span-2 text-right">
                                                                <p className="text-xs text-slate-500 uppercase font-bold">Valor</p>
                                                                <p className="text-emerald-400 font-medium text-sm mt-1">
                                                                    {formatCurrency(inv.total)}
                                                                </p>
                                                            </div>

                                                            <div className="col-span-4 flex justify-end gap-2">
                                                                <button
                                                                    title="Editar"
                                                                    onClick={() => handleEdit(inv)}
                                                                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-400 transition-colors"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    title="Fatura PDF"
                                                                    onClick={() => generateRentalPDF(inv)}
                                                                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    title="Contrato PDF"
                                                                    onClick={() => generateRentalContract(inv)}
                                                                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                                >
                                                                    <Printer className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    title="Apagar"
                                                                    onClick={() => {
                                                                        if (window.confirm('Tem a certeza que deseja apagar este registo?')) {
                                                                            onDelete(inv.id);
                                                                        }
                                                                    }}
                                                                    className="p-2 bg-slate-800 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
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
// Force update timestamp: 2026-01-09 01:06
