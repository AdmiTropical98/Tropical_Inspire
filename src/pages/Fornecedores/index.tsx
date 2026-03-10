import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, MapPin, Phone, Mail, Building2, Pencil } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/common/PageHeader';
import { Building2 as BuildingIcon } from 'lucide-react';
import type { Fornecedor } from '../../types';

export default function Fornecedores() {
    const { fornecedores, addFornecedor, updateFornecedor, deleteFornecedor, requisicoes } = useWorkshop();
    const { t } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('');
    const [editingSupplier, setEditingSupplier] = useState<Fornecedor | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [formData, setFormData] = useState<Omit<Fornecedor, 'id'>>({
        nome: '',
        nif: '',
        morada: '',
        contacto: '',
        email: '',
        obs: ''
    });

    const [editFormData, setEditFormData] = useState<Omit<Fornecedor, 'id'>>({
        nome: '',
        nif: '',
        morada: '',
        contacto: '',
        email: '',
        obs: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addFornecedor({
            ...formData,
            id: crypto.randomUUID()
        });
        setShowForm(false);
        setFormData({ nome: '', nif: '', morada: '', contacto: '', email: '', obs: '' });
    };

    const filteredItems = fornecedores.filter(f =>
        f.nome.toLowerCase().includes(filter.toLowerCase()) ||
        f.nif.includes(filter)
    );

    const openEditModal = (supplier: Fornecedor) => {
        setEditingSupplier(supplier);
        setEditFormData({
            nome: supplier.nome || '',
            nif: supplier.nif || '',
            morada: supplier.morada || '',
            contacto: supplier.contacto || '',
            email: supplier.email || '',
            obs: supplier.obs || '',
            foto: supplier.foto
        });
    };

    const closeEditModal = () => {
        setEditingSupplier(null);
        setIsSavingEdit(false);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSupplier) return;

        setIsSavingEdit(true);
        await updateFornecedor({
            ...editingSupplier,
            ...editFormData
        });
        closeEditModal();
    };

    return (
        <div className="w-full min-w-0 space-y-6">
            <PageHeader
                title={t('suppliers.title') || 'Fornecedores'}
                subtitle={t('suppliers.subtitle') || 'Gestão de parceiros e fornecedores de serviços.'}
                icon={BuildingIcon}
                actions={
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="h-4 w-4" />
                        {t('suppliers.new')}
                    </button>
                }
            >
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                    <input
                        type="text"
                        placeholder={t('suppliers.search')}
                        className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full text-sm text-slate-200 placeholder-slate-500 transition-all"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </PageHeader>

            {/* Content Container */}
            <div className="animate-in fade-in duration-500">
                {showForm ? (
                    <div className="w-full min-w-0 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm">
                        <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
                            <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                            {t('suppliers.new')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Image Upload */}
                            <div className="flex justify-center mb-6">
                                <div className="relative group">
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border-2 ${formData.foto ? 'border-blue-500' : 'border-slate-600 border-dashed bg-slate-800'}`}>
                                        {formData.foto ? (
                                            <img src={formData.foto} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Building2 className="w-8 h-8 text-slate-500" />
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full cursor-pointer shadow-lg transition-all z-10">
                                        <Plus className="w-4 h-4" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setFormData(prev => ({ ...prev, foto: reader.result as string }));
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">{t('suppliers.form.name')}</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 transition-all"
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">{t('suppliers.form.nif')}</label>
                                    <input
                                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 transition-all"
                                        value={formData.nif}
                                        onChange={e => setFormData({ ...formData, nif: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">{t('suppliers.form.contact')}</label>
                                    <input
                                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 transition-all"
                                        value={formData.contacto}
                                        onChange={e => setFormData({ ...formData, contacto: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">{t('suppliers.form.email')}</label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 transition-all"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">{t('suppliers.form.address')}</label>
                                    <input
                                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 transition-all"
                                        value={formData.morada}
                                        onChange={e => setFormData({ ...formData, morada: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">{t('suppliers.form.obs')}</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-200 transition-all resize-none"
                                        value={formData.obs}
                                        onChange={e => setFormData({ ...formData, obs: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-700/50">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-600 rounded-xl transition-all"
                                >
                                    {t('suppliers.form.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-900/30 transition-all"
                                >
                                    {t('suppliers.form.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredItems.map(fornecedor => (
                            <div key={fornecedor.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10 transition-all group relative">
                                <button
                                    onClick={() => deleteFornecedor(fornecedor.id)}
                                    className="absolute top-4 right-4 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-red-500/10 rounded-lg z-10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>

                                <div className="flex items-start gap-4 mb-4">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-xl shadow-lg flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                                            {fornecedor.foto ? (
                                                <img src={fornecedor.foto} alt={fornecedor.nome} className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 className="h-6 w-6" />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg leading-tight">{fornecedor.nome}</h3>
                                        <p className="text-sm text-slate-400 mt-1 font-mono">NIF: {fornecedor.nif}</p>
                                        <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                                            TOTAL: {requisicoes
                                                .filter(r => r.fornecedorId === fornecedor.id)
                                                .reduce((acc, curr) => acc + (curr.custo || 0), 0)
                                                .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2.5 mt-4 pt-4 border-t border-slate-700/50 text-sm">
                                    <div className="flex items-center gap-2.5 text-slate-400">
                                        <Phone className="h-4 w-4 text-slate-500" />
                                        <span>{fornecedor.contacto || 'Sem contacto'}</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-slate-400">
                                        <Mail className="h-4 w-4 text-slate-500" />
                                        <span className="truncate">{fornecedor.email || 'Sem email'}</span>
                                    </div>
                                    <div className="flex items-start gap-2.5 text-slate-400">
                                        <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                                        <span className="flex-1 leading-tight">{fornecedor.morada || 'Sem morada'}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-700/60">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(fornecedor)}
                                            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Editar
                                        </button>
                                        <Link
                                            to={`/fornecedores/${fornecedor.id}`}
                                            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                                        >
                                            Ver perfil financeiro
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="col-span-full text-center py-20">
                                <div className="inline-flex p-4 bg-slate-800/50 rounded-full mb-4">
                                    <Search className="w-8 h-8 text-slate-600" />
                                </div>
                                <p className="text-slate-500 text-lg">{t('suppliers.list.empty')}</p>
                                <p className="text-slate-600 text-sm mt-1">{t('suppliers.list.empty_subtitle')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {editingSupplier && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
                            <h2 className="text-lg font-bold text-white">Editar Fornecedor</h2>
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                                Cancelar
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="space-y-4 px-6 py-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Nome</label>
                                    <input
                                        required
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        value={editFormData.nome}
                                        onChange={e => setEditFormData(prev => ({ ...prev, nome: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">NIF</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        value={editFormData.nif}
                                        onChange={e => setEditFormData(prev => ({ ...prev, nif: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Telefone</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        value={editFormData.contacto}
                                        onChange={e => setEditFormData(prev => ({ ...prev, contacto: e.target.value }))}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Email</label>
                                    <input
                                        type="email"
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        value={editFormData.email}
                                        onChange={e => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Morada</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        value={editFormData.morada}
                                        onChange={e => setEditFormData(prev => ({ ...prev, morada: e.target.value }))}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Notas</label>
                                    <textarea
                                        rows={4}
                                        className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        value={editFormData.obs}
                                        onChange={e => setEditFormData(prev => ({ ...prev, obs: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-slate-700 pt-4">
                                <button
                                    type="button"
                                    onClick={closeEditModal}
                                    className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/30 transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSavingEdit ? 'A guardar...' : 'Guardar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
