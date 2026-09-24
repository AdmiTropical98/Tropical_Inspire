# Invoice Engine V2

Novo motor de importação de faturas do Tropical Inspire.

## Objetivo

Separar:

1. leitura do documento;
2. normalização;
3. associação a fornecedor/viatura/requisição/centro de custo;
4. validação;
5. gravação.

O motor é não destrutivo: não apaga nem altera faturas ou requisições existentes.

## Ficheiros

- `types.ts` — modelos do motor.
- `pdfTextParser.ts` — leitura PDF textual, cabeçalho, linhas e totais.
- `entityMatcher.ts` — associação por NIF, matrícula, chassis e requisição.
- `index.ts` — orquestração.

## Integração

O `InvoiceForm` atual NÃO deve ser apagado nesta primeira fase.

Primeiro aplicar a migration e testar o engine isoladamente.

Depois ligar `processInvoice()` ao novo ecrã de revisão.

## Exemplo

```ts
import { processInvoice, toInvoiceDraft } from './services/invoiceEngine';

const result = await processInvoice({
  file,
  suppliers,
  vehicles,
  costCenters,
  requisitions,
  qrData,
});

const draft = toInvoiceDraft(result);
```

O `draft` só deve ser enviado para `addSupplierInvoice()` depois da confirmação do utilizador.

## Teste esperado para a fatura FTA 458126/381

O motor deve procurar:

- número: `FTA 458126/381`
- emissão: `2026-09-16`
- vencimento: `2026-10-16`
- NIF: `504139304`
- matrícula: `80-LM-28`
- chassis: `TW1FC518X06000470`
- total: `1090.02`

E deve preservar os descontos das linhas:
- 15%
- 15%
- 5%

antes de gravar.
