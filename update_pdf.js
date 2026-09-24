const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Combustivel', 'index.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Replace exportIntervalsPDF
const regex = /    const exportIntervalsPDF = \(\) => \{[\s\S]*?doc\.save\(`auditoria_tanque_\$\{new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\}\.pdf`\);\s*\};/m;

if (!regex.test(content)) {
    console.error("Could not find exportIntervalsPDF block");
    process.exit(1);
}

const replacement = `    const exportCostCenterPDF = () => {
        const doc = new jsPDF();
        const colors = {
            primary: [15, 23, 42],
            secondary: [51, 65, 85],
            accent: [16, 185, 129],
            bg: [248, 250, 252],
            border: [226, 232, 240]
        };

        const confirmedTxs = fuelTransactions.filter(tx => tx.status === 'confirmed');

        // Group by Cost Center
        const grouped = confirmedTxs.reduce((acc, tx) => {
            const ccId = tx.centroCustoId || 'unassigned';
            if (!acc[ccId]) {
                acc[ccId] = {
                    transactions: [],
                    totalLiters: 0,
                    totalCost: 0
                };
            }
            acc[ccId].transactions.push(tx);
            acc[ccId].totalLiters += tx.liters || 0;
            acc[ccId].totalCost += tx.totalCost || 0;
            return acc;
        }, {});

        const ccList = Object.keys(grouped).map(ccId => {
            if (ccId === 'unassigned') {
                return { id: ccId, nome: 'Sem Centro de Custo', ...grouped[ccId] };
            }
            const cc = centrosCustos.find(c => c.id === ccId);
            return { id: ccId, nome: cc?.nome || 'Desconhecido', ...grouped[ccId] };
        }).sort((a, b) => b.totalCost - a.totalCost);

        // Header Design
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.rect(0, 0, 210, 45, 'F');

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('Relatório de Custos', 14, 26);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);
        doc.text(\`Gerado em: \${new Date().toLocaleString()}\`, 14, 35);
        
        const totalGlobalCost = confirmedTxs.reduce((sum, tx) => sum + (tx.totalCost || 0), 0);
        const totalGlobalLiters = confirmedTxs.reduce((sum, tx) => sum + (tx.liters || 0), 0);
        
        doc.text(\`Total Litros: \${totalGlobalLiters.toFixed(1)} L | Total Custos: \${totalGlobalCost.toFixed(2)} €\`, 110, 35);

        let yPos = 55;

        // SUMMARY PAGE
        doc.setFontSize(14);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo por Centro de Custo', 14, yPos);
        yPos += 8;

        const summaryData = ccList.map(cc => [
            cc.nome,
            \`\${cc.transactions.length}\`,
            \`\${cc.totalLiters.toFixed(1)} L\`,
            \`\${cc.totalCost.toFixed(2)} €\`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Centro de Custo', 'Nº Abastecimentos', 'Litros', 'Custo Total']],
            body: summaryData,
            theme: 'grid',
            headStyles: {
                fillColor: [16, 185, 129],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' }
            },
            styles: { fontSize: 9, cellPadding: 4, lineColor: colors.border },
            alternateRowStyles: { fillColor: colors.bg },
            margin: { left: 14, right: 14 }
        });

        yPos = doc.lastAutoTable.finalY + 20;

        // DETAILS PAGE(S)
        ccList.forEach((cc) => {
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            // CC Header
            doc.setFillColor(241, 245, 249);
            doc.rect(14, yPos, 182, 14, 'F');
            doc.setDrawColor(16, 185, 129);
            doc.setLineWidth(1);
            doc.line(14, yPos, 14, yPos + 14);

            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.text(cc.nome.toUpperCase(), 18, yPos + 9);

            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'normal');
            doc.text(\`Litros: \${cc.totalLiters.toFixed(1)} L  |  Custos: \${cc.totalCost.toFixed(2)} €\`, 130, yPos + 9);

            yPos += 18;

            const tableData = cc.transactions
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map(tx => {
                    const viatura = viaturas.find(v => v.id === tx.vehicleId || v.matricula === tx.vehicleId);
                    const motorista = motoristas.find(m => m.id === tx.driverId);
                    return [
                        new Date(tx.timestamp).toLocaleString(),
                        viatura?.matricula || tx.vehicleId || 'N/A',
                        motorista?.nome || tx.staffName || 'N/A',
                        \`\${tx.liters.toFixed(1)} L\`,
                        \`\${tx.totalCost?.toFixed(2) || '0.00'} €\`
                    ];
                });

            autoTable(doc, {
                startY: yPos,
                head: [['Data/Hora', 'Viatura', 'Motorista', 'Litros', 'Custo']],
                body: tableData,
                theme: 'plain',
                headStyles: {
                    textColor: [51, 65, 85],
                    fontSize: 8,
                    fontStyle: 'bold',
                    fillColor: [255, 255, 255],
                    lineColor: [226, 232, 240],
                    lineWidth: { bottom: 0.5 }
                },
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 30, halign: 'center' },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 25, halign: 'right' },
                    4: { cellWidth: 25, halign: 'right' }
                },
                styles: { fontSize: 8, cellPadding: 3, textColor: [71, 85, 105], lineColor: [241, 245, 249], lineWidth: { bottom: 0.1 } },
                margin: { left: 14, right: 14 }
            });

            yPos = doc.lastAutoTable.finalY + 15;
        });

        // Add page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(\`Página \${i} de \${pageCount}\`, 180, 285);
            doc.text('Tropical Inspire - Gestão de Frota e Oficina', 14, 285);
        }

        doc.save(\`relatorio_custos_\${new Date().toISOString().split('T')[0]}.pdf\`);
    };`;

content = content.replace(regex, replacement);

// 2. Replace button
content = content.replace('onClick={exportIntervalsPDF}', 'onClick={exportCostCenterPDF}');
content = content.replace('Exportar PDF Detalhado', 'PDF por Centro de Custo');

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Successfully updated Combustivel/index.tsx");
