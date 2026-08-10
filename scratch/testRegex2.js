const afterProduct = "68,41 1,659 -0,120 1,539 23,00 85,57 19,68 105,25\nTotal do Cartao 182,17 227,87 52,40 280,27";
const stopWords = /(TOTAL\s+DO\s+CART[ÃA]O|RESUMO\s+DO\s+IVA|TOTAL\s+FATURA|TOTAL\s+A\s+TRANSPORTAR|SUBTOTAL|TOTAL\s+GERAL|RESUMO\s+DE\s+PRODUTOS|P[ÁA]GINA)/i;
const stopMatch = afterProduct.match(stopWords);
const cleanAfterProduct = stopMatch ? afterProduct.slice(0, stopMatch.index) : afterProduct;
console.log("CLEAN:", cleanAfterProduct);

const cleanNumberToken = (val) => val.trim().replace(/%/g, '') === '-' ? '0' : val.trim().replace(/%/g, '');
const parseEU = (val) => {
    if (!val) return 0;
    let s = val.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};

const decimalTokens = (cleanAfterProduct.slice(0, 120).match(/-?\d{1,3}(?:\.\d{3})*,\d+|-?\d+,\d+/g) || [])
    .map(cleanNumberToken)
    .filter(t => t.includes(','));

console.log("DECIMAL TOKENS:", decimalTokens);
console.log("TOTAL:", parseEU(decimalTokens[decimalTokens.length - 1]));
