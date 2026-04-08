import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Edit3, IdCard, Plus, RefreshCcw, Search, Trash2, UserRound, XCircle } from 'lucide-react';
import { ColaboradorService } from '../../services/colaboradorService';
import type { Colaborador } from '../../services/colaboradorService';
import { useAuth } from '../../contexts/AuthContext';

interface ColaboradorForm {
  id?: string;
  numero: string;
  nome: string;
  paragem: string;
  status: 'active' | 'inactive';
}

const EMPTY_FORM: ColaboradorForm = {
  numero: '',
  nome: '',
  paragem: '',
  status: 'active',
};

export default function ColaboradoresPage() {
  const { currentUser } = useAuth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formData, setFormData] = useState<ColaboradorForm>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [isConfirmingToken, setIsConfirmingToken] = useState(false);

  const carregar = async () => {
    setIsLoading(true);
    const lista = await ColaboradorService.listarTodosIncluindoInativos();
    setColaboradores(lista);
    setIsLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
  };

  const colaboradoresFiltrados = useMemo(() => {
    return colaboradores.filter((c) => {
      const status = c.status || 'active';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const term = searchTerm.toLowerCase();
      const nome = String(c.nome || '').toLowerCase();
      const numero = String(c.numero || '').toLowerCase();
      const matchesSearch =
        nome.includes(term) ||
        numero.includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [colaboradores, searchTerm, statusFilter]);

  const totalAtivos = useMemo(
    () => colaboradores.filter((c) => (c.status || 'active') === 'active').length,
    [colaboradores]
  );

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!formData.numero.trim() || !formData.nome.trim()) {
      setFeedback({ type: 'error', message: 'Preencha número e nome.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    if (formData.id) {
      const result = await ColaboradorService.atualizarColaborador(formData.id, {
        numero: formData.numero,
        nome: formData.nome,
        paragem: formData.paragem || undefined,
        status: formData.status,
      });

      if (!result.success) {
        setFeedback({ type: 'error', message: result.error || 'Erro ao atualizar colaborador.' });
        setIsSaving(false);
        return;
      }

      setFeedback({ type: 'success', message: 'Colaborador atualizado com sucesso.' });
    } else {
      const result = await ColaboradorService.criarColaborador({
        numero: formData.numero,
        nome: formData.nome,
        paragem: formData.paragem || undefined,
      });

      if (!result.success) {
        setFeedback({ type: 'error', message: result.error || 'Erro ao criar colaborador.' });
        setIsSaving(false);
        return;
      }

      setFeedback({ type: 'success', message: 'Colaborador criado com sucesso.' });
    }

    await carregar();
    resetForm();
    setIsSaving(false);
  };

  const handleEditar = (colaborador: Colaborador) => {
    setFormData({
      id: colaborador.id,
      numero: String(colaborador.numero || ''),
      nome: String(colaborador.nome || ''),
      paragem: String(colaborador.paragem || ''),
      status: colaborador.status || 'active',
    });
  };

  const handleConfirmarToken = async () => {
    if (!tokenInput.trim() || isConfirmingToken) return;

    setIsConfirmingToken(true);
    const result = await ColaboradorService.confirmarEntradaPorToken(
      tokenInput.trim(),
      currentUser?.nome || currentUser?.email || 'Motorista'
    );
    setIsConfirmingToken(false);

    if (!result.success) {
      setFeedback({ type: 'error', message: result.error || 'Nao foi possivel confirmar o token.' });
      return;
    }

    setTokenInput('');
    setFeedback({ type: 'success', message: 'Entrada confirmada com sucesso pelo motorista.' });
    await carregar();
  };

  const handleDesativar = async (colaborador: Colaborador) => {
    const confirmar = window.confirm(`Desativar colaborador ${colaborador.nome} (nº ${colaborador.numero})?`);
    if (!confirmar) return;

    const result = await ColaboradorService.desativarColaborador(colaborador.id);
    if (!result.success) {
      setFeedback({ type: 'error', message: result.error || 'Erro ao desativar colaborador.' });
      return;
    }

    setFeedback({ type: 'success', message: 'Colaborador desativado.' });
    await carregar();
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Colaboradores Ativos</p>
          <p className="text-3xl font-black text-white mt-2">{totalAtivos}</p>
        </div>
        <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Total Registados</p>
          <p className="text-3xl font-black text-white mt-2">{colaboradores.length}</p>
        </div>
        <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-4">
          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Inativos</p>
          <p className="text-3xl font-black text-white mt-2">{Math.max(colaboradores.length - totalAtivos, 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <IdCard className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-black text-lg tracking-tight">
              {formData.id ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h2>
          </div>

          <form onSubmit={handleSalvar} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Número de colaborador</label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => setFormData((prev) => ({ ...prev, numero: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 4507"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Nome</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome completo"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Paragem</label>
              <input
                type="text"
                value={formData.paragem}
                onChange={(e) => setFormData((prev) => ({ ...prev, paragem: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Rotunda EN125 - Quarteira"
              />
              <p className="text-[11px] text-slate-500 mt-1">Campo opcional.</p>
            </div>

            {formData.id && (
              <div>
                <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Estado</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl py-2.5 font-bold transition-colors"
              >
                {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {formData.id ? 'Guardar' : 'Criar Número'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              >
                Limpar
              </button>
            </div>
          </form>

          {feedback && (
            <div className={`mt-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Confirmar entrada por QR/NFC</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Token de 6 digitos"
              />
              <button
                type="button"
                disabled={!tokenInput.trim() || isConfirmingToken}
                onClick={handleConfirmarToken}
                className="px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold"
              >
                {isConfirmingToken ? 'A confirmar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between mb-4">
            <h2 className="text-white font-black text-lg tracking-tight">Colaboradores de Transporte</h2>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar nome ou número"
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>

              <button
                onClick={carregar}
                className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg px-3 py-2 text-sm"
              >
                <RefreshCcw className="w-4 h-4" />
                Atualizar
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800">
            <table className="w-full text-left" style={{ minWidth: '620px' }}>
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Paragem</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">A carregar colaboradores...</td>
                  </tr>
                ) : colaboradoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">Sem resultados para os filtros aplicados.</td>
                  </tr>
                ) : (
                  colaboradoresFiltrados.map((colaborador) => {
                    const status = colaborador.status || 'active';

                    return (
                      <tr key={colaborador.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
                              <UserRound className="w-4 h-4" />
                            </div>
                            <span className="text-white font-medium">{colaborador.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-blue-300">{String(colaborador.numero || '-')}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {colaborador.paragem || 'Sem paragem definida'}
                        </td>
                        <td className="px-4 py-3">
                          {status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold uppercase">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 text-xs font-bold uppercase">
                              <XCircle className="w-3.5 h-3.5" /> Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditar(colaborador)}
                              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {status === 'active' && (
                              <button
                                onClick={() => handleDesativar(colaborador)}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                                title="Desativar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
