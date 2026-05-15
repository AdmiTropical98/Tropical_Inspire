import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Navigation2,
  BarChart3,
  Users,
  MapPin,
  Truck,
  UserCog,
  ArrowRight,
  Zap,
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronDown,
  Lock,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, KeyRound } from 'lucide-react';

const ROLE_OPTIONS: Array<{ id: 'admin' | 'gestor' | 'supervisor' | 'oficina' | 'motorista'; label: string }> = [
  { id: 'admin', label: 'Administrador' },
  { id: 'gestor', label: 'Gestor' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'motorista', label: 'Motorista' },
];

export default function OperacoesLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<'admin' | 'gestor' | 'supervisor' | 'oficina' | 'motorista'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [credential, setCredential] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('login-active');
    return () => {
      document.documentElement.classList.remove('login-active');
    };
  }, []);

  const identifierLabel = useMemo(() => {
    if (role === 'motorista' || role === 'oficina') return 'Telemóvel';
    return 'Email';
  }, [role]);

  const credentialLabel = useMemo(() => {
    if (role === 'motorista' || role === 'oficina') return 'PIN';
    return 'Palavra-passe';
  }, [role]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const ok = await login(role, identifier, credential, 'operacoes');
    setIsSubmitting(false);

    if (!ok) {
      setError('Credenciais inválidas para acesso às Operações.');
      return;
    }

    navigate('/operacoes/dashboard', { replace: true });
  };

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden"
      style={{ backgroundImage: "url('/loginoperaçao2.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >
      <div className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <img
          src="/LOGO22.png"
          alt="Algartempo"
          className="h-14 w-auto sm:h-16"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.08)_42%,rgba(20,10,2,0.36)_100%)]" />

      <div className="relative z-10 min-h-[100dvh] w-full">
        <main className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%] lg:justify-center lg:px-0">
          <div className="w-full max-w-[430px] rounded-[34px] border border-[#d6a85491] bg-[linear-gradient(180deg,rgba(40,26,10,0.78)_0%,rgba(34,20,6,0.66)_100%)] px-7 py-8 shadow-[0_20px_48px_rgba(0,0,0,0.45)] backdrop-blur-[8px] sm:px-9 sm:py-9">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d6a8544f] bg-orange-400/10 px-4 py-1.5">
              <Lock className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[12px] font-black uppercase tracking-[0.13em] text-orange-400">Acesso Direto</span>
            </div>

            <h2 className="text-[56px] font-black leading-[0.9] tracking-[-0.03em] text-white">Bem-<span className="text-orange-400">vindo</span></h2>
            <p className="mt-2 text-[48px] leading-[0.95] tracking-[-0.03em] text-white">às Operações</p>
            <p className="mt-3 text-[20px] text-slate-300">Inicie sessão para aceder às suas operações.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-300">Perfil de acesso</label>
                <div className="relative">
                  <UserCog className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400" />
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as typeof role)}
                    className="h-[56px] w-full appearance-none rounded-[12px] border border-[#d6a85488] bg-[#1a0f0566] pl-11 pr-10 text-[16px] font-semibold text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30"
                  >
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-300">{identifierLabel}</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={role === 'motorista' || role === 'oficina' ? 'tel' : 'email'}
                    value={identifier}
                    autoComplete="username"
                    onChange={(event) => setIdentifier(event.target.value)}
                    required
                    placeholder={role === 'motorista' || role === 'oficina' ? '9XXXXXXXX' : 'utilizador@empresa.pt'}
                    className="h-[56px] w-full rounded-[12px] border border-[#d6a85488] bg-[#1a0f0566] pl-11 pr-4 text-[17px] text-white outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-300">{credentialLabel}</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credential}
                    autoComplete="current-password"
                    onChange={(event) => setCredential(event.target.value)}
                    required
                    placeholder={role === 'motorista' || role === 'oficina' ? '••••' : '••••••••'}
                    className="h-[56px] w-full rounded-[12px] border border-[#d6a85488] bg-[#1a0f0566] pl-11 pr-12 text-[17px] text-white outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200"
                    aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(event) => setRememberSession(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
                  />
                  Guardar sessão
                </label>
                <button type="button" className="font-semibold text-orange-400 transition hover:text-orange-300">Esqueci a palavra-passe</button>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex h-[56px] w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400 text-[16px] font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(249,115,22,0.35)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(249,115,22,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'A autenticar...' : 'Entrar em Operações'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>

            <div className="mt-7 flex items-center gap-3 text-sm text-slate-400">
              <div className="h-px flex-1 bg-slate-700" />
              <span>ou</span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>

            <p className="mt-5 text-center text-[15px] text-slate-300">
              Voltar para{' '}
              <button onClick={() => navigate('/', { replace: true })} className="font-bold text-orange-400 hover:text-orange-300">
                seleção de sistemas
              </button>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
