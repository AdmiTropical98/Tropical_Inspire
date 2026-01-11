import React, { useState } from 'react';
import { CreditCard, Save, AlertCircle, Search, User, Check } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';

interface TagRegistrationModalProps {
    onSave: (tagId: string) => Promise<void>;
}

export default function TagRegistrationModal({ onSave }: TagRegistrationModalProps) {
    const { cartrackDrivers, motoristas } = useWorkshop();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState<{ id: string, name: string, tagId: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get available tags from Cartrack that are NOT yet assigned in our local DB
    const availableCartrackDrivers = cartrackDrivers
        .filter(cd => cd.tagId) // Must have a tag
        .map(cd => {
            // Clean/Format tagId for comparison
            let cleanTag = cd.tagId!.toUpperCase();
            if (cleanTag.includes('-')) cleanTag = cleanTag.split('-').pop()!;
            cleanTag = cleanTag.replace(/^0+/, '');
            return { ...cd, cleanTag };
        })
        .filter(cd => {
            // Check if this tag is already taken by someone else in our system
            const isTaken = motoristas.some(m => {
                const mTag = m.cartrackKey?.toUpperCase().replace(/^0+/, '');
                return mTag === cd.cleanTag;
            });
            return !isTaken;
        });

    const filteredDrivers = availableCartrackDrivers.filter(d =>
        d.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.cleanTag.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10); // Limit results for better UI

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTag) {
            setError('Por favor, seleciona uma Tag da lista.');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await onSave(selectedTag.tagId);
        } catch (err: any) {
            setError(err.message || 'Erro ao gravar Tag.');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-6 mx-auto">
                        <CreditCard className="w-8 h-8 text-blue-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center mb-2">Registo de Chapinha</h2>
                    <p className="text-slate-400 text-center text-sm mb-8">
                        Para seres identificado automaticamente nas viaturas, introduz o número da tua **Tag Cartrack (chapinha)**.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Procurar a tua Tag / Nome</label>
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Ex: Teu nome ou nº da tag..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-700"
                                />
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {filteredDrivers.map(driver => (
                                    <button
                                        key={driver.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedTag({ id: driver.id, name: driver.fullName, tagId: driver.cleanTag });
                                            setSearchTerm(driver.cleanTag);
                                        }}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedTag?.id === driver.id
                                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${selectedTag?.id === driver.id ? 'bg-blue-500/20 border-blue-500/30' : 'bg-slate-950 border-slate-800'
                                                }`}>
                                                <User className={`w-5 h-5 ${selectedTag?.id === driver.id ? 'text-blue-400' : 'text-slate-600'}`} />
                                            </div>
                                            <div className="text-left">
                                                <p className={`font-bold text-sm ${selectedTag?.id === driver.id ? 'text-blue-400' : 'text-white'}`}>{driver.fullName}</p>
                                                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Tag: {driver.cleanTag}</p>
                                            </div>
                                        </div>
                                        {selectedTag?.id === driver.id && <Check className="w-5 h-5 text-blue-400" />}
                                    </button>
                                ))}

                                {filteredDrivers.length === 0 && searchTerm && (
                                    <div className="p-8 text-center bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl">
                                        <p className="text-sm text-slate-500">Nenhuma Tag encontrada com este termo.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 text-red-400 text-xs animate-in shake duration-300">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving || !selectedTag}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-lg"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Gravar e Continuar
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-slate-950/50 p-4 border-t border-slate-800/50">
                    <p className="text-[10px] text-slate-600 text-center uppercase tracking-tighter">
                        Tropical Inspire &bull; Gestão de Frota
                    </p>
                </div>
            </div>
        </div>
    );
}
