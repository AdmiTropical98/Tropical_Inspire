import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation2, BarChart3, Users, MapPin, Truck, UserCog, ArrowRight, Zap, ShieldCheck } from 'lucide-react';
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
    <div className="relative flex min-h-[100dvh] overflow-hidden bg-slate-50">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-orange-50" />
      <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="absolute -right-20 bottom-6 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
      <div className="absolute left-[8%] top-[22%] hidden h-24 w-24 rounded-full border border-amber-200/80 bg-white/30 lg:block" />
      <div className="absolute right-[12%] top-[15%] hidden h-16 w-16 rounded-full border border-orange-200/80 bg-white/30 lg:block" />
      <div className="absolute right-[18%] bottom-[20%] hidden h-20 w-20 rounded-full border border-amber-200/80 bg-white/25 lg:block" />

      <div className="relative z-10 flex min-h-[100dvh] w-full">
      {/* Left: Hero & Features Panel */}
      <aside className="hidden lg:flex lg:w-[500px] xl:w-[560px] shrink-0 flex-col bg-gradient-to-br from-slate-900 via-amber-900 to-slate-900 text-white relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 opacity-60">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-slate-900/20 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl">
                <Navigation2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">Algartempo</p>
                <p className="text-xl font-black tracking-tight leading-none text-white">Operações</p>
              </div>
            </div>

            <h1 className="text-5xl xl:text-6xl font-black tracking-[-0.02em] leading-[1.05] text-white mb-4">
              Gestão de
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-amber-300 bg-clip-text text-transparent">Operações Logísticas</span>
            </h1>
            <p className="text-base leading-relaxed text-slate-300 max-w-sm">
              Plataforma empresarial para roteirização, transporte, geofences e gestão de colaboradores.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="flex-1 grid grid-cols-2 gap-3 mb-auto">
            {[
              { icon: Navigation2, label: 'Roteirização', color: 'from-blue-400 to-cyan-400' },
              { icon: Truck, label: 'Linha Transportes', color: 'from-purple-400 to-pink-400' },
              { icon: MapPin, label: 'Cercas Geográficas', color: 'from-blue-400 to-teal-400' },
              { icon: Users, label: 'Colaboradores', color: 'from-amber-400 to-orange-400' },
              { icon: BarChart3, label: 'Relatórios', color: 'from-rose-400 to-red-400' },
              { icon: ShieldCheck, label: 'Monitorização', color: 'from-indigo-400 to-blue-400' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl px-4 py-4 hover:border-white/30 hover:bg-white/20 transition-all duration-300 cursor-default">
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <div className="relative z-10 flex flex-col items-start gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${color}`} />
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-300 group-hover:text-white transition-colors" />
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer info */}
          <div className="space-y-3 border-t border-white/10 pt-6">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Sistema separado da Frota</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
              <span>Sessões independentes e seguras</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Right: Login Form */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        {/* Mobile header */}
        <div className="flex items-center gap-3 mb-12 lg:hidden">
          <div className="h-10 w-10 rounded-xl bg-amber-600 flex items-center justify-center">
            <Navigation2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Algartempo</p>
            <p className="text-lg font-black tracking-tight text-slate-900">Operações</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 mb-4">
              <Navigation2 className="h-3 w-3 text-amber-600" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Acesso direto</span>
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">Bem-vindo</h2>
            <p className="mt-2 text-sm text-slate-500">Inicie sessão para acceder às suas operações.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role picker */}
            <div className="group">
              <label className="mb-2.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-600">Perfil de acesso</label>
              <div className="relative">
                <UserCog className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as typeof role)}
                  className="h-11 w-full appearance-none rounded-xl border-2 border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 hover:border-slate-300"
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Identifier */}
            <div className="group">
              <label className="mb-2.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-600">{identifierLabel}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                <input
                  type={role === 'motorista' || role === 'oficina' ? 'tel' : 'email'}
                  value={identifier}
                  autoComplete="username"
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  placeholder={role === 'motorista' || role === 'oficina' ? '9XXXXXXXX' : 'utilizador@empresa.pt'}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 hover:border-slate-300"
                />
              </div>
            </div>

            {/* Credential */}
            <div className="group">
              <label className="mb-2.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-600">{credentialLabel}</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-600 transition-colors" />
                <input
                  type="password"
                  value={credential}
                  autoComplete="current-password"
                  onChange={(event) => setCredential(event.target.value)}
                  required
                  placeholder={role === 'motorista' || role === 'oficina' ? '••••' : '••••••••'}
                  className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 hover:border-slate-300"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border-l-4 border-rose-500 border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative h-11 w-full flex items-center justify-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-amber-600 to-orange-500 font-bold text-white shadow-lg shadow-amber-600/40 transition hover:shadow-xl hover:shadow-amber-600/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Entrar em Operações</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-slate-300" />
            <span>Ou</span>
            <div className="h-px flex-1 bg-slate-300" />
          </div>

          {/* Link to main login */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">Voltou a entrar? <button onClick={() => navigate('/', { replace: true })} className="font-bold text-amber-600 hover:text-amber-700 transition">Voltar ao menu</button></p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/operacoes/colaborador', { replace: true })}
            className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 hover:border-amber-300"
          >
            Sou colaborador • Aceder a Operacoes
          </button>
        </div>
      </main>
      </div>
    </div>
  );
}
