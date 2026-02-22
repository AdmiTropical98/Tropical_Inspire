import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, CreditCard, RefreshCw } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { getTagVariants } from '../../services/cartrack';

const ABSOLUTE_SAFETY_LIST = [
    '01EEA0A600000080', '000000001FFFFF01', '3D0000011B567901', '3A0000011BD96201',
    '2D000001278D2401', '1B00000128A41901', 'B40000015D63FD01', '5C0000016142E901',
    '96000001619A3B01', '26000001636A2601', '6D000001637A2701', '6E0000016380F301',
    'F400000163B56F01', '470000016406F801', 'E20000016478DC01', '3C000001664EAF01',
    'F4000001665AF801', 'AD000001665DB401', '750000016661B801', 'A0000001666B8F01',
    '890000016679D401', '7B00000169313D01', 'C20000016936AE01', '3600000169508401',
    'C30000016959B101', 'A700000169766001', 'CC00000169876001', '5300000169B34601',
    'D00000016C42F401', 'ED0000016CF45201', '3100000171439901', '85000001722FF301',
    'F600000181A97201', 'D800000182003C01', '90000001824BD701', '63000001825FEB01',
    '6E0000018294DD01', 'CF00000182987901', 'A700000182BB6E01', 'A300000185133601',
    '0F0000018550EC01', '6000000185FBAF01', 'BB00000186A3A401', '3700000186F2EC01',
    '3E000001872A0601', '6B00000187A39201', 'CC000001881CE501', 'AD0000018850A101',
    'CE00000188588401', 'D300000188A4E701', '7700000188B1B801', '8900000188EAFA01',
    '5A00000188F07101', '85000001891B6901', '8A000001893B9E01', 'E7000001897C5301',
    'C3000001898FCF01', 'BF00000189927A01', '7F00000189C67701', 'B300000189C6EB01',
    'D20000018A5AF401', '0C0000018A8D1F01', '6A0000018A934601', '520000018AD19F01',
    '300000018C920301', 'A10000018D5C4601', '420000018D7F2F01', 'EF0000018E18F701',
    'EE0000019E03E501', 'A70000019E15A101', '910000019E290B01', 'EB0000019E2A9C01',
    '420000019E2FA501', 'BC0000019E37DA01', '950000019E42D301', 'E90000019EBB3301',
    '020000019EC88901', '6A0000019F632201', 'D30000019F668301', '620000019FD2D901',
    'B4000001A135D901', '21000001A1497E01', '30000001A16D0C01', '02000001A5D80401',
    '8D000001A5E10F01', '7F000001A5EAB801', 'AC000001A6063501', '3F000001A6A0EE01',
    'A7000001A7DECC01', '8B000001A7EE0D01', 'F3000001A7F0B501', '01000001A7F48501',
    '23000001A7F68D01', 'E3000001A7F9FC01', 'E5000001A802F101', '51000001A8083801',
    'D5000001A811E201', 'E8000001A81A5F01', 'C1000001A83CE201', '8A000001A85D6E01',
    '0C000001A8704101', '61000001A889BC01', '11000001A89F8001', '3D000001A8A3ED01',
    'CD000001A8C7D301', '05000001A8CD9301', '5000001A8CD9F301', 'E700001CB7314001',
    '0C00001D03D6AC01', 'AC0046A187A39201', '0001FFFF2550EC01', '201620031AFF2F01',
    '2080467FFBE68301', 'C08FFFFFFFFFD701', 'FFE000116142E901', 'FFE4000188B1B801',
    'FFF00001A7EE0D01', 'FFF2000186F2EC01', 'FFFFF00169B34601', 'FFFFFFD988B1B801',
    'FFFFFFFFCA5AF401', 'FFFFFFFFFFE5E201', 'FFFFFFFFFFFAEC01', 'D7FFFFFFFFFFF401'
];

interface TagRegistrationModalProps {
    onDetected: (tagId: string) => Promise<void>;
    onClose: () => void;
}

