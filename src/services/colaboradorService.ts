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

export interface TransporteEscalaDisponivel {
  id: string;
  data?: string;
  hora?: string;
  origem?: string;
  destino?: string;
  passageiro: string;
}

export interface TransporteQrAccess {
  allowed: boolean;
  escalas: TransporteEscalaDisponivel[];
  message: string;
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

const isMissingEscalaAccessDependencyError = (error: any): boolean => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  const mentionsKnownField =
    message.includes('scale_batches') ||
    message.includes('batch_id') ||
    message.includes('data') ||
    message.includes('status');

  return mentionsKnownField && (
    message.includes('schema cache') ||
    message.includes('column') ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('relation')
  );
};

const normalizeTextForMatch = (value: string): string => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const matchesColaboradorName = (passageiro: string, colaboradorNome: string): boolean => {
  const normalizedPassenger = normalizeTextForMatch(passageiro);
  const normalizedColaborador = normalizeTextForMatch(colaboradorNome);

  if (!normalizedPassenger || !normalizedColaborador) return false;
  if (normalizedPassenger === normalizedColaborador) return true;

  const tokens = normalizedColaborador.split(' ').filter((token) => token.length > 1);
  return tokens.length > 1 && tokens.every((token) => normalizedPassenger.includes(token));
};

const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getEscalaTimeKey = (hora?: string): string => {
  const digits = String(hora || '').replace(/\D/g, '').slice(0, 4);
  return digits.length === 4 ? digits : '0000';
};

const matchesEscalaToRequest = (request: Pick<TransporteCheckinRequest, 'token'>, escala?: Pick<TransporteEscalaDisponivel, 'hora'> | null): boolean => {
  if (!escala?.hora) return false;
  return String(request.token || '').startsWith(getEscalaTimeKey(escala.hora));
};

