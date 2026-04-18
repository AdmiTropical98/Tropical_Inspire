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
    <div
      className="colaborador-dashboard relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#d8e8f8] text-slate-900"
      style={{
        backgroundImage:
          "radial-gradient(140% 100% at 50% 100%, rgba(96,165,250,0.45) 0%, rgba(96,165,250,0) 55%), radial-gradient(120% 95% at 50% 0%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.35) 35%, rgba(255,255,255,0) 70%), url('/grid-pattern.svg'), linear-gradient(180deg, #cfdff1 0%, #dce8f6 45%, #e5eef9 100%)",
        backgroundSize: "100% 100%, 100% 100%, 420px 420px, 100% 100%",
        backgroundPosition: "center, center, center, center",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "linear-gradient(20deg, rgba(255,255,255,0.2) 10%, rgba(255,255,255,0) 45%), linear-gradient(-22deg, rgba(255,255,255,0.18) 20%, rgba(255,255,255,0) 48%)" }} />

      {/* Logo Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 md:px-10 md:pt-8 md:pb-4">
        {/* Mobile: compact row with logo + welcome + logout */}
        <div className="flex items-center justify-between md:block">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl bg-white/65 px-2.5 py-1.5 shadow-[0_8px_25px_rgba(15,35,80,0.18)] backdrop-blur-sm md:rounded-2xl md:px-4 md:py-2">
              <img src="/LOGO.png" alt="Algartempo Frota" className="h-8 w-auto drop-shadow-[0_3px_8px_rgba(17,24,39,0.25)] md:h-14" />
            </div>
            <div className="md:hidden">
              <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest leading-none">Área Colaborador</p>
              <p className="text-base font-black text-slate-900 leading-tight">Bem-vindo, {colaborador.nome}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="md:hidden p-2 bg-white/70 text-slate-600 rounded-xl shadow-sm backdrop-blur-sm border border-white/60 active:scale-95 transition-transform"
            title="Terminar Sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="android-page-shell relative z-10 flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 pb-8 flex flex-col justify-start md:justify-center">

        {/* Feedback Banner */}
        {feedback && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' 
              : 'bg-red-500/10 border-red-500/30 text-red-700'
          }`}>
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="font-medium text-sm">{feedback.message}</p>
          </div>
        )}

        {/* Main Card Container */}
        <div className="colaborador-main-card bg-white/95 rounded-3xl shadow-2xl overflow-hidden border border-white/90 backdrop-blur-sm">
          
          {/* Greeting Section — hidden on mobile (shown in header instead) */}
          <div className="hidden md:flex bg-gradient-to-r from-blue-50 to-blue-100 px-8 py-6 border-b border-slate-200 justify-between items-start">
            <div>
              <p className="text-sm text-slate-600 uppercase tracking-widest font-bold">Painel do Colaborador</p>
              <h1 className="text-3xl font-black text-slate-900 mt-1">Bem-vindo, {colaborador.nome}</h1>
            </div>
            <button 
              onClick={onLogout}
              className="p-2.5 bg-white text-slate-600 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm border border-slate-200"
              title="Terminar Sessão"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs — segmented control compact */}
          <div className="p-2 border-b border-slate-200 bg-slate-50/50">
            <div className="colaborador-tabs flex rounded-xl bg-slate-200/60 p-0.5 h-auto min-h-11">
              <button
                type="button"
                onClick={() => setActiveTab('resumo')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] text-sm font-bold transition-all ${
                  activeTab === 'resumo'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 active:bg-white/40'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Resumo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] text-sm font-bold transition-all ${
                  activeTab === 'qr'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 active:bg-white/40'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('linha')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] text-sm font-bold transition-all ${
                  activeTab === 'linha'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 active:bg-white/40'
                }`}
              >
                <Bus className="w-3.5 h-3.5" />
                <span>Linha</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 md:p-8">

        {activeTab === 'resumo' ? (
          <div className="space-y-4 md:space-y-6">
            {/* Status Card */}
            <div className="rounded-[14px] border border-slate-200 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-widest font-bold">Estado do Transporte</p>
                  <h2 className="text-xl font-black text-slate-900">
                    {isCheckedIn ? 'Em transporte' : qrAccess.allowed ? 'Escala pronta para embarque' : 'A aguardar escala'}
                  </h2>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-4">
                {isCheckedIn
                  ? 'Quando terminar o trajeto, registe a sua saída.'
                  : qrAccess.allowed
                    ? 'O QR do transporte só fica disponível quando o seu nome constar numa escala ativa.'
                    : qrAccess.message}
              </p>
              
              {proximaEscala && (
                <div className="rounded-xl bg-white border border-slate-200 p-4 mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Próxima Escala</p>
                  <div className="flex justify-between items-end gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {proximaEscala.origem || 'Origem'} <span className="text-slate-500">→</span> {proximaEscala.destino || 'Destino'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatScaleDate(proximaEscala.data)}{proximaEscala.hora ? ` • ${proximaEscala.hora}` : ''}
                      </p>
                    </div>
                    {proximaEscala.hora && (
                      <div className="px-3 py-1 bg-blue-100 rounded-lg text-xs font-bold text-blue-700">
                        {proximaEscala.hora}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Statistics */}
            <div className="colaborador-stats grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest flex items-center gap-1.5">
                  <Bus className="w-3.5 h-3.5" /> Total de Utilizações
                </p>
                <p className="mt-3 text-2xl font-black text-slate-900">{stats.totalUtilizacoes}</p>
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Este Mês
                </p>
                <p className="mt-3 text-2xl font-black text-slate-900">{stats.utilizacoesMesAtual}</p>
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Dias Ativos
                </p>
                <p className="mt-3 text-2xl font-black text-slate-900">{stats.diasAtivosMesAtual}</p>
              </div>
            </div>

            {/* Exit Button */}
            <button
              onClick={() => registarPonto('saida')}
              disabled={isLoading || !isCheckedIn}
              className={`w-full relative overflow-hidden group rounded-2xl p-4 border-2 transition-all active:scale-[0.98] ${
                !isCheckedIn
                  ? 'bg-slate-100 border-slate-200 opacity-50'
                  : 'bg-gradient-to-br from-orange-500 to-red-600 border-red-400/50 shadow-lg shadow-red-200/40'
              }`}
            >
              <div className="flex flex-col items-center gap-3 relative z-10">
                <div className={`p-3 rounded-full ${!isCheckedIn ? 'bg-slate-200 text-slate-500' : 'bg-white/20 text-white'}`}>
                  <Hand className="w-5 h-5" />
                </div>
                <span className={`font-bold text-sm ${!isCheckedIn ? 'text-slate-500' : 'text-white'}`}>
                  Sair do Transporte
                </span>
              </div>
            </button>

            {/* Recent History */}
            <div className="bg-slate-50/50 rounded-[14px] border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Histórico Recente
                </h3>
                <button
                  onClick={carregarHistorico}
                  disabled={isFetchingHistory}
                  className={`text-slate-500 hover:text-slate-900 transition-colors ${isFetchingHistory ? 'animate-spin' : ''}`}
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {isFetchingHistory ? (
                  <div className="text-center text-slate-500 py-4 text-sm animate-pulse">
                    A carregar...
                  </div>
                ) : presencas.length === 0 ? (
                  <div className="text-center text-slate-500 py-4 text-sm">
                    Ainda não tem registos.
                  </div>
                ) : (
                  presencas.slice(0, 5).map((p) => {
                    const date = new Date(p.data_hora);
                    const isEntrada = p.tipo === 'entrada';
                    return (
                      <div key={p.id} className="flex justify-between items-center px-3 h-14 bg-white rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            isEntrada
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {isEntrada ? <MapPin className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />}
                          </div>
                          <p className="text-sm font-bold text-slate-900">
                            {isEntrada ? 'Entrada' : 'Saída'}
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-slate-600">
                          {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'qr' ? (
          <div className="space-y-5 text-center">
            {/* Header */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Passe Digital</p>
              <h1 className="text-2xl font-black text-slate-900 mt-1">
                {qrAccess.allowed ? 'Transporte' : 'Passe Indisponível'}
              </h1>
            </div>

            {qrAccess.allowed ? (
              <div className="space-y-4">
                {activeRequest ? (() => {
                  const expiresAt = new Date(activeRequest.expires_at);
                  const msLeft = expiresAt.getTime() - Date.now();
                  const isExpiringSoon = msLeft > 0 && msLeft < 2 * 60 * 1000; // < 2 min
                  const isExpired = msLeft <= 0;
                  const glowClass = isExpired ? 'qr-disabled' : isExpiringSoon ? 'qr-warning' : 'qr-active';

                  return (
                    <div className="qr-card mx-auto max-w-xs">
                      {activeRequest.metodo === 'qr' ? (
                        <>
                          {/* Badge */}
                          <div className="flex justify-center mb-4">
                            {isExpired ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Expirado
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-xs font-bold text-orange-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                                Expira em breve
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Válido agora
                              </span>
                            )}
                          </div>

                          {/* QR container with glow */}
                          <div className={`mx-auto w-fit bg-white p-4 rounded-[20px] border border-slate-100 ${glowClass}`}>
                            <QRCodeSVG
                              value={`SMARTFLEET_CHECKIN:${activeRequest.token}`}
                              size={200}
                              level="M"
                              includeMargin
                            />
                          </div>

                          {/* Token + expiry */}
                          <div className="mt-5 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Código de Embarque</p>
                            <p className="text-2xl font-black font-mono text-slate-900">{activeRequest.token}</p>
                            <p className={`text-xs mt-1.5 font-semibold ${isExpiringSoon ? 'text-orange-500' : 'text-slate-400'}`}>
                              Válido até {expiresAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="py-8">
                          <p className="text-xl font-black text-slate-900">Modo NFC Ativo</p>
                          <p className="text-sm text-slate-600 mt-2">Encoste seu dispositivo ao leitor</p>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  /* No active request — show generate button */
                  <div className="space-y-4">
                    {/* QR disabled placeholder */}
                    <div className="qr-card mx-auto max-w-xs">
                      <div className="flex justify-center mb-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          A aguardar escala
                        </span>
                      </div>
                      <div className="qr-disabled mx-auto w-fit bg-slate-50 p-4 rounded-[20px] border border-slate-100 flex items-center justify-center" style={{ width: 200, height: 200 }}>
                        <QrCode className="w-16 h-16 text-slate-300" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedMetodo('qr')}
                        className={`rounded-xl py-2.5 text-sm font-bold border-2 transition-colors ${selectedMetodo === 'qr' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'}`}
                      >
                        QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMetodo('nfc')}
                        className={`rounded-xl py-2.5 text-sm font-bold border-2 transition-colors ${selectedMetodo === 'nfc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'}`}
                      >
                        NFC
                      </button>
                    </div>

                    <button
                      onClick={() => solicitarEntrada(activeEscala)}
                      disabled={isLoading || !qrAccess.allowed}
                      className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                        isLoading
                          ? 'bg-slate-200 text-slate-500'
                          : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-white shadow-lg shadow-amber-200/50'
                      }`}
                    >
                      <QrCode className="w-5 h-5" />
                      Gerar Passe de Embarque
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-xs text-slate-500 px-4">
                      Mostre este código ao motorista para confirmar o seu embarque.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* QR not allowed */
              <div className="qr-card mx-auto max-w-xs">
                <div className="flex justify-center mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    A aguardar escala
                  </span>
                </div>
                <div className="qr-disabled mx-auto w-fit bg-slate-50 p-4 rounded-[20px] border border-slate-100 flex items-center justify-center" style={{ width: 200, height: 200 }}>
                  <QrCode className="w-16 h-16 text-slate-300" />
                </div>
                <p className="mt-4 text-sm text-slate-600 font-medium">{qrAccess.message}</p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-500">© 2026. ALGARTEMPO FROTA</p>
              <p className="text-xs text-slate-400 mt-0.5">Sistema interno de gestão de transportes</p>
            </div>
          </div>
        ) : activeTab === 'linha' ? (
          <div className="space-y-3 md:space-y-6">
            <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white rounded-[14px] p-4 border border-blue-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center shrink-0">
                  <Bus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">Linha do Transporte</p>
                  <p className="text-xs text-blue-200">Acompanhe o motorista até à sua paragem.</p>
                </div>
              </div>
            </div>
            
            <LinhaTransportes
              colaboradorParagem={colaborador.paragem}
              colaboradorNome={colaborador.nome}
              colaboradorId={colaborador.id}
              escala={proximaEscala}
              compact
            />

            <div className="text-center py-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">© 2026. ALGARTEMPO FROTA</p>
              <p className="text-xs text-slate-600 mt-1">Sistema interno de gestão de transportes</p>
            </div>
          </div>
        ) : null}

          </div>
        </div>

        {/* Footer — safe area for gesture navigation */}
        <div
          className="text-center pt-4 text-xs text-slate-600"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        >
          <p>© 2026. ALGARTEMPO FROTA</p>
          <p>Sistema interno de gestão de transportes</p>
        </div>
      </main>
    </div>
  );
};

export default ColaboradorDashboard;
