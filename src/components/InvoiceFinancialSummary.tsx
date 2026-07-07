interface InvoiceFinancialSummaryProps {
    grossBaseTotal: number;
    discountTotal: number;
    taxableBase: number;
    totalIva: number;
    totalFinal: number;
}

export default function InvoiceFinancialSummary({
    grossBaseTotal,
    discountTotal,
    taxableBase,
    totalIva,
    totalFinal
}: InvoiceFinancialSummaryProps) {
    return (
        <>
            <h3 className="text-sm font-bold text-slate-700 mb-4">Resumo Financeiro</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Base Bruta (€)</label>
                    <input
                        type="number"
                        value={grossBaseTotal}
                        readOnly
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Descontos (€)</label>
                    <input
                        type="number"
                        value={discountTotal}
                        readOnly
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Base após desconto (€)</label>
                    <input
                        type="number"
                        value={taxableBase}
                        readOnly
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Total IVA (€)</label>
                    <input
                        type="number"
                        value={totalIva}
                        readOnly
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Total Final (€)</label>
                    <input
                        type="number"
                        value={totalFinal}
                        readOnly
                        className="w-full bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700 font-bold cursor-not-allowed"
                    />
                </div>
            </div>
        </>
    );
}
