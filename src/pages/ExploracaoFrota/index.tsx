/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { supabase } from '../../lib/supabase';
import {
  Car, Calendar, Wrench, FileText, BarChart3, MapPin, DollarSign,
  TrendingUp, ArrowUp, RefreshCw, Download, FileSpreadsheet, Sparkles, Plus, Edit, Trash2, Paperclip, Bus
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import TransportesEva from '../TransportesEva';



const STORAGE_BUCKETS = ['vehicle-documents', 'uploads', 'documents', 'invoices'];

async function tryUpload(file: File, path: string): Promise<string | null> {
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl ?? null;
      }
    } catch { /* try next bucket */ }
  }
  return null;
}

const CATEGORIES = [
  { id: 'combustivel', label: 'Combustível', color: '#3B82F6' },
  { id: 'reparacao', label: 'Reparações / Oficina', color: '#EF4444' },
  { id: 'manutencao', label: 'Manutenções', color: '#F59E0B' },
  { id: 'seguro', label: 'Seguros', color: '#10B981' },
  { id: 'iuc', label: 'IUC', color: '#8B5CF6' },
  { id: 'ipo', label: 'IPO (Inspeção)', color: '#EC4899' },
  { id: 'pneus', label: 'Pneus', color: '#6366F1' },
  { id: 'portagens', label: 'Portagens', color: '#06B6D4' },
  { id: 'via_verde', label: 'Via Verde', color: '#0284C7' },
  { id: 'lavagem', label: 'Lavagens', color: '#14B8A6' },
  { id: 'leasing', label: 'Leasings', color: '#F472B6' },
  { id: 'ordenados', label: 'Ordenados Motoristas', color: '#22C55E' },
  { id: 'eva', label: 'Alugueres EVA (Autocarros)', color: '#D59D31' },
  { id: 'outros', label: 'Outros Custos', color: '#64748B' }
];

