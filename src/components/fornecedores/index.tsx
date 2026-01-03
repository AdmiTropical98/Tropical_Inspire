import { useState } from 'react';
import { Plus, Search, Trash2, MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Fornecedor } from '../../types';

export default function Fornecedores() {
    const { fornecedores, addFornecedor, deleteFornecedor } = useWorkshop();
    const { t } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('');

    const [formData, setFormData] = useState<Omit<Fornecedor, 'id'>>({
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

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/30 rounded-t-3xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                    <input
                        type="text"
                        placeholder={t('suppliers.search')}
                        className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64 text-sm text-slate-200 placeholder-slate-500 transition-all"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
                >
                    <Plus className="h-4 w-4" />
                    {t('suppliers.new')}
                </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
                {showForm ? (
                    <div className="max-w-2xl mx-auto bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm">
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
        </div>
    );
}
