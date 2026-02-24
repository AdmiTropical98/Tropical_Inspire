import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import InvoiceForm from '../../components/InvoiceForm';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useFinancial } from '../../contexts/FinancialContext';
import type { SupplierInvoice } from '../../types';

interface SupplierInvoiceDocumentPageProps {
    mode: 'create' | 'edit';
}

export default function SupplierInvoiceDocumentPage({ mode }: SupplierInvoiceDocumentPageProps) {
    const navigate = useNavigate();
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const [searchParams] = useSearchParams();

    const { fornecedores, centrosCustos, viaturas, requisicoes } = useWorkshop();
    const { supplierInvoices, addSupplierInvoice, updateSupplierInvoice } = useFinancial();

    const initialRequisitionId = searchParams.get('requisitionId') || '';

    const selectedInvoice = useMemo(() => {
        if (mode !== 'edit' || !invoiceId) return null;
        return supplierInvoices.find(invoice => invoice.id === invoiceId) || null;
    }, [mode, invoiceId, supplierInvoices]);

    const selectedRequisition = useMemo(() => {
        if (mode !== 'create' || !initialRequisitionId) return null;
        return requisicoes.find(req => req.id === initialRequisitionId) || null;
    }, [mode, initialRequisitionId, requisicoes]);

    const handleSave = async (data: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => {
        try {
            if (mode === 'edit' && selectedInvoice) {
                await updateSupplierInvoice(selectedInvoice.id, data);
            } else {
                await addSupplierInvoice(data);
            }
            navigate('/contabilidade');
        } catch (error) {
            console.error('Error saving invoice:', error);
            alert('Erro ao guardar fatura');
        }
    };

    const handleCancel = () => {
        navigate('/contabilidade');
    };

    if (mode === 'edit' && !selectedInvoice) {
        return (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">
                <h2 className="text-xl font-semibold text-white mb-2">Fatura não encontrada</h2>
                <p className="text-slate-400 mb-6">A fatura solicitada não existe ou ainda não foi carregada.</p>
                <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div className="w-full">
            <InvoiceForm
                invoice={selectedInvoice}
                suppliers={fornecedores}
                costCenters={centrosCustos}
                vehicles={viaturas}
                requisitions={requisicoes}
                initialRequisition={selectedRequisition}
                onSave={handleSave}
                onCancel={handleCancel}
            />
        </div>
    );
}