export default function ExploracaoFrota() {
  const { viaturas, motoristas, clientes, requisicoes, centrosCustos, fornecedores } = useWorkshop();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'costs' | 'map' | 'profitability' | 'eva' | 'history' | 'reports'>('dashboard');

  // Filter States
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [periodType, setPeriodType] = useState<'month' | 'year' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString()); // YYYY
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Cost Data States (ONLY vehicle_other_costs + faturas for client billing revenue)
  const [otherCosts, setOtherCosts] = useState<any[]>([]);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [evaTransports, setEvaTransports] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Search filter inside History Tab
  const [historySearch, setHistorySearch] = useState('');

  // Modal / Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [formVehicle, setFormVehicle] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formCategory, setFormCategory] = useState('combustivel');
  const [formDescription, setFormDescription] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formCostCenter, setFormCostCenter] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formKm, setFormKm] = useState('');
  const [formDriver, setFormDriver] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formDocumentUrl, setFormDocumentUrl] = useState('');
  const [uploading, setUploading] = useState(false);



  // Load datasets
  const loadAllData = async () => {
    setLoadingData(true);
    try {
      const [othRes, invRes, evaRes] = await Promise.all([
        supabase.from('vehicle_other_costs').select('*').order('cost_date', { ascending: false }),
        supabase.from('faturas').select('*'),
        supabase.from('eva_transports').select('*')
      ]);

      if (othRes.data) setOtherCosts(othRes.data);
      if (invRes.data) setInvoicesData(invRes.data);
      if (evaRes.data) setEvaTransports(evaRes.data);
    } catch (err) {
      console.error('Erro a carregar dados do Supabase:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compile manual cost items (no automatic calculations / imports)
  const rawCosts = useMemo(() => {
    const list = otherCosts.map(c => {
      // Find driver from database if not explicitly set in the record
      const vehicle = viaturas.find(v => v.id === c.vehicle_id);
      const driver_id = c.driver_id || vehicle?.driver_id;

      // Find client_id by checking active requisition dates for the vehicle
      let client_id = null;
      if (c.cost_date) {
        const itemTime = new Date(c.cost_date).getTime();
        const matchedReq = requisicoes.find(r => {
          const vId = r.viaturaId || (r as any).vehicle_id || (r as any).viatura_id;
          if (vId !== c.vehicle_id) return false;
          const reqTime = new Date(r.data).getTime();
          return Math.abs(itemTime - reqTime) < (24 * 60 * 60 * 1000); // 1 day range
        });
        client_id = matchedReq?.clienteId;
      }

      return {
        id: c.id,
        vehicle_id: c.vehicle_id,
        driver_id: driver_id,
        cost_center_id: c.centro_custo_id,
        fornecedor_id: c.fornecedor_id,
        client_id: client_id,
        category: c.cost_category,
        date: c.cost_date,
        amount: Number(c.amount || 0),
        description: c.description || '',
        notes: c.notes || '',
        km: Number(c.km || 0),
        document_url: c.document_url || '',
        is_eva: false
      };
    });

    // Add EVA Transports as a cost item
    (evaTransports || []).forEach(t => {
      list.push({
        id: `eva-${t.id}`,
        vehicle_id: 'all', // EVA belongs to global fleet
        driver_id: null,
        cost_center_id: null,
        fornecedor_id: null,
        client_id: null,
        category: 'eva',
        date: t.reference_date,
        amount: Number(t.amount || 0),
        description: `Serviço EVA: ${t.route}`,
        notes: t.notes || '',
        km: 0,
        document_url: '',
        is_eva: true
      });
    });

    return list;
  }, [otherCosts, evaTransports, viaturas, requisicoes]);

  // Client side filtering logic
  const filteredCosts = useMemo(() => {
    return rawCosts.filter(item => {
      // Vehicle Filter
      if (selectedVehicle !== 'all' && item.vehicle_id !== selectedVehicle) return false;

      // Driver Filter
      if (selectedDriver !== 'all' && item.driver_id !== selectedDriver) return false;

      // Cost Center Filter
      if (selectedCostCenter !== 'all' && item.cost_center_id !== selectedCostCenter) return false;

      // Client Filter
      if (selectedClient !== 'all' && item.client_id !== selectedClient) return false;

      // Supplier Filter
      if (selectedSupplier !== 'all' && item.fornecedor_id !== selectedSupplier) return false;

      // Date Filter
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      if (periodType === 'month') {
        const [year, month] = selectedMonth.split('-');
        if (itemDate.getFullYear().toString() !== year || (itemDate.getMonth() + 1).toString().padStart(2, '0') !== month) return false;
      } else if (periodType === 'year') {
        if (itemDate.getFullYear().toString() !== selectedYear) return false;
      } else if (periodType === 'custom') {
        if (startDate && itemDate < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && itemDate > new Date(`${endDate}T23:59:59`)) return false;
      }

      return true;
    });
  }, [rawCosts, selectedVehicle, selectedDriver, selectedCostCenter, selectedClient, selectedSupplier, periodType, selectedMonth, selectedYear, startDate, endDate]);

  // Calculate Invoices/Revenue per Vehicle (Revenue is separate, not a cost)
  const vehicleRevenues = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    invoicesData.forEach(inv => {
      if (inv.status === 'anulada') return;

      if (inv.data) {
        const invDate = new Date(inv.data);
        if (periodType === 'month') {
          const [year, month] = selectedMonth.split('-');
          if (invDate.getFullYear().toString() !== year || (invDate.getMonth() + 1).toString().padStart(2, '0') !== month) return;
        } else if (periodType === 'year') {
          if (invDate.getFullYear().toString() !== selectedYear) return;
        } else if (periodType === 'custom') {
          if (startDate && invDate < new Date(`${startDate}T00:00:00`)) return;
          if (endDate && invDate > new Date(`${endDate}T23:59:59`)) return;
        }
      }

      if (selectedClient !== 'all' && inv.clienteId !== selectedClient) return;

      const details = inv.aluguerDetails;
      if (inv.tipo === 'aluguer' && details) {
        const lines = details.viaturas || details.detalhesViaturas || [];
        if (lines.length > 0) {
          lines.forEach((line: any) => {
            if (line.viaturaId) {
              if (selectedVehicle !== 'all' && line.viaturaId !== selectedVehicle) return;
              revenueMap[line.viaturaId] = (revenueMap[line.viaturaId] || 0) + Number(line.total || 0);
            }
          });
        } else {
          const vehicleIds = details.viaturasIds || (details.viaturaId ? [details.viaturaId] : []);
          if (vehicleIds.length > 0) {
            const splitAmt = Number(inv.subtotal || inv.total || 0) / vehicleIds.length;
            vehicleIds.forEach((vId: string) => {
              if (selectedVehicle !== 'all' && vId !== selectedVehicle) return;
              revenueMap[vId] = (revenueMap[vId] || 0) + splitAmt;
            });
          }
        }
      }
    });
    return revenueMap;
  }, [invoicesData, selectedVehicle, selectedClient, periodType, selectedMonth, selectedYear, startDate, endDate]);

  // Aggregate stats for Dashboard Tab (solely from manually input records)
  const dashboardStats = useMemo(() => {
    const totalCost = filteredCosts.reduce((acc, c) => acc + c.amount, 0);

    // Kms calculations: sum of KMs recorded in manual cost logs for selected vehicles
    let totalKms = 0;
    const vehicleIds = selectedVehicle === 'all' ? viaturas.map(v => v.id) : [selectedVehicle];
    
    vehicleIds.forEach(vId => {
      const vKms = rawCosts.filter(c => c.vehicle_id === vId).map(c => Number(c.km || 0));
      if (vKms.length > 0) {
        totalKms += Math.max(...vKms);
      }
    });

    const costPerKm = totalKms > 0 ? (totalCost / totalKms) : 0;

    // Monthly Cost (sum of manual costs for current month)
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const monthlyCost = rawCosts
      .filter(item => item.date?.startsWith(currentMonthStr))
      .reduce((acc, c) => acc + c.amount, 0);

    return {
      totalVehicles: viaturas.length,
      activeVehicles: viaturas.filter(v => v.estado !== 'em_manutencao').length,
      maintVehicles: viaturas.filter(v => v.estado === 'em_manutencao').length,
      totalCost,
      monthlyCost,
      totalKms,
      costPerKm
    };
  }, [filteredCosts, rawCosts, viaturas, selectedVehicle]);



  // Rentabilidade and Rankings strictly on manual costs
  const profitabilityRows = useMemo(() => {
    return viaturas.map(v => {
      const vCosts = rawCosts.filter(c => c.vehicle_id === v.id);
      const totalCost = vCosts.reduce((acc, c) => acc + c.amount, 0);
      const totalRev = vehicleRevenues[v.id] || 0;
      const profit = totalRev - totalCost;
      const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;

      // Find max manual Kms logged
      const vKms = vCosts.map(c => Number(c.km || 0));
      const kms = vKms.length > 0 ? Math.max(...vKms) : 0;

      const costPerKm = kms > 0 ? totalCost / kms : 0;
      const revPerKm = kms > 0 ? totalRev / kms : 0;

      return {
        id: v.id,
        matricula: v.matricula,
        model: `${v.marca} ${v.modelo}`,
        revenue: totalRev,
        cost: totalCost,
        profit,
        margin,
        kms,
        costPerKm,
        revPerKm
      };
    });
  }, [viaturas, rawCosts, vehicleRevenues]);

  const rankings = useMemo(() => {
    const sortedByProfit = [...profitabilityRows].sort((a, b) => b.profit - a.profit);
    const sortedByKms = [...profitabilityRows].sort((a, b) => b.kms - a.kms);
    const sortedByMaint = viaturas.map(v => {
      const maintSum = rawCosts.filter(c => c.vehicle_id === v.id && (c.category === 'manutencao' || c.category === 'reparacao')).reduce((acc, c) => acc + c.amount, 0);
      return { matricula: v.matricula, model: `${v.marca} ${v.modelo}`, cost: maintSum };
    }).sort((a, b) => b.cost - a.cost);

    return {
      mostProfitable: sortedByProfit.slice(0, 5),
      leastProfitable: [...sortedByProfit].reverse().slice(0, 5),
      mostKms: sortedByKms.filter(r => r.kms > 0).slice(0, 5),
      highestMaint: sortedByMaint.filter(r => r.cost > 0).slice(0, 5)
    };
  }, [profitabilityRows, viaturas, rawCosts]);

  // Donut chart categories strictly on manual costs
  const categoryChartData = useMemo(() => {
    const catsMap: Record<string, number> = {};
    filteredCosts.forEach(c => {
      catsMap[c.category] = (catsMap[c.category] || 0) + c.amount;
    });

    return Object.entries(catsMap).map(([key, val]) => {
      const catObj = CATEGORIES.find(cat => cat.id === key);
      return {
        name: catObj?.label || key,
        value: val,
        color: catObj?.color || '#64748B'
      };
    });
  }, [filteredCosts]);

  // Dynamic breakdown of costs by Supplier
  const supplierChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCosts.forEach(c => {
      const sName = fornecedores.find(f => f.id === c.fornecedor_id)?.nome || 'Sem Fornecedor';
      map[sName] = (map[sName] || 0) + c.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredCosts, fornecedores]);

  // Dynamic breakdown of costs by Cost Center
  const costCenterChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCosts.forEach(c => {
      const ccName = centrosCustos.find(cc => cc.id === c.cost_center_id)?.nome || 'Sem Centro de Custo';
      map[ccName] = (map[ccName] || 0) + c.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredCosts, centrosCustos]);

  // Evolution of costs vs revenue monthly
  const monthlyCostRevenueData = useMemo(() => {
    const dataMap: Record<string, { month: string; custos: number; receitas: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      dataMap[key] = { month: key, custos: 0, receitas: 0 };
    }

    filteredCosts.forEach(c => {
      const monthKey = c.date?.slice(0, 7);
      if (dataMap[monthKey]) {
        dataMap[monthKey].custos += c.amount;
      }
    });

    Object.values(vehicleRevenues).forEach(rev => {
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      if (dataMap[currentMonthStr]) {
        dataMap[currentMonthStr].receitas += rev;
      }
    });

    return Object.values(dataMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredCosts, vehicleRevenues]);

  // File Change Storage Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const extension = file.name.split('.').pop();
      const randomName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${extension}`;
      const filePath = `manual_costs/${randomName}`;
      const publicUrl = await tryUpload(file, filePath);
      if (publicUrl) {
        setFormDocumentUrl(publicUrl);
        alert('Documento carregado com sucesso!');
      } else {
        alert('Erro ao carregar o ficheiro no Storage.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Submit form for Manual Cost Record (Insert or Update)
  const handleSubmitCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVehicle) { alert('Selecione uma viatura.'); return; }
    if (!formDate) { alert('Selecione a data do custo.'); return; }
    if (!formCategory) { alert('Selecione uma categoria.'); return; }
    if (!formDescription) { alert('Insira uma descrição.'); return; }
    if (!formAmount || Number(formAmount) <= 0) { alert('Insira um valor superior a 0 €.'); return; }

    const payload: any = {
      vehicle_id: formVehicle,
      cost_category: formCategory,
      cost_date: formDate,
      description: formDescription,
      amount: Number(formAmount),
      km: formKm ? Number(formKm) : null,
      driver_id: formDriver || null,
      fornecedor_id: formSupplier || null,
      centro_custo_id: formCostCenter || null,
      notes: formNotes || null,
      document_url: formDocumentUrl || null
    };

    setLoadingData(true);
    try {
      if (editingRecord) {
        // Update existing record
        const { error } = await supabase
          .from('vehicle_other_costs')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('vehicle_other_costs')
          .insert(payload);
        if (error) throw error;
      }
      setModalOpen(false);
      await loadAllData();
      resetForm();
    } catch (err: any) {
      alert(`Erro ao guardar registo: ${err.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  const handleEditRecord = (rec: any) => {
    setEditingRecord(rec);
    setFormVehicle(rec.vehicle_id);
    setFormDate(rec.date);
    setFormCategory(rec.category);
    setFormDescription(rec.description);
    setFormSupplier(rec.fornecedor_id || '');
    setFormCostCenter(rec.cost_center_id || '');
    setFormAmount(rec.amount.toString());
    setFormKm(rec.km ? rec.km.toString() : '');
    setFormDriver(rec.driver_id || '');
    setFormNotes(rec.notes || '');
    setFormDocumentUrl(rec.document_url || '');
    setModalOpen(true);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Tem a certeza que pretende eliminar este registo de custo?')) return;
    setLoadingData(true);
    try {
      const { error } = await supabase.from('vehicle_other_costs').delete().eq('id', id);
      if (error) throw error;
      await loadAllData();
    } catch (err: any) {
      alert(`Erro ao eliminar registo: ${err.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  const resetForm = () => {
    setEditingRecord(null);
    setFormVehicle('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCategory('combustivel');
    setFormDescription('');
    setFormSupplier('');
    setFormCostCenter('');
    setFormAmount('');
    setFormKm('');
    setFormDriver('');
    setFormNotes('');
    setFormDocumentUrl('');
  };

  // Search filter matching
  const searchedCosts = useMemo(() => {
    if (!historySearch) return filteredCosts;
    const term = historySearch.toLowerCase();
    return filteredCosts.filter(c => {
      const plate = viaturas.find(v => v.id === c.vehicle_id)?.matricula || '';
      const driver = motoristas.find(m => m.id === c.driver_id)?.nome || '';
      const supplier = fornecedores.find(f => f.id === c.fornecedor_id)?.nome || '';
      return (
        plate.toLowerCase().includes(term) ||
        driver.toLowerCase().includes(term) ||
        supplier.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        c.notes.toLowerCase().includes(term)
      );
    });
  }, [filteredCosts, historySearch, viaturas, motoristas, fornecedores]);

  // Export options
  const handleExportExcel = () => {
    const headers = ['Matrícula', 'Data', 'Categoria', 'Fornecedor', 'Centro de Custo', 'Montante (€)', 'Km', 'Descrição', 'Notas'];
    const rows = filteredCosts.map(c => {
      const v = viaturas.find(vit => vit.id === c.vehicle_id);
      const f = fornecedores.find(s => s.id === c.fornecedor_id);
      const cc = centrosCustos.find(x => x.id === c.cost_center_id);
      return [
        v?.matricula || '—',
        c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—',
        c.category.toUpperCase(),
        f?.nome || '—',
        cc?.nome || '—',
        c.amount,
        c.km || '—',
        c.description,
        c.notes
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Custos_Manuais');
    XLSX.writeFile(workbook, `Frota_Custos_Manuais_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportMatrixExcel = () => {
    const data = viaturas.map(v => {
      const vCosts = filteredCosts.filter(c => c.vehicle_id === v.id);
      let total = 0;
      const row: any = { 'Matrícula': v.matricula };
      CATEGORIES.forEach(cat => {
        const val = vCosts.filter(c => c.category === cat.id).reduce((sum, c) => sum + c.amount, 0);
        row[cat.label] = val;
        total += val;
      });
      row['Total'] = total;
      return row;
    });

    // Add Frota Global Row
    const globalCosts = filteredCosts.filter(c => c.vehicle_id === 'all' || !c.vehicle_id);
    let globalTotal = 0;
    const globalRow: any = { 'Matrícula': 'Frota (Global)' };
    CATEGORIES.forEach(cat => {
      const val = globalCosts.filter(c => c.category === cat.id).reduce((sum, c) => sum + c.amount, 0);
      globalRow[cat.label] = val;
      globalTotal += val;
    });
    globalRow['Total'] = globalTotal;
    data.push(globalRow);

    // Add Total Row
    const totalRow: any = { 'Matrícula': 'TOTAL GERAL' };
    let grandTotal = 0;
    CATEGORIES.forEach(cat => {
      const val = filteredCosts.filter(c => c.category === cat.id).reduce((sum, c) => sum + c.amount, 0);
      totalRow[cat.label] = val;
      grandTotal += val;
    });
    totalRow['Total'] = grandTotal;
    data.push(totalRow);

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Matriz Custos');
    XLSX.writeFile(workbook, `matriz_custos_exploracao_${selectedMonth}.xlsx`);
  };

  const handleExportCSV = () => {
    const headers = ['Matrícula', 'Data', 'Categoria', 'Fornecedor', 'Montante', 'Descrição'];
    const rows = filteredCosts.map(c => {
      const v = viaturas.find(vit => vit.id === c.vehicle_id);
      const f = fornecedores.find(s => s.id === c.fornecedor_id);
      return [
        v?.matricula || '—',
        c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—',
        c.category.toUpperCase(),
        f?.nome || '—',
        c.amount.toFixed(2),
        c.description.replace(/;/g, ',')
      ];
    });

    let csvContent = '\uFEFF';
    csvContent += headers.join(';') + '\n';
    rows.forEach(row => { csvContent += row.join(';') + '\n'; });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Frota_Custos_Manuais_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4') as any;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(11, 34, 57);
    doc.text('Relatório Analítico de Custos de Frota', 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Registos Manuais - Gerado em: ${new Date().toLocaleString('pt-PT')}`, 14, 24);

    doc.autoTable({
      startY: 28,
      head: [['Matrícula', 'Data', 'Categoria', 'Fornecedor', 'Valor', 'Descrição']],
      body: filteredCosts.map(c => {
        const v = viaturas.find(vit => vit.id === c.vehicle_id);
        const f = fornecedores.find(s => s.id === c.fornecedor_id);
        return [
          v?.matricula || '—',
          c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—',
          c.category.toUpperCase(),
          f?.nome || '—',
          `${c.amount.toFixed(2)} €`,
          c.description
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [11, 34, 57] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Relatorio_Frota_Custos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="flex flex-col space-y-6 min-h-screen app-content-bg p-4 sm:p-6 lg:p-8">
      {/* Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#0B2239] to-[#1f385c] p-6 rounded-2xl shadow-lg border border-slate-700 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 -translate-y-4 translate-x-4">
          <BarChart3 className="w-64 h-64" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="bg-[#d59d31] text-xs font-black px-2 py-0.5 rounded text-[#0B2239] uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Gestão Manual
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">Exploração da Frota</h1>
          <p className="text-slate-300 text-sm mt-1">
            Painel operacional e financeiro alimentado exclusivamente por registos manuais.
          </p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loadingData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700/80 transition-all font-semibold text-xs active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {/* FILTROS GLOBAIS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-slate-900 font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
          🔍 Filtros Analíticos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Viatura */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-500">Viatura</label>
            <select
              value={selectedVehicle}
              onChange={e => setSelectedVehicle(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#d59d31]"
            >
              <option value="all">Todas as Viaturas</option>
              {viaturas.map(v => (
                <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>

          {/* Motorista */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-500">Motorista</label>
            <select
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#d59d31]"
            >
              <option value="all">Todos os Motoristas</option>
              {motoristas.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          {/* Centro de Custo */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-500">Centro de Custo</label>
            <select
              value={selectedCostCenter}
              onChange={e => setSelectedCostCenter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#d59d31]"
            >
              <option value="all">Todos os Centros</option>
              {centrosCustos.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.name}</option>
              ))}
            </select>
          </div>

          {/* Fornecedor */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-500">Fornecedor</label>
            <select
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#d59d31]"
            >
              <option value="all">Todos os Fornecedores</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          {/* Cliente */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-500">Cliente</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#d59d31]"
            >
              <option value="all">Todos os Clientes</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Tipo Periodo */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-500">Período</label>
            <select
              value={periodType}
              onChange={e => setPeriodType(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#d59d31]"
            >
              <option value="month">Mensal</option>
              <option value="year">Anual</option>
              <option value="custom">Customizado</option>
            </select>
          </div>
        </div>

        {/* Sub-filtros de período */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          {periodType === 'month' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">Mês de Referência:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 font-medium focus:outline-none"
              />
            </div>
          )}

          {periodType === 'year' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">Ano de Referência:</span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 font-medium focus:outline-none"
              >
                {['2024', '2025', '2026', '2027'].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'custom' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">De:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 font-medium focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Até:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 font-medium focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto bg-white rounded-t-2xl px-4 border border-b-0 border-slate-100">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'costs', label: 'Custos', icon: DollarSign },
          { id: 'map', label: 'Mapa de Exploração', icon: MapPin },
          { id: 'profitability', label: 'Rentabilidade', icon: TrendingUp },
          { id: 'eva', label: 'Transportes EVA', icon: Bus },
          { id: 'history', label: 'Histórico', icon: FileText },
          { id: 'reports', label: 'Relatórios', icon: Calendar }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'map') {
                setTimeout(() => { if (mapRef.current) mapRef.current.getViewPort().resize(); }, 200);
              }
            }}
            className={`flex items-center gap-2 px-6 py-4 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0
              ${activeTab === tab.id
                ? 'border-[#d59d31] text-[#0B2239] bg-amber-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TABS CONTENT */}
      {loadingData ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-b-2xl border border-slate-100 shadow-sm space-y-4">
          <RefreshCw className="w-10 h-10 text-[#d59d31] animate-spin" />
          <p className="text-slate-500 font-bold text-sm">A processar dados financeiros...</p>
        </div>
      ) : (
        <div className="bg-white rounded-b-2xl p-6 border border-slate-100 shadow-sm min-h-[500px]">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* KPIs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5"><Car className="w-12 h-12 text-blue-600" /></div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Total Viaturas</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-900">{dashboardStats.totalVehicles}</span>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {dashboardStats.activeVehicles} Ativas
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5"><Wrench className="w-12 h-12 text-orange-500" /></div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Em Manutenção</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-900">{dashboardStats.maintVehicles}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5"><DollarSign className="w-12 h-12 text-[#d59d31]" /></div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Custos Registados</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-[#0B2239]">
                      {dashboardStats.totalCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5"><TrendingUp className="w-12 h-12 text-emerald-500" /></div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Km Percorridos (Manual)</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-900">{dashboardStats.totalKms.toLocaleString()} km</span>
                    <span className="text-xs font-bold text-slate-500">{dashboardStats.costPerKm.toFixed(2)} €/km</span>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 lg:col-span-1">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider mb-4">
                    Distribuição por Categoria
                  </h4>
                  <div className="h-64 relative">
                    {categoryChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={80}
                            paddingAngle={3}
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => `${value.toFixed(2)} €`} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem dados</div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                    {categoryChartData.map(c => (
                      <div key={c.name} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-slate-600 font-medium truncate">{c.name}</span>
                        <span className="text-slate-900 font-bold ml-auto">{c.value.toFixed(0)}€</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 lg:col-span-2">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider mb-4">
                    Evolução Mensal (Custos vs Receitas de Faturas)
                  </h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyCostRevenueData}>
                        <defs>
                          <linearGradient id="colorCustos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => `${value.toFixed(2)} €`} />
                        <Legend />
                        <Area type="monotone" dataKey="custos" stroke="#EF4444" name="Custos Manuais" fillOpacity={1} fill="url(#colorCustos)" />
                        <Area type="monotone" dataKey="receitas" stroke="#10B981" name="Faturação" fillOpacity={1} fill="url(#colorReceitas)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CUSTOS */}
          {activeTab === 'costs' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Supplier breakdown */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider mb-4">
                    Custos por Fornecedor
                  </h4>
                  <div className="h-64">
                    {supplierChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={supplierChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(v: any) => `${v.toFixed(2)} €`} />
                          <Bar dataKey="value" fill="#8B5CF6" name="Custo (€)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem registos</div>
                    )}
                  </div>
                </div>

                {/* Cost Center breakdown */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider mb-4">
                    Custos por Centro de Custo
                  </h4>
                  <div className="h-64">
                    {costCenterChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={costCenterChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(v: any) => `${v.toFixed(2)} €`} />
                          <Bar dataKey="value" fill="#EC4899" name="Custo (€)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem registos</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table list per vehicle */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100"><h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider">Matriz de Custos por Viatura</h4></div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase">Matrícula</th>
                        <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase">Combustível</th>
                        <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase">Manutenção/Reparação</th>
                        <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase">Seguros</th>
                        <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase">IUC/IPO</th>
                        <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase">Portagens</th>
                        <th className="px-6 py-3 text-xs font-black text-slate-500 uppercase text-right">Total Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                      {viaturas.map(v => {
                        const vCosts = filteredCosts.filter(c => c.vehicle_id === v.id);
                        const fSum = vCosts.filter(c => c.category === 'combustivel').reduce((acc, c) => acc + c.amount, 0);
                        const mSum = vCosts.filter(c => c.category === 'manutencao' || c.category === 'reparacao').reduce((acc, c) => acc + c.amount, 0);
                        const sSum = vCosts.filter(c => c.category === 'seguro').reduce((acc, c) => acc + c.amount, 0);
                        const iSum = vCosts.filter(c => c.category === 'iuc' || c.category === 'ipo').reduce((acc, c) => acc + c.amount, 0);
                        const tSum = vCosts.filter(c => c.category === 'portagens').reduce((acc, c) => acc + c.amount, 0);
                        const total = fSum + mSum + sSum + iSum + tSum;

                        if (total === 0) return null;

                        return (
                          <tr key={v.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3 font-bold text-[#0B2239]">{v.matricula}</td>
                            <td className="px-6 py-3">{fSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{mSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{sSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{(iSum).toFixed(2)} €</td>
                            <td className="px-6 py-3">{tSum.toFixed(2)} €</td>
                            <td className="px-6 py-3 font-black text-slate-900 text-right">{total.toFixed(2)} €</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MAPA DE EXPLORAÇÃO */}
          {activeTab === 'map' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h4 className="font-extrabold text-sm text-[#0B2239] uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-[#d59d31]" />
                    Matriz de Custos de Exploração
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Consolidação de todos os gastos da frota distribuídos por viatura e categoria no período selecionado.</p>
                </div>
                <button
                  onClick={handleExportMatrixExcel}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 w-full sm:w-auto"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Matriz (Excel)
                </button>
              </div>

              {/* Matrix Spreadsheet Grid */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Viatura / Matrícula</th>
                      {CATEGORIES.map(cat => (
                        <th key={cat.id} className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-right border-r border-slate-200" style={{ minWidth: '110px' }}>
                          {cat.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-right bg-slate-100/80 font-bold" style={{ minWidth: '120px' }}>Total Viatura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold font-mono">
                    {/* Render rows for each vehicle */}
                    {viaturas.map(v => {
                      const vCosts = filteredCosts.filter(c => c.vehicle_id === v.id);
                      let rowTotal = 0;

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/50">
                          <td 
                            onClick={() => { setSelectedVehicle(v.id); setActiveTab('costs'); }}
                            className="px-4 py-3 font-bold text-[#0B2239] font-sans sticky left-0 bg-white z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:underline"
                            title="Filtrar custos por esta viatura"
                          >
                            {v.matricula}
                          </td>
                          {CATEGORIES.map(cat => {
                            const val = vCosts.filter(c => c.category === cat.id).reduce((sum, c) => sum + c.amount, 0);
                            rowTotal += val;
                            return (
                              <td key={cat.id} className="px-4 py-3 text-right border-r border-slate-200">
                                {val > 0 ? `${val.toFixed(2)} €` : '—'}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right bg-slate-50/50 font-black text-[#0B2239]">
                            {rowTotal > 0 ? `${rowTotal.toFixed(2)} €` : '—'}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Special Row: Frota (Global) */}
                    {(() => {
                      const globalCosts = filteredCosts.filter(c => c.vehicle_id === 'all' || !c.vehicle_id);
                      let rowTotal = 0;
                      return (
                        <tr className="hover:bg-slate-50/50 bg-slate-50/30">
                          <td className="px-4 py-3 font-bold text-slate-500 font-sans sticky left-0 bg-slate-50/30 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            Frota (Global)
                          </td>
                          {CATEGORIES.map(cat => {
                            const val = globalCosts.filter(c => c.category === cat.id).reduce((sum, c) => sum + c.amount, 0);
                            rowTotal += val;
                            return (
                              <td key={cat.id} className="px-4 py-3 text-right border-r border-slate-200">
                                {val > 0 ? `${val.toFixed(2)} €` : '—'}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right bg-slate-50/50 font-black text-slate-500">
                            {rowTotal > 0 ? `${rowTotal.toFixed(2)} €` : '—'}
                          </td>
                        </tr>
                      );
                    })()}

                    {/* Total Row */}
                    <tr className="bg-slate-100 font-black text-xs text-[#0B2239] border-t-2 border-slate-200">
                      <td className="px-4 py-3 font-bold font-sans sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                        TOTAL GERAL
                      </td>
                      {CATEGORIES.map(cat => {
                        const val = filteredCosts.filter(c => c.category === cat.id).reduce((sum, c) => sum + c.amount, 0);
                        return (
                          <td key={cat.id} className="px-4 py-3 text-right border-r border-slate-200">
                            {val > 0 ? `${val.toFixed(2)} €` : '—'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right bg-slate-200/80 font-black">
                        {filteredCosts.reduce((sum, c) => sum + c.amount, 0).toFixed(2)} €
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: RENTABILIDADE */}
          {activeTab === 'profitability' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Viatura</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Faturação (Receita)</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Custos Manuais</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Lucro Líquido</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Margem</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Kms (Logs)</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase text-right">Custo / KM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                    {profitabilityRows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-bold text-[#0B2239]">{row.matricula}</td>
                        <td className="px-6 py-3 text-emerald-600 font-bold">{row.revenue.toFixed(2)} €</td>
                        <td className="px-6 py-3 text-slate-600">{row.cost.toFixed(2)} €</td>
                        <td className={`px-6 py-3 font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.profit.toFixed(2)} €
                        </td>
                        <td className={`px-6 py-3 ${row.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.margin.toFixed(1)} %
                        </td>
                        <td className="px-6 py-3">{row.kms > 0 ? `${row.kms.toLocaleString()} km` : '—'}</td>
                        <td className="px-6 py-3 font-bold text-slate-900 text-right">
                          {row.costPerKm > 0 ? `${row.costPerKm.toFixed(2)} €/km` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rankings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-emerald-500" /> Mais Lucrativos
                  </h4>
                  <div className="space-y-3">
                    {rankings.mostProfitable.map((v, idx) => (
                      <div key={v.id} className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">#{idx+1}</span>
                        <span className="text-slate-800 font-bold">{v.matricula}</span>
                        <span className="text-emerald-600 font-black ml-auto">{v.profit.toFixed(0)}€</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-500" /> Maior Quilometragem (Manual)
                  </h4>
                  <div className="space-y-3">
                    {rankings.mostKms.map((v, idx) => (
                      <div key={v.id} className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">#{idx+1}</span>
                        <span className="text-slate-800 font-bold">{v.matricula}</span>
                        <span className="text-slate-800 font-black ml-auto">{v.kms.toLocaleString()} km</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-orange-500" /> Manutenção & Reparações
                  </h4>
                  <div className="space-y-3">
                    {rankings.highestMaint.map((v, idx) => (
                      <div key={v.matricula} className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">#{idx+1}</span>
                        <span className="text-slate-800 font-bold">{v.matricula}</span>
                        <span className="text-slate-900 font-black ml-auto">{v.cost.toFixed(0)}€</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: HISTÓRICO / GESTÃO DE CUSTOS */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Search className="w-4 h-4" /></span>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Pesquisar matrícula, fornecedor, descrição..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#d59d31]"
                  />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button
                    onClick={() => { resetForm(); setModalOpen(true); }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#d59d31] hover:bg-[#c28c27] text-white rounded-xl text-xs font-bold transition-all active:scale-95 ml-auto w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Custo
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Viatura</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Data</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Categoria</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Fornecedor</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Descrição</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Valor</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Doc</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                    {searchedCosts.length > 0 ? (
                      searchedCosts.map(c => {
                        const v = viaturas.find(vit => vit.id === c.vehicle_id);
                        const f = fornecedores.find(s => s.id === c.fornecedor_id);
                        const catLabel = CATEGORIES.find(cat => cat.id === c.category)?.label || c.category;

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3 font-bold text-[#0B2239]">{c.is_eva ? 'Frota (EVA)' : (v?.matricula || '—')}</td>
                            <td className="px-6 py-3 text-xs">{c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—'}</td>
                            <td className="px-6 py-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                {catLabel}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-600 text-xs truncate max-w-[120px]">{f?.nome || '—'}</td>
                            <td className="px-6 py-3 text-slate-500 text-xs truncate max-w-[180px]" title={c.description}>{c.description}</td>
                            <td className="px-6 py-3 font-black text-slate-900">{c.amount.toFixed(2)} €</td>
                            <td className="px-6 py-3">
                              {c.document_url ? (
                                <a href={c.document_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs">
                                  <Paperclip className="w-3.5 h-3.5" /> PDF
                                </a>
                              ) : '—'}
                            </td>
                            <td className="px-6 py-3 text-right">
                              {c.is_eva ? (
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none pr-2" title="Registo gerido na página de Transportes EVA">EVA</span>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => handleEditRecord(c)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all"><Edit className="w-4 h-4" /></button>
                                  <button onClick={() => handleDeleteRecord(c.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-rose-500 hover:text-rose-700 transition-all"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={8} className="text-center p-8 text-slate-400 font-bold text-xs">Nenhum registo financeiro manual encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: TRANSPORTES EVA */}
          {activeTab === 'eva' && (
            <div className="animate-in fade-in duration-300">
              <TransportesEva isTab={true} selectedMonthProp={selectedMonth} setSelectedMonthProp={setSelectedMonth} />
            </div>
          )}

          {/* TAB: RELATÓRIOS */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider">Centro de Relatórios Financeiros Manuais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between h-48 hover:shadow-md transition-all">
                  <div>
                    <h5 className="font-extrabold text-base text-[#0B2239] flex items-center gap-2"><FileText className="w-5 h-5 text-rose-500" /> Exportação Executiva (PDF)</h5>
                    <p className="text-slate-500 text-xs mt-2">Gere um documento PDF contendo a listagem analítica e consolidação das despesas introduzidas manualmente no sistema.</p>
                  </div>
                  <button onClick={handleExportPDF} className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs">Descarregar PDF</button>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between h-48 hover:shadow-md transition-all">
                  <div>
                    <h5 className="font-extrabold text-base text-[#0B2239] flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Folha de Cálculo (Excel)</h5>
                    <p className="text-slate-500 text-xs mt-2">Exporte todas as despesas em formato XLSX para integração noutros sistemas ERP ou análises adicionais.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleExportCSV} className="py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-xs">CSV</button>
                    <button onClick={handleExportExcel} className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs">Excel (XLSX)</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: REGISTAR / EDITAR CUSTO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 relative flex flex-col max-h-[90%] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-black text-lg text-[#0B2239]">
                {editingRecord ? 'Editar Registo de Custo' : 'Registar Novo Custo Manual'}
              </h3>
              <button onClick={() => { setModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSubmitCost} className="space-y-4 overflow-y-auto pr-1 flex-1 text-slate-700">
              {/* Viatura */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500">Viatura *</label>
                <select
                  value={formVehicle}
                  onChange={e => setFormVehicle(e.target.value)}
                  required
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                >
                  <option value="">Selecione a Viatura...</option>
                  {viaturas.map(v => (
                    <option key={v.id} value={v.id}>{v.matricula} - {v.marca} {v.modelo}</option>
                  ))}
                </select>
              </div>

              {/* Data & Categoria */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500">Data *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500">Categoria *</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    required
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                  >
                    {CATEGORIES.filter(cat => cat.id !== 'eva').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500">Descrição *</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Ex: Abastecimento de combustível, Mudança de óleo..."
                  required
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                />
              </div>

              {/* Fornecedor & Centro de Custo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500">Fornecedor (Opcional)</label>
                  <select
                    value={formSupplier}
                    onChange={e => setFormSupplier(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                  >
                    <option value="">Nenhum...</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500">Centro de Custo (Opcional)</label>
                  <select
                    value={formCostCenter}
                    onChange={e => setFormCostCenter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                  >
                    <option value="">Nenhum...</option>
                    {centrosCustos.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Valor & Km */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500">Valor (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500">Quilómetros (Opcional)</label>
                  <input
                    type="number"
                    value={formKm}
                    onChange={e => setFormKm(e.target.value)}
                    placeholder="Quilometragem..."
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                  />
                </div>
              </div>

              {/* Motorista */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500">Motorista Associado (Opcional)</label>
                <select
                  value={formDriver}
                  onChange={e => setFormDriver(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                >
                  <option value="">Nenhum...</option>
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>

              {/* Observações */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500">Observações (Opcional)</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d59d31]"
                  placeholder="Notas adicionais sobre a despesa..."
                />
              </div>

              {/* Anexos */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500">Anexo (Fatura, Foto ou PDF)</label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="cost-attachment"
                    accept="application/pdf,image/*"
                  />
                  <label
                    htmlFor="cost-attachment"
                    className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-slate-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50 transition-all select-none"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Escolher ficheiro
                  </label>
                  <input
                    type="text"
                    value={formDocumentUrl}
                    onChange={e => setFormDocumentUrl(e.target.value)}
                    placeholder="Ou cole o URL do documento..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#d59d31]"
                  />
                </div>
                {uploading && <p className="text-[10px] text-orange-500 font-bold animate-pulse">A carregar ficheiro...</p>}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); resetForm(); }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-[#d59d31] hover:bg-[#c28c27] text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
                >
                  {editingRecord ? 'Atualizar Custo' : 'Guardar Custo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