export default function TagRegistrationModal({ onDetected, onClose }: TagRegistrationModalProps) {
    const { cartrackDrivers, motoristas, refreshData } = useWorkshop();
    const [tagInput, setTagInput] = useState('');
    const [status, setStatus] = useState<{ type: 'idle' | 'valid' | 'invalid' | 'taken', message?: string }>({ type: 'idle' });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initial background sync
    useEffect(() => {
        refreshData().catch(console.error);
    }, []);

    useEffect(() => {
        const input = tagInput.trim().toUpperCase();
        if (!input) {
            setStatus({ type: 'idle' });
            return;
        }

        const inputVariants = getTagVariants(input);

        // BLINDADO MATCHING
        // 1. Try context drivers (merged from API and vehicles)
        let matchedDriver: any = cartrackDrivers.find(cd => {
            const officialVariants = cd.tagVariants || getTagVariants(cd.tagId);
            return inputVariants.some(iv =>
                officialVariants.some(ov => iv === ov || ov.includes(iv) || iv.includes(ov))
            );
        });

        // 2. ABSOLUTE SAFETY FALLBACK: Check hardcoded list directly
        if (!matchedDriver) {
            const safeMatch = ABSOLUTE_SAFETY_LIST.find(id => {
                const officialVariants = getTagVariants(id);
                return inputVariants.some(iv =>
                    officialVariants.some(ov => iv === ov || ov.includes(iv) || iv.includes(ov))
                );
            });

            if (safeMatch) {
                matchedDriver = {
                    id: `safe-${safeMatch}`,
                    fullName: 'Tag Oficial AlgaTempo (Verificada)',
                    tagId: safeMatch,
                    tagVariants: getTagVariants(safeMatch)
                };
            }
        }

        if (!matchedDriver) {
            // Last chance: simple substring match against ANY tagId in the fleet (min 6 chars)
            if (input.length >= 6) {
                matchedDriver = cartrackDrivers.find(cd => cd.tagId?.toUpperCase().includes(input));
            }
        }

        if (!matchedDriver) {
            setStatus({ type: 'invalid', message: 'Tag não reconhecida.' });
            return;
        }

        // Check if taken
        const finalTagId = matchedDriver.tagId?.toUpperCase();
        const isTaken = motoristas.some(m => {
            const mKey = String((m as any).cartrackKey || (m as any).cartrack_key || '').toUpperCase();
            if (!mKey) return false;

            // Check if taken key matches any of the official variants of the detected tag
            const driverVariants = matchedDriver!.tagVariants || getTagVariants(finalTagId);
            return mKey === finalTagId || driverVariants.includes(mKey);
        });

        if (isTaken) {
            setStatus({ type: 'taken', message: 'Tag já registada.' });
        } else {
            setStatus({ type: 'valid', message: `Tag Válida: ${matchedDriver.fullName}` });
        }
    }, [tagInput, cartrackDrivers, motoristas]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            await refreshData();
        } catch (e) {
            setError('Falha ao sincronizar dados da Cartrack.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (status.type !== 'valid') return;

        setIsSaving(true);
        setError(null);
        try {
            const input = tagInput.trim().toUpperCase();
            const inputVariants = getTagVariants(input);

            // Find match again for safe submission
            let match: any = cartrackDrivers.find(cd => {
                const officialVariants = cd.tagVariants || getTagVariants(cd.tagId);
                return inputVariants.some(iv =>
                    officialVariants.some(ov => iv === ov || ov.includes(iv) || iv.includes(ov))
                );
            });

            if (!match) {
                const safeId = ABSOLUTE_SAFETY_LIST.find(id => {
                    const officialVariants = getTagVariants(id);
                    return inputVariants.some(iv =>
                        officialVariants.some(ov => iv === ov || ov.includes(iv) || iv.includes(ov))
                    );
                });
                if (safeId) match = { tagId: safeId };
            }

            await onDetected(match?.tagId || tagInput.trim());
        } catch (err: any) {
            setError(err.message || 'Erro ao gravar Tag.');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 relative">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-6 mx-auto">
                        <CreditCard className="w-8 h-8 text-blue-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center mb-2">Registo de Chapinha</h2>
                    <p className="text-slate-400 text-center text-sm mb-8">
                        Para seres identificado automaticamente nas viaturas, introduz o número da tua **Tag Cartrack (chapinha)**.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">ID da tua Chapinha / Chave</label>
                            <div className="relative">
                                <input
                                    autoFocus
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    placeholder="Ex: 3D00... ou 0500..."
                                    className={`w-full bg-slate-950 border rounded-2xl px-6 py-5 text-white text-xl font-mono focus:outline-none transition-all placeholder:text-slate-800 ${status.type === 'valid' ? 'border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20' :
                                        status.type === 'idle' ? 'border-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500' :
                                            'border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                                        }`}
                                />
                                {status.type !== 'idle' && (
                                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${status.type === 'valid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                        {status.type === 'valid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                        {status.type === 'valid' ? 'Oficial' : status.message}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-2">
                                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                    • Introduz o número que vês na tua chapinha física.
                                </p>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                    • O sistema valida automaticamente se é uma chave oficial da AlgaTempo.
                                </p>
                            </div>
                        </div>

                        {status.type === 'valid' && status.message?.includes(':') && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 animate-in fade-in slide-in-from-top-2">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Motorista Detetado</p>
                                    <p className="text-white font-bold">{status.message.split(': ')[1]}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {error && (
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 animate-in shake duration-300">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm font-medium">{error}</p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="w-full py-2 text-[10px] text-slate-500 hover:text-blue-400 uppercase font-bold tracking-widest transition-colors disabled:opacity-50 group flex items-center justify-center gap-2"
                            >
                                {isRefreshing ? (
                                    <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        Sincronizando com Cartrack...
                                    </>
                                ) : (
                                    'Não encontras a tua tag? Tenta Sincronizar'
                                )}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving || status.type !== 'valid'}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3 text-lg"
                        >
                            {isSaving ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle2 className="w-6 h-6" />
                                    Gravar e Continuar
                                </>
                            )}
                        </button>
                    </form>
                </div>
                <div className="px-8 py-4 bg-slate-950/50 border-t border-slate-800/50 flex justify-center">
                    <p className="text-[10px] text-slate-600 font-medium uppercase tracking-tight">
                        Tropical Inspire • Gestão de Frota
                    </p>
                </div>
            </div>
        </div>
    );
}