const generateCheckinToken = (hora?: string): string => {
  const prefix = getEscalaTimeKey(hora);
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${suffix}`;
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
      const { data: ultimaPresenca } = await supabase
        .from('presencas_transporte')
        .select('tipo, data_hora')
        .eq('colaborador_id', colaboradorId)
        .order('data_hora', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaPresenca?.tipo === tipo) {
        const elapsedMs = Math.abs(Date.now() - new Date(ultimaPresenca.data_hora).getTime());
        if (elapsedMs < 2 * 60 * 1000) {
          return true;
        }
      }

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

  async obterAcessoQrTransporte(colaborador: Pick<Colaborador, 'id' | 'nome'>): Promise<TransporteQrAccess> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayKey = formatLocalDateKey(today);
    const tomorrowKey = formatLocalDateKey(tomorrow);

    const mapEscalas = (rows: any[]): TransporteEscalaDisponivel[] => {
      return (rows || [])
        .filter((item: any) => !Boolean(item?.concluido))
        .filter((item: any) => {
          const status = String(item?.status || '').toLowerCase();
          return !status || !['completed', 'cancelled', 'failed'].includes(status);
        })
        .filter((item: any) => matchesColaboradorName(item?.passageiro, colaborador.nome))
        .map((item: any) => ({
          id: String(item?.id || ''),
          data: item?.data || todayKey,
          hora: String(item?.hora || ''),
          origem: String(item?.origem || ''),
          destino: String(item?.destino || ''),
          passageiro: String(item?.passageiro || ''),
        }))
        .filter((item: TransporteEscalaDisponivel) => item.id);
    };

    try {
      let escalas: TransporteEscalaDisponivel[] = [];

      const { data: batches, error: batchesError } = await supabase
        .from('scale_batches')
        .select('id, reference_date')
        .eq('reference_date', todayKey);

      if (!batchesError && (batches || []).length > 0) {
        const batchIds = (batches || []).map((batch: any) => String(batch?.id || '')).filter(Boolean);

        if (batchIds.length > 0) {
          let batchServices: any[] | null = null;
          let batchServicesError: any = null;

          ({ data: batchServices, error: batchServicesError } = await supabase
            .from('servicos')
            .select('id, batch_id, data, hora, origem, destino, passageiro, concluido, status')
            .in('batch_id', batchIds)
            .order('hora', { ascending: true }));

          if (batchServicesError && isMissingEscalaAccessDependencyError(batchServicesError)) {
            ({ data: batchServices, error: batchServicesError } = await supabase
              .from('servicos')
              .select('id, batch_id, hora, origem, destino, passageiro, concluido')
              .in('batch_id', batchIds)
              .order('hora', { ascending: true }));
          }

          if (!batchServicesError) {
            escalas = mapEscalas(batchServices || []);
          }
        }
      } else if (batchesError && !isMissingEscalaAccessDependencyError(batchesError)) {
        console.error('Erro ao consultar lotes de escala:', batchesError);
      }

      if (escalas.length === 0) {
        let data: any[] | null = null;
        let error: any = null;

        ({ data, error } = await supabase
          .from('servicos')
          .select('id, data, hora, origem, destino, passageiro, concluido, status')
          .gte('data', todayKey)
          .lt('data', tomorrowKey)
          .order('hora', { ascending: true }));

        if (error && isMissingEscalaAccessDependencyError(error)) {
          ({ data, error } = await supabase
            .from('servicos')
            .select('id, hora, origem, destino, passageiro, concluido')
            .eq('concluido', false)
            .order('hora', { ascending: true }));
        }

        if (error) {
          console.error('Erro ao verificar escala do colaborador:', error);
          return {
            allowed: false,
            escalas: [],
            message: 'Não foi possível confirmar a sua escala de transporte.'
          };
        }

        escalas = mapEscalas(data || []);
      }

      if (escalas.length === 0) {
        return {
          allowed: false,
          escalas: [],
          message: 'O QR do transporte só fica disponível quando o seu nome constar numa escala ativa.',
        };
      }

      return {
        allowed: true,
        escalas,
        message: 'Acesso ao QR do transporte disponível para a sua escala.',
      };
    } catch (e) {
      console.error('Erro de rede ao verificar acesso ao QR:', e);
      return {
        allowed: false,
        escalas: [],
        message: 'Não foi possível validar o acesso ao transporte agora.',
      };
    }
  },

  async solicitarEntradaComToken(
    colaboradorId: string,
    metodo: 'qr' | 'nfc',
    escala?: TransporteEscalaDisponivel | null
  ): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const { data: colaboradorData, error: colaboradorError } = await supabase
        .from('colaboradores')
        .select('id, nome')
        .eq('id', colaboradorId)
        .maybeSingle();

      if (colaboradorError || !colaboradorData) {
        return { success: false, error: 'Colaborador não encontrado.' };
      }

      const acesso = await ColaboradorService.obterAcessoQrTransporte(normalizeColaborador(colaboradorData));
      if (!acesso.allowed) {
        return { success: false, error: acesso.message };
      }

      const escalaSelecionada = escala
        ? acesso.escalas.find((item) => item.id === escala.id) || acesso.escalas.find((item) => item.hora === escala.hora)
        : acesso.escalas[0];

      if (!escalaSelecionada) {
        return { success: false, error: 'Não foi possível identificar o transporte para este QR.' };
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      const activeRequests = await ColaboradorService.obterSolicitacoesAtivas(colaboradorId);
      const activeForEscala = activeRequests.find((request) => matchesEscalaToRequest(request, escalaSelecionada));

      if (activeForEscala) {
        return { success: true, token: String(activeForEscala.token) };
      }

      const token = generateCheckinToken(escalaSelecionada.hora);
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

  async obterSolicitacoesAtivas(colaboradorId: string): Promise<TransporteCheckinRequest[]> {
    try {
      const { data, error } = await supabase
        .from('transporte_checkins')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (error || !data) return [];

      const now = Date.now();
      const validRequests: TransporteCheckinRequest[] = [];
      const expiredIds: string[] = [];

      for (const item of data as TransporteCheckinRequest[]) {
        if (new Date(item.expires_at).getTime() <= now) {
          expiredIds.push(item.id);
        } else {
          validRequests.push(item);
        }
      }

      if (expiredIds.length > 0) {
        await supabase
          .from('transporte_checkins')
          .update({ status: 'expired' })
          .in('id', expiredIds);
      }

      return validRequests;
    } catch {
      return [];
    }
  },

  async obterSolicitacaoAtiva(colaboradorId: string): Promise<TransporteCheckinRequest | null> {
    const requests = await ColaboradorService.obterSolicitacoesAtivas(colaboradorId);
    return requests[0] || null;
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

      const confirmedAt = new Date().toISOString();
      const { data: latestPresence } = await supabase
        .from('presencas_transporte')
        .select('id, tipo, data_hora')
        .eq('colaborador_id', request.colaborador_id)
        .order('data_hora', { ascending: false })
        .limit(1)
        .maybeSingle();

      const alreadyCheckedIn = latestPresence?.tipo === 'entrada';

      const { data: updatedRequests, error: updateError } = await supabase
        .from('transporte_checkins')
        .update({
          status: 'confirmed',
          confirmed_at: confirmedAt,
          confirmed_by: confirmedBy || null,
        })
        .eq('id', request.id)
        .eq('status', 'pending')
        .select('id');

      if (updateError) {
        return { success: false, error: mapCheckinErrorMessage(updateError, 'Nao foi possivel finalizar a confirmacao do token.') };
      }

      if (!updatedRequests || updatedRequests.length === 0 || alreadyCheckedIn) {
        return { success: true };
      }

      const { error: presencaError } = await supabase.from('presencas_transporte').insert({
        colaborador_id: request.colaborador_id,
        tipo: 'entrada',
        data_hora: confirmedAt,
      });

      if (presencaError) {
        return { success: false, error: 'Nao foi possivel registar a entrada do colaborador.' };
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
