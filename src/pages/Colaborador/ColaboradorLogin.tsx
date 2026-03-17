import React, { useState } from 'react';
import { Truck, LogIn, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-[#0f172a] flex flex-col justify-center items-center px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4 mb-4 shadow-xl shadow-blue-900/20 ring-4 ring-slate-800">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter">
            SmartFleet
          </h1>
          <p className="text-blue-500 font-bold uppercase tracking-widest text-xs mt-1">
            Área do Colaborador
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <LogIn className="w-32 h-32 text-white" />
          </div>

          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div>
              <label 
                htmlFor="numeroColaborador" 
                className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2"
              >
                Número de Colaborador
              </label>
              <input
                id="numeroColaborador"
                type="text" // using text to allow formats like 'A123' just in case
                inputMode="numeric"
                pattern="[0-9]*"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-xl px-4 py-4 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-center text-2xl"
                placeholder="Ex. 1234"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !numero}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-4 rounded-xl font-bold tracking-wide transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ColaboradorLogin;
