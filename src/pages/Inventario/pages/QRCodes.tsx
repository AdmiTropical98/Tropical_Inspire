import { useEffect, useRef, useState } from 'react';
import { Download, Printer, QrCode, Search } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getMaterials, getEquipments } from '../../../services/inventoryService';
import type { InventoryMaterial, InventoryEquipment } from '../../../services/inventoryService';

type QRItem = {
  id: string;
  label: string;
  sublabel: string;
  code: string;
  type: 'material' | 'equipment';
};

export default function QRCodes() {
  const [items, setItems] = useState<QRItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [mats, equips] = await Promise.all([getMaterials(), getEquipments()]);
      const matItems: QRItem[] = (mats as InventoryMaterial[])
        .filter(m => m.qr_code)
        .map(m => ({
          id: m.id,
          label: m.name,
          sublabel: m.sku || '',
          code: m.qr_code!,
          type: 'material' as const,
        }));
      const eqItems: QRItem[] = (equips as InventoryEquipment[])
        .filter(e => e.qr_code)
        .map(e => ({
          id: e.id,
          label: e.name,
          sublabel: e.serial_number || '',
          code: e.qr_code!,
          type: 'equipment' as const,
        }));
      setItems([...matItems, ...eqItems]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter(
    i =>
      i.label.toLowerCase().includes(search.toLowerCase()) ||
      i.sublabel.toLowerCase().includes(search.toLowerCase()) ||
      i.code.toLowerCase().includes(search.toLowerCase()),
  );

  function handlePrint() {
    window.print();
  }

  function downloadSVG(item: QRItem) {
    const svg = document.getElementById(`qr-${item.id}`)?.querySelector('svg');
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5 print:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <QrCode className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">QR Codes</h1>
              <p className="text-xs text-slate-500">{items.length} códigos gerados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir tudo
          </button>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, código..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6" ref={printRef}>
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
            <QrCode className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {items.length === 0
                ? 'Nenhum QR Code gerado ainda. Crie materiais ou equipamentos para gerar QR Codes.'
                : 'Nenhum resultado para a pesquisa.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 print:grid-cols-4">
            {filtered.map(item => (
              <div
                key={item.id}
                className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow print:shadow-none print:border print:break-inside-avoid"
              >
                <div id={`qr-${item.id}`} className="rounded-xl bg-white p-2">
                  <QRCodeSVG value={item.code} size={120} />
                </div>
                <p className="mt-2 text-xs font-bold text-slate-800 line-clamp-2">{item.label}</p>
                {item.sublabel && (
                  <p className="text-[10px] text-slate-400 font-mono">{item.sublabel}</p>
                )}
                <span
                  className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    item.type === 'material'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {item.type === 'material' ? 'Material' : 'Equipamento'}
                </span>
                <button
                  type="button"
                  onClick={() => downloadSVG(item)}
                  className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-50 print:hidden"
                >
                  <Download className="h-3 w-3" />
                  SVG
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:grid-cols-4, .print\\:grid-cols-4 * { visibility: visible; }
          [ref] { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
