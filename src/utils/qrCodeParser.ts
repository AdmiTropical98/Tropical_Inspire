export interface AtcudData {
    nif_emissor?: string;
    nif_adquirente?: string;
    data_fatura?: string;
    numero_fatura?: string;
    total_base?: number;
    total_impostos?: number;
    total_com_impostos?: number;
}

export const parseAtcudQrCode = (qrData: string): AtcudData | null => {
    if (!qrData || !qrData.includes('*')) return null;

    const parts = qrData.split('*');
    const data: Record<string, string> = {};
    
    parts.forEach(part => {
        const separatorIndex = part.indexOf(':');
        if (separatorIndex !== -1) {
            const key = part.substring(0, separatorIndex);
            const value = part.substring(separatorIndex + 1);
            data[key] = value;
        }
    });

    if (!data['A'] || !data['G']) {
        return null;
    }

    const formatData = (dateStr?: string) => {
        if (!dateStr || dateStr.length !== 8) return undefined;
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    };

    const totalBase = data['N'] ? parseFloat(data['N']) : undefined;
    const totalImpostos = data['O'] ? parseFloat(data['O']) : undefined;
    
    let totalComImpostos = undefined;
    if (totalBase !== undefined && totalImpostos !== undefined) {
        totalComImpostos = totalBase + totalImpostos;
    }

    return {
        nif_emissor: data['A'],
        nif_adquirente: data['B'],
        data_fatura: formatData(data['F']),
        numero_fatura: data['G'],
        total_base: totalBase,
        total_impostos: totalImpostos,
        total_com_impostos: totalComImpostos,
    };
};
