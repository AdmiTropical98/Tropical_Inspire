import React, { useState, useMemo } from 'react';
import { Car, Gauge, Droplet, Check, AlertCircle } from 'lucide-react';
import { useWorkshop } from '../../../contexts/WorkshopContext';
import { useAuth } from '../../../contexts/AuthContext';

const AbastecerViatura: React.FC = () => {
    const { viaturas, registerRefuel, fuelTank } = useWorkshop();
    const { currentUser } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [km, setKm] = useState('');
    const [liters, setLiters] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const activeVehicles = useMemo(() => {
        return viaturas
            .filter(v => v.status === 'ativo')
            .filter(v => 
                v.matricula.toLowerCase().includes(searchTerm.toLowerCase()) || 
                v.marca.toLowerCase().includes(searchTerm.toLowerCase()) || 
                v.modelo.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [viaturas, searchTerm]);

    const selectedVehicle = viaturas.find(v => v.id === selectedVehicleId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!selectedVehicleId) {
            setError('Selecione uma viatura.');
            return;
        }

        const kmVal = parseFloat(km);
        const litersVal = parseFloat(liters);

        if (isNaN(kmVal) || kmVal <= 0) {
            setError('Introduza uma quilometragem válida.');
            return;
        }

        if (isNaN(litersVal) || litersVal <= 0) {
            setError('Introduza uma quantidade de litros válida.');
            return;
        }

        if (fuelTank.currentLevel < litersVal) {
            setError(\`Aviso: O tanque apenas tem \${fuelTank.currentLevel.toFixed(2)} L disponíveis.\`);
            // We might still allow it, but for safety let's block or just warn.
            // Actually, let's block to prevent negative stock in a tablet mode.
            return;
        }

        try {
            setIsSubmitting(true);
            await registerRefuel({
                id: crypto.randomUUID(),
                vehicleId: selectedVehicleId,
                driverId: null, // Driver unknown in tablet mode unless we add it
                liters: litersVal,
                km: kmVal,
                status: 'confirmed',
                timestamp: new Date().toISOString(),
                staffId: currentUser?.id || 'oficina',
                staffName: currentUser?.nome || 'Tablet Oficina',
                isExternal: false,
                station: 'Oficina (Depósito)'
            });

            setSuccess(true);
            setSearchTerm('');
            setSelectedVehicleId(null);
            setKm('');
            setLiters('');
            
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Erro ao registar o abastecimento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-6 text-white shrink-0">
                <h2 className="text-3xl font-black flex items-center gap-4">
                    <FuelIcon className="w-10 h-10 text-blue-200" />
                    Registar Abastecimento
                </h2>
                <p className="text-blue-100 mt-2 text-lg">Registe os abastecimentos feitos no depósito da oficina.</p>
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
                {success && (
                    <div className="bg-emerald-50 border-l-8 border-emerald-500 p-6 rounded-2xl mb-8 flex items-center gap-4 animate-in slide-in-from-top-4">
                        <div className="bg-emerald-500 rounded-full p-2 text-white">
                            <Check className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-emerald-800 text-xl font-bold">Abastecimento Registado!</h3>
                            <p className="text-emerald-600 text-lg">O stock do tanque foi atualizado com sucesso.</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border-l-8 border-red-500 p-6 rounded-2xl mb-8 flex items-center gap-4 animate-in slide-in-from-top-4">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                        <p className="text-red-700 text-lg font-bold">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex gap-12">
                    {/* Left Column: Vehicle Selection */}
                    <div className="w-1/2 flex flex-col gap-6">
                        <div>
                            <label className="block text-xl font-bold text-slate-700 mb-3">1. Selecionar Viatura</label>
                            <div className="relative">
                                <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-8 h-8" />
                                <input
                                    type="text"
                                    placeholder="Procurar matrícula..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setSelectedVehicleId(null);
                                    }}
                                    className="w-full pl-16 pr-6 py-5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-2xl font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex-1 border-2 border-slate-200 rounded-2xl overflow-y-auto max-h-[500px] bg-slate-50 p-2">
                            {activeVehicles.length === 0 ? (
                                <div className="text-center p-8 text-slate-400 font-bold text-xl">Nenhuma viatura encontrada.</div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {activeVehicles.map(v => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedVehicleId(v.id);
                                                setSearchTerm(v.matricula);
                                            }}
                                            className={\`p-4 rounded-xl text-left border-2 transition-all \${
                                                selectedVehicleId === v.id
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                                            }\`}
                                        >
                                            <div className="text-2xl font-black tracking-wider">{v.matricula}</div>
                                            <div className={\`text-sm mt-1 truncate \${selectedVehicleId === v.id ? 'text-blue-100' : 'text-slate-500'}\`}>
                                                {v.marca} {v.modelo}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Values */}
                    <div className="w-1/2 flex flex-col gap-8">
                        <div>
                            <label className="block text-xl font-bold text-slate-700 mb-3">2. Quilómetros Atuais</label>
                            <div className="relative">
                                <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-8 h-8" />
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="Ex: 154000"
                                    value={km}
                                    onChange={(e) => setKm(e.target.value)}
                                    className="w-full pl-16 pr-6 py-6 bg-slate-100 border-2 border-slate-200 rounded-2xl text-4xl font-black text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">KM</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xl font-bold text-slate-700 mb-3">3. Litros Abastecidos</label>
                            <div className="relative">
                                <Droplet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-8 h-8" />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                    placeholder="Ex: 45.5"
                                    value={liters}
                                    onChange={(e) => setLiters(e.target.value)}
                                    className="w-full pl-16 pr-6 py-6 bg-slate-100 border-2 border-slate-200 rounded-2xl text-4xl font-black text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">L</span>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedVehicleId || !km || !liters}
                                className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-2xl font-black text-3xl transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-4"
                            >
                                {isSubmitting ? (
                                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-10 h-10" />
                                        Confirmar Registo
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

function FuelIcon(props: any) {
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
            <line x1="3" x2="15" y1="22" y2="22" />
            <line x1="4" x2="14" y1="9" y2="9" />
            <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
            <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
        </svg>
    )
}

export default AbastecerViatura;
