import { useState, useEffect } from 'react';
import ColaboradorLogin from './ColaboradorLogin';
import ColaboradorDashboard from './ColaboradorDashboard';
import type { Colaborador } from '../../services/colaboradorService';

const COLABORADOR_STORAGE_KEY = 'smartfleet_colaborador_session';

export default function ColaboradorApp() {
  const [session, setSession] = useState<Colaborador | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check valid session on mount
  useEffect(() => {
    const stored = localStorage.getItem(COLABORADOR_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.numero) {
          setSession(parsed);
        }
      } catch (e) {
        localStorage.removeItem(COLABORADOR_STORAGE_KEY);
      }
    }
    setIsInitializing(false);
  }, []);

  const handleLogin = (colaborador: Colaborador) => {
    localStorage.setItem(COLABORADOR_STORAGE_KEY, JSON.stringify(colaborador));
    setSession(colaborador);
  };

  const handleLogout = () => {
    localStorage.removeItem(COLABORADOR_STORAGE_KEY);
    setSession(null);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#f7fafd] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // If no active session, show the login view
  if (!session) {
    return <ColaboradorLogin onLogin={handleLogin} />;
  }

  // If active session, show the dashboard
  return <ColaboradorDashboard colaborador={session} onLogout={handleLogout} />;
}
