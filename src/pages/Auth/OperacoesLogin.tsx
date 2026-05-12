import { useMemo, useState } from 'react';
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
      setError('Credenciais inválidas para acesso às Operações.');
      return;
    }

    navigate('/operacoes/dashboard', { replace: true });
  };

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-[#f6f5f4]"
      style={{ backgroundImage: "url('/Login operacoes.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >
      <div className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-[1400px] grid-cols-1 px-6 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 xl:px-14">
        <aside className="hidden lg:flex lg:flex-col lg:justify-between lg:pr-10 xl:pr-14">
          <div>
            <div className="mb-9 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-900/50">
                <Navigation2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">Algartempo</p>
                <p className="text-[42px] font-black leading-none text-white">Operações</p>
              </div>
            </div>

            <h1 className="max-w-[490px] text-[66px] font-black leading-[0.98] tracking-[-0.03em] text-white">
              Gestão de
              <br />
              <span className="text-amber-300">Operações</span>
              <br />
              <span className="text-amber-300">Logísticas</span>
            </h1>

            <p className="mt-5 max-w-[430px] text-[20px] leading-relaxed text-slate-200">
              Plataforma empresarial para roteirização, transporte, geofences e gestão de colaboradores.
            </p>
          </div>

          <div>
            <div className="grid max-w-[470px] grid-cols-3 gap-3.5">
              {[
                { icon: Navigation2, title: 'Roteirização', subtitle: 'Rotas otimizadas' },
                { icon: Truck, title: 'Linha Transportes', subtitle: 'Gestão de frotas' },
                { icon: MapPin, title: 'Cercas Geográficas', subtitle: 'Geofences' },
                { icon: Users, title: 'Colaboradores', subtitle: 'Gestão de equipas' },
                { icon: BarChart3, title: 'Relatórios', subtitle: 'Insights e KPIs' },
                { icon: ShieldCheck, title: 'Monitorização', subtitle: 'Acompanhamento' },
              ].map(({ icon: Icon, title, subtitle }) => (
                <article key={title} className="rounded-2xl border border-amber-400/35 bg-slate-900/55 px-3.5 py-3.5 backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-amber-300" />
                  <p className="mt-3 text-sm font-bold text-white">{title}</p>
                  <p className="mt-1 text-xs text-slate-300">{subtitle}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-5 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                <span>Sistema separado da Frota</span>
              </div>
              <div className="h-3 w-px bg-slate-400/50" />
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
                <span>Sessões independentes e seguras</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-[560px] rounded-[28px] border border-slate-200/90 bg-white/95 px-7 py-7 shadow-[0_24px_52px_rgba(15,23,42,0.08)] sm:px-10 sm:py-9">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-orange-50 px-4 py-1.5">
              <Lock className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-600">Acesso Direto</span>
            </div>

            <h2 className="text-5xl font-black tracking-[-0.03em] text-slate-900">Bem-vindo!</h2>
            <p className="mt-2 text-lg text-slate-500">Inicie sessão para aceder às suas operações.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="group">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Perfil de acesso</label>
                <div className="relative">
                  <UserCog className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as typeof role)}
                    className="h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-base font-medium text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200/60"
                  >
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="group">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{identifierLabel}</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={role === 'motorista' || role === 'oficina' ? 'tel' : 'email'}
                    value={identifier}
                    autoComplete="username"
                    onChange={(event) => setIdentifier(event.target.value)}
                    required
                    placeholder={role === 'motorista' || role === 'oficina' ? '9XXXXXXXX' : 'utilizador@empresa.pt'}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-slate-100 pl-10 pr-4 text-base text-slate-700 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-200/60"
                  />
                </div>
              </div>

              <div className="group">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{credentialLabel}</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credential}
                    autoComplete="current-password"
                    onChange={(event) => setCredential(event.target.value)}
                    required
                    placeholder={role === 'motorista' || role === 'oficina' ? '••••' : '••••••••'}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-slate-100 pl-10 pr-12 text-base text-slate-700 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-200/60"
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

              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(event) => setRememberSession(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
                  />
                  Guardar sessão
                </label>
                <button type="button" className="font-semibold text-orange-500 transition hover:text-orange-600">Esqueci a palavra-passe</button>
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
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-base font-bold text-white shadow-[0_14px_28px_rgba(249,115,22,0.34)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Entrar em Operações
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>ou</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <p className="mt-5 text-center text-base text-slate-500">
              Voltou a entrar?{' '}
              <button onClick={() => navigate('/', { replace: true })} className="font-bold text-orange-500 hover:text-orange-600">
                Voltar ao menu
              </button>
            </p>

            <button
              type="button"
              onClick={() => navigate('/operacoes/colaborador', { replace: true })}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 text-base font-semibold text-orange-700 transition hover:bg-orange-100"
            >
              <User className="h-4 w-4" />
              Sou colaborador · Aceder a Operações
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
