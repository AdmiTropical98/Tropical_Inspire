import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  HandshakeIcon,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_OPTIONS: Array<{ id: 'admin' | 'gestor'; label: string }> = [
  { id: 'admin', label: 'Administrador' },
  { id: 'gestor', label: 'Gestor' },
];

export default function FornecedoresLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<'admin' | 'gestor'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [credential, setCredential] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('login-active');
    return () => {
      document.documentElement.classList.remove('login-active');
    };
  }, []);

  const identifierLabel = useMemo(() => {
    if (role === 'gestor') return 'Email ou Telemóvel';
    return 'Email';
  }, [role]);

  const credentialLabel = useMemo(() => {
    if (role === 'gestor') return 'PIN ou Palavra-passe';
    return 'Palavra-passe';
  }, [role]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const ok = await login(role, identifier, credential, 'inventario');
    setIsSubmitting(false);

    if (!ok) {
      setError('Credenciais inválidas. Verifique os dados e tente novamente.');
      return;
    }

    navigate('/fornecedores-erp/dashboard', { replace: true });
  };

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden"
      style={{
        backgroundImage: "url('Fornecedores.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Purple overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(50,0,90,0.55) 0%, rgba(10,2,25,0.4) 40%, rgba(5,1,18,0.75) 100%)',
        }}
      />

      {/* Logo top-left */}
      <div className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <img src="LOGO22.png" alt="Algartempo" className="h-14 w-auto sm:h-16" />
      </div>

      {/* Module badge top-right */}
      <div className="absolute right-6 top-6 z-20 sm:right-8 sm:top-8">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{
            background: 'rgba(124,58,237,0.18)',
            border: '1px solid rgba(139,92,246,0.35)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#c084fc' }} />
          <span
            className="text-[11px] font-black uppercase tracking-[0.16em]"
            style={{ color: '#c084fc' }}
          >
            Enterprise ERP
          </span>
        </div>
      </div>

      {/* Glow top-right subtle */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-[360px] w-[360px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Login card — right side */}
      <div className="relative z-10 min-h-[100dvh] w-full">
        <main className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%] lg:justify-center lg:px-0">
          <div
            className="w-full max-w-[430px] px-7 py-8 sm:px-9 sm:py-9"
            style={{
              borderRadius: '28px',
              background:
                'linear-gradient(180deg, rgba(18,5,45,0.88) 0%, rgba(10,2,28,0.78) 100%)',
              border: '1px solid rgba(139,92,246,0.25)',
              backdropFilter: 'blur(16px)',
              boxShadow:
                '0 0 60px rgba(124,58,237,0.18), 0 20px 48px rgba(0,0,0,0.55)',
            }}
          >
            {/* Module icon + badge */}
            <div className="mb-6 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[12px]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  boxShadow: '0 0 20px rgba(124,58,237,0.6)',
                }}
              >
                <HandshakeIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">
                  Módulo Independente
                </p>
                <p className="text-[13px] font-bold text-white">Fornecedores ERP</p>
              </div>
            </div>

            <h2
              className="text-[48px] font-black leading-[0.9] tracking-[-0.03em] text-white"
            >
              Bem-<span style={{ color: '#c084fc' }}>vindo</span>
            </h2>
            <p
              className="mt-1 text-[42px] leading-[0.95] tracking-[-0.03em]"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              ao portal de
            </p>
            <p
              className="text-[42px] font-black leading-[0.95] tracking-[-0.03em]"
              style={{
                background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Fornecedores
            </p>
            <p className="mt-3 text-[15px]" style={{ color: '#94a3b8' }}>
              Gestão enterprise de parceiros e fornecedores da empresa.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* Role */}
              <div>
                <label
                  className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]"
                  style={{ color: '#94a3b8' }}
                >
                  Perfil de acesso
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2"
                    style={{ color: '#7c3aed' }}
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as typeof role)}
                    className="h-[52px] w-full appearance-none rounded-[12px] pl-11 pr-10 text-[15px] font-semibold text-white outline-none transition"
                    style={{
                      background: 'rgba(20,5,50,0.8)',
                      border: '1px solid rgba(139,92,246,0.3)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168,85,247,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[#120530]">
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: '#94a3b8' }}
                  />
                </div>
              </div>

              {/* Identifier */}
              <div>
                <label
                  className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]"
                  style={{ color: '#94a3b8' }}
                >
                  {identifierLabel}
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2"
                    style={{ color: '#7c3aed' }}
                  />
                  <input
                    type={role === 'gestor' ? 'text' : 'email'}
                    value={identifier}
                    autoComplete="username"
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={role === 'gestor' ? 'email@empresa.com ou telemóvel' : 'email@empresa.com'}
                    required
                    className="h-[52px] w-full rounded-[12px] pl-11 pr-4 text-[15px] text-white outline-none placeholder:text-slate-600"
                    style={{
                      background: 'rgba(20,5,50,0.8)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168,85,247,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Credential */}
              <div>
                <label
                  className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]"
                  style={{ color: '#94a3b8' }}
                >
                  {credentialLabel}
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2"
                    style={{ color: '#7c3aed' }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credential}
                    autoComplete="current-password"
                    onChange={(e) => setCredential(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-[52px] w-full rounded-[12px] pl-11 pr-12 text-[15px] text-white outline-none placeholder:text-slate-600"
                    style={{
                      background: 'rgba(20,5,50,0.8)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168,85,247,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-purple-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="rounded-[10px] px-4 py-3 text-[13px] font-semibold"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] text-[15px] font-black text-white transition disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  boxShadow: isSubmitting
                    ? 'none'
                    : '0 0 28px rgba(124,58,237,0.5), 0 4px 12px rgba(0,0,0,0.3)',
                  transform: isSubmitting ? 'none' : undefined,
                }}
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  <>
                    Aceder ao sistema
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Footer note */}
            <p className="mt-6 text-center text-[11px]" style={{ color: '#475569' }}>
              Módulo Enterprise • Gestão de Fornecedores
            </p>
          </div>
        </main>
      </div>

      {/* Bottom left — features list */}
      <div className="absolute bottom-8 left-8 z-20 hidden lg:block">
        <p
          className="mb-3 text-[10px] font-black uppercase tracking-[0.18em]"
          style={{ color: 'rgba(192,132,252,0.7)' }}
        >
          Funcionalidades incluídas
        </p>
        <ul className="space-y-1.5">
          {[
            'Cadastro e avaliação de fornecedores',
            'Contratos e documentos digitais',
            'Histórico de pagamentos',
            'Requisições e aprovações',
            'Desempenho e indicadores',
            'Relatórios e analytics',
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: '#a855f7', boxShadow: '0 0 6px #a855f7' }}
              />
              <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {f}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
