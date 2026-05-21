export interface Fornecedor {
  id: string;
  nome: string;
  categoria: string;
  estado: 'ativo' | 'inativo';
  nif: string;
  morada: string;
  email: string;
  iban: string;
  contactos: string[];
  documentos: string[];
  historico: string[];
  notas: string;
  avaliacoes: number[];
  pagamentos: string[];
  requisicoes: string[];
}
