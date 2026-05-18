import { ErrorBoundary } from '../../components/ErrorBoundary';
import SupplierInvoiceDocumentPage from '../Contabilidade/SupplierInvoiceDocumentPage';

export default function NovaFaturaPage() {
    return (
        <ErrorBoundary>
            <div style={{ color: 'white' }}>Nova Fatura Page Loaded</div>
            <SupplierInvoiceDocumentPage mode="create" />
        </ErrorBoundary>
    );
}
