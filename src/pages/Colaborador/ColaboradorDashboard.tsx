import React, { useState, useEffect, useRef } from 'react';
import { LogOut, CheckCircle2, MapPin, History, RefreshCcw, Hand, CalendarDays, Bus, Activity, Clock3, LayoutGrid, QrCode, ArrowRight } from 'lucide-react';
import { ColaboradorService } from '../../services/colaboradorService';
import type { Colaborador, ColaboradorStats, PresencaTransporte, TransporteCheckinRequest, TransporteQrAccess } from '../../services/colaboradorService';
import { QRCodeSVG } from 'qrcode.react';
import LinhaTransportes from '../LinhaTransportes';

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
  const [isWritingNfc, setIsWritingNfc] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [feedback, setFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [checkinRequests, setCheckinRequests] = useState<TransporteCheckinRequest[]>([]);
  const [selectedMetodo, setSelectedMetodo] = useState<'qr' | 'nfc'>('qr');
  const [qrAccess, setQrAccess] = useState<TransporteQrAccess>({
    allowed: false,
    escalas: [],
    message: 'A verificar a sua escala de transporte...',
  });
  const [activeTab, setActiveTab] = useState<'resumo' | 'qr' | 'linha'>('resumo');
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [entradaValida, setEntradaValida] = useState(false);
  const prevPendingRef = useRef<string | null>(null);

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
      const [access, activeRequests] = await Promise.all([
        ColaboradorService.obterAcessoQrTransporte(colaborador),
        ColaboradorService.obterSolicitacoesAtivas(colaborador.id),
      ]);

      const visibleRequests = access.allowed ? activeRequests : [];
      const currentPendingIds = visibleRequests.map((item) => item.id).sort().join('|');
      const previousPendingIds = prevPendingRef.current || '';

      setQrAccess(access);
      setCheckinRequests(visibleRequests);

      if (!currentPendingIds) {
        await carregarHistorico();
      }

      if (previousPendingIds && previousPendingIds !== currentPendingIds && currentPendingIds.length < previousPendingIds.length) {
        setEntradaValida(true);
        setFeedback({ message: 'Entrada validada pelo motorista.', type: 'success' });
        setTimeout(() => setEntradaValida(false), 6000);
      }

      prevPendingRef.current = currentPendingIds || null;
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

  const solicitarEntrada = async (escala?: TransporteQrAccess['escalas'][number]) => {
    if (isLoading) return;
    if (!qrAccess.allowed) {
      setFeedback({ message: qrAccess.message, type: 'error' });
      return;
    }

    const targetEscala = escala || qrAccess.escalas[0];
    if (!targetEscala) {
      setFeedback({ message: 'Nenhum transporte ativo disponível para gerar QR.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    const result = await ColaboradorService.solicitarEntradaComToken(colaborador.id, selectedMetodo, targetEscala);
    setIsLoading(false);

    if (!result.success) {
      setFeedback({ message: result.error || 'Nao foi possivel gerar o token QR/NFC.', type: 'error' });
      return;
    }

    const activeRequests = await ColaboradorService.obterSolicitacoesAtivas(colaborador.id);
    setCheckinRequests(activeRequests);
    setActiveTab('qr');
    setFeedback({ message: `Token gerado para o transporte${targetEscala.hora ? ` das ${targetEscala.hora}` : ''}.`, type: 'success' });

    if (selectedMetodo === 'nfc') {
      await escreverNfc(result.token || '');
    }
  };

  const escreverNfc = async (token: string) => {
    if (!token) return;

    const NDEFReaderCtor = (window as any).NDEFReader;
    if (!NDEFReaderCtor) {
      setFeedback({
        message: 'NFC nao suportado neste dispositivo/browser. Use QR code ou introduza o token.',
        type: 'error'
      });
      return;
    }

    try {
      setIsWritingNfc(true);
      const ndef = new NDEFReaderCtor();
      await ndef.write({
        records: [{
          recordType: 'text',
          data: `SMARTFLEET_CHECKIN:${token}`,
        }],
      });

      setFeedback({ message: 'NFC gravado. Encoste o telemovel ao leitor/dispositivo do motorista.', type: 'success' });
    } catch (error) {
      setFeedback({ message: 'Falha ao gravar NFC. Confirme permissao NFC e tente novamente.', type: 'error' });
    } finally {
      setIsWritingNfc(false);
    }
  };

  // If the last status is 'entrada', the user is likely on the bus, so we highlight 'saida'.
  const getLastStatus = () => {
    if (presencas.length === 0) return 'nenhum';
    return presencas[0].tipo; // List is ordered DESC by data_hora
  };

  const isCheckedIn = getLastStatus() === 'entrada';
  const proximaEscala = qrAccess.escalas[0] ?? null;
  const hasPendingRequest = checkinRequests.length > 0;

  const getEscalaTimeKey = (hora?: string) => String(hora || '').replace(/\D/g, '').slice(0, 4);
  const getCheckinRequestForEscala = (escala?: TransporteQrAccess['escalas'][number] | null) => {
    if (!escala) return null;
    const escalaKey = getEscalaTimeKey(escala.hora);
    return checkinRequests.find((request) => String(request.token || '').startsWith(escalaKey)) || null;
  };

  const formatScaleDate = (value?: string) => {
    if (!value) return 'Hoje';
    const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-PT');
  };

  const activeEscala =
    qrAccess.escalas.find((item) => String(item.id) === String(selectedPassId)) ||
    qrAccess.escalas.find((item) => Boolean(getCheckinRequestForEscala(item))) ||
    proximaEscala;

  const activeRequest = getCheckinRequestForEscala(activeEscala);
  const activeEscalaIndex = activeEscala
    ? qrAccess.escalas.findIndex((item) => item.id === activeEscala.id) + 1
    : 0;

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
      <main className={`flex-1 w-full ${activeTab === 'qr' ? 'max-w-5xl' : activeTab === 'linha' ? 'max-w-6xl' : 'max-w-md'} mx-auto p-6 flex flex-col gap-6`}>

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

        <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('resumo')}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'resumo' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Resumo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'qr' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            QR Transporte
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('linha')}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'linha' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Bus className="w-4 h-4" />
            Linha
          </button>
        </div>

        {activeTab === 'resumo' ? (
          <>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">Estado do transporte</p>
                  <h2 className="mt-1 text-lg font-black text-white">
                    {isCheckedIn ? 'Em transporte' : qrAccess.allowed ? 'Escala pronta para embarque' : 'A aguardar escala'}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {isCheckedIn
                      ? 'Quando terminar o trajeto, registe a sua saída.'
                      : qrAccess.allowed
                        ? 'Já pode abrir a aba do QR e mostrar o código ao motorista.'
                        : qrAccess.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 hover:border-blue-500/40 hover:text-white"
                >
                  Abrir QR
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {proximaEscala && (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Próxima escala</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {proximaEscala.origem || 'Origem por definir'} <span className="text-slate-500">→</span> {proximaEscala.destino || 'Destino por definir'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatScaleDate(proximaEscala.data)}
                        {proximaEscala.hora ? ` • ${proximaEscala.hora}` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-3 py-2 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-800">
                      <Clock3 className="w-3.5 h-3.5" />
                      {proximaEscala.hora || 'Por definir'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!hasPendingRequest && entradaValida && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
                <p className="text-emerald-300 text-xs uppercase tracking-wider font-bold">Entrada válida</p>
                <p className="text-white font-black text-lg mt-1">Motorista confirmou o seu embarque</p>
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
          </>
        ) : activeTab === 'linha' ? (
          <LinhaTransportes
            colaboradorParagem={colaborador.paragem}
            colaboradorNome={colaborador.nome}
            colaboradorId={colaborador.id}
            escala={proximaEscala}
            compact
          />
        ) : (
          <div className="mt-2 space-y-4">
            {qrAccess.allowed && activeEscala ? (
              <div className="mx-auto w-full max-w-5xl space-y-4">
                {qrAccess.escalas.length > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {qrAccess.escalas.map((escala, index) => {
                      const isSelected = activeEscala?.id === escala.id;
                      const hasRequestForScale = Boolean(getCheckinRequestForEscala(escala));

                      return (
                        <button
                          key={escala.id}
                          type="button"
                          onClick={() => setSelectedPassId(escala.id)}
                          className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                            isSelected
                              ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
                              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/30'
                          }`}
                        >
                          Transporte {index + 1}{escala.hora ? ` • ${escala.hora}` : ''}{hasRequestForScale ? ' • pronto' : ''}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_38%),linear-gradient(135deg,#082f49_0%,#0f172a_45%,#111827_100%)] shadow-[0_20px_80px_rgba(8,145,178,0.18)]">
                  <div className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-cyan-500/20 bg-[#0f172a]" />
                  <div className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-cyan-500/20 bg-[#0f172a]" />

                  <div className="border-b border-dashed border-cyan-400/20 px-6 py-4 md:px-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-200/70">Tropical Inspire</p>
                        <h2 className="mt-1 text-2xl font-black text-white">Boarding Pass</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-100">
                          Transporte {activeEscalaIndex || 1}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                          activeRequest
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                            : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                        }`}>
                          {activeRequest ? `Pronto • ${activeRequest.metodo.toUpperCase()}` : 'Por gerar'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="p-6 md:p-7">
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-100/70">Rota do embarque</p>
                      <div className="mt-3 rounded-[24px] border border-cyan-400/15 bg-slate-950/30 p-4">
                        <p className="text-lg font-black text-white">{activeEscala.origem || 'Origem por definir'}</p>
                        <div className="my-3 flex items-center gap-2 text-cyan-300">
                          <div className="h-px flex-1 bg-cyan-400/20" />
                          <Bus className="h-4 w-4" />
                          <div className="h-px flex-1 bg-cyan-400/20" />
                        </div>
                        <p className="text-lg font-black text-white">{activeEscala.destino || 'Destino por definir'}</p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Passageiro</p>
                          <p className="mt-1 text-sm font-bold text-white">{colaborador.nome}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Colaborador</p>
                          <p className="mt-1 text-sm font-bold text-white">#{colaborador.numero}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data</p>
                          <p className="mt-1 text-sm font-bold text-white">{formatScaleDate(activeEscala.data)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hora</p>
                          <p className="mt-1 text-sm font-bold text-white">{activeEscala.hora || 'Por definir'}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/70">Instruções</p>
                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          Apresente este passe ao motorista no embarque. O código é individual, temporário e válido apenas para este transporte.
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-cyan-400/20 bg-slate-950/30 p-6 md:border-l md:border-t-0 md:p-7">
                      {activeRequest ? (
                        <div className="flex h-full flex-col justify-between gap-4">
                          {activeRequest.metodo === 'qr' ? (
                            <div className="mx-auto flex w-full max-w-[220px] items-center justify-center rounded-[28px] bg-white p-4 shadow-xl">
                              <QRCodeSVG
                                value={`SMARTFLEET_CHECKIN:${activeRequest.token}`}
                                size={190}
                                level="M"
                                includeMargin
                              />
                            </div>
                          ) : (
                            <div className="rounded-[28px] border border-cyan-400/20 bg-cyan-500/10 p-6 text-center">
                              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-100/70">Modo NFC</p>
                              <p className="mt-2 text-2xl font-black text-white">Encoste para validar</p>
                              <p className="mt-2 text-sm text-slate-300">O motorista pode confirmar a entrada através do token NFC deste transporte.</p>
                            </div>
                          )}

                          <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-500/10 px-5 py-4 text-center text-white">
                            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-100/80">Código de embarque</p>
                            <p className="mt-3 text-4xl font-black tracking-[0.22em] font-mono sm:text-5xl">{activeRequest.token}</p>
                            <p className="mt-3 text-sm text-cyan-100/90">
                              Válido até {new Date(activeRequest.expires_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          {activeRequest.metodo === 'nfc' && (
                            <button
                              type="button"
                              onClick={() => escreverNfc(activeRequest.token)}
                              disabled={isWritingNfc}
                              className="w-full rounded-2xl bg-white py-3 font-bold text-[#1565c0] hover:bg-blue-50 disabled:bg-slate-300 disabled:text-slate-600"
                            >
                              {isWritingNfc ? 'A gravar NFC...' : 'Gravar token no NFC'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full flex-col justify-between gap-4">
                          <div className="rounded-[24px] border border-cyan-400/15 bg-slate-950/40 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-100/70">Método de validação</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedMetodo('qr')}
                                className={`rounded-xl py-2.5 text-sm font-bold border transition-colors ${selectedMetodo === 'qr' ? 'bg-white text-[#1565c0] border-white' : 'bg-slate-950 text-slate-300 border-slate-700'}`}
                              >
                                QR Code
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedMetodo('nfc')}
                                className={`rounded-xl py-2.5 text-sm font-bold border transition-colors ${selectedMetodo === 'nfc' ? 'bg-white text-[#1565c0] border-white' : 'bg-slate-950 text-slate-300 border-slate-700'}`}
                              >
                                NFC
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={() => solicitarEntrada(activeEscala)}
                            disabled={isLoading || !qrAccess.allowed}
                            className={`w-full rounded-[24px] border-2 p-5 text-center transition-all active:scale-[0.98] ${
                              !qrAccess.allowed
                                ? 'bg-slate-900 border-slate-800 opacity-50'
                                : 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-300/50 shadow-lg shadow-cyan-900/20'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-3">
                              <div className={`rounded-full p-3 ${!qrAccess.allowed ? 'bg-slate-800 text-slate-500' : 'bg-white/20 text-white'}`}>
                                <QrCode className="h-7 w-7" />
                              </div>
                              <span className={`text-lg font-black tracking-wide ${!qrAccess.allowed ? 'text-slate-500' : 'text-white'}`}>
                                {selectedMetodo === 'nfc' ? 'Criar passe NFC' : 'Criar boarding pass'}
                              </span>
                            </div>
                          </button>

                          <p className="text-center text-xs text-slate-300">
                            Será criado um único passe para o transporte {activeEscala.hora ? `das ${activeEscala.hora}` : 'selecionado'}.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-slate-400">Passe digital</p>
                <h2 className="mt-2 text-2xl font-black text-white">Boarding pass indisponível</h2>
                <p className="mt-2 text-sm text-slate-300">{qrAccess.message}</p>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default ColaboradorDashboard;
