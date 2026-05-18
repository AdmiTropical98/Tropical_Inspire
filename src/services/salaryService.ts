import { supabase } from '../lib/supabase';

export interface SalaryProcessingFilters {
  month: number;
  year: number;
}

export interface SalaryDriver {
  id: string;
  name: string;
  nif: string | null;
  niss: string | null;
  iban: string | null;
  baseSalary: number;
}

export interface SalaryLineInput {
  driverId: string;
  baseSalary: number;
  extraHours: number;
  nightHours: number;
  bonuses: number;
  deductions: number;
}

export interface SalaryLineResult extends SalaryLineInput {
  driverName: string;
  valuePerHour: number;
  extraPay: number;
  nightPay: number;
  grossSalary: number;
  ssDiscount: number;
  irsDiscount: number;
  netSalary: number;
}

type GenericRow = Record<string, unknown>;

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const periodFromDate = (value: unknown): { month: number; year: number } | null => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
};

const rowMatchesPeriod = (row: GenericRow, month: number, year: number): boolean => {
  const monthValue = asNumber(row.reference_month ?? row.month);
  const yearValue = asNumber(row.reference_year ?? row.year);

  if (monthValue > 0 && yearValue > 0) {
    return monthValue === month && yearValue === year;
  }

  const fromReferenceDate = periodFromDate(row.reference_date ?? row.date ?? row.created_at);
  if (!fromReferenceDate) return false;
  return fromReferenceDate.month === month && fromReferenceDate.year === year;
};

const calculateSalaryLineRaw = (input: SalaryLineInput) => {
  const valuePerHour = input.baseSalary / 160;
  const extraPay = input.extraHours * valuePerHour * 1.5;
  const nightPay = input.nightHours * valuePerHour * 1.25;
  const grossSalary = input.baseSalary + extraPay + nightPay + input.bonuses;
  const ssDiscount = grossSalary * 0.11;
  const irsDiscount = grossSalary * 0.12;
  const netSalary = grossSalary - ssDiscount - irsDiscount - input.deductions;

  return {
    valuePerHour,
    extraPay,
    nightPay,
    grossSalary,
    ssDiscount,
    irsDiscount,
    netSalary,
  };
};

export const calculateSalaryLine = (input: SalaryLineInput, driverName: string): SalaryLineResult => {
  const calc = calculateSalaryLineRaw(input);
  return {
    ...input,
    driverName,
    valuePerHour: round2(calc.valuePerHour),
    extraPay: round2(calc.extraPay),
    nightPay: round2(calc.nightPay),
    grossSalary: round2(calc.grossSalary),
    ssDiscount: round2(calc.ssDiscount),
    irsDiscount: round2(calc.irsDiscount),
    netSalary: round2(calc.netSalary),
  };
};

export const fetchDriversForSalary = async (): Promise<SalaryDriver[]> => {
  const { data, error } = await supabase
    .from('motoristas')
    .select('id, nome, vencimento_base, base_salary, nif, niss, iban')
    .order('nome', { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar motoristas: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const baseSalary = asNumber((row as GenericRow).base_salary ?? (row as GenericRow).vencimento_base);
    return {
      id: String((row as GenericRow).id),
      name: String((row as GenericRow).nome ?? 'Motorista sem nome'),
      nif: ((row as GenericRow).nif as string | null) ?? null,
      niss: ((row as GenericRow).niss as string | null) ?? null,
      iban: ((row as GenericRow).iban as string | null) ?? null,
      baseSalary,
    };
  });
};

