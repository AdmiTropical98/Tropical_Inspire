import React, { useState, useEffect } from 'react';
import { Truck, Droplet, DollarSign, Calculator, Check, AlertCircle, FileText } from 'lucide-react';
import { useWorkshop } from '../../../contexts/WorkshopContext';
import { useAuth } from '../../../contexts/AuthContext';

const ReceberCombustivel: React.FC = () => {
    const { registerTankRefill, fuelTank } = useWorkshop();
    const { currentUser } = useAuth();
    
    const [supplier, setSupplier] = useState('');
    const [liters, setLiters] = useState('');
    const [pricePerLiter, setPricePerLiter] = useState('');
    const [obs, setObs] = useState('');
    const [totalValue, setTotalValue] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Auto calculate total
    useEffect(() => {
        const l = parseFloat(liters);
        const p = parseFloat(pricePerLiter);
        if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
            setTotalValue(Number((l * p).toFixed(2)));
        } else {
            setTotalValue(0);
        }
    }, [liters, pricePerLiter]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!supplier.trim()) {
            setError('Preencha o nome do fornecedor.');
            return;
        }

        const litersVal = parseFloat(liters);
        const priceVal = parseFloat(pricePerLiter);

        if (isNaN(litersVal) || litersVal <= 0) {
            setError('Introduza uma quantidade de litros válida.');
            return;
        }

        if (isNaN(priceVal) || priceVal <= 0) {
            setError('Introduza um preço por litro válido.');
            return;
        }

        // Check if tank has capacity
        const availableSpace = fuelTank.capacity - fuelTank.currentLevel;
        if (litersVal > availableSpace) {
            setError(\`Aviso: O tanque apenas tem capacidade para mais \${availableSpace.toFixed(2)} L. Está a tentar inserir \${litersVal} L.\`);
            return;
        }

        try {
            setIsSubmitting(true);
            const total = Number((litersVal * priceVal).toFixed(2));
            
            await registerTankRefill({
                id: crypto.randomUUID(),
                litersAdded: litersVal,
                levelBefore: fuelTank.currentLevel,
                levelAfter: fuelTank.currentLevel + litersVal,
                totalSpentSinceLast: total, // Usually calculated differently, but we'll map it to total cost
                pumpMeterReading: fuelTank.pumpTotalizer,
                supplier: supplier.trim(),
                timestamp: new Date().toISOString(),
                staffId: currentUser?.id || 'oficina',
                staffName: currentUser?.nome || 'Tablet Oficina',
                pricePerLiter: priceVal,
                totalCost: total,
            });

            setSuccess(true);
            setSupplier('');
            setLiters('');
            setPricePerLiter('');
            setObs('');
            
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Erro ao registar a entrada de combustível.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-emerald-600 p-6 text-white shrink-0">
                <h2 className="text-3xl font-black flex items-center gap-4">
                    <ArrowDownToLineIcon className="w-10 h-10 text-emerald-200" />
                    Receber Combustível
                </h2>
                <p className="text-emerald-100 mt-2 text-lg">Registe o abastecimento dos depósitos feito pelos fornecedores.</p>
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
                {success && (
                    <div className="bg-emerald-50 border-l-8 border-emerald-500 p-6 rounded-2xl mb-8 flex items-center gap-4 animate-in slide-in-from-top-4">
                        <div className="bg-emerald-500 rounded-full p-2 text-white">
                            <Check className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-emerald-800 text-xl font-bold">Entrada Registada!</h3>
                            <p className="text-emerald-600 text-lg">O stock do tanque e os custos foram atualizados com sucesso.</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border-l-8 border-red-500 p-6 rounded-2xl mb-8 flex items-center gap-4 animate-in slide-in-from-top-4">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                        <p className="text-red-700 text-lg font-bold">{error}</p>
                    </div>
                )}

                {/* Dashboard Stats */}
                <div className="flex gap-6 mb-8">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center">
                        <p className="text-slate-500 font-bold mb-1">Capacidade Atual</p>
                        <p className="text-3xl font-black text-slate-800">{fuelTank.currentLevel.toFixed(2)} L</p>
                        <p className="text-sm text-emerald-600 font-medium mt-1">/ {fuelTank.capacity} L</p>
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center">
                        <p className="text-slate-500 font-bold mb-1">Espaço Livre</p>
                        <p className="text-3xl font-black text-slate-800">{(fuelTank.capacity - fuelTank.currentLevel).toFixed(2)} L</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col xl:flex-row gap-12">
                    {/* Left Column: Core Data */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div>
                            <label className="block text-xl font-bold text-slate-700 mb-3">Fornecedor</label>
                            <div className="relative">
                                <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-8 h-8" />
                                <input
                                    type="text"
                                    placeholder="Nome do Fornecedor..."
                                    value={supplier}
                                    onChange={(e) => setSupplier(e.target.value)}
                                    className="w-full pl-16 pr-6 py-5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-2xl font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xl font-bold text-slate-700 mb-3">Litros (Quantidade)</label>
                            <div className="relative">
                                <Droplet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-8 h-8" />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                    placeholder="Ex: 5000"
                                    value={liters}
                                    onChange={(e) => setLiters(e.target.value)}
                                    className="w-full pl-16 pr-6 py-5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-2xl font-black text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">L</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xl font-bold text-slate-700 mb-3">Preço por Litro</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-8 h-8" />
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    placeholder="Ex: 1.459"
                                    value={pricePerLiter}
                                    onChange={(e) => setPricePerLiter(e.target.value)}
                                    className="w-full pl-16 pr-6 py-5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-2xl font-black text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all outline-none"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">€</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Totals & Obs */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col items-center justify-center shadow-lg border border-slate-800">
                            <Calculator className="w-12 h-12 text-emerald-400 mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Valor Total a Pagar</p>
                            <p className="text-6xl font-black">{totalValue > 0 ? totalValue.toFixed(2) : '0.00'} <span className="text-4xl text-emerald-500">€</span></p>
                        </div>

                        <div className="flex-1">
                            <label className="block text-xl font-bold text-slate-700 mb-3">Nº Guia / Observações</label>
                            <div className="relative h-full">
                                <FileText className="absolute left-4 top-5 text-slate-400 w-8 h-8" />
                                <textarea
                                    placeholder="Fatura nº, Notas..."
                                    value={obs}
                                    onChange={(e) => setObs(e.target.value)}
                                    className="w-full h-full min-h-[150px] pl-16 pr-6 py-5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button
                                type="submit"
                                disabled={isSubmitting || !supplier || !liters || !pricePerLiter}
                                className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-2xl font-black text-3xl transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-4 mt-4"
                            >
                                {isSubmitting ? (
                                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-10 h-10" />
                                        Confirmar Entrada
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

function ArrowDownToLineIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 17V3" />
            <path d="m6 11 6 6 6-6" />
            <path d="M19 21H5" />
        </svg>
    )
}

export default ReceberCombustivel;
