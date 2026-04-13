import { useState } from 'react';
import { X, Check, XCircle, Send, Phone, Mail, Shield } from 'lucide-react';
import { useWorkshop } from '../../../contexts/WorkshopContext';
import type { Notification } from '../../../types';

interface ApprovalsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ApprovalsModal({ isOpen, onClose }: ApprovalsModalProps) {
    const { notifications, updateNotification } = useWorkshop();
    
    // Filter only pending registration requests
    const pendingRequests = notifications.filter(
        n => n.type === 'registration_request' && n.status === 'pending'
    );

    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleApprove = async (notification: Notification) => {
        if (!confirm('Tem a certeza que deseja aprovar este pedido?')) return;
        
        setProcessingId(notification.id);
        try {
            await updateNotification({
                ...notification,
                status: 'approved'
            });
        } catch (error) {
            console.error('Error approving request:', error);
            alert('Erro ao aprovar pedido.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (notification: Notification) => {
        if (!confirm('Tem a certeza que deseja rejeitar este pedido?')) return;

        setProcessingId(notification.id);
        try {
            await updateNotification({
                ...notification,
                status: 'rejected'
            });
        } catch (error) {
            console.error('Error rejecting request:', error);
            alert('Erro ao rejeitar pedido.');
        } finally {
            setProcessingId(null);
        }
    };

    const sendWhatsApp = (notification: Notification) => {
        const phone = notification.data.telemovel?.replace(/[^0-9]/g, '');
        const pin = notification.response?.pin || '####';
        const name = notification.data.nome || 'Utilizador';

        if (!phone) {
            alert('Número de telemóvel inválido.');
            return;
        }

        const message = `Olá ${name}, seja bem vindo ao sistema de gerenciamento de frota da Algartempo.\nSegue o código Pin para autorizar o acesso de ${notification.data.role || 'utilizador'}\n\n*PIN:* ${pin}\n\nPara acessar a aplicação carregue aqui https://algartempo-frota.com/`;
        
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            Aprovações Pendentes
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full uppercase ml-2 border border-amber-500/30">
                                {pendingRequests.length}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-600 mt-1">Gerencie os pedidos de acesso e registo de novos utilizadores.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {pendingRequests.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <Check className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Não existem pedidos pendentes de momento.</p>
                        </div>
                    ) : (
                        pendingRequests.map(req => (
                            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors shadow-sm">
                                <div className="flex flex-col md:flex-row gap-6">
                                    
                                    {/* User Info */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <h3 className="font-bold text-slate-900 text-lg">{req.data.nome || 'Sem Nome'}</h3>
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-200">
                                                {new Date(req.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Phone className="w-4 h-4 text-slate-500" />
                                                <span>{req.data.telemovel || '---'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Mail className="w-4 h-4 text-slate-500" />
                                                <span>{req.data.email || '---'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Shield className="w-4 h-4 text-slate-500" />
                                                <span className="capitalize">{req.data.role || 'Utilizador'}</span>
                                            </div>
                                        </div>

                                        {/* PIN Display */}
                                        {req.response?.pin && (
                                            <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between group">
                                                <div>
                                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">PIN Gerado</span>
                                                    <p className="font-mono text-xl text-slate-900 font-bold tracking-widest">{req.response.pin}</p>
                                                </div>
                                                <button 
                                                    onClick={() => sendWhatsApp(req)}
                                                    className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 text-xs font-bold transition-colors shadow-lg shadow-green-600/20"
                                                    title="Enviar credenciais por WhatsApp"
                                                >
                                                    <Send className="w-3 h-3" />
                                                    Enviar
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">

                                        {!req.response?.pin ? (
                                            <button
                                                onClick={async () => {
                                                    const pin = Math.floor(1000 + Math.random() * 9000).toString();
                                                    setProcessingId(req.id);
                                                    try {
                                                        await updateNotification({
                                                            ...req,
                                                            response: { ...req.response, pin }
                                                        });
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert('Erro ao gerar PIN');
                                                    } finally {
                                                        setProcessingId(null);
                                                    }
                                                }}
                                                disabled={!!processingId}
                                                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
                                            >
                                                <Shield className="w-4 h-4" />
                                                Gerar PIN
                                            </button>
                                        ) : (
                                                <button
                                                    onClick={() => handleApprove(req)}
                                                    disabled={!!processingId}
                                                    className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap shadow-lg shadow-emerald-900/20"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Concluir
                                                </button>
                                        )}

                                        <button 
                                            onClick={() => handleReject(req)}
                                            disabled={!!processingId}
                                            className="flex-1 md:flex-none px-4 py-2 bg-white hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border border-slate-200 hover:border-red-200"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Rejeitar
                                        </button>
                                    </div>

                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}
