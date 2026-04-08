import { supabase } from '../lib/supabase';

export interface Colaborador {
  id: string;
  numero: string;
  nome: string;
  paragem?: string;
  centro_custo_id?: string;
  status?: 'active' | 'inactive';
}

export interface TransporteCheckinRequest {
  id: string;
  colaborador_id: string;
  token: string;
  metodo: 'qr' | 'nfc';
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  requested_at: string;
  expires_at: string;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
}

export interface TransporteCheckinLookup {
  request: TransporteCheckinRequest;
  colaborador: Colaborador;
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
  paragem: row?.paragem || undefined,
  centro_custo_id: row?.centro_custo_id || undefined,
  status: row?.status === 'inactive' ? 'inactive' : 'active',
});

const isMissingCentroCustoColumnError = (error: any): boolean => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return message.includes('centro_custo_id') && (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column')
  );
};

const isMissingColaboradoresTableError = (error: any): boolean => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return message.includes("could not find the table 'public.colaboradores'") ||
    (message.includes('colaboradores') && message.includes('schema cache')) ||
    (message.includes('relation') && message.includes('colaboradores') && message.includes('does not exist'));
};

const mapColaboradorErrorMessage = (error: any, fallback: string): string => {
  if (isMissingColaboradoresTableError(error)) {
    return 'Tabela de colaboradores em falta na base de dados. Execute o script supabase/create_colaboradores_tables.sql no Supabase.';
  }

  const message = String(error?.message || '').trim();
  return message || fallback;
};

const mapCheckinErrorMessage = (error: any, fallback: string): string => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  if (message.includes("public.transporte_checkins") && message.includes('schema cache')) {
    return 'Tabela de confirmações QR/NFC em falta. Execute o script supabase/add_paragem_and_checkin_flow.sql.';
  }
  return String(error?.message || '').trim() || fallback;
};

