import { supabase } from '../lib/supabase';

export interface Colaborador {
  id: string;
  numero: string;
  nome: string;
  centro_custo_id?: string;
  status?: 'active' | 'inactive';
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

export interface ColaboradorStats {
  totalUtilizacoes: number;
  utilizacoesMesAtual: number;
  diasAtivosMesAtual: number;
  ultimaUtilizacao: string | null;
}

const normalizeColaborador = (row: any): Colaborador => ({
  id: String(row?.id ?? ''),
  numero: String(row?.numero ?? '').trim(),
  nome: String(row?.nome ?? '').trim() || 'Sem nome',
  centro_custo_id: row?.centro_custo_id || undefined,
  status: row?.status === 'inactive' ? 'inactive' : 'active',
});

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

      if (!data) return null;
      return normalizeColaborador(data);
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

      return (data || []).map(normalizeColaborador).filter((c) => c.id);
    } catch (e) {
      console.error('Erro de rede ao listar colaboradores:', e);
      return [];
    }
  },

  /**
   * Obtém todos os colaboradores (ativos e inativos)
   */
  async listarTodosIncluindoInativos(): Promise<Colaborador[]> {
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Erro ao listar todos os colaboradores:', error);
        return [];
      }

      return (data || []).map(normalizeColaborador).filter((c) => c.id);
    } catch (e) {
      console.error('Erro de rede ao listar todos os colaboradores:', e);
      return [];
    }
  },

  /**
   * Cria colaborador com número definido pelo utilizador
   */
  async criarColaborador(input: {
    numero: string;
    nome: string;
    centro_custo_id?: string;
  }): Promise<{ success: boolean; data?: Colaborador; error?: string }> {
    try {
      const numero = input.numero.trim();
      const nome = input.nome.trim();

      if (!numero || !nome) {
        return { success: false, error: 'Número e nome são obrigatórios.' };
      }

      const { data: existente, error: checkError } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('numero', numero)
        .maybeSingle();

      if (checkError) {
        return { success: false, error: 'Erro ao validar número de colaborador.' };
      }

      if (existente) {
        return { success: false, error: 'Esse número de colaborador já existe.' };
      }

      const { data, error } = await supabase
        .from('colaboradores')
        .insert({
          numero,
          nome,
          centro_custo_id: input.centro_custo_id || null,
          status: 'active',
        })
        .select('*')
        .single();

      if (error) {
        console.error('Erro ao criar colaborador:', error);
        return { success: false, error: 'Não foi possível criar o colaborador.' };
      }

      return { success: true, data: normalizeColaborador(data) };
    } catch (e) {
      console.error('Erro de rede ao criar colaborador:', e);
      return { success: false, error: 'Erro de rede ao criar colaborador.' };
    }
  },

  /**
   * Atualiza dados do colaborador
   */
  async atualizarColaborador(
    id: string,
    input: {
      numero: string;
      nome: string;
      centro_custo_id?: string;
      status?: 'active' | 'inactive';
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const numero = input.numero.trim();
      const nome = input.nome.trim();

      if (!numero || !nome) {
        return { success: false, error: 'Número e nome são obrigatórios.' };
      }

      const { data: existente, error: checkError } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('numero', numero)
        .neq('id', id)
        .maybeSingle();

      if (checkError) {
        return { success: false, error: 'Erro ao validar número de colaborador.' };
      }

      if (existente) {
        return { success: false, error: 'Esse número já está atribuído a outro colaborador.' };
      }

      const { error } = await supabase
        .from('colaboradores')
        .update({
          numero,
          nome,
          centro_custo_id: input.centro_custo_id || null,
          status: input.status || 'active',
        })
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar colaborador:', error);
        return { success: false, error: 'Não foi possível atualizar o colaborador.' };
      }

      return { success: true };
    } catch (e) {
      console.error('Erro de rede ao atualizar colaborador:', e);
      return { success: false, error: 'Erro de rede ao atualizar colaborador.' };
    }
  },

  /**
   * Desativa colaborador mantendo histórico
   */
  async desativarColaborador(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('colaboradores')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) {
        console.error('Erro ao desativar colaborador:', error);
        return { success: false, error: 'Não foi possível desativar o colaborador.' };
      }

      return { success: true };
    } catch (e) {
      console.error('Erro de rede ao desativar colaborador:', e);
      return { success: false, error: 'Erro de rede ao desativar colaborador.' };
    }
  },

  /**
   * Resumo de utilização de transporte para a área do colaborador
   */
  async obterResumoUtilizacao(colaboradorId: string): Promise<ColaboradorStats> {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    try {
      const [{ count: totalUtilizacoes }, { data: dadosMes }, { data: ultima }] = await Promise.all([
        supabase
          .from('presencas_transporte')
          .select('*', { count: 'exact', head: true })
          .eq('colaborador_id', colaboradorId)
          .eq('tipo', 'entrada'),
        supabase
          .from('presencas_transporte')
          .select('data_hora, tipo')
          .eq('colaborador_id', colaboradorId)
          .eq('tipo', 'entrada')
          .gte('data_hora', inicioMes.toISOString()),
        supabase
          .from('presencas_transporte')
          .select('data_hora')
          .eq('colaborador_id', colaboradorId)
          .eq('tipo', 'entrada')
          .order('data_hora', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const dias = new Set(
        (dadosMes || []).map((item) => new Date(item.data_hora).toISOString().slice(0, 10))
      );

      return {
        totalUtilizacoes: totalUtilizacoes || 0,
        utilizacoesMesAtual: (dadosMes || []).length,
        diasAtivosMesAtual: dias.size,
        ultimaUtilizacao: ultima?.data_hora || null,
      };
    } catch (e) {
      console.error('Erro ao obter resumo de utilização:', e);
      return {
        totalUtilizacoes: 0,
        utilizacoesMesAtual: 0,
        diasAtivosMesAtual: 0,
        ultimaUtilizacao: null,
      };
    }
  }
};
