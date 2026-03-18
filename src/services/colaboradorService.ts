import { supabase } from '../lib/supabase';

export interface Colaborador {
  id: string;
  numero: string;
  nome: string;
  centro_custo_id?: string;
}

export interface PresencaTransporte {
  id: string;
  colaborador_id: string;
  viatura_id?: string;
  tipo: 'entrada' | 'saida';
  data_hora: string;
  latitude?: number;
  longitude?: number;
}

export const ColaboradorService = {
  /**
   * Valida o login do colaborador apenas pelo seu número.
   */
  async loginPorNumero(numero: string): Promise<Colaborador | null> {
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('numero', numero)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error('Erro ao procurar colaborador:', error);
        return null;
      }

      return data as Colaborador;
    } catch (e) {
      console.error('Erro de rede ao procurar colaborador:', e);
      return null;
    }
  },

  /**
   * Regista a presença do colaborador (Entrada ou Saída).
   */
  async registarPresenca(
    colaboradorId: string,
    tipo: 'entrada' | 'saida',
    dadosOpcionais?: {
      viaturaId?: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('presencas_transporte').insert({
        colaborador_id: colaboradorId,
        tipo,
        viatura_id: dadosOpcionais?.viaturaId,
        latitude: dadosOpcionais?.latitude,
        longitude: dadosOpcionais?.longitude,
      });

      if (error) {
        console.error('Erro ao registar presença:', error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Erro de rede ao registar presença:', e);
      return false;
    }
  },

  /**
   * Obtém as presenças recentes do colaborador (ex: últimas 5)
   */
  async obterPresencasRecentes(colaboradorId: string, limite: number = 5): Promise<PresencaTransporte[]> {
    try {
      const { data, error } = await supabase
        .from('presencas_transporte')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('data_hora', { ascending: false })
        .limit(limite);

      if (error) {
        console.error('Erro ao obter presenças:', error);
        return [];
      }

      return data as PresencaTransporte[];
    } catch (e) {
      console.error('Erro de rede ao obter presenças:', e);
      return [];
    }
  },

  /**
   * Obtém todos os colaboradores ativos
   */
  async listarTodos(): Promise<Colaborador[]> {
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('status', 'active')
        .order('nome');

      if (error) {
        console.error('Erro ao listar colaboradores:', error);
        return [];
      }

      return data as Colaborador[];
    } catch (e) {
      console.error('Erro de rede ao listar colaboradores:', e);
      return [];
    }
  }
};
