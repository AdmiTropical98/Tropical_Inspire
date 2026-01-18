import { useState, useRef, useEffect } from 'react';
import { useWorkshop } from '../contexts/WorkshopContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';
import {
    Plus, Trash, ArrowRightLeft, Upload,
    Info, Building2, MapPin,
    Clock, AlertCircle, ChevronDown, FileSpreadsheet, Download
} from 'lucide-react';
import { read, utils, write } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CartrackService } from '../services/cartrack';

// Helper for unique IDs for grid rows
const generateTempId = () => Math.random().toString(36).substr(2, 9);

interface GridRow {
    tempId: string;
    passageiro: string;
    origem: string;
    destino: string;
    hora: string;
    obs: string;
    tipo: 'entrada' | 'saida';
    departamento: string;
}

interface LancarEscalaProps {
    onNavigate?: (tab: string) => void;
}

export default function LancarEscala({ onNavigate }: LancarEscalaProps) {
    const { centrosCustos, createScaleBatch } = useWorkshop();
    const { hasAccess } = usePermissions();
    const { userRole } = useAuth();

    // Geofence Autocomplete State
    const [geofenceSuggestions, setGeofenceSuggestions] = useState<string[]>([]);

    useEffect(() => {
        const fetchGeofences = async () => {
            try {
                const fences = await CartrackService.getGeofences();
                // Extract unique names and sort
                const names = Array.from(new Set(fences.map(f => f.name))).sort();
                setGeofenceSuggestions(names);
            } catch (e) {
                console.error('Failed to load geofences for autocomplete:', e);
            }
        };
        fetchGeofences();
    }, []);

    // Access Control
    if (userRole && !hasAccess(userRole, 'escalas_create')) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#0B1120] text-slate-400">
                <AlertCircle className="w-12 h-12 mb-4 text-red-500 opacity-50" />
                <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
                <p className="max-w-md text-center">Você não tem permissão para lançar escalas. Contacte o administrador.</p>
            </div>
        );
    }

    const [isLoading, setIsLoading] = useState(false);
    
    // Header Data
    const [referenceDate, setReferenceDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [selectedCentroCusto, setSelectedCentroCusto] = useState('');
    const [notes, setNotes] = useState('');

    // State for Import Modal
    const [showImportModal, setShowImportModal] = useState(false);
    const [pendingImportRows, setPendingImportRows] = useState<GridRow[]>([]);

    // Grid Data
    const [rows, setRows] = useState<GridRow[]>([
        { tempId: generateTempId(), passageiro: '', origem: '', destino: '', hora: '', obs: '', tipo: 'entrada', departamento: '' }
    ]);

    // Refs
    const gridRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Excel Handlers
    // Excel Handlers
    const handleDownloadTemplate = () => {
        // Dynamic generation to ensure it matches current requirements
        const ws = utils.json_to_sheet([
            {
                'TIPO': 'ENTRADA',
                'DEPARTAMENTO': 'HK',
                'PASSAGEIRO': 'João Silva',
                'ORIGEM': 'Aeroporto',
                'DESTINO': 'Hotel',
                'HORA': '10:00',
                'OBS': 'Voo TP123'
            },
            {
                'TIPO': 'SAIDA',
                'DEPARTAMENTO': 'F&B',
                'PASSAGEIRO': 'Maria Santos',
                'ORIGEM': 'Hotel',
                'DESTINO': 'Aeroporto',
                'HORA': '18:00',
                'OBS': ''
            }
        ]);

        // Set column widths
        ws['!cols'] = [
            { wch: 10 }, // TIPO
            { wch: 15 }, // DEPARTAMENTO
            { wch: 25 }, // PASSAGEIRO
            { wch: 20 }, // ORIGEM
            { wch: 20 }, // DESTINO
            { wch: 10 }, // HORA
            { wch: 20 }  // OBS
        ];

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Modelo");

        // Save file
        const wbout = typeof window !== 'undefined' ? write(wb, { bookType: 'xlsx', type: 'array' }) : null;
        if (wbout) {
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'Modelo_Escala_Tropical.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            // Explicitly requesting raw values to avoid date formatting issues, but we will handle dates if they come
            const jsonData = utils.sheet_to_json<any>(worksheet, { raw: true });

            // Helper to safe parse Excel time (handles number 0.xxx, strings, and Date objects)
            const parseExcelTime = (val: any): string => {
                if (val === undefined || val === null) return '';

                // Debug log to help identify what exactly is coming in
                console.log('Parsing time value:', val, typeof val);

                // 0. Handle JS Date Objects (if xlsx parsed it as date)
                if (val instanceof Date) {
                    const h = val.getHours().toString().padStart(2, '0');
                    const m = val.getMinutes().toString().padStart(2, '0');
                    return `${h}:${m}`;
                }

                // 1. Handle Excel Serial Number (e.g. 0.5 = 12:00)
                if (typeof val === 'number') {
                    // Excel fractional day: 0.5 = 12:00
                    const totalMinutes = Math.round(val * 24 * 60);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    const h = (hours % 24).toString().padStart(2, '0');
                    const m = minutes.toString().padStart(2, '0');
                    return `${h}:${m}`;
                }

                // 2. Handle Strings (Aggrresive parsing)
                let str = val.toString().trim();

                // 2a. Handle AM/PM
                const isPM = /pm/i.test(str);
                const isAM = /am/i.test(str);

                // Remove unwanted chars except digits and separators
                // We keep : . , h H

                const match = str.match(/(\d{1,2})[:.,hH](\d{2})/);
                if (match) {
                    let h = parseInt(match[1], 10);
                    let m = parseInt(match[2], 10);

                    if (isPM && h < 12) h += 12;
                    if (isAM && h === 12) h = 0;

                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                }

                // Fallback for just 4 digits "1430"
                if (/^\d{4}$/.test(str)) {
                    const h = str.substr(0, 2);
                    const m = str.substr(2, 2);
                    return `${h}:${m}`;
                }

                return ''; // Failed to parse
            };

            const newRows: GridRow[] = jsonData.map((row: any) => {
                let tipoRaw = (row['TIPO'] || 'ENTRADA').toString().toLowerCase().trim();
                let tipo: 'entrada' | 'saida' = 'entrada';
                if (tipoRaw.includes('saida') || tipoRaw.includes('saída')) tipo = 'saida';

                const rawHora = row['HORA'] !== undefined ? row['HORA'] : (row['Hora'] || row['hora']); 

                return {
                    tempId: generateTempId(),
                    passageiro: row['PASSAGEIRO'] || row['Passageiro'] || '',
                    origem: row['ORIGEM'] || row['Origem'] || '',
                    destino: row['DESTINO'] || row['Destino'] || '',
                    hora: parseExcelTime(rawHora),
                    obs: row['OBS'] || row['Obs'] || '',
                    tipo: tipo,
                    departamento: row['DEPARTAMENTO'] || row['Departamento'] || ''
                };
            });

            if (newRows.length > 0) {
                setPendingImportRows(newRows);
                setShowImportModal(true);
            } else {
                alert('Nenhum dado encontrado no arquivo.');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao processar arquivo. Verifique se é um Excel válido.');
        } finally {
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = (mode: 'replace' | 'append') => {
        if (mode === 'replace') {
            setRows(pendingImportRows);
        } else {
            setRows(prev => [...prev, ...pendingImportRows]);
        }
        setShowImportModal(false);
        setPendingImportRows([]);
    };

    // Grid Handlers
    const addRow = () => {
        setRows(prev => [...prev, { tempId: generateTempId(), passageiro: '', origem: '', destino: '', hora: '', obs: '', tipo: 'entrada', departamento: '' }]);
    };

    const updateRow = (id: string, field: keyof GridRow, value: any) => {
        setRows(prev => prev.map(r => r.tempId === id ? { ...r, [field]: value } : r));
    };

    const deleteRow = (id: string) => {
        if (rows.length === 1) {
            setRows([{ tempId: generateTempId(), passageiro: '', origem: '', destino: '', hora: '', obs: '', tipo: 'entrada', departamento: '' }]);
            return;
        }
        setRows(prev => prev.filter(r => r.tempId !== id));
    };

    // Smart Actions
    const setRowType = (id: string, newType: 'entrada' | 'saida') => {
        setRows(prev => prev.map(r => {
            if (r.tempId !== id) return r;
            let changes: Partial<GridRow> = { tipo: newType };
            return { ...r, ...changes };
        }));
    };

    const addReturnTrip = (row: GridRow) => {
        const returnRow: GridRow = {
            tempId: generateTempId(),
            passageiro: row.passageiro,
            origem: row.destino,
            destino: row.origem,
            hora: '',
            obs: row.tipo === 'entrada' ? 'Volta' : 'Ida',
            tipo: row.tipo === 'entrada' ? 'saida' : 'entrada',
            departamento: row.departamento // Copy Department
        };
        const index = rows.findIndex(r => r.tempId === row.tempId);
        const newRows = [...rows];
        newRows.splice(index + 1, 0, returnRow);
        setRows(newRows);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        // Arrow Keys Navigation (Basic implementation)
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Focus same field in next row
            if (index === rows.length - 1) {
                addRow();
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (index === rows.length - 1) {
                addRow();
            }
        }
    };

    // Generate PDF
    const generatePDF = async (batch: any, services: any[]) => {
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
                doc.addImage(imgData as string, 'PNG', 15, 10, 50, 25); // Top Left Logo
            }
        } catch (e) {
            console.warn('Logo load failed', e);
        }

        // 2. Header Content (Right Side)
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // Slate 900

        // Schedule ID & Date (Top Right)
        doc.setFontSize(14);
        doc.setTextColor(51, 65, 85);
        if (batch.serial_number) {
            doc.text(`Escala #${batch.serial_number}`, pageWidth - 15, 20, { align: 'right' });
        } else {
            doc.text(`Escala #${batch.id.slice(0, 8)}`, pageWidth - 15, 20, { align: 'right' });
        }

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(referenceDate, pageWidth - 15, 26, { align: 'right' });

        // 3. Meta Info (Below Logo)
        let currentY = 45;
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);

        const ccName = centrosCustos.find(c => c.id === selectedCentroCusto)?.nome || 'N/A';
        doc.text(`Centro de Custo: ${ccName}`, 15, currentY);

        const creatorName = batch.created_by || 'Sistema';
        const roleDisplay = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';

        doc.text(`Criado por: ${roleDisplay} ${creatorName}`, 15, currentY + 6);

        if (notes) {
            doc.setFont('helvetica', 'italic');
            doc.text(`Obs: ${notes}`, 15, currentY + 12);
            doc.setFont('helvetica', 'normal');
            currentY += 6;
        }

        // 4. Group by Department
        // Get unique departments (empty string = "Geral" or "Sem Departamento")
        const departments = Array.from(new Set(services.map(s => s.departamento || 'Geral'))).sort();

        // Start tables below header
        currentY += 15;

        departments.forEach((dept) => {
            // Filter services for this department
            const deptServices = services.filter(s => (s.departamento || 'Geral') === dept);

            // Check if we need a new page (rough estimation)
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            // Department Header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.setFillColor(241, 245, 249); // Slate 100 background for header
            // doc.rect(14, currentY - 5, pageWidth - 28, 7, 'F'); // Optional bg
            doc.text(dept.toUpperCase(), 15, currentY);

            // Table for this Department
            const tableBody = deptServices.map((s, index) => [
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
                    fillColor: [15, 23, 42], // Slate 900
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    textColor: 50,
                    halign: 'center'
                },
                alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate 50
                styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 25, fontStyle: 'bold' },
                    1: { halign: 'left' }, // Passageiro Left Align
                    2: { halign: 'left' }, // Origem Left Align
                    3: { halign: 'left' }, // Destino Left Align
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 0) {
                        const text = data.cell.raw as string;
                        if (text === 'ENTRADA') {
                            data.cell.styles.textColor = [217, 119, 6]; // Amber 600
                        } else if (text === 'SAIDA' || text === 'SAÍDA') {
                            data.cell.styles.textColor = [79, 70, 229]; // Indigo 600
                        }
                    }
                },
                // Update currentY after table draw
                didDrawPage: (data) => {
                // This is called on page add, but we manage simple flow here.
                }
            });

            // Update Y for next table
            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 15;
        });


        // 5. Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString()}`, pageWidth / 2, 290, { align: 'center' });
            doc.text("Tropical Inspire App", pageWidth - 15, 290, { align: 'right' });
        }

        doc.save(`Escala_${batch.serial_number || 'Batch'}_${referenceDate}.pdf`);
    };

    // Actions
    const handleLaunch = async () => {
        if (!selectedCentroCusto) {
            alert('Por favor selecione um Centro de Custo');
            return;
        }

        const validRows = rows.filter(r => r.passageiro.trim() !== '');
        if (validRows.length === 0) {
            alert('Adicione pelo menos um serviço válido.');
            return;
        }

        const missingTime = validRows.find(r => r.hora.trim() === '');
        if (missingTime) {
            alert(`Falta hora para o passageiro: ${missingTime.passageiro}`);
            return;
        }

        setIsLoading(true);

        try {
            const servicesToCreate = validRows.map(r => ({
                id: crypto.randomUUID(),
                data: referenceDate, // Operational Date
                motoristaId: null, 
                passageiro: r.passageiro,
                hora: r.hora,
                origem: r.origem,
                destino: r.destino,
                voo: '', 
                obs: r.obs,
                tipo: r.tipo,
                concluido: false,
                centroCustoId: selectedCentroCusto,
                departamento: r.departamento || '' // New Field
            }));

            const result = await createScaleBatch({
                referenceDate,
                centroCustoId: selectedCentroCusto,
                notes
            }, servicesToCreate as any);

            if (result.success) {
                // Success UI
                if (confirm('Escala lançada com sucesso! Deseja imprimir a lista em PDF?')) {
                    // Pass the full batch object returned from context (contains serial_number, created_by, etc)
                    await generatePDF(result.data, servicesToCreate);
                }

                if (onNavigate) onNavigate('escalas');
            } else {
                alert('Erro ao lançar escala: ' + result.error);
            }

        } catch (error) {
            console.error(error);
            alert('Erro inesperado.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0B1120] text-slate-200 overflow-hidden font-sans">
            {/* Datalist for AutoComplete */}
            <datalist id="geofence-list">
                {geofenceSuggestions.map((name, i) => (
                    <option key={i} value={name} />
                ))}
            </datalist>

            {/* Top Bar: Controls */}
            <div className="bg-[#0f172a] border-b border-slate-800 p-6 shadow-xl z-20">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-[1920px] mx-auto w-full">

                    {/* Left: Inputs */}
                    <div className="flex items-center gap-6 flex-1">

                        {/* Date Picker */}
                        <div className="group relative">
                            <label className="absolute -top-2.5 left-3 bg-[#0f172a] px-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 group-focus-within:text-blue-300 transition-colors z-10">
                                Data da Escala
                            </label>
                            <div className="relative flex items-center bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden group-focus-within:border-blue-500/50 group-focus-within:ring-2 ring-blue-500/10 transition-all w-36">
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-sm font-medium text-white px-3 py-2.5 w-full outline-none [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    value={referenceDate}
                                    onChange={e => setReferenceDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Cost Center */}
                        <div className="group relative flex-1 max-w-xs">
                            <label className="absolute -top-2.5 left-3 bg-[#0f172a] px-1 text-[10px] font-bold uppercase tracking-wider text-purple-400 group-focus-within:text-purple-300 transition-colors z-10">
                                Centro de Custo
                            </label>
                            <div className="relative bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden group-focus-within:border-purple-500/50 group-focus-within:ring-2 ring-purple-500/10 transition-all">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <select 
                                    className="bg-transparent border-none text-sm font-medium text-white pl-10 pr-10 py-2.5 w-full outline-none appearance-none [&_option]:bg-slate-900 cursor-pointer"
                                    value={selectedCentroCusto}
                                    onChange={e => setSelectedCentroCusto(e.target.value)}
                                >
                                    <option value="">Selecione...</option>
                                    {centrosCustos.map(cc => (
                                        <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                    <ChevronDown className="w-4 h-4 opacity-50" />
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="group relative flex-[1.5]">
                            <label className="absolute -top-2.5 left-3 bg-[#0f172a] px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 group-focus-within:text-slate-300 transition-colors z-10">
                                Observações desta Escala
                            </label>
                            <div className="flex items-center bg-slate-900/50 border border-slate-700 rounded-xl overflow-visible group-focus-within:border-slate-500/50 transition-all relative">
                                <div className="pl-3 text-slate-500 group/info cursor-help relative flex items-center h-full py-2.5">
                                    <Info className="w-4 h-4 hover:text-blue-400 transition-colors" />
                                    {/* Tooltip */}
                                    <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl text-xs text-slate-300 opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all z-50 translate-y-[-10px] group-hover/info:translate-y-0">
                                        Use este campo para observações gerais que se aplicam a todo o lote de escalas.
                                        {/* Arrow */}
                                        <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 border-t border-l border-slate-700 rotate-45"></div>
                                    </div>
                                </div>
                                <input 
                                    className="bg-transparent border-none text-sm text-slate-300 px-3 py-2.5 w-full outline-none placeholder:text-slate-600"
                                    placeholder="Ex: Reforço de Verão..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        {/* Hidden Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xlsx, .xls"
                            onChange={handleImportExcel}
                        />

                        {/* Buttons */}
                        <button 
                            onClick={handleDownloadTemplate}
                            className="bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 px-4 py-2.5 rounded-xl border border-slate-700/50 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wide h-12"
                            title="Baixar Modelo Excel"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden xl:block text-left leading-none">
                                BAIXAR<br />MODELO
                            </span>
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 px-4 py-2.5 rounded-xl border border-slate-700/50 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wide h-12"
                            title="Importar Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden xl:block text-left leading-none">
                                IMPORTAR<br />ESCALA EM MASSA
                            </span>
                        </button>

                        <div className="w-px h-8 bg-slate-800 mx-1"></div>

                        <button
                            onClick={handleLaunch}
                            disabled={isLoading}
                            className={`
                                relative overflow-hidden group px-6 py-2 rounded-xl font-bold text-sm tracking-wide transition-all h-12
                                ${isLoading
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 hover:-translate-y-0.5'
                                }
                            `}
                        >
                            <div className="flex items-center gap-2 relative z-10">
                                {isLoading ? (
                                    'Processando...'
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        <span className="text-left leading-none text-xs">
                                            LANÇAR<br />ESCALA
                                        </span>
                                    </>
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Grid Area */}
            <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-[url('/grid-pattern.svg')] bg-repeat opacity-[0.98]">
                <div className="max-w-[1920px] mx-auto">

                    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                        {/* Grid Header */}
                        <div className="grid grid-cols-[40px_105px_0.8fr_1.21fr_1.9fr_1.9fr_125px_1fr_60px] gap-px bg-slate-900 border-b border-slate-800">
                            {[
                                { l: '#', c: 'text-center' },
                                { l: 'Tipo', c: 'text-center' },
                                { l: 'Departamento', c: 'text-center' }, // New Column
                                { l: 'Passageiro', i: null },
                                { l: 'Origem', i: MapPin },
                                { l: 'Destino', i: MapPin },
                                { l: 'Hora', i: Clock },
                                { l: 'Obs', i: Info },
                                { l: '', c: '' }
                            ].map((h, idx) => (
                                <div key={idx} className={`p-4 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 ${h.c || ''}`}>
                                    {h.i && <h.i className="w-3 h-3" />}
                                    {h.l}
                                </div>
                            ))}
                        </div>

                        {/* Grid Rows */}
                        <div className="divide-y divide-slate-800/50 bg-[#0f172a]" ref={gridRef}>
                            {rows.map((row, idx) => (
                                <div
                                    key={row.tempId} 
                                    className="group grid grid-cols-[40px_105px_0.8fr_1.21fr_1.9fr_1.9fr_125px_1fr_60px] gap-px text-sm hover:bg-slate-800/30 transition-colors focus-within:bg-slate-800/50"
                                >

                                    {/* Line Number */}
                                    <div className="p-3 text-center text-slate-600 font-mono text-xs flex items-center justify-center">
                                        {idx + 1}
                                    </div>

                                    {/* Type Toggle - Changed to Select */}
                                    <div className="p-2 flex items-center justify-center">
                                        <div className="relative w-full h-full">
                                            <select
                                                className={`
                                                    w-full h-full text-xs font-bold uppercase rounded-lg px-2 outline-none appearance-none cursor-pointer border
                                                    ${row.tipo === 'entrada' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                        row.tipo === 'saida' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                                                            'bg-slate-800 text-slate-400 border-slate-700'}
                                                `}
                                                value={row.tipo}
                                                onChange={e => setRowType(row.tempId, e.target.value as any)}
                                            >
                                                <option value="entrada">ENTRADA</option>
                                                <option value="saida">SAÍDA</option>
                                            </select>
                                            {/* Custom Arrow */}
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                <ChevronDown className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Departamento Input */}
                                    <div className="relative border-r border-slate-800/50">
                                        <input
                                            className="w-full h-full bg-transparent px-3 outline-none placeholder:text-slate-700 text-slate-300 font-medium"
                                            placeholder="Geral"
                                            value={row.departamento || ''}
                                            onChange={e => updateRow(row.tempId, 'departamento', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, idx)}
                                        />
                                    </div>

                                    {/* Inputs */}
                                    <div className="relative">
                                        <input 
                                            className="w-full h-full bg-transparent px-4 py-3 outline-none text-white focus:ring-2 ring-blue-500/20 focus:bg-blue-500/5 transition-all placeholder:text-slate-700"
                                            placeholder="Nome do Passageiro..."
                                            value={row.passageiro}
                                            maxLength={18}
                                            onChange={e => updateRow(row.tempId, 'passageiro', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, idx)}
                                        />
                                    </div>

                                    <div className="relative border-l border-slate-800/50">
                                        <input 
                                            className="w-full h-full bg-transparent px-4 py-3 outline-none text-slate-300 focus:text-white focus:ring-2 ring-blue-500/20 focus:bg-blue-500/5 transition-all"
                                            value={row.origem}
                                            maxLength={28}
                                            list="geofence-list"
                                            onChange={e => updateRow(row.tempId, 'origem', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, idx)}
                                            placeholder="Origem..."
                                        />
                                    </div>

                                    <div className="relative border-l border-slate-800/50">
                                        <input 
                                            className="w-full h-full bg-transparent px-4 py-3 outline-none text-slate-300 focus:text-white focus:ring-2 ring-blue-500/20 focus:bg-blue-500/5 transition-all"
                                            value={row.destino}
                                            maxLength={28}
                                            list="geofence-list"
                                            onChange={e => updateRow(row.tempId, 'destino', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, idx)}
                                            placeholder="Destino..."
                                        />
                                    </div>

                                    <div className="relative border-l border-slate-800/50">
                                        <input
                                            type="time"
                                            className="w-full h-full bg-transparent px-4 py-3 outline-none text-white font-mono text-center focus:ring-2 ring-blue-500/20 focus:bg-blue-500/5 transition-all"
                                            value={row.hora}
                                            onChange={e => updateRow(row.tempId, 'hora', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, idx)}
                                        />
                                    </div>

                                    <div className="relative border-l border-slate-800/50">
                                        <input 
                                            className="w-full h-full bg-transparent px-4 py-3 outline-none text-slate-400 focus:text-white focus:ring-2 ring-blue-500/20 focus:bg-blue-500/5 transition-all"
                                            value={row.obs}
                                            maxLength={50}
                                            onChange={e => updateRow(row.tempId, 'obs', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, idx)}
                                        />
                                    </div>

                                    {/* Row Actions */}
                                    <div className="flex items-center justify-center gap-1 border-l border-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => addReturnTrip(row)}
                                            className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded-lg transition-colors"
                                            title="Retorno"
                                        >
                                            <ArrowRightLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => deleteRow(row.tempId)}
                                            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                            title="Remover"
                                        >
                                            <Trash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                </div>
                            ))}
                        </div>

                        {/* Footer: Add Row */}
                        <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                            <button
                                onClick={addRow}
                                className="w-full py-3 border-2 border-dashed border-slate-700/50 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 font-medium text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Adicionar Nova Linha
                            </button>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-8 flex gap-8 text-xs text-slate-500 px-2 opacity-50 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold font-mono">↙</div>
                            <span>Use <span className="text-slate-300 font-bold">Enter</span> para adicionar novas linhas</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-2">Importar Escala</h3>
                            <p className="text-slate-400 text-sm">
                                Encontradas <span className="text-blue-400 font-bold">{pendingImportRows.length}</span> linhas no arquivo.
                                <br />Como deseja proceder?
                            </p>

                            <div className="flex flex-col gap-3 mt-8">
                                <button
                                    onClick={() => confirmImport('replace')}
                                    className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash className="w-4 h-4" />
                                    Substituir Escala Atual
                                </button>

                                <button 
                                    onClick={() => confirmImport('append')}
                                    className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Somente Adicionar à Escala
                                </button>

                                <button
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setPendingImportRows([]);
                                    }}
                                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 font-medium text-sm transition-all mt-2"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
