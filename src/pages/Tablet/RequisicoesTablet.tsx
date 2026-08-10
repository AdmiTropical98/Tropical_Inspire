import React, { useState } from 'react';
import { useWorkshop } from '../../../contexts/WorkshopContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Check, X, ClipboardCheck, Package } from 'lucide-react';
import type { ItemRequisicao, Requisicao } from '../../../types';

export default function RequisicoesTablet() {
    const { requisicoes, addRequisicao, viaturas, fornecedores, clientes, centrosCustos } = useWorkshop();
    const { currentUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form, setForm] = useState({
        tipo: 'Oficina' as Requisicao['tipo'],
        clienteId: '',
        fornecedorId: '',
        centroCustoId: '',
        obs: ''
    });

    const [itemNome, setItemNome] = useState('');
    const [quantidade, setQuantidade] = useState('1');
    const [valor, setValor] = useState('');
    const [items, setItems] = useState<ItemRequisicao[]>([]);

    const recentRequisicoes = [...requisicoes]
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        .slice(0, 15);

    const handleAddItem = () => {
        if (!itemNome || !quantidade) return;
        setItems([
            ...items,
            {
                id: crypto.randomUUID(),
                descricao: itemNome,
                quantidade: Number(quantidade),
                valor_unitario: valor ? Number(valor) : 0,
                valor_total: valor ? Number(quantidade) * Number(valor) : 0
            }
        ]);
        setItemNome('');
        setQuantidade('1');
        setValor('');
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (items.length === 0) {
            alert('Tem de adicionar pelo menos um item à requisição.');
            return;
        }

        try {
            const novaRequisicao: Requisicao = {
                id: crypto.randomUUID(),
                numero: '', // Seria auto-gerado pelo backend ou context
                data: new Date().toISOString(),
                tipo: form.tipo,
                clienteId: form.clienteId || undefined,
                fornecedorId: form.fornecedorId || undefined,
                centroCustoId: form.centroCustoId || undefined,
                itens: items,
                obs: form.obs,
                criadoPor: currentUser?.nome || 'Operador',
                // Default status related flags
                supplier_confirmed: false,
                supplier_refused: false,
                supplier_rejected: false
            };

            await addRequisicao(novaRequisicao);
            
            setForm({ tipo: 'Oficina', clienteId: '', fornecedorId: '', centroCustoId: '', obs: '' });
            setItems([]);
            setIsModalOpen(false);
            alert('Requisição criada com sucesso!');
        } catch (error: any) {
            alert('Erro ao criar requisição: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Requisições</h1>
                    <p className="text-slate-500 text-lg">Criação rápida de requisições de material</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95"
                >
                    <Plus className="w-8 h-8" />
                    Nova Requisição
                </button>
            </div>

            <div className="bg-white flex-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                    <ClipboardCheck className="w-6 h-6 text-slate-500" />
                    <h2 className="text-xl font-bold text-slate-800">Requisições Recentes</h2>
                </div>
                <div className="overflow-y-auto p-0 flex-1">
                    <table className="w-full text-left text-lg">
                        <thead className="bg-slate-50 sticky top-0 text-slate-500 font-bold uppercase text-sm tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Número</th>
                                <th className="p-4">Data</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Fornecedor</th>
                                <th className="p-4">Qtd Itens</th>
                                <th className="p-4">Staff</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recentRequisicoes.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 pl-6 font-bold text-blue-600">
                                        {req.numero || 'S/N'}
                                    </td>
                                    <td className="p-4 text-slate-700">
                                        {new Date(req.data).toLocaleDateString('pt-PT')}
                                    </td>
                                    <td className="p-4 text-slate-700">
                                        {req.tipo}
                                    </td>
                                    <td className="p-4 text-slate-900">
                                        {fornecedores.find(f => f.id === req.fornecedorId)?.nome || '-'}
                                    </td>
                                    <td className="p-4 text-slate-700 font-bold">
                                        {req.itens?.length || 0}
                                    </td>
                                    <td className="p-4 text-slate-500 text-base">
                                        {req.criadoPor || '-'}
                                    </td>
                                </tr>
                            ))}
                            {recentRequisicoes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        Nenhuma requisição encontrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for New Requisition */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full">
                        <div className="flex justify-between items-center p-6 sm:p-8 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                                    <Package className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900">Nova Requisição</h2>
                                    <p className="text-slate-500">Adicione os itens e detalhes da requisição</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X className="w-8 h-8" />
                            </button>
                        </div>
                        
                        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-100/50">
                            <form id="req-form" onSubmit={handleSubmit} className="flex flex-col gap-8">
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-3">
                                        <label className="block text-lg font-bold text-slate-700">Tipo</label>
                                        <select 
                                            value={form.tipo} 
                                            onChange={e => setForm({...form, tipo: e.target.value as any})}
                                            className="w-full p-4 text-lg border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="Oficina">Oficina</option>
                                            <option value="Stock">Stock</option>
                                            <option value="Viatura">Viatura</option>
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-lg font-bold text-slate-700">Fornecedor</label>
                                        <select 
                                            value={form.fornecedorId} 
                                            onChange={e => setForm({...form, fornecedorId: e.target.value})}
                                            className="w-full p-4 text-lg border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">Opcional...</option>
                                            {fornecedores.map(f => (
                                                <option key={f.id} value={f.id}>{f.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <label className="block text-lg font-bold text-slate-700">Centro de Custo</label>
                                        <select 
                                            value={form.centroCustoId} 
                                            onChange={e => setForm({...form, centroCustoId: e.target.value})}
                                            className="w-full p-4 text-lg border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">Opcional...</option>
                                            {centrosCustos.map(c => (
                                                <option key={c.id} value={c.id}>{c.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-lg font-bold text-slate-700">Observações</label>
                                        <input 
                                            type="text" 
                                            value={form.obs} 
                                            onChange={e => setForm({...form, obs: e.target.value})}
                                            className="w-full p-4 text-lg border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                                            placeholder="Ex: Urgente..."
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-xl font-bold text-slate-900 mb-4">Adicionar Itens</h3>
                                    <div className="flex flex-wrap md:flex-nowrap gap-4 items-end">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="block text-sm font-bold text-slate-600 mb-2">Descrição</label>
                                            <input 
                                                type="text"
                                                value={itemNome}
                                                onChange={e => setItemNome(e.target.value)}
                                                className="w-full p-3 text-lg border border-slate-300 rounded-xl focus:border-blue-500 outline-none bg-slate-50"
                                                placeholder="Nome do produto ou serviço"
                                            />
                                        </div>
                                        <div className="w-32">
                                            <label className="block text-sm font-bold text-slate-600 mb-2">Qtd</label>
                                            <input 
                                                type="number"
                                                min="1"
                                                value={quantidade}
                                                onChange={e => setQuantidade(e.target.value)}
                                                className="w-full p-3 text-lg border border-slate-300 rounded-xl focus:border-blue-500 outline-none bg-slate-50 font-bold"
                                            />
                                        </div>
                                        <div className="w-40">
                                            <label className="block text-sm font-bold text-slate-600 mb-2">Preço (Opcional)</label>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={valor}
                                                onChange={e => setValor(e.target.value)}
                                                className="w-full p-3 text-lg border border-slate-300 rounded-xl focus:border-blue-500 outline-none bg-slate-50"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={handleAddItem}
                                            className="p-3 px-6 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl h-[52px] transition-colors"
                                        >
                                            Adicionar Item
                                        </button>
                                    </div>

                                    {items.length > 0 && (
                                        <div className="mt-6 border-t border-slate-100 pt-6">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-slate-500 text-sm uppercase">
                                                        <th className="pb-3">Descrição</th>
                                                        <th className="pb-3 text-center">Qtd</th>
                                                        <th className="pb-3 text-right">Valor Unit.</th>
                                                        <th className="pb-3 text-right">Total</th>
                                                        <th className="pb-3 text-right"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-medium text-lg">
                                                    {items.map(item => (
                                                        <tr key={item.id}>
                                                            <td className="py-4 text-slate-900">{item.descricao}</td>
                                                            <td className="py-4 text-center">{item.quantidade}</td>
                                                            <td className="py-4 text-right text-slate-500">{item.valor_unitario ? `${item.valor_unitario.toFixed(2)} €` : '-'}</td>
                                                            <td className="py-4 text-right text-blue-600 font-bold">{item.valor_total ? `${item.valor_total.toFixed(2)} €` : '-'}</td>
                                                            <td className="py-4 text-right">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleRemoveItem(item.id)}
                                                                    className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-6 sm:p-8 border-t border-slate-100 bg-slate-50 flex gap-4 justify-end">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors text-lg"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                form="req-form"
                                className="flex items-center gap-3 px-10 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 text-lg active:scale-95"
                            >
                                <Check className="w-6 h-6" />
                                Criar Requisição
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple Trash Icon as it wasn't imported from lucide-react in the main import to avoid clutter
function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
    );
}
