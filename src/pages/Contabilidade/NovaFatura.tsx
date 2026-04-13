import { useState } from 'react';
import { ArrowLeft, Save, FileText, Trash2, Car } from 'lucide-react';
import type { Cliente, ItemFatura, Fatura } from '../../types';
import { useWorkshop } from '../../contexts/WorkshopContext';

interface NovaFaturaProps {
    initialData?: Fatura | null;
    onBack: () => void;
    onSave: (data: any) => void;
}

export default function NovaFatura({ initialData, onBack, onSave }: NovaFaturaProps) {
    const { viaturas, centrosCustos, clientes } = useWorkshop();

    const [clienteId, setClienteId] = useState(initialData?.clienteId || '');
    const [data, setData] = useState(initialData?.data || new Date().toISOString().split('T')[0]);
    const [vencimento, setVencimento] = useState(initialData?.vencimento || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [notas, setNotas] = useState(initialData?.notas || '');

    const [items, setItems] = useState<ItemFatura[]>(initialData?.itens || []);
    const [showRentalModal, setShowRentalModal] = useState(false);

    // Rental Form State
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedCostCenterId, setSelectedCostCenterId] = useState('');
    const [rentalDays, setRentalDays] = useState(1);
    const [rentalRate, setRentalRate] = useState(0);

    const handleVehicleSelect = (id: string) => {
        setSelectedVehicleId(id);
        const vehicle = viaturas.find(v => v.id === id);
        if (vehicle && vehicle.precoDiario) {
            setRentalRate(vehicle.precoDiario);
        }
    };

    const addRentalItem = () => {
        if (!selectedVehicleId) return alert('Selecione uma viatura');
        if (rentalDays <= 0) return alert('Insira um número válido de dias');
        if (rentalRate <= 0) return alert('Insira um preço diário válido');

        const vehicle = viaturas.find(v => v.id === selectedVehicleId);
        const costCenter = centrosCustos.find(c => c.id === selectedCostCenterId);

        const description = `Aluguer ${vehicle?.marca} ${vehicle?.modelo} (${vehicle?.matricula})${costCenter ? ` - ${costCenter.nome}` : ''}`;

        const newItem: ItemFatura = {
            id: crypto.randomUUID(),
            descricao: description,
            quantidade: rentalDays,
            precoUnitario: rentalRate,
            taxaImposto: 14,
            total: (rentalDays * rentalRate) * 1.14
        };

        // Recalculate precisely
        const subRes = rentalDays * rentalRate;
        const taxRes = subRes * 0.14;
        newItem.total = subRes + taxRes;

        setItems([...items, newItem]);
        setShowRentalModal(false);
        // Reset form
        setSelectedVehicleId('');
        setSelectedCostCenterId('');
        setRentalDays(1);
        setRentalRate(0);
    };

    const addItem = () => {
        const newItem: ItemFatura = {
            id: crypto.randomUUID(),
            descricao: '',
            quantidade: 1,
            precoUnitario: 0,
            taxaImposto: 14, // Default VAT 14%
            total: 0
        };
        setItems([...items, newItem]);
    };

    const updateItem = (id: string, field: keyof ItemFatura, value: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Recalculate total if needed
                if (field === 'quantidade' || field === 'precoUnitario' || field === 'taxaImposto') {
                    const qty = field === 'quantidade' ? Number(value) : item.quantidade;
                    const price = field === 'precoUnitario' ? Number(value) : item.precoUnitario;
                    const taxRate = field === 'taxaImposto' ? Number(value) : item.taxaImposto;

                    const subRes = qty * price;
                    const taxRes = subRes * (taxRate / 100);
                    updated.total = subRes + taxRes;
                }
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);
    };

    // Calculations
    const subtotal = items.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0);
    const totalTax = items.reduce((acc, item) => acc + ((item.quantidade * item.precoUnitario) * (item.taxaImposto / 100)), 0);
    const total = subtotal + totalTax;

    const handleSave = () => {
        if (!clienteId) return alert('Selecione um cliente');
        if (items.length === 0) return alert('Adicione pelo menos um item');

        onSave({
            clienteId,
            data,
            vencimento,
            notas,
            items,
            subtotal,
            imposto: totalTax,
            total
        });
    };

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </button>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200">
                        Salvar Rascunho
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-blue-500/20"
                    >
                        <Save className="w-4 h-4" />
                        {initialData ? 'Atualizar Fatura' : 'Emitir Fatura'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-8 shadow-sm">

                {/* Invoice Meta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-slate-200">
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-600">Cliente</label>
                        <select
                            value={clienteId}
                            onChange={(e) => setClienteId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Selecione um cliente...</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                        </select>
                        {clienteId && (
                            <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 space-y-1 border border-slate-200">
                                <p className="font-medium text-slate-900">{clientes.find(c => c.id === clienteId)?.nome}</p>
                                <p>NIF: {clientes.find(c => c.id === clienteId)?.nif}</p>
                                <p>{clientes.find(c => c.id === clienteId)?.morada}</p>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-600">Data de Emissão</label>
                            <input
                                type="date"
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-600">Data de Vencimento</label>
                            <input
                                type="date"
                                value={vencimento}
                                onChange={(e) => setVencimento(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <label className="block text-sm font-medium text-slate-600">Notas / Observações</label>
                            <textarea
                                value={notas}
                                onChange={(e) => setNotas(e.target.value)}
                                placeholder="Detalhes de pagamento, referências, etc."
                                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-20 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">

                            <FileText className="w-5 h-5 text-blue-500" />
                            Itens da Fatura
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowRentalModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium transition-colors border border-dashed border-amber-300 hover:border-amber-400"
                            >
                                <Car className="w-4 h-4" />
                                + Aluguer Viatura
                            </button>
                            <button
                                onClick={addItem}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors border border-dashed border-blue-300 hover:border-blue-500"
                            >
                                + Adicionar Item
                            </button>
                        </div>
                    </div>

                    {/* Rental Modal Area (Inline for simplicity) */}
                    {showRentalModal && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-amber-400 flex items-center gap-2">
                                <Car className="w-4 h-4" />
                                Adicionar Cobrança de Aluguer
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs text-slate-500">Viatura</label>
                                    <select
                                        value={selectedVehicleId}
                                        onChange={(e) => handleVehicleSelect(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-amber-500"
                                    >
                                        <option value="">Selecione a viatura...</option>
                                        {viaturas.map(v => (
                                            <option key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.matricula}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs text-slate-500">Centro de Custo (Opcional)</label>
                                    <select
                                        value={selectedCostCenterId}
                                        onChange={(e) => setSelectedCostCenterId(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-amber-500"
                                    >
                                        <option value="">Selecione o centro de custo...</option>
                                        {centrosCustos.map(c => (
                                            <option key={c.id} value={c.id}>{c.nome}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500">Dias</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={rentalDays}
                                        onChange={(e) => setRentalDays(Number(e.target.value))}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500">Diária (€)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={rentalRate}
                                        onChange={(e) => setRentalRate(Number(e.target.value))}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-amber-500"
                                    />
                                </div>
                                <div className="flex items-end gap-2 md:col-span-2">
                                    <button
                                        onClick={addRentalItem}
                                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Adicionar à Fatura
                                    </button>
                                    <button
                                        onClick={() => setShowRentalModal(false)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition-colors border border-slate-200"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 w-[40%]">Descrição</th>
                                    <th className="px-4 py-3 text-right w-[10%]">Qtd</th>
                                    <th className="px-4 py-3 text-right w-[20%]">Preço Unit.</th>
                                    <th className="px-4 py-3 text-right w-[10%]">IVA (%)</th>
                                    <th className="px-4 py-3 text-right w-[15%]">Total</th>
                                    <th className="px-4 py-3 w-[5%]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {items.map((item) => (
                                    <tr key={item.id} className="group">
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={item.descricao}
                                                onChange={(e) => updateItem(item.id, 'descricao', e.target.value)}
                                                placeholder="Descrição do serviço ou produto"
                                                className="w-full bg-transparent border-none text-slate-900 placeholder-slate-400 focus:ring-0 px-2"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantidade}
                                                onChange={(e) => updateItem(item.id, 'quantidade', e.target.value)}
                                                className="w-full bg-transparent border-none text-right text-slate-900 focus:ring-0 px-2"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.precoUnitario}
                                                onChange={(e) => updateItem(item.id, 'precoUnitario', e.target.value)}
                                                className="w-full bg-transparent border-none text-right text-slate-900 focus:ring-0 px-2"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={item.taxaImposto}
                                                onChange={(e) => updateItem(item.id, 'taxaImposto', e.target.value)}
                                                className="w-full bg-transparent border-none text-right text-slate-600 focus:ring-0 px-2"
                                            />
                                        </td>
                                        <td className="p-2 text-right font-medium text-slate-900 px-6">
                                            {formatCurrency(item.total)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-500 italic bg-slate-50">
                                            Adicione itens à fatura para calcular o total.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end pt-4 border-t border-slate-200">
                    <div className="w-72 space-y-3">
                        <div className="flex justify-between text-slate-600">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Impostos (IVA)</span>
                            <span>{formatCurrency(totalTax)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-slate-200">
                            <span className="text-lg font-bold text-slate-900">Total a Pagar</span>
                            <span className="text-lg font-bold text-blue-400">
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
