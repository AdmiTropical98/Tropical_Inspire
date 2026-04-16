import React, { useState } from 'react';
import { ArrowRight, Briefcase, MapPin } from 'lucide-react';
import { ColaboradorService } from '../../services/colaboradorService';
import type { Colaborador } from '../../services/colaboradorService';

interface ColaboradorLoginProps {
  onLogin: (colaborador: Colaborador) => void;
}

const ColaboradorLogin: React.FC<ColaboradorLoginProps> = ({ onLogin }) => {
  const [numero, setNumero] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) {
      setError('Por favor introduza o seu número.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const colaborador = await ColaboradorService.loginPorNumero(numero.trim());
      
      if (colaborador) {
        onLogin(colaborador);
      } else {
        setError('Colaborador não encontrado ou inativo.');
      }
    } catch (err) {
      setError('Ocorreu um erro ao validar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-[#f7fafd] login-scrollbar">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(147,197,253,0.24),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(191,219,254,0.34),_transparent_30%),linear-gradient(135deg,_#edf4ff_0%,_#fafcff_55%,_#edf4ff_100%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-28" style={{ backgroundImage: 'url(/grid-pattern.svg)', backgroundRepeat: 'no-repeat', backgroundPosition: 'center 6%', backgroundSize: '40rem auto' }} />
      <div className="absolute left-[-8%] top-[18%] h-px w-[52%] rotate-[-16deg] bg-gradient-to-r from-transparent via-blue-200/80 to-transparent opacity-70" />
      <div className="absolute left-[2%] top-[38%] h-px w-[46%] rotate-[8deg] bg-gradient-to-r from-transparent via-blue-100/90 to-transparent opacity-80" />
      <div className="absolute right-[4%] top-[28%] hidden h-px w-[24%] rotate-[28deg] bg-gradient-to-r from-transparent via-slate-200/80 to-transparent opacity-60 lg:block" />
      <div className="absolute inset-x-[-10%] bottom-[-2%] h-[28vh] opacity-90" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(219,234,254,0.18) 35%, rgba(191,219,254,0.32) 100%)', clipPath: 'ellipse(72% 58% at 50% 100%)' }} />
      <div className="absolute inset-x-[-6%] bottom-[-7%] h-[24vh] opacity-90" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 100%)', clipPath: 'ellipse(68% 54% at 50% 100%)' }} />

      <div className="absolute left-[7%] top-[24%] hidden h-24 w-24 rounded-full border border-blue-100/80 bg-white/20 lg:block">
        <MapPin className="absolute inset-0 m-auto h-8 w-8 text-blue-100" />
      </div>
      <div className="absolute right-[7%] top-[14%] hidden h-16 w-16 rounded-full border border-slate-200/70 bg-white/20 lg:block">
        <MapPin className="absolute inset-0 m-auto h-5 w-5 text-slate-200" />
      </div>
      <div className="absolute right-[9%] top-[42%] hidden h-20 w-20 rounded-full border border-blue-100/70 bg-white/10 lg:block">
        <MapPin className="absolute inset-0 m-auto h-7 w-7 text-blue-100" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1440px] items-start px-4 py-5 sm:px-6 sm:py-8 lg:items-center lg:px-16 xl:px-20">
        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.72fr] xl:gap-16">
          <section className="relative flex min-h-[150px] items-center justify-center sm:min-h-[220px] lg:min-h-[720px] lg:justify-start">
            <div className="relative flex w-full items-center justify-center lg:justify-center">
              <img src="/LOGO.png" alt="Algartempo Frota" className="w-full max-w-[360px] object-contain drop-shadow-[0_20px_40px_rgba(37,99,235,0.08)] sm:max-w-[430px] lg:max-w-[520px]" />
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-end">
            <div className="colaborador-login-card w-full max-w-[424px] rounded-[1.9rem] border border-white/85 bg-white/94 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-9">
              <div className="mb-4 flex items-center gap-3 sm:hidden">
                <div className="rounded-2xl bg-slate-50 px-3 py-2 shadow-sm border border-slate-200">
                  <img src="/LOGO.png" alt="Algartempo Frota" className="h-8 w-auto" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Transporte interno</p>
                  <p className="text-sm font-semibold text-slate-700">Acesso do colaborador</p>
                </div>
              </div>
              <div className="mb-6">
                <h1 className="text-[2rem] font-extrabold tracking-[-0.04em] text-[#1f2957] sm:text-[2.2rem]">Área do Colaborador</h1>
                <p className="mt-2 text-[1.02rem] text-slate-500">Introduza o seu número para continuar.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="numeroColaborador" className="sr-only">
                    Número de colaborador
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                    <input
                      id="numeroColaborador"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      autoFocus
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-700 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all placeholder:text-slate-400 focus:border-[#d8ab42] focus:ring-4 focus:ring-amber-100"
                      placeholder="Número de colaborador"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !numero}
                  className="mt-2 flex h-[3.55rem] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#d59d31_0%,#e8b547_40%,#ffcc58_100%)] px-6 text-[1.08rem] font-extrabold text-white shadow-[0_10px_20px_rgba(201,163,78,0.34)] transition-all hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.location.href = '/'}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
                >
                  Voltar ao login principal
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ColaboradorLogin;
