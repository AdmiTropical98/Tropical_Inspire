import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { Cliente } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

export default function Clientes() {
    const { clientes, addCliente, updateCliente, deleteCliente } = useWorkshop();
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Cliente>>({
        nome: '',
        nif: '',
        email: '',
        telefone: '',
        morada: ''
    });

    const filteredClientes = clientes.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nif.includes(searchTerm) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (cliente: Cliente) => {
        setEditingCliente(cliente);
        setFormData(cliente);
        setShowModal(true);
    };

    const handleDelete = (id: string) => {
        if (confirm(t('clients.delete_confirm'))) {
            deleteCliente(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nome || !formData.nif) {
            alert(t('clients.required_fields'));
            return;
        }

        if (editingCliente) {
            updateCliente({ ...editingCliente, ...formData } as Cliente);
        } else {
            addCliente({
                id: crypto.randomUUID(),
                ...formData
            } as Cliente);
        }

        setShowModal(false);
        setEditingCliente(null);
        setFormData({ nome: '', nif: '', email: '', telefone: '', morada: '' });
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder={t('clients.search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500"
                    />
                </div>
                <button
                    onClick={() => {
                        setEditingCliente(null);
                        setFormData({ nome: '', nif: '', email: '', telefone: '', morada: '' });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
                >
                    <Plus className="w-5 h-5" />
                    {t('clients.new')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClientes.map(cliente => (
                    <div key={cliente.id} className="bg-[#1e293b]/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-900/10 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                    <Building2 className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white leading-tight">{cliente.nome}</h3>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">NIF: {cliente.nif}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(cliente)}
                                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(cliente.id)}
                                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-400">
                            {cliente.email && (
                                <div className="flex items-center gap-2 truncate">
                                    <Mail className="w-4 h-4 text-slate-500" />
                                    {cliente.email}
                                </div>
                            )}
                            {cliente.telefone && (
                                <div className="flex items-center gap-2 truncate">
                                    <Phone className="w-4 h-4 text-slate-500" />
                                    {cliente.telefone}
                                </div>
                            )}
                            {cliente.morada && (
                                <div className="flex items-center gap-2 truncate">
                                    <MapPin className="w-4 h-4 text-slate-500" />
                                    {cliente.morada}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {filteredClientes.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>{t('clients.empty')}</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">
                                {editingCliente ? t('clients.edit') : t('clients.new')}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <span className="sr-only">Fechar</span>
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Nome da Empresa / Particular *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.nome || ''}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ex: Transportes Lda"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">NIF *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.nif || ''}
                                    onChange={e => setFormData({ ...formData, nif: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ex: 500123456"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Telefone</label>
                                    <input
                                        type="tel"
                                        value={formData.telefone || ''}
                                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="923..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Morada</label>
                                <textarea
                                    value={formData.morada || ''}
                                    onChange={e => setFormData({ ...formData, morada: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 resize-none h-20"
                                    placeholder="Endereço completo..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
