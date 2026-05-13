import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  BoxesIcon,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  QrCode,
  ShieldCheck,
  UserCog,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_OPTIONS: Array<{ id: 'admin' | 'gestor' | 'supervisor' | 'oficina' | 'motorista'; label: string }> = [
  { id: 'admin', label: 'Administrador' },
  { id: 'gestor', label: 'Gestor' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'motorista', label: 'Motorista' },
];

export default function InventoryLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<'admin' | 'gestor' | 'supervisor' | 'oficina' | 'motorista'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [credential, setCredential] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

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

    const ok = await login(role, identifier, credential);
    setIsSubmitting(false);

    if (!ok) {
      setError('Credenciais inválidas para acesso ao Inventário.');
      return;
    }

    navigate('/inventario/dashboard', { replace: true });
  };

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-[#f8fbfa]"
      style={{ backgroundImage: "url('/Login inventários.png')", backgroundSize: 'auto 100%', backgroundPosition: 'left center', backgroundRepeat: 'no-repeat' }}
    >
      <div className="absolute right-[7%] top-[9%] hidden h-12 w-12 grid-cols-4 gap-1 opacity-60 lg:grid">
        {Array.from({ length: 16 }).map((_, idx) => (
          <span key={idx} className="h-1 w-1 rounded-full bg-emerald-300" />
        ))}
      </div>

      <div className="relative z-10 min-h-[100dvh] w-full">
        <aside className="relative hidden h-[100dvh] w-[50%] overflow-hidden lg:flex lg:flex-col lg:justify-between">

          <div className="relative z-10 flex h-full w-full flex-col justify-between px-10 py-10 xl:px-12 xl:py-12">
            <div>
              <div className="mb-9 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_12px_24px_rgba(16,185,129,0.32)]">
                  <BoxesIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200">Algartempo</p>
                  <p className="text-[40px] font-black leading-none text-white">Inventário</p>
                </div>
              </div>

              <h1 className="max-w-[480px] text-[66px] font-black leading-[0.95] tracking-[-0.03em] text-white">
                Controlo de
                <br />
                <span className="text-emerald-300">Stock & Ativos</span>
              </h1>

              <p className="mt-5 max-w-[430px] text-[18px] leading-relaxed text-emerald-50/90">
                Plataforma empresarial para gestão inteligente de materiais, equipamentos e movimentos de inventário.
              </p>
            </div>

            <div>
              <div className="grid max-w-[520px] grid-cols-3 gap-3.5">
                {[
                  { icon: BoxesIcon, title: 'Gestão de Stock' },
                  { icon: Archive, title: 'Equipamentos' },
                  { icon: ArrowLeftRight, title: 'Movimentos' },
                  { icon: QrCode, title: 'QR Codes' },
                  { icon: BarChart3, title: 'Relatórios' },
                  { icon: ShieldCheck, title: 'Auditoria' },
                ].map(({ icon: Icon, title }) => (
                  <article
                    key={title}
                    className="group rounded-2xl border border-emerald-200/25 bg-white/[0.06] px-3.5 py-3.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-white/[0.1]"
                  >
                    <Icon className="h-4 w-4 text-emerald-200 transition-colors group-hover:text-emerald-100" />
                    <p className="mt-3 text-[13px] font-bold text-white">{title}</p>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-5 text-xs text-emerald-100/90">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Sistema separado da Frota</span>
                </div>
                <div className="h-3 w-px bg-emerald-200/40" />
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Sessões independentes e seguras</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[50%] lg:justify-start lg:px-0 lg:pl-10 xl:pl-12">
          <div className="w-full max-w-[500px] rounded-[32px] border border-slate-200/95 bg-white/96 px-7 py-8 shadow-[0_30px_70px_rgba(2,6,23,0.08)] sm:px-10 sm:py-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[12px] font-black uppercase tracking-[0.13em] text-emerald-700">Acesso Direto</span>
            </div>

            <h2 className="text-[52px] font-black leading-none tracking-[-0.03em] text-slate-900">Bem-vindo</h2>
            <p className="mt-3 text-[20px] text-slate-500">Inicie sessão para aceder ao seu inventário.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">Perfil de acesso</label>
                <div className="relative">
                  <UserCog className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400" />
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as typeof role)}
                    className="h-[50px] w-full appearance-none rounded-xl border border-slate-300 bg-white pl-11 pr-10 text-[16px] font-medium text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">{identifierLabel}</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={role === 'motorista' || role === 'oficina' ? 'tel' : 'email'}
                    value={identifier}
                    autoComplete="username"
                    onChange={(event) => setIdentifier(event.target.value)}
                    required
                    placeholder={role === 'motorista' || role === 'oficina' ? '9XXXXXXXX' : 'utilizador@empresa.pt'}
                    className="h-[50px] w-full rounded-xl border border-slate-300 bg-[#eef5f2] pl-11 pr-4 text-[16px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">{credentialLabel}</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credential}
                    autoComplete="current-password"
                    onChange={(event) => setCredential(event.target.value)}
                    required
                    placeholder={role === 'motorista' || role === 'oficina' ? '••••' : '••••••••'}
                    className="h-[50px] w-full rounded-xl border border-slate-300 bg-[#eef5f2] pl-11 pr-12 text-[16px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(event) => setRememberSession(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-300"
                  />
                  Manter sessão iniciada
                </label>
                <button type="button" className="font-semibold text-emerald-600 transition hover:text-emerald-700">Esqueci a palavra-passe?</button>
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
                className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-[14px] font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(16,185,129,0.32)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(16,185,129,0.40)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'A autenticar...' : 'Iniciar Sessão'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>

            <div className="mt-7 flex items-center gap-3 text-sm text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>ou</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <p className="mt-5 text-center text-[15px] text-slate-500">
              Voltar para{' '}
              <button onClick={() => navigate('/', { replace: true })} className="font-bold text-emerald-600 hover:text-emerald-700">
                seleção de sistemas
              </button>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
