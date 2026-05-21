import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';

const FornecedoresLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulação de login (mock)
    if (email === 'admin@empresa.com' && password === '123456') {
      navigate('/fornecedores');
    } else {
      setError('Credenciais inválidas.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 to-blue-900">
      <div className="w-full max-w-md rounded-2xl bg-blue-950/80 p-8 shadow-2xl border border-blue-800/40 backdrop-blur-xl">
        <h1 className="text-3xl font-bold text-blue-200 mb-6 text-center">Login Fornecedores</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-blue-300 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-3 rounded-lg bg-blue-900/80 border border-blue-700 text-blue-100 focus:outline-none focus:border-blue-400"
                placeholder="email@empresa.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-blue-300 mb-1">Palavra-passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-3 rounded-lg bg-blue-900/80 border border-blue-700 text-blue-100 focus:outline-none focus:border-blue-400"
                placeholder="••••••••"
              />
            </div>
          </div>
          {error && <div className="text-red-400 text-sm text-center">{error}</div>}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-blue-700 to-blue-500 text-white font-bold shadow-lg hover:brightness-110 transition-all"
          >
            Entrar <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default FornecedoresLogin;
