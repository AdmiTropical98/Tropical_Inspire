import { useState } from 'react';
import { Star, User, Calendar, Save, Award, TrendingUp, Search, Download } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AvaliacaoMotorista() {
    const { motoristas, addAvaliacao, avaliacoes } = useWorkshop();
    const { currentUser } = useAuth();

    // Form State
    const [selectedMotorista, setSelectedMotorista] = useState('');
    const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [criterios, setCriterios] = useState({
        pontualidade: 0,
        apresentacao: 0,
        cuidadoViatura: 0,
        comportamento: 0
    });
    const [obs, setObs] = useState('');

    // List State
    const [filterMotorista, setFilterMotorista] = useState('');

    const handleRating = (key: keyof typeof criterios, value: number) => {
        setCriterios(prev => ({ ...prev, [key]: value }));
    };

    const calculateAverage = (c: typeof criterios) => {
        const values = Object.values(c);
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedMotorista || Object.values(criterios).some(v => v === 0)) {
            alert('Por favor preencha todos os campos e atribua estrelas a todos os critérios.');
            return;
        }

        const avg = Number(calculateAverage(criterios));

        await addAvaliacao({
            id: crypto.randomUUID(),
            motoristaId: selectedMotorista,
            adminId: currentUser?.id || 'admin',
            periodo,
            pontuacao: avg,
            criterios,
            obs,
            dataAvaliacao: new Date().toISOString()
        });

        // Reset
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSelectedMotorista('');
        setCriterios({ pontualidade: 0, apresentacao: 0, cuidadoViatura: 0, comportamento: 0 });
        setObs('');
        alert('Avaliação registada com sucesso!');
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text("Relatório de Avaliações", 14, 20);

        const data = avaliacoes.map(a => {
            const motorista = motoristas.find(m => m.id === a.motoristaId)?.nome || 'N/D';
            return [
                a.periodo,
                motorista,
                a.pontuacao,
                `${a.criterios.pontualidade}/5`,
                new Date(a.dataAvaliacao).toLocaleDateString()
            ];
        });

        autoTable(doc, {
            head: [['Período', 'Motorista', 'Média', 'Pontual.', 'Data']],
            body: data,
            startY: 25,
        });

        doc.save('avaliacoes_motoristas.pdf');
    };

    const filteredEvaluations = avaliacoes.filter(a => {
        const driverName = motoristas.find(m => m.id === a.motoristaId)?.nome.toLowerCase() || '';
        return driverName.includes(filterMotorista.toLowerCase());
    }).sort((a, b) => new Date(b.dataAvaliacao).getTime() - new Date(a.dataAvaliacao).getTime());

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 font-sans h-full overflow-y-auto custom-scrollbar">

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                            <Award className="w-6 h-6 text-purple-400" />
                        </div>
                        Avaliação de Desempenho
                    </h1>
                    <p className="text-slate-400">Avalie e acompanhe o desempenho da sua equipa.</p>
                </div>
                <div className="hidden md:block">
                    <div className="bg-slate-800/40 px-4 py-2 rounded-xl border border-slate-700/50 flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-bold">Média Geral</p>
                            <p className="text-xl font-bold text-white">
                                {avaliacoes.length > 0
                                    ? (avaliacoes.reduce((acc, curr) => acc + curr.pontuacao, 0) / avaliacoes.length).toFixed(1)
                                    : '---'} / 5.0
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* FORM */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl sticky top-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500" />
                            Nova Avaliação
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Motorista</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <select
                                        required
                                        value={selectedMotorista}
                                        onChange={e => setSelectedMotorista(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-white focus:border-purple-500 outline-none appearance-none"
                                    >
                                        <option value="">Selecione...</option>
                                        {motoristas.filter(m => m.status === 'disponivel' || m.status === 'ocupado').map(m => (
                                            <option key={m.id} value={m.id}>{m.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Período</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="month"
                                        required
                                        value={periodo}
                                        onChange={e => setPeriodo(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-white focus:border-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Critérios de Avaliação</p>

                                {Object.entries(criterios).map(([key, value]) => (
                                    <div key={key} className="flex justify-between items-center group">
                                        <span className="text-sm text-slate-300 capitalize group-hover:text-white transition-colors">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => handleRating(key as keyof typeof criterios, star)}
                                                    className={`transition-transform hover:scale-110 p-0.5 ${star <= value ? 'text-yellow-400' : 'text-slate-700'}`}
                                                >
                                                    <Star className="w-5 h-5 fill-current" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-800">
                                    <span className="text-sm font-bold text-white">Média Calc.</span>
                                    <span className="text-xl font-bold text-purple-400">{calculateAverage(criterios)}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Observações</label>
                                <textarea
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:border-purple-500 outline-none resize-none h-24"
                                    placeholder="Comentários adicionais sobre o desempenho..."
                                    value={obs}
                                    onChange={e => setObs(e.target.value)}
                                />
                            </div>

                            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <Save className="w-5 h-5" />
                                Registar Avaliação
                            </button>

                        </form>
                    </div>
                </div>

                {/* LIST */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Histórico de Avaliações</h3>
                            <button onClick={exportPDF} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700" title="Baixar PDF">
                                <Download className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Filter */}
                        <div className="mb-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Filtrar por nome do motorista..."
                                value={filterMotorista}
                                onChange={e => setFilterMotorista(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:border-purple-500 outline-none"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                            {filteredEvaluations.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <p>Nenhuma avaliação encontrada.</p>
                                </div>
                            ) : (
                                filteredEvaluations.map(ava => {
                                    const motorista = motoristas.find(m => m.id === ava.motoristaId);
                                    return (
                                        <div key={ava.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 hover:border-purple-500/30 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                                                        {motorista?.nome.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white">{motorista?.nome || 'Motorista Removido'}</h4>
                                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {ava.periodo}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                                                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                                        <span className="font-bold text-white">{ava.pontuacao.toFixed(1)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {ava.obs && (
                                                <div className="bg-slate-900/30 p-2 rounded text-xs text-slate-400 italic mt-2 border-l-2 border-slate-700">
                                                    "{ava.obs}"
                                                </div>
                                            )}

                                            <div className="grid grid-cols-4 gap-2 mt-3 text-[10px] text-slate-500 uppercase tracking-wider">
                                                <div className="text-center bg-slate-900/30 rounded py-1">
                                                    <span className="block text-slate-300 font-bold text-xs">{ava.criterios.pontualidade}</span>
                                                    Pontual.
                                                </div>
                                                <div className="text-center bg-slate-900/30 rounded py-1">
                                                    <span className="block text-slate-300 font-bold text-xs">{ava.criterios.apresentacao}</span>
                                                    Apres.
                                                </div>
                                                <div className="text-center bg-slate-900/30 rounded py-1">
                                                    <span className="block text-slate-300 font-bold text-xs">{ava.criterios.cuidadoViatura}</span>
                                                    Cuidado
                                                </div>
                                                <div className="text-center bg-slate-900/30 rounded py-1">
                                                    <span className="block text-slate-300 font-bold text-xs">{ava.criterios.comportamento}</span>
                                                    Comport.
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