export const processSalaries = async ({ month, year }: SalaryProcessingFilters): Promise<SalaryLineResult[]> => {
  const [drivers, hoursResult, bonusesResult, deductionsResult] = await Promise.all([
    fetchDriversForSalary(),
    supabase.from('driver_hours').select('*'),
    supabase.from('driver_bonuses').select('*'),
    supabase.from('driver_deductions').select('*'),
  ]);

  if (hoursResult.error) throw new Error(`Erro ao carregar horas: ${hoursResult.error.message}`);
  if (bonusesResult.error) throw new Error(`Erro ao carregar prémios: ${bonusesResult.error.message}`);
  if (deductionsResult.error) throw new Error(`Erro ao carregar descontos: ${deductionsResult.error.message}`);

  const hoursRows = ((hoursResult.data ?? []) as GenericRow[]).filter((row) => rowMatchesPeriod(row, month, year));
  const bonusRows = ((bonusesResult.data ?? []) as GenericRow[]).filter((row) => rowMatchesPeriod(row, month, year));
  const deductionRows = ((deductionsResult.data ?? []) as GenericRow[]).filter((row) => rowMatchesPeriod(row, month, year));

  const extraHoursByDriver = new Map<string, number>();
  const nightHoursByDriver = new Map<string, number>();
  hoursRows.forEach((row) => {
    const driverId = typeof row.driver_id === 'string' ? row.driver_id : '';
    if (!driverId) return;
    extraHoursByDriver.set(driverId, (extraHoursByDriver.get(driverId) ?? 0) + asNumber(row.extra_hours));
    nightHoursByDriver.set(driverId, (nightHoursByDriver.get(driverId) ?? 0) + asNumber(row.night_hours));
  });

  const bonusesByDriver = new Map<string, number>();
  bonusRows.forEach((row) => {
    const driverId = typeof row.driver_id === 'string' ? row.driver_id : '';
    if (!driverId) return;
    bonusesByDriver.set(driverId, (bonusesByDriver.get(driverId) ?? 0) + asNumber(row.amount));
  });

  const deductionsByDriver = new Map<string, number>();
  deductionRows.forEach((row) => {
    const driverId = typeof row.driver_id === 'string' ? row.driver_id : '';
    if (!driverId) return;
    deductionsByDriver.set(driverId, (deductionsByDriver.get(driverId) ?? 0) + asNumber(row.amount));
  });

  return drivers.map((driver) => calculateSalaryLine({
    driverId: driver.id,
    baseSalary: driver.baseSalary,
    extraHours: round2(extraHoursByDriver.get(driver.id) ?? 0),
    nightHours: round2(nightHoursByDriver.get(driver.id) ?? 0),
    bonuses: round2(bonusesByDriver.get(driver.id) ?? 0),
    deductions: round2(deductionsByDriver.get(driver.id) ?? 0),
  }, driver.name));
};

export const saveSalaryRun = async (
  filters: SalaryProcessingFilters,
  lines: SalaryLineResult[],
): Promise<string> => {
  const { data: existingRun, error: existingRunError } = await supabase
    .from('salary_runs')
    .select('id')
    .eq('month', filters.month)
    .eq('year', filters.year)
    .maybeSingle();

  if (existingRunError) {
    throw new Error(`Erro ao validar execução salarial: ${existingRunError.message}`);
  }

  let salaryRunId = existingRun?.id as string | undefined;

  if (!salaryRunId) {
    const { data: createdRun, error: createRunError } = await supabase
      .from('salary_runs')
      .insert({ month: filters.month, year: filters.year })
      .select('id')
      .single();

    if (createRunError) {
      throw new Error(`Erro ao criar execução salarial: ${createRunError.message}`);
    }

    salaryRunId = createdRun.id as string;
  }

  const payload = lines.map((line) => ({
    salary_run_id: salaryRunId,
    driver_id: line.driverId,
    base_salary: line.baseSalary,
    extra_pay: line.extraPay,
    night_pay: line.nightPay,
    bonuses: line.bonuses,
    deductions: line.deductions,
    gross_salary: line.grossSalary,
    ss_discount: line.ssDiscount,
    irs_discount: line.irsDiscount,
    net_salary: line.netSalary,
  }));

  const { error: upsertError } = await supabase
    .from('salary_lines')
    .upsert(payload, { onConflict: 'salary_run_id,driver_id' });

  if (upsertError) {
    throw new Error(`Erro ao guardar linhas salariais: ${upsertError.message}`);
  }

  return salaryRunId;
};
