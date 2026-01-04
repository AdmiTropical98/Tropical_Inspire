import { BarChart3, FileText, Download, Calendar } from 'lucide-react';


export default function Relatorios() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-lg">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-blue-500" />
                        Relatórios e Estatísticas
                    </h1>
                    <p className="text-slate-400 mt-1">Análise detalhada da operação e exportação de dados.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
                        <Calendar className="w-4 h-4" />
                        <span>Este Mês</span>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">
                        <Download className="w-4 h-4" />
                        <span>Exportar PDF</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stat 1 */}
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText className="w-24 h-24 text-blue-500" />
                    </div>
                    <h3 className="text-slate-400 font-medium mb-2">Total de Serviços</h3>
                    <p className="text-3xl font-bold text-white">1,248</p>
                    <div className="mt-4 text-xs text-emerald-400 flex items-center gap-1">
                        <span>+12.5%</span>
                        <span className="text-slate-500">vs mês anterior</span>
                    </div>
                </div>

                {/* Stat 2 */}
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BarChart3 className="w-24 h-24 text-purple-500" />
                    </div>
                    <h3 className="text-slate-400 font-medium mb-2">Despesa Média</h3>
                    <p className="text-3xl font-bold text-white">€ 45.20</p>
                    <div className="mt-4 text-xs text-red-400 flex items-center gap-1">
                        <span>+2.1%</span>
                        <span className="text-slate-500">vs mês anterior</span>
                    </div>
                </div>

                {/* Stat 3 */}
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Calendar className="w-24 h-24 text-amber-500" />
                    </div>
                    <h3 className="text-slate-400 font-medium mb-2">Taxa de Ocupação</h3>
                    <p className="text-3xl font-bold text-white">87%</p>
                    <div className="mt-4 text-xs text-emerald-400 flex items-center gap-1">
                        <span>+5.4%</span>
                        <span className="text-slate-500">vs mês anterior</span>
                    </div>
                </div>
            </div>

            {/* Content Placeholder */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <BarChart3 className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Módulo de Relatórios em Construção</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                    Estamos a preparar uma suite completa de relatórios para análise detalhada da sua frota e equipa.
                </p>
            </div>
        </div>
    );
}
