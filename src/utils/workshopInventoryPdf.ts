import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { StockItem } from '../types';

export interface InventoryPDFItem {
    name: string;
    category?: string;
    serial_number?: string;
    quantity?: number;
    status?: string;
    location?: string;
    notes?: string;
}

const getStatusLabel = (status?: string) => {
    switch (status) {
        case 'available':
            return 'Disponível';
        case 'assigned':
            return 'Em uso';
        case 'maintenance':
            return 'Manutenção';
        case 'retired':
            return 'Abatido';
        default:
            return status || '---';
    }
};

const formatDateTime = (date: Date) => {
    return date.toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export function generateInventoryPDF(inventoryItems: InventoryPDFItem[], generatedBy = 'Sistema') {
    const doc = new jsPDF('p', 'mm', 'a4');
    const generatedAt = new Date();

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('ALGARTEMPO FROTA', 14, 14);
    doc.setFontSize(13);
    doc.text('Inventário de Oficina', 14, 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text(`Data: ${formatDateTime(generatedAt)}`, 14, 30);
    doc.text(`Gerado por: ${generatedBy}`, 115, 30);

    const rows = inventoryItems.map(item => [
        item.name || '---',
        item.category || '---',
        item.serial_number || '---',
        String(item.quantity ?? 1),
        getStatusLabel(item.status),
        item.location || '---',
        item.notes || '---'
    ]);

    autoTable(doc, {
        startY: 44,
        head: [[
            'Nome do Item',
            'Categoria',
            'Número de Série',
            'Quantidade',
            'Estado',
            'Localização',
            'Observações'
        ]],
        body: rows,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 2,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            textColor: [15, 23, 42]
        },
        headStyles: {
            fillColor: [51, 65, 85],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'left'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 25 },
            2: { cellWidth: 26 },
            3: { cellWidth: 15, halign: 'center' },
            4: { cellWidth: 20 },
            5: { cellWidth: 24 },
            6: { cellWidth: 46 }
        },
        didDrawPage: () => {
            const pageSize = doc.internal.pageSize;
            const pageWidth = pageSize.getWidth();
            const pageHeight = pageSize.getHeight();
            const pageNumber = doc.getCurrentPageInfo().pageNumber;

            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`Página ${pageNumber}`, pageWidth - 24, pageHeight - 8);
        }
    });

    doc.save(`Inventario_Oficina_${generatedAt.toISOString().slice(0, 10)}.pdf`);
}

export function generateMaterialIssueFormPDF() {
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('ALGARTEMPO FROTA', 14, 14);
    doc.setFontSize(13);
    doc.text('Registo de Saída de Material - Oficina', 14, 23);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);

    let y = 44;

    const drawField = (label: string, lineWidth = 120) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.line(42, y + 0.5, 42 + lineWidth, y + 0.5);
        y += 12;
    };

    drawField('Data', 70);
    drawField('Nome do Funcionário', 120);
    drawField('Departamento / Equipa', 110);
    drawField('Motivo da Saída', 145);

    autoTable(doc, {
        startY: y + 2,
        head: [['Item', 'Quantidade', 'Nº Série', 'Observações']],
        body: Array.from({ length: 10 }, () => ['', '', '', '']),
        theme: 'grid',
        styles: {
            fontSize: 10,
            minCellHeight: 10,
            lineColor: [148, 163, 184],
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: [51, 65, 85],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 58 },
            1: { cellWidth: 30 },
            2: { cellWidth: 35 },
            3: { cellWidth: 67 }
        }
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200;
    const signatureY = Math.min(finalY + 20, 265);

    doc.setFont('helvetica', 'bold');
    doc.text('Assinatura Funcionário:', 14, signatureY);
    doc.text('Assinatura Responsável:', 110, signatureY);

    doc.setLineWidth(0.2);
    doc.line(14, signatureY + 8, 90, signatureY + 8);
    doc.line(110, signatureY + 8, 190, signatureY + 8);

    doc.save('Folha_Saida_Material_Oficina.pdf');
}

export function generateStockPartsPDF(stockItems: StockItem[], generatedBy = 'Sistema') {
    const doc = new jsPDF('p', 'mm', 'a4');
    const generatedAt = new Date();

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('ALGARTEMPO FROTA', 14, 14);
    doc.setFontSize(13);
    doc.text('Relatório de Stock de Peças', 14, 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text(`Data: ${formatDateTime(generatedAt)}`, 14, 30);
    doc.text(`Gerado por: ${generatedBy}`, 115, 30);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    const groupedItems = stockItems.reduce((acc, item) => {
        const cat = item.category || 'Indefinido';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, typeof stockItems>);

    const sortedGroups = Object.keys(groupedItems).sort((a, b) => {
        if (a === 'Indefinido') return 1;
        if (b === 'Indefinido') return -1;
        return a.localeCompare(b);
    });

    let currentY = 44;

    sortedGroups.forEach(category => {
        const items = groupedItems[category];

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`Categoria: ${category}`, 14, currentY);

        const rows = items.map(item => [
            item.name || '---',
            item.sku || '---',
            String(item.stock_quantity),
            String(item.minimum_stock),
            formatCurrency(item.average_cost),
            item.location || '---'
        ]);

        autoTable(doc, {
            startY: currentY + 4,
            head: [[
                'Nome da Peça',
                'SKU',
                'Stock Atual',
                'Stock Mín',
                'Custo Médio',
                'Localização'
            ]],
            body: rows,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [226, 232, 240],
                lineWidth: 0.1,
                textColor: [15, 23, 42]
            },
            headStyles: {
                fillColor: [51, 65, 85],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left'
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 28 },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 30, halign: 'right' },
                5: { cellWidth: 34 }
            },
            didDrawPage: () => {
                const pageSize = doc.internal.pageSize;
                const pageWidth = pageSize.getWidth();
                const pageHeight = pageSize.getHeight();
                const pageNumber = doc.getCurrentPageInfo().pageNumber;

                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.setFont('helvetica', 'normal');
                doc.text(`Página ${pageNumber}`, pageWidth - 24, pageHeight - 8);
            }
        });

        currentY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY + 40;
        currentY += 12; // spacing before next category
    });

    doc.save(`Relatorio_Stock_Pecas_${generatedAt.toISOString().slice(0, 10)}.pdf`);
}