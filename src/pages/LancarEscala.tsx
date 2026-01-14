
import { useState } from 'react';
import { useWorkshop } from '../contexts/WorkshopContext';
// import { useAuth } from '../contexts/AuthContext'; // Unused
import { Plus, Trash, ArrowRightLeft, Upload, LayoutTemplate } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import * as XLSX from 'xlsx'; // Not used yet in this version

// Helper for unique IDs for grid rows (temporary)
const generateTempId = () => Math.random().toString(36).substr(2, 9);

interface GridRow {
    tempId: string;
    passageiro: string;
    origem: string;
    destino: string;
    hora: string;
    voo: string;
    obs: string;
}

interface LancarEscalaProps {
    onNavigate?: (tab: string) => void;
}

export default function LancarEscala({ onNavigate }: LancarEscalaProps) {
    const { centrosCustos, createScaleBatch } = useWorkshop();
    // const { currentUser } = useAuth(); // Unused
    // const navigate = useNavigate(); // Removed due to no Router context

    const [isLoading, setIsLoading] = useState(false);
    
    // Header Data
    const [referenceDate, setReferenceDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [selectedCentroCusto, setSelectedCentroCusto] = useState('');
    const [notes, setNotes] = useState('');

    // Grid Data
    const [rows, setRows] = useState<GridRow[]>([
        { tempId: generateTempId(), passageiro: '', origem: '', destino: '', hora: '', voo: '', obs: '' }
    ]);

    // Templates State (Mock for now, easy to implement real storage)
    const [templates, setTemplates] = useState<{name: string, rows: GridRow[]}[]>([
        { 
            name: 'Exemplo: Turno Manhã', 
            rows: [
                { tempId: '1', passageiro: 'João Silva', origem: 'Albufeira', destino: 'Aeroporto', hora: '08:00', voo: '', obs: 'Ida' },
                { tempId: '2', passageiro: 'Maria Santos', origem: 'Vilamoura', destino: 'Aeroporto', hora: '08:30', voo: '', obs: 'Ida' }
            ]
        }
    ]);
    const [showTemplates, setShowTemplates] = useState(false);

    // Grid Handlers
    const addRow = () => {
        setRows(prev => [...prev, { tempId: generateTempId(), passageiro: '', origem: '', destino: '', hora: '', voo: '', obs: '' }]);
    };

    const updateRow = (id: string, field: keyof GridRow, value: string) => {
        setRows(prev => prev.map(r => r.tempId === id ? { ...r, [field]: value } : r));
    };

    const deleteRow = (id: string) => {
        if (rows.length === 1) {
            // Don't delete last row, just clear it
            setRows([{ tempId: generateTempId(), passageiro: '', origem: '', destino: '', hora: '', voo: '', obs: '' }]);
            return;
        }
        setRows(prev => prev.filter(r => r.tempId !== id));
    };

    const addReturnTrip = (row: GridRow) => {
        const returnRow: GridRow = {
            tempId: generateTempId(),
            passageiro: row.passageiro,
            origem: row.destino, // Swap
            destino: row.origem, // Swap
            hora: '', // User must fill
            voo: row.voo,
            obs: 'Volta'
        };
        // Find index to insert after
        const index = rows.findIndex(r => r.tempId === row.tempId);
        const newRows = [...rows];
        newRows.splice(index + 1, 0, returnRow);
        setRows(newRows);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // If it's the last row, add new
            if (index === rows.length - 1) {
                addRow();
            }
        }
    };

    // Actions
    const handleSaveTemplate = () => {
        const name = prompt('Nome do Modelo (ex: Turno Manhã):');
        if (name) {
            setTemplates(prev => [...prev, { name, rows: rows.map(r => ({ ...r, tempId: generateTempId() })) }]);
            alert('Modelo salvo!');
        }
    };

    const loadTemplate = (t: {rows: GridRow[]}) => {
        setRows(t.rows.map(r => ({ ...r, tempId: generateTempId() })));
        setShowTemplates(false);
    };

    const handleLaunch = async () => {
        if (!selectedCentroCusto) {
            alert('Por favor selecione um Centro de Custo');
            return;
        }

        // Validate rows (simple check: must have passenger)
        const validRows = rows.filter(r => r.passageiro.trim() !== '');
        if (validRows.length === 0) {
            alert('Adicione pelo menos um serviço válido.');
            return;
        }

        // Validate times
        const missingTime = validRows.find(r => r.hora.trim() === '');
        if (missingTime) {
            alert(`Falta hora para o passageiro: ${missingTime.passageiro}`);
            return;
        }

        setIsLoading(true);

        try {
            // Convert GridRows to proper Service objects (DTOs)
            // We generate IDs here or let backend. For batch simplicity context expects servicos with IDs
            const servicesToCreate = validRows.map(r => ({
                id: crypto.randomUUID(),
                motoristaId: '', // Unassigned
                passageiro: r.passageiro,
                hora: r.hora,
                origem: r.origem,
                destino: r.destino,
                voo: r.voo,
                obs: r.obs,
                concluido: false,
                centroCustoId: selectedCentroCusto,
                // Batch ID applied by context
            }));

            const result = await createScaleBatch({
                referenceDate,
                centroCustoId: selectedCentroCusto,
                notes
            }, servicesToCreate as any);

            if (result.success) {
                alert('Escala lançada com sucesso!');
                if (onNavigate) onNavigate('escalas');
                // Since App.tsx uses activeTab via props/state interaction, this navigate might not work if it's not route based.
                // Actually App.tsx is not using Routes for tabs, but 'LancarEscala' is rendered BY App.tsx. 
                // To switch tab, we might need to access setActiveTab from context or just rely on user clicking.
                // Or better: show success toast.
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
        <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
            {/* Header Toolbar */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase text-slate-500 font-bold mb-1">Data Escala</label>
                        <input 
                            type="date"
                            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-2 ring-blue-500 outline-none"
                            value={referenceDate}
                            onChange={e => setReferenceDate(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col flex-1 max-w-xs">
                        <label className="text-[10px] uppercase text-slate-500 font-bold mb-1">Centro de Custo</label>
                        <select 
                            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-2 ring-blue-500 outline-none"
                            value={selectedCentroCusto}
                            onChange={e => setSelectedCentroCusto(e.target.value)}
                        >
                            <option value="">Selecione...</option>
                            {centrosCustos.map(cc => (
                                <option key={cc.id} value={cc.id}>{cc.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col flex-1 max-w-md">
                        <label className="text-[10px] uppercase text-slate-500 font-bold mb-1">Notas / Observações do Lote</label>
                        <input 
                            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:ring-2 ring-blue-500 outline-none w-full"
                            placeholder="Ex: Reforço de Verão..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition ml-4"
                        title="Carregar Modelo"
                    >
                        <LayoutTemplate className="w-5 h-5 text-purple-400" />
                        <span className="text-[10px] text-slate-400">Modelos</span>
                    </button>
                    {showTemplates && (
                        <div className="absolute top-20 left-60 z-50 bg-slate-800 border border-slate-700 shadow-xl rounded-xl p-2 w-64 animate-in fade-in zoom-in-95">
                             <div className="text-xs font-bold text-slate-400 px-2 py-1 uppercase">Modelos Salvos</div>
                             {templates.map((t, idx) => (
                                 <button 
                                    key={idx}
                                    onClick={() => loadTemplate(t)}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded text-sm text-white flex justify-between"
                                 >
                                     {t.name}
                                     <span className="text-slate-500 text-xs">{t.rows.length} linhas</span>
                                 </button>
                             ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleSaveTemplate}
                        className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition"
                    >
                        Salvar Modelo
                    </button>
                    <button 
                        onClick={handleLaunch}
                        disabled={isLoading}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 flex items-center gap-2 transition disabled:opacity-50"
                    >
                        {isLoading ? 'Lançando...' : (
                            <>
                                <Upload className="w-4 h-4" />
                                Lançar Escala
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900/50">
                    {/* Grid Header */}
                    <div className="grid grid-cols-[30px_1fr_1fr_1fr_100px_100px_1fr_100px] gap-px bg-slate-800 border-b border-slate-700 text-xs font-bold uppercase text-slate-400 sticky top-0 z-10">
                        <div className="p-3 text-center">#</div>
                        <div className="p-3">Passageiro</div>
                        <div className="p-3">Origem</div>
                        <div className="p-3">Destino</div>
                        <div className="p-3">Hora</div>
                        <div className="p-3">Voo/Ref</div>
                        <div className="p-3">Obs</div>
                        <div className="p-3 text-center">Ações</div>
                    </div>

                    {/* Grid Rows */}
                    <div className="bg-slate-800/50">
                        {rows.map((row, idx) => (
                            <div 
                                key={row.tempId} 
                                className="group grid grid-cols-[30px_1fr_1fr_1fr_100px_100px_1fr_100px] gap-px border-b border-slate-800/50 hover:bg-slate-800/80 transition-colors"
                            >
                                <div className="p-2 text-center text-slate-600 text-xs flex items-center justify-center">
                                    {idx + 1}
                                </div>
                                <div className="p-0">
                                    <input 
                                        className="w-full h-full bg-transparent px-3 py-2 outline-none focus:bg-blue-900/20 text-white text-sm"
                                        placeholder="Nome..."
                                        value={row.passageiro}
                                        onChange={e => updateRow(row.tempId, 'passageiro', e.target.value)}
                                        onKeyDown={e => handleKeyDown(e, idx)}
                                    />
                                </div>
                                <div className="p-0">
                                    <input 
                                        className="w-full h-full bg-transparent px-3 py-2 outline-none focus:bg-blue-900/20 text-white text-sm"
                                        placeholder="Origem"
                                        value={row.origem}
                                        onChange={e => updateRow(row.tempId, 'origem', e.target.value)}
                                        onKeyDown={e => handleKeyDown(e, idx)}
                                    />
                                </div>
                                <div className="p-0">
                                    <input 
                                        className="w-full h-full bg-transparent px-3 py-2 outline-none focus:bg-blue-900/20 text-white text-sm"
                                        placeholder="Destino"
                                        value={row.destino}
                                        onChange={e => updateRow(row.tempId, 'destino', e.target.value)}
                                        onKeyDown={e => handleKeyDown(e, idx)}
                                    />
                                </div>
                                <div className="p-0">
                                    <input 
                                        type="time"
                                        className="w-full h-full bg-transparent px-3 py-2 outline-none focus:bg-blue-900/20 text-white text-sm"
                                        value={row.hora}
                                        onChange={e => updateRow(row.tempId, 'hora', e.target.value)}
                                        onKeyDown={e => handleKeyDown(e, idx)}
                                    />
                                </div>
                                <div className="p-0">
                                    <input 
                                        className="w-full h-full bg-transparent px-3 py-2 outline-none focus:bg-blue-900/20 text-slate-300 text-sm"
                                        placeholder="TP..."
                                        value={row.voo}
                                        onChange={e => updateRow(row.tempId, 'voo', e.target.value)}
                                        onKeyDown={e => handleKeyDown(e, idx)}
                                    />
                                </div>
                                <div className="p-0">
                                    <input 
                                        className="w-full h-full bg-transparent px-3 py-2 outline-none focus:bg-blue-900/20 text-slate-300 text-sm"
                                        value={row.obs}
                                        onChange={e => updateRow(row.tempId, 'obs', e.target.value)}
                                        onKeyDown={e => handleKeyDown(e, idx)}
                                    />
                                </div>
                                <div className="p-0 flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => addReturnTrip(row)}
                                        className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded"
                                        title="Adicionar Retorno (Inverter)"
                                        tabIndex={-1}
                                    >
                                        <ArrowRightLeft className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => deleteRow(row.tempId)}
                                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"
                                        title="Remover Linha"
                                        tabIndex={-1}
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={addRow}
                    className="mt-4 w-full py-3 border-2 border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-white hover:border-slate-500 hover:bg-slate-800 transition flex items-center justify-center gap-2 font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Adicionar Linha
                </button>
            </div>
        </div>
    );
}