const generateCheckinToken = (): string => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

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
    paragem?: string;
  }): Promise<{ success: boolean; data?: Colaborador; error?: string }> {
    try {
      const numero = input.numero.trim();
      const nome = input.nome.trim();

      if (!numero || !nome) {
        return { success: false, error: 'Número e nome são obrigatórios.' };
      }

      // Best-effort uniqueness pre-check. If RLS blocks this read, we still try insert
      // and rely on DB unique constraints for final validation.
      const { data: existente, error: checkError } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('numero', numero)
        .maybeSingle();

      if (!checkError && existente) {
        return { success: false, error: 'Esse número de colaborador já existe.' };
      }

      const insertPayload: Record<string, any> = {
        numero,
        nome,
        status: 'active',
      };
      if (input.paragem) {
        insertPayload.paragem = input.paragem;
      }

      let { data, error } = await supabase
        .from('colaboradores')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error && isMissingCentroCustoColumnError(error)) {
        const { data: retryData, error: retryError } = await supabase
          .from('colaboradores')
          .insert({ numero, nome, status: 'active' })
          .select('*')
          .single();
        data = retryData;
        error = retryError;
      }

      if (error) {
        console.error('Erro ao criar colaborador:', error);
        if (String(error.code) === '23505' || String(error.message || '').toLowerCase().includes('duplicate')) {
          return { success: false, error: 'Esse número de colaborador já existe.' };
        }
        return { success: false, error: mapColaboradorErrorMessage(error, 'Não foi possível criar o colaborador.') };
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
      paragem?: string;
      status?: 'active' | 'inactive';
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const numero = input.numero.trim();
      const nome = input.nome.trim();

      if (!numero || !nome) {
        return { success: false, error: 'Número e nome são obrigatórios.' };
      }

      // Best-effort uniqueness pre-check. If blocked, DB unique constraint still protects updates.
      const { data: existente, error: checkError } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('numero', numero)
        .neq('id', id)
        .maybeSingle();

      if (!checkError && existente) {
        return { success: false, error: 'Esse número já está atribuído a outro colaborador.' };
      }

      const updatePayload: Record<string, any> = {
        numero,
        nome,
        status: input.status || 'active',
      };
      if (input.paragem) {
        updatePayload.paragem = input.paragem;
      }

      let { error } = await supabase
        .from('colaboradores')
        .update(updatePayload)
        .eq('id', id);

      if (error && isMissingCentroCustoColumnError(error)) {
        const { error: retryError } = await supabase
          .from('colaboradores')
          .update({
            numero,
            nome,
            status: input.status || 'active',
          })
          .eq('id', id);
        error = retryError;
      }

      if (error) {
        console.error('Erro ao atualizar colaborador:', error);
        if (String(error.code) === '23505' || String(error.message || '').toLowerCase().includes('duplicate')) {
          return { success: false, error: 'Esse número já está atribuído a outro colaborador.' };
        }
        return { success: false, error: mapColaboradorErrorMessage(error, 'Não foi possível atualizar o colaborador.') };
      }

      return { success: true };
    } catch (e) {
      console.error('Erro de rede ao atualizar colaborador:', e);
      return { success: false, error: 'Erro de rede ao atualizar colaborador.' };
    }
  },

  async solicitarEntradaComToken(
    colaboradorId: string,
    metodo: 'qr' | 'nfc'
  ): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

      const { data: active } = await supabase
        .from('transporte_checkins')
        .select('id, token, expires_at')
        .eq('colaborador_id', colaboradorId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active && new Date(active.expires_at).getTime() > Date.now()) {
        return { success: true, token: String(active.token) };
      }

      const token = generateCheckinToken();
      const { error } = await supabase.from('transporte_checkins').insert({
        colaborador_id: colaboradorId,
        token,
        metodo,
        status: 'pending',
        requested_at: now.toISOString(),
        expires_at: expiresAt,
      });

      if (error) {
        console.error('Erro ao solicitar entrada com token:', error);
        return { success: false, error: mapCheckinErrorMessage(error, 'Nao foi possivel gerar o token.') };
      }

      return { success: true, token };
    } catch (e) {
      console.error('Erro de rede ao solicitar entrada com token:', e);
      return { success: false, error: 'Erro de rede ao gerar token.' };
    }
  },

  async obterSolicitacaoAtiva(colaboradorId: string): Promise<TransporteCheckinRequest | null> {
    try {
      const { data, error } = await supabase
        .from('transporte_checkins')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      if (new Date(data.expires_at).getTime() <= Date.now()) {
        await supabase
          .from('transporte_checkins')
          .update({ status: 'expired' })
          .eq('id', data.id);
        return null;
      }

      return data as TransporteCheckinRequest;
    } catch {
      return null;
    }
  },

  async obterDadosTokenEntrada(token: string): Promise<{ success: boolean; data?: TransporteCheckinLookup; error?: string }> {
    try {
      const code = token.trim();
      if (!code) return { success: false, error: 'Token invalido.' };

      const { data: request, error: requestError } = await supabase
        .from('transporte_checkins')
        .select('*')
        .eq('token', code)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError) {
        return { success: false, error: mapCheckinErrorMessage(requestError, 'Nao foi possivel consultar o token.') };
      }

      if (!request) {
        return { success: false, error: 'Token nao encontrado ou ja utilizado.' };
      }

      if (new Date(request.expires_at).getTime() <= Date.now()) {
        await supabase
          .from('transporte_checkins')
          .update({ status: 'expired' })
          .eq('id', request.id);
        return { success: false, error: 'Token expirado.' };
      }

      const { data: colaboradorData, error: colaboradorError } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('id', request.colaborador_id)
        .maybeSingle();

      if (colaboradorError || !colaboradorData) {
        return { success: false, error: 'Colaborador associado ao token nao encontrado.' };
      }

      return {
        success: true,
        data: {
          request: request as TransporteCheckinRequest,
          colaborador: normalizeColaborador(colaboradorData),
        },
      };
    } catch (e) {
      console.error('Erro ao obter dados do token:', e);
      return { success: false, error: 'Erro de rede ao consultar token.' };
    }
  },

  async confirmarEntradaPorToken(token: string, confirmedBy?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const code = token.trim();
      if (!code) return { success: false, error: 'Token invalido.' };

      const { data: request, error: requestError } = await supabase
        .from('transporte_checkins')
        .select('*')
        .eq('token', code)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError) {
        return { success: false, error: mapCheckinErrorMessage(requestError, 'Nao foi possivel validar o token.') };
      }

      if (!request) {
        return { success: false, error: 'Token nao encontrado ou ja utilizado.' };
      }

      if (new Date(request.expires_at).getTime() <= Date.now()) {
        await supabase
          .from('transporte_checkins')
          .update({ status: 'expired' })
          .eq('id', request.id);
        return { success: false, error: 'Token expirado. O colaborador deve gerar um novo.' };
      }

      const { error: presencaError } = await supabase.from('presencas_transporte').insert({
        colaborador_id: request.colaborador_id,
        tipo: 'entrada',
        data_hora: new Date().toISOString(),
      });

      if (presencaError) {
        return { success: false, error: 'Nao foi possivel registar a entrada do colaborador.' };
      }

      const { error: updateError } = await supabase
        .from('transporte_checkins')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: confirmedBy || null,
        })
        .eq('id', request.id);

      if (updateError) {
        return { success: false, error: mapCheckinErrorMessage(updateError, 'Entrada registada, mas falhou atualizar confirmacao.') };
      }

      return { success: true };
    } catch (e) {
      console.error('Erro de rede ao confirmar entrada por token:', e);
      return { success: false, error: 'Erro de rede ao confirmar token.' };
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
