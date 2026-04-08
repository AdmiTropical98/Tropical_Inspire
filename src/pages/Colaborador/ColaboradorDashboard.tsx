import React, { useState, useEffect } from 'react';
import { LogOut, CheckCircle2, MapPin, History, RefreshCcw, Hand, CalendarDays, Bus, Activity } from 'lucide-react';
import { ColaboradorService } from '../../services/colaboradorService';
import type { Colaborador, ColaboradorStats, PresencaTransporte, TransporteCheckinRequest } from '../../services/colaboradorService';

interface ColaboradorDashboardProps {
  colaborador: Colaborador;
  onLogout: () => void;
}

const ColaboradorDashboard: React.FC<ColaboradorDashboardProps> = ({ colaborador, onLogout }) => {
  const [presencas, setPresencas] = useState<PresencaTransporte[]>([]);
  const [stats, setStats] = useState<ColaboradorStats>({
    totalUtilizacoes: 0,
    utilizacoesMesAtual: 0,
    diasAtivosMesAtual: 0,
    ultimaUtilizacao: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [feedback, setFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [checkinRequest, setCheckinRequest] = useState<TransporteCheckinRequest | null>(null);
  const [selectedMetodo, setSelectedMetodo] = useState<'qr' | 'nfc'>('qr');

  const carregarHistorico = async () => {
    setIsFetchingHistory(true);
    const [historico, resumo] = await Promise.all([
      ColaboradorService.obterPresencasRecentes(colaborador.id, 10),
      ColaboradorService.obterResumoUtilizacao(colaborador.id),
    ]);

    setPresencas(historico);
    setStats(resumo);
    setIsFetchingHistory(false);
  };

  useEffect(() => {
    carregarHistorico();
  }, [colaborador.id]);

  useEffect(() => {
    let intervalId: number | null = null;

    const poll = async () => {
      const active = await ColaboradorService.obterSolicitacaoAtiva(colaborador.id);
      setCheckinRequest(active);

      if (!active) {
        await carregarHistorico();
      }
    };

    poll();
    intervalId = window.setInterval(poll, 5000);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [colaborador.id]);

  const registarPonto = async (tipo: 'entrada' | 'saida') => {
    if (isLoading) return;
    setIsLoading(true);
    setFeedback(null);

    // Try to get GPS Location (Optional, don't block if denied)
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }
    } catch (e) {
      console.warn('GPS location not available or denied.');
    }

    const sucesso = await ColaboradorService.registarPresenca(colaborador.id, tipo, {
      latitude: lat,
      longitude: lng,
    });

    setIsLoading(false);

    if (sucesso) {
      setFeedback({ message: `Registo de ${tipo} efetuado com sucesso!`, type: 'success' });
      // Clear feedback after 4 seconds
      setTimeout(() => setFeedback(null), 4000);
      carregarHistorico();
    } else {
      setFeedback({ message: `Erro ao registar ${tipo}. Tente de novo.`, type: 'error' });
    }
  };

  const solicitarEntrada = async () => {
    if (isLoading || isCheckedIn) return;

    setIsLoading(true);
    setFeedback(null);

    const result = await ColaboradorService.solicitarEntradaComToken(colaborador.id, selectedMetodo);
    setIsLoading(false);

    if (!result.success) {
      setFeedback({ message: result.error || 'Nao foi possivel gerar o token QR/NFC.', type: 'error' });
      return;
    }

    const active = await ColaboradorService.obterSolicitacaoAtiva(colaborador.id);
    setCheckinRequest(active);
    setFeedback({ message: 'Token gerado. Mostre ao motorista para confirmar a entrada.', type: 'success' });
  };

  // If the last status is 'entrada', the user is likely on the bus, so we highlight 'saida'.
  const getLastStatus = () => {
    if (presencas.length === 0) return 'nenhum';
    return presencas[0].tipo; // List is ordered DESC by data_hora
  };

  const isCheckedIn = getLastStatus() === 'entrada';

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-6 shadow-sm z-10">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Colaborador #{colaborador.numero}
            </p>
            <h1 className="text-xl font-black text-white">{colaborador.nome}</h1>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            title="Terminar Sessão"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto p-6 flex flex-col gap-6">

        {/* Feedback Banner */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            feedback.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="font-medium text-sm">{feedback.message}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-4 mt-2">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-2">Metodo de validacao</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMetodo('qr')}
                className={`rounded-xl py-2 text-sm font-bold border ${selectedMetodo === 'qr' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-700'}`}
              >
                QR Code
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetodo('nfc')}
                className={`rounded-xl py-2 text-sm font-bold border ${selectedMetodo === 'nfc' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-700'}`}
              >
                NFC
              </button>
            </div>
          </div>

          <button
            onClick={solicitarEntrada}
            disabled={isLoading || isCheckedIn || !!checkinRequest}
            className={`relative overflow-hidden group rounded-3xl p-6 border-2 transition-all active:scale-[0.98] ${
              isCheckedIn || !!checkinRequest
                ? 'bg-slate-900 border-slate-800 opacity-50' 
                : 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400/50 shadow-lg shadow-green-900/20'
            }`}
          >
            <div className="flex flex-col items-center gap-4 relative z-10">
               <div className={`p-4 rounded-full ${isCheckedIn ? 'bg-slate-800 text-slate-500' : 'bg-white/20 text-white'}`}>
                 <MapPin className="w-8 h-8" />
               </div>
               <span className={`font-black tracking-wide text-xl ${(isCheckedIn || !!checkinRequest) ? 'text-slate-500' : 'text-white'}`}>
                 Gerar QR/NFC de Entrada
               </span>
            </div>
            
            {!isCheckedIn && !checkinRequest && (
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
            )}
          </button>

          {checkinRequest && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-widest font-bold text-emerald-300">Token {checkinRequest.metodo.toUpperCase()} ativo</p>
              <p className="text-4xl font-black text-white mt-2 tracking-widest text-center">{checkinRequest.token}</p>
              <p className="text-xs text-emerald-200/80 mt-2 text-center">Mostre este token ao motorista para confirmar a entrada.</p>
            </div>
          )}

          <button
            onClick={() => registarPonto('saida')}
            disabled={isLoading || !isCheckedIn}
            className={`relative overflow-hidden group rounded-3xl p-6 border-2 transition-all active:scale-[0.98] ${
              !isCheckedIn 
                ? 'bg-slate-900 border-slate-800 opacity-50' 
                : 'bg-gradient-to-br from-orange-500 to-red-600 border-red-400/50 shadow-lg shadow-red-900/20'
            }`}
          >
            <div className="flex flex-col items-center gap-4 relative z-10">
               <div className={`p-4 rounded-full ${!isCheckedIn ? 'bg-slate-800 text-slate-500' : 'bg-white/20 text-white'}`}>
                 <Hand className="w-8 h-8" />
               </div>
               <span className={`font-black tracking-wide text-xl ${!isCheckedIn ? 'text-slate-500' : 'text-white'}`}>
                 Sair do Transporte
               </span>
            </div>
            
            {isCheckedIn && (
               <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
              <Bus className="w-3.5 h-3.5" /> Total de Utilizações
            </p>
            <p className="mt-2 text-2xl font-black text-white">{stats.totalUtilizacoes}</p>
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> Este Mês
            </p>
            <p className="mt-2 text-2xl font-black text-white">{stats.utilizacoesMesAtual}</p>
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> Dias Ativos
            </p>
            <p className="mt-2 text-2xl font-black text-white">{stats.diasAtivosMesAtual}</p>
          </div>
        </div>

        {/* History Area */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex-1 mt-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico Recente
            </h3>
            <button 
               onClick={carregarHistorico}
               disabled={isFetchingHistory}
               className={`text-slate-500 hover:text-white transition-colors ${isFetchingHistory ? 'animate-spin' : ''}`}
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {isFetchingHistory ? (
              <div className="text-center text-slate-500 py-4 text-sm animate-pulse">
                A carregar os seus registos...
              </div>
            ) : presencas.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-sm">
                Ainda não tem registos efetuados.
              </div>
            ) : (
              presencas.map((p) => {
                const date = new Date(p.data_hora);
                const isEntrada = p.tipo === 'entrada';
                return (
                  <div key={p.id} className="flex flex-row items-center justify-between border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                        isEntrada 
                          ? 'bg-green-500/20 text-green-500 border border-green-500/20' 
                          : 'bg-red-500/20 text-red-500 border border-red-500/20'
                        }`}>
                        {isEntrada ? <MapPin className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isEntrada ? 'text-green-400' : 'text-red-400'}`}>
                          {isEntrada ? 'Entrada' : 'Saída'}
                        </p>
                        <p className="text-xs text-slate-500">Transporte da Frota</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-300">
                        {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-slate-600">
                        {date.toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default ColaboradorDashboard;
