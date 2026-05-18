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
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Resumo Financeiro</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Base Bruta (€)</label>
                    <input
                        type="number"
                        value={grossBaseTotal}
                        readOnly
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Descontos (€)</label>
                    <input
                        type="number"
                        value={discountTotal}
                        readOnly
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Base após desconto (€)</label>
                    <input
                        type="number"
                        value={taxableBase}
                        readOnly
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Total IVA (€)</label>
                    <input
                        type="number"
                        value={totalIva}
                        readOnly
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Total Final (€)</label>
                    <input
                        type="number"
                        value={totalFinal}
                        readOnly
                        className="w-full bg-blue-600/20 border border-blue-500/60 rounded-lg px-3 py-2 text-blue-200 font-semibold cursor-not-allowed"
                    />
                </div>
            </div>
        </>
    );
}
