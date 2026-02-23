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
        <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
            {/* Full Width Container */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-4">
                                <span className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                                    <Award className="w-8 h-8 text-purple-400" />
                                </span>
                                <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 text-transparent bg-clip-text">
                                    Avaliação de Desempenho
                                </span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium">Avalie e acompanhe o desempenho da sua equipa.</p>
                        </div>
                        <div className="hidden md:block">
                            <div className="bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-700/50 flex items-center gap-4 shadow-xl">
                                <div className="p-2 bg-emerald-500/10 rounded-full">
                                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Média Geral</p>
                                    <p className="text-2xl font-black text-white">
                                        {avaliacoes.length > 0
                                            ? (avaliacoes.reduce((acc, curr) => acc + curr.pontuacao, 0) / avaliacoes.length).toFixed(1)
                                            : '---'} <span className="text-sm text-slate-500 font-bold">/ 5.0</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">

                        {/* FORM */}
                        <div className="lg:col-span-1 h-full">
                            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl h-full flex flex-col overflow-y-auto custom-scrollbar">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 pb-4 border-b border-slate-800">
                                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                                    Nova Avaliação
                                </h3>

                                <form onSubmit={handleSubmit} className="space-y-6 flex-1 flex flex-col">

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Motorista</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                            <select
                                                required
                                                value={selectedMotorista}
                                                onChange={e => setSelectedMotorista(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 pl-12 text-white focus:border-purple-500 outline-none appearance-none transition-all shadow-sm font-medium"
                                            >
                                                <option value="">Selecione um motorista...</option>
                                                {motoristas.filter(m => m.status === 'disponivel' || m.status === 'ocupado').map(m => (
                                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Período</label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                            <input
                                                type="month"
                                                required
                                                value={periodo}
                                                onChange={e => setPeriodo(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 pl-12 text-white focus:border-purple-500 outline-none transition-all shadow-sm font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-5 pt-4">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            Critérios de Avaliação
                                            <span className="h-px bg-slate-800 flex-1"></span>
                                        </p>

                                        {Object.entries(criterios).map(([key, value]) => (
                                            <div key={key} className="flex justify-between items-center group">
                                                <span className="text-sm font-medium text-slate-300 capitalize group-hover:text-white transition-colors">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <div className="flex gap-1 bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => handleRating(key as keyof typeof criterios, star)}
                                                            className={`transition-all hover:scale-110 p-1 ${star <= value ? 'text-yellow-400' : 'text-slate-800 hover:text-yellow-500/50'}`}
                                                        >
                                                            <Star className={`w-6 h-6 ${star <= value ? 'fill-current' : ''}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        <div className="flex justify-between items-center pt-4 pb-2">
                                            <span className="text-sm font-bold text-white">Média Calculada</span>
                                            <div className="bg-purple-500/10 px-4 py-2 rounded-xl border border-purple-500/20">
                                                <span className="text-2xl font-black text-purple-400">{calculateAverage(criterios)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Observações</label>
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:border-purple-500 outline-none resize-none h-24 transition-all"
                                            placeholder="Comentários adicionais sobre o desempenho..."
                                            value={obs}
                                            onChange={e => setObs(e.target.value)}
                                        />
                                    </div>

                                    <button type="submit" className="mt-auto w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 group">
                                        <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        Registar Avaliação
                                    </button>

                                </form>
                            </div>
                        </div>

                        {/* LIST */}
                        <div className="lg:col-span-2 h-full">
                            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 h-full flex flex-col shadow-2xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white">Histórico de Avaliações</h3>
                                    <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 font-medium text-xs uppercase tracking-wider hover:text-white" title="Baixar PDF">
                                        <Download className="w-4 h-4" />
                                        Exportar PDF
                                    </button>
                                </div>

                                {/* Filter */}
                                <div className="mb-6 relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar por nome do motorista..."
                                        value={filterMotorista}
                                        onChange={e => setFilterMotorista(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:border-purple-500 outline-none transition-all shadow-inner"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                                    {filteredEvaluations.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                            <div className="p-4 bg-slate-800/50 rounded-full mb-4">
                                                <Search className="w-8 h-8 opacity-50" />
                                            </div>
                                            <p className="font-medium">Nenhuma avaliação encontrada.</p>
                                        </div>
                                    ) : (
                                        filteredEvaluations.map(ava => {
                                            const motorista = motoristas.find(m => m.id === ava.motoristaId);
                                            return (
                                                <div key={ava.id} className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-5 hover:border-purple-500/30 transition-all hover:shadow-lg hover:shadow-purple-900/5 group relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-purple-500/10 transition-colors"></div>

                                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-lg border border-slate-600 shadow-inner">
                                                                {motorista?.nome.charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-white text-lg">{motorista?.nome || 'Motorista Removido'}</h4>
                                                                <p className="text-xs text-slate-400 flex items-center gap-1 font-medium bg-slate-800/50 px-2 py-0.5 rounded-md w-fit">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {ava.periodo}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-baseline gap-1 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
                                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                                <span className="font-black text-white text-xl">{ava.pontuacao.toFixed(1)}</span>
                                                                <span className="text-xs text-slate-500 font-bold">/ 5.0</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {ava.obs && (
                                                        <div className="bg-slate-950/50 p-3 rounded-xl text-sm text-slate-400 italic mb-4 border-l-2 border-purple-500/50 relative z-10">
                                                            "{ava.obs}"
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-4 gap-3 relative z-10">
                                                        <div className="flex flex-col items-center bg-slate-950/30 rounded-xl py-2 border border-slate-800/50">
                                                            <div className="flex gap-0.5 mb-1">
                                                                {[1, 2, 3, 4, 5].map(s => <div key={s} className={`w-1 h-3 rounded-full ${s <= ava.criterios.pontualidade ? 'bg-purple-500' : 'bg-slate-800'}`}></div>)}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pontual.</span>
                                                        </div>
                                                        <div className="flex flex-col items-center bg-slate-950/30 rounded-xl py-2 border border-slate-800/50">
                                                            <div className="flex gap-0.5 mb-1">
                                                                {[1, 2, 3, 4, 5].map(s => <div key={s} className={`w-1 h-3 rounded-full ${s <= ava.criterios.apresentacao ? 'bg-purple-500' : 'bg-slate-800'}`}></div>)}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Apres.</span>
                                                        </div>
                                                        <div className="flex flex-col items-center bg-slate-950/30 rounded-xl py-2 border border-slate-800/50">
                                                            <div className="flex gap-0.5 mb-1">
                                                                {[1, 2, 3, 4, 5].map(s => <div key={s} className={`w-1 h-3 rounded-full ${s <= ava.criterios.cuidadoViatura ? 'bg-purple-500' : 'bg-slate-800'}`}></div>)}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cuidado</span>
                                                        </div>
                                                        <div className="flex flex-col items-center bg-slate-950/30 rounded-xl py-2 border border-slate-800/50">
                                                            <div className="flex gap-0.5 mb-1">
                                                                {[1, 2, 3, 4, 5].map(s => <div key={s} className={`w-1 h-3 rounded-full ${s <= ava.criterios.comportamento ? 'bg-purple-500' : 'bg-slate-800'}`}></div>)}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Comport.</span>
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
            </div>
        </div>
    );
}
