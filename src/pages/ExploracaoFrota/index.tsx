/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { supabase } from '../../lib/supabase';
import {
  Car, Calendar, Wrench, FileText, BarChart3, MapPin, DollarSign,
  TrendingUp, Fuel, ArrowUp, RefreshCw, Download, Map as MapIcon, FileSpreadsheet, Sparkles
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// HERE Maps Types and Global
const H = (window as any).H;
const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY;

interface FlatCostItem {
  id: string;
  vehicle_id: string;
  driver_id?: string;
  cost_center_id?: string;
  client_id?: string;
  category: 'combustivel' | 'reparacao' | 'manutencao' | 'seguro' | 'iuc' | 'ipo' | 'pneus' | 'portagens' | 'lavagem' | 'outros';
  date: string;
  amount: number;
  description: string;
}

export default function ExploracaoFrota() {
  const { viaturas, motoristas, clientes, locais, geofences, cartrackVehicles, requisicoes, centrosCustos } = useWorkshop();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'costs' | 'map' | 'profitability' | 'history' | 'reports'>('dashboard');

  // Filter States
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [periodType, setPeriodType] = useState<'month' | 'year' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString()); // YYYY
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Cost Data States
  const [insurance, setInsurance] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [iucs, setIucs] = useState<any[]>([]);
  const [otherCosts, setOtherCosts] = useState<any[]>([]);
  const [fuelTx, setFuelTx] = useState<any[]>([]);
  const [tollsData, setTollsData] = useState<any[]>([]);
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [profileSummaries, setProfileSummaries] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Map States
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const geofencesGroupRef = useRef<any>(null);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<'normal' | 'satellite'>('normal');
  const [showTraffic, setShowTraffic] = useState<boolean>(false);
  const trafficFlowLayerRef = useRef<any>(null);
  const trafficIncidentsLayerRef = useRef<any>(null);

  // Load datasets
  const loadAllData = async () => {
    setLoadingData(true);
    try {
      const [
        insRes,
        ipRes,
        iucRes,
        othRes,
        fuelRes,
        tollRes,
        maintRes,
        invRes,
        profRes
      ] = await Promise.all([
        supabase.from('vehicle_insurance_policies').select('*'),
        supabase.from('vehicle_inspections').select('*'),
        supabase.from('vehicle_iuc_records').select('*'),
        supabase.from('vehicle_other_costs').select('*'),
        supabase.from('fuel_transactions').select('*'),
        supabase.from('via_verde_toll_records').select('*'),
        supabase.from('manutencoes').select('*'),
        supabase.from('faturas').select('*'),
        supabase.from('vehicle_profile_summary').select('*')
      ]);

      if (insRes.data) setInsurance(insRes.data);
      if (ipRes.data) setInspections(ipRes.data);
      if (iucRes.data) setIucs(iucRes.data);
      if (othRes.data) setOtherCosts(othRes.data);
      if (fuelRes.data) setFuelTx(fuelRes.data);
      if (tollRes.data) setTollsData(tollRes.data);
      if (maintRes.data) setMaintenances(maintRes.data);
      if (invRes.data) setInvoicesData(invRes.data);
      if (profRes.data) setProfileSummaries(profRes.data);
    } catch (err) {
      console.error('Erro a carregar dados do Supabase:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compile cost items into a flat table for easy parsing
  const rawCosts = useMemo(() => {
    const list: FlatCostItem[] = [];

    fuelTx.forEach(t => {
      list.push({
        id: `fuel-${t.id}`,
        vehicle_id: t.vehicle_id || t.vehicleId,
        driver_id: t.driver_id || t.driverId,
        category: 'combustivel',
        date: t.timestamp || t.created_at,
        amount: Number(t.total_cost || t.totalCost || 0),
        description: `Abastecimento ${(t.liters || 0).toFixed(1)}L - ${t.station || 'Sem posto'}`
      });
    });

    maintenances.forEach(m => {
      list.push({
        id: `maint-${m.id}`,
        vehicle_id: m.vehicle_id || m.viaturaId,
        driver_id: m.driver_id,
        category: (m.tipo === 'corretiva' ? 'reparacao' : 'manutencao'),
        date: m.data,
        amount: Number(m.custo || 0),
        description: `Manutenção ${m.tipo} - ${m.oficina || 'Oficina'}: ${m.descricao || ''}`
      });
    });

    insurance.forEach(i => {
      list.push({
        id: `ins-${i.id}`,
        vehicle_id: i.vehicle_id,
        category: 'seguro',
        date: i.start_date,
        amount: Number(i.premium_amount || 0),
        description: `Seguro ${i.insurer} - Apólice ${i.policy_number}`
      });
    });

    inspections.forEach(i => {
      list.push({
        id: `ipo-${i.id}`,
        vehicle_id: i.vehicle_id,
        category: 'ipo',
        date: i.inspection_date,
        amount: Number(i.cost || 0),
        description: `Inspeção IPO - Resultado: ${i.result || 'aprovado'}`
      });
    });

    iucs.forEach(i => {
      list.push({
        id: `iuc-${i.id}`,
        vehicle_id: i.vehicle_id,
        category: 'iuc',
        date: i.payment_date || i.due_date || `${i.fiscal_year}-01-01`,
        amount: Number(i.amount || 0),
        description: `IUC Ano Fiscal ${i.fiscal_year}`
      });
    });

    otherCosts.forEach(o => {
      let cat: FlatCostItem['category'] = 'outros';
      if (o.cost_category === 'lavagem') cat = 'lavagem';
      else if (o.cost_category === 'pneus') cat = 'pneus';
      else if (o.cost_category === 'reparacao_extraordinaria' || o.cost_category === 'pecas') cat = 'reparacao';

      list.push({
        id: `oth-${o.id}`,
        vehicle_id: o.vehicle_id,
        driver_id: o.driver_id,
        category: cat,
        date: o.cost_date,
        amount: Number(o.amount || 0),
        description: `${o.cost_category.toUpperCase()} - ${o.description || ''}`
      });
    });

    tollsData.forEach(t => {
      list.push({
        id: `toll-${t.id}`,
        vehicle_id: t.vehicle_id,
        driver_id: t.driver_id,
        category: 'portagens',
        date: t.transit_datetime,
        amount: Number(t.amount || 0),
        description: `Portagem: ${t.entry_station || 'Entrada'} -> ${t.exit_station || 'Saída'}`
      });
    });

    return list;
  }, [fuelTx, maintenances, insurance, inspections, iucs, otherCosts, tollsData]);

  // Enrich costs with driver, client, and cost center
  const enrichedCosts = useMemo(() => {
    return rawCosts.map(item => {
      const vehicle = viaturas.find(v => v.id === item.vehicle_id);
      const cost_center_id = item.cost_center_id || vehicle?.centro_custo_id;
      const driver_id = item.driver_id || vehicle?.driver_id;

      // Find client_id by checking active requisition dates
      let client_id = item.client_id;
      if (!client_id && item.date) {
        const itemTime = new Date(item.date).getTime();
        const matchedReq = requisicoes.find(r => {
          const vId = r.viaturaId || (r as any).vehicle_id || (r as any).viatura_id;
          if (vId !== item.vehicle_id) return false;
          const reqTime = new Date(r.data).getTime();
          return Math.abs(itemTime - reqTime) < (24 * 60 * 60 * 1000); // 1 day range
        });
        client_id = matchedReq?.clienteId;
      }

      return {
        ...item,
        cost_center_id,
        driver_id,
        client_id
      };
    });
  }, [rawCosts, viaturas, requisicoes]);

  // Client side filtering logic
  const filteredCosts = useMemo(() => {
    return enrichedCosts.filter(item => {
      // Vehicle Filter
      if (selectedVehicle !== 'all' && item.vehicle_id !== selectedVehicle) return false;

      // Driver Filter
      if (selectedDriver !== 'all' && item.driver_id !== selectedDriver) return false;

      // Cost Center Filter
      if (selectedCostCenter !== 'all' && item.cost_center_id !== selectedCostCenter) return false;

      // Client Filter
      if (selectedClient !== 'all' && item.client_id !== selectedClient) return false;

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
  }, [enrichedCosts, selectedVehicle, selectedDriver, selectedCostCenter, selectedClient, periodType, selectedMonth, selectedYear, startDate, endDate]);

  // Calculate Invoices/Revenue per Vehicle
  const vehicleRevenues = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    invoicesData.forEach(inv => {
      if (inv.status === 'anulada') return;

      // Filter by period if needed
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

  // Aggregate stats for Dashboard Tab
  const dashboardStats = useMemo(() => {
    const totalCost = filteredCosts.reduce((acc, c) => acc + c.amount, 0);

    // Kms calculations
    let totalKms = 0;
    const activeVehicles = viaturas.filter(v => v.estado !== 'em_manutencao');
    const maintVehicles = viaturas.filter(v => v.estado === 'em_manutencao');

    const filteredVehicleIds = selectedVehicle === 'all'
      ? viaturas.map(v => v.id)
      : [selectedVehicle];

    filteredVehicleIds.forEach(vId => {
      const summary = profileSummaries.find(s => s.vehicle_id === vId);
      if (summary) {
        totalKms += Number(summary.km_travelled || 0);
      }
    });

    const averageCons = selectedVehicle === 'all'
      ? (profileSummaries.reduce((acc, s) => acc + Number(s.average_consumption || 0), 0) / (profileSummaries.length || 1))
      : Number(profileSummaries.find(s => s.vehicle_id === selectedVehicle)?.average_consumption || 0);

    const costPerKm = totalKms > 0 ? (totalCost / totalKms) : 0;

    // Monthly Cost
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const monthlyCost = enrichedCosts
      .filter(item => item.date?.startsWith(currentMonthStr))
      .reduce((acc, c) => acc + c.amount, 0);

    return {
      totalVehicles: viaturas.length,
      activeVehicles: activeVehicles.length,
      maintVehicles: maintVehicles.length,
      totalCost,
      monthlyCost,
      totalKms,
      averageCons,
      costPerKm
    };
  }, [filteredCosts, enrichedCosts, viaturas, profileSummaries, selectedVehicle]);

  // Map: HERE Maps drawing hook
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      if (!HERE_API_KEY) {
        console.error('VITE_HERE_API_KEY not configured.');
        return;
      }
      try {
        const platform = new H.service.Platform({ apikey: HERE_API_KEY });
        const defaultLayers = platform.createDefaultLayers({
          engineType: H.Map.EngineType.VECTOR
        });

        const map = new H.Map(
          mapContainerRef.current,
          defaultLayers.vector.normal.map,
          {
            center: { lat: 37.0891, lng: -8.2479 }, // Algarve/Loulé area center
            zoom: 9,
            pixelRatio: window.devicePixelRatio || 1
          }
        );

        window.addEventListener('resize', () => map.getViewPort().resize());
        new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
        const ui = H.ui.UI.createDefault(map, defaultLayers, 'pt-PT');

        mapRef.current = map;
        uiRef.current = ui;

        // Track traffic layers
        trafficFlowLayerRef.current = defaultLayers.vector.normal.trafficflow || null;
        trafficIncidentsLayerRef.current = defaultLayers.vector.normal.trafficincidents || null;
      } catch (err) {
        console.error('Erro a inicializar mapa HERE:', err);
      }
    }

    return () => {
      // Keep map alive during tab transitions
    };
  }, []);

  // Update map style and layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const platform = new H.service.Platform({ apikey: HERE_API_KEY });
    const defaultLayers = platform.createDefaultLayers({
      engineType: H.Map.EngineType.VECTOR
    });

    if (mapStyle === 'satellite') {
      map.setBaseLayer(defaultLayers.vector.satellite.map);
    } else {
      map.setBaseLayer(defaultLayers.vector.normal.map);
    }
  }, [mapStyle]);

  // Toggle Traffic Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showTraffic) {
      if (trafficFlowLayerRef.current) map.addLayer(trafficFlowLayerRef.current);
      if (trafficIncidentsLayerRef.current) map.addLayer(trafficIncidentsLayerRef.current);
    } else {
      if (trafficFlowLayerRef.current) map.removeLayer(trafficFlowLayerRef.current);
      if (trafficIncidentsLayerRef.current) map.removeLayer(trafficIncidentsLayerRef.current);
    }
  }, [showTraffic]);

  // Re-draw Markers & Geofences on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old elements
    if (markersGroupRef.current) map.removeObject(markersGroupRef.current);
    if (geofencesGroupRef.current) map.removeObject(geofencesGroupRef.current);

    const markersGroup = new H.map.Group();
    const geofencesGroup = new H.map.Group();

    // 1. Draw Vehicles
    const visibleVehicles = selectedVehicle === 'all'
      ? viaturas
      : viaturas.filter(v => v.id === selectedVehicle);

    visibleVehicles.forEach(v => {
      const live = cartrackVehicles.find(cv => cv.registration.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === v.matricula.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
      if (live && live.latitude && live.longitude) {
        const isIgnOn = live.ignition;
        const color = isIgnOn ? '#10B981' : '#6B7280'; // Green vs gray
        const speedText = live.speed > 0 ? `${Math.round(live.speed)} km/h` : 'Parado';

        const markerHtml = `
          <div style="background:${color}; padding:6px 10px; border-radius:6px; border:2px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.35); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:sans-serif; font-size:11px; font-weight:bold; min-width:80px;">
            <span>${v.matricula}</span>
            <span style="font-size:9px; opacity:0.9; margin-top:2px;">${speedText}</span>
          </div>
        `;

        const domIcon = new H.map.DomIcon(markerHtml);
        const marker = new H.map.DomMarker({ lat: live.latitude, lng: live.longitude }, { icon: domIcon });

        // Compile vehicle costs for tap panel
        const fuelSum = rawCosts.filter(c => c.vehicle_id === v.id && c.category === 'combustivel').reduce((acc, c) => acc + c.amount, 0);
        const maintSum = rawCosts.filter(c => c.vehicle_id === v.id && (c.category === 'manutencao' || c.category === 'reparacao')).reduce((acc, c) => acc + c.amount, 0);
        const insSum = rawCosts.filter(c => c.vehicle_id === v.id && c.category === 'seguro').reduce((acc, c) => acc + c.amount, 0);
        const iucSum = rawCosts.filter(c => c.vehicle_id === v.id && c.category === 'iuc').reduce((acc, c) => acc + c.amount, 0);
        const ipoSum = rawCosts.filter(c => c.vehicle_id === v.id && c.category === 'ipo').reduce((acc, c) => acc + c.amount, 0);
        const tollsSum = rawCosts.filter(c => c.vehicle_id === v.id && c.category === 'portagens').reduce((acc, c) => acc + c.amount, 0);
        const otherSum = rawCosts.filter(c => c.vehicle_id === v.id && !['combustivel', 'manutencao', 'reparacao', 'seguro', 'iuc', 'ipo', 'portagens'].includes(c.category)).reduce((acc, c) => acc + c.amount, 0);

        const totalCost = fuelSum + maintSum + insSum + iucSum + ipoSum + tollsSum + otherSum;

        marker.addEventListener('tap', () => {
          setSelectedVehicleDetails({
            ...v,
            live,
            costs: { fuel: fuelSum, maint: maintSum, ins: insSum, iuc: iucSum, ipo: ipoSum, tolls: tollsSum, other: otherSum, total: totalCost }
          });
          setPanelOpen(true);
        });

        markersGroup.addObject(marker);
      }
    });

    // 2. Draw POIs (Locais)
    locais.forEach(l => {
      let color = '#3B82F6'; // Default Blue
      let icon = '📍';

      if (l.tipo === 'oficina') {
        color = '#EF4444'; // Red
        icon = '🔧';
      } else if (l.tipo === 'hotel' || l.tipo === 'aeroporto') {
        color = '#F59E0B'; // Amber
        icon = '🏨';
      } else if (l.nome.toLowerCase().includes('garagem') || l.nome.toLowerCase().includes('sede')) {
        color = '#10B981'; // Green
        icon = '🚗';
      }

      const poiHtml = `
        <div style="background:${color}; width:28px; height:28px; border-radius:50%; border:2px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:14px; cursor:pointer;">
          ${icon}
        </div>
      `;

      const domIcon = new H.map.DomIcon(poiHtml);
      const marker = new H.map.DomMarker({ lat: l.latitude, lng: l.longitude }, { icon: domIcon });

      marker.addEventListener('tap', () => {
        const bubble = new H.ui.InfoBubble({ lat: l.latitude, lng: l.longitude }, {
          content: `
            <div style="padding:10px; font-family:sans-serif; color:#1e293b;">
              <h4 style="margin:0 0 4px 0; font-weight:bold; font-size:13px;">${l.nome}</h4>
              <p style="margin:0; font-size:11px; color:#64748b; text-transform:capitalize;">Categoria: ${l.tipo}</p>
              <p style="margin:4px 0 0 0; font-size:10px; color:#94a3b8;">Coord: ${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)}</p>
            </div>
          `
        });
        uiRef.current.getBubbles().forEach((b: any) => b.close());
        uiRef.current.addBubble(bubble);
      });

      markersGroup.addObject(marker);
    });

    // 3. Draw Geofences
    geofences.forEach(gf => {
      if (gf.radius && gf.latitude && gf.longitude) {
        const circle = new H.map.Circle(
          { lat: gf.latitude, lng: gf.longitude },
          gf.radius,
          {
            style: {
              fillColor: 'rgba(59, 130, 246, 0.1)',
              strokeColor: 'rgba(59, 130, 246, 0.4)',
              lineWidth: 1.5
            }
          }
        );
        geofencesGroup.addObject(circle);
      } else if (gf.points && gf.points.length > 2) {
        const lineString = new H.geo.LineString();
        gf.points.forEach(p => lineString.pushPoint(p));
        // Push first point again to close polygon
        lineString.pushPoint(gf.points[0]);

        const polygon = new H.map.Polygon(lineString, {
          style: {
            fillColor: 'rgba(16, 185, 129, 0.1)',
            strokeColor: 'rgba(16, 185, 129, 0.4)',
            lineWidth: 1.5
          }
        });
        geofencesGroup.addObject(polygon);
      }
    });

    map.addObject(markersGroup);
    map.addObject(geofencesGroup);

    markersGroupRef.current = markersGroup;
    geofencesGroupRef.current = geofencesGroup;

    // Set map bounds to fit markers
    const bbox = markersGroup.getBoundingBox();
    if (bbox) {
      map.getViewModel().setLookAtData({ bounds: bbox }, true);
    }
  }, [filteredCosts, cartrackVehicles, locais, geofences, selectedVehicle, viaturas, rawCosts]);

  // Rentabilidade and Stats calculations
  const profitabilityRows = useMemo(() => {
    return viaturas.map(v => {
      const vCosts = rawCosts.filter(c => c.vehicle_id === v.id);
      const totalCost = vCosts.reduce((acc, c) => acc + c.amount, 0);
      const totalRev = vehicleRevenues[v.id] || 0;
      const profit = totalRev - totalCost;
      const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;

      const summary = profileSummaries.find(s => s.vehicle_id === v.id);
      const kms = summary?.km_travelled || 0;
      const cons = summary?.average_consumption || 0;

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
        consumption: cons,
        costPerKm,
        revPerKm
      };
    });
  }, [viaturas, rawCosts, vehicleRevenues, profileSummaries]);

  // Rankings
  const rankings = useMemo(() => {
    const sortedByProfit = [...profitabilityRows].sort((a, b) => b.profit - a.profit);
    const sortedByCons = [...profitabilityRows].filter(r => r.consumption > 0).sort((a, b) => b.consumption - a.consumption);
    const sortedByKms = [...profitabilityRows].sort((a, b) => b.kms - a.kms);
    const sortedByMaint = viaturas.map(v => {
      const maintSum = rawCosts.filter(c => c.vehicle_id === v.id && (c.category === 'manutencao' || c.category === 'reparacao')).reduce((acc, c) => acc + c.amount, 0);
      return {
        matricula: v.matricula,
        model: `${v.marca} ${v.modelo}`,
        cost: maintSum
      };
    }).sort((a, b) => b.cost - a.cost);

    return {
      mostProfitable: sortedByProfit.slice(0, 5),
      leastProfitable: [...sortedByProfit].reverse().slice(0, 5),
      highestCons: sortedByCons.slice(0, 5),
      lowestCons: [...sortedByCons].reverse().slice(0, 5),
      mostKms: sortedByKms.slice(0, 5),
      highestMaint: sortedByMaint.slice(0, 5)
    };
  }, [profitabilityRows, viaturas, rawCosts]);

  // Donut chart data (by category)
  const categoryChartData = useMemo(() => {
    const catsMap: Record<string, number> = {};
    filteredCosts.forEach(c => {
      catsMap[c.category] = (catsMap[c.category] || 0) + c.amount;
    });

    const labelMap: Record<string, string> = {
      combustivel: 'Combustível',
      reparacao: 'Reparações',
      manutencao: 'Manutenções',
      seguro: 'Seguros',
      iuc: 'IUC',
      ipo: 'IPO',
      pneus: 'Pneus',
      portagens: 'Portagens',
      lavagem: 'Lavagens',
      outros: 'Outros Custos'
    };

    const colors: Record<string, string> = {
      combustivel: '#3B82F6',
      reparacao: '#EF4444',
      manutencao: '#F59E0B',
      seguro: '#10B981',
      iuc: '#8B5CF6',
      ipo: '#EC4899',
      pneus: '#6366F1',
      portagens: '#06B6D4',
      lavagem: '#14B8A6',
      outros: '#64748B'
    };

    return Object.entries(catsMap).map(([key, val]) => ({
      name: labelMap[key] || key,
      value: val,
      color: colors[key] || '#64748B'
    }));
  }, [filteredCosts]);

  // Evolution of costs vs revenue (monthly chart)
  const monthlyCostRevenueData = useMemo(() => {
    const dataMap: Record<string, { month: string; custos: number; receitas: number }> = {};

    // Get last 6 months list
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      dataMap[key] = { month: key, custos: 0, receitas: 0 };
    }

    filteredCosts.forEach(c => {
      const monthKey = c.date?.slice(0, 7);
      if (dataMap[monthKey]) {
        dataMap[monthKey].custos += c.amount;
      }
    });

    Object.values(vehicleRevenues).forEach(rev => {
      // Attribute all revenue to current active month or distribute
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      if (dataMap[currentMonthStr]) {
        dataMap[currentMonthStr].receitas += rev;
      }
    });

    return Object.values(dataMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredCosts, vehicleRevenues]);

  // Export handlers
  const handleExportExcel = () => {
    const headers = ['ID Viatura', 'Matrícula', 'Data', 'Categoria', 'Montante', 'Descrição'];
    const rows = filteredCosts.map(c => {
      const v = viaturas.find(vit => vit.id === c.vehicle_id);
      return [
        c.vehicle_id,
        v?.matricula || '—',
        c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—',
        c.category.toUpperCase(),
        c.amount,
        c.description
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Custos');
    XLSX.writeFile(workbook, `Exploracao_Custos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportCSV = () => {
    const headers = ['Matrícula', 'Data', 'Categoria', 'Montante', 'Descrição'];
    const rows = filteredCosts.map(c => {
      const v = viaturas.find(vit => vit.id === c.vehicle_id);
      return [
        v?.matricula || '—',
        c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—',
        c.category.toUpperCase(),
        c.amount.toFixed(2),
        c.description.replace(/;/g, ',')
      ];
    });

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(';') + '\n';
    rows.forEach(row => {
      csvContent += row.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Exploracao_Custos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4') as any;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(18);
    doc.setTextColor(11, 34, 57); // Algartempo Brand Color
    doc.text('Relatório de Exploração de Frota', 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 14, 24);

    doc.autoTable({
      startY: 28,
      head: [['Matrícula', 'Data', 'Categoria', 'Montante', 'Descrição']],
      body: filteredCosts.map(c => {
        const v = viaturas.find(vit => vit.id === c.vehicle_id);
        return [
          v?.matricula || '—',
          c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—',
          c.category.toUpperCase(),
          `${c.amount.toFixed(2)} €`,
          c.description
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [11, 34, 57] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Relatorio_Exploracao_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="flex flex-col space-y-6 min-h-screen app-content-bg p-4 sm:p-6 lg:p-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#0B2239] to-[#1f385c] p-6 rounded-2xl shadow-lg border border-slate-700 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 -translate-y-4 translate-x-4">
          <BarChart3 className="w-64 h-64" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="bg-[#d59d31] text-xs font-black px-2 py-0.5 rounded text-[#0B2239] uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> NOVO
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">Exploração da Frota</h1>
          <p className="text-slate-300 text-sm mt-1">
            Gestão operacional, financeira e monitorização GPS da frota Algartempo.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
                <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
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
            <label className="text-xs font-semibold text-slate-500">Tipo de Período</label>
            <select
              value={periodType}
              onChange={e => setPeriodType(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#d59d31]"
            >
              <option value="month">Mensal</option>
              <option value="year">Anual</option>
              <option value="custom">Datas Customizadas</option>
            </select>
          </div>
        </div>

        {/* Dinamic sub-filters based on period type */}
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

      {/* TABS NAV */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto bg-white rounded-t-2xl px-4 border border-b-0 border-slate-100">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'costs', label: 'Custos', icon: DollarSign },
          { id: 'map', label: 'Mapa de Exploração', icon: MapPin },
          { id: 'profitability', label: 'Rentabilidade', icon: TrendingUp },
          { id: 'history', label: 'Histórico', icon: FileText },
          { id: 'reports', label: 'Relatórios', icon: Calendar }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'map') {
                // Resize map viewport after dynamic rendering delay
                setTimeout(() => {
                  if (mapRef.current) mapRef.current.getViewPort().resize();
                }, 200);
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

      {/* ACTIVE TAB CONTENT */}
      {loadingData ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-b-2xl border border-slate-100 shadow-sm space-y-4">
          <RefreshCw className="w-10 h-10 text-[#d59d31] animate-spin" />
          <p className="text-slate-500 font-bold text-sm">A processar dados da frota...</p>
        </div>
      ) : (
        <div className="bg-white rounded-b-2xl p-6 border border-slate-100 shadow-sm min-h-[500px]">
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Vehicles */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5 group-hover:scale-110 transition-transform">
                    <Car className="w-16 h-16 text-blue-600" />
                  </div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Total Frota</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-900">{dashboardStats.totalVehicles}</span>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {dashboardStats.activeVehicles} Ativas
                    </span>
                  </div>
                </div>

                {/* Maintenance */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5 group-hover:scale-110 transition-transform">
                    <Wrench className="w-16 h-16 text-red-500" />
                  </div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Em Manutenção</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-900">{dashboardStats.maintVehicles}</span>
                    <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                      Atenção
                    </span>
                  </div>
                </div>

                {/* Total Cost */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5 group-hover:scale-110 transition-transform">
                    <DollarSign className="w-16 h-16 text-[#d59d31]" />
                  </div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Custos Filtrados</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-[#0B2239]">
                      {dashboardStats.totalCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>

                {/* Kms */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute right-4 top-4 opacity-5 group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-16 h-16 text-emerald-500" />
                  </div>
                  <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">KMs Percorridos</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-900">
                      {dashboardStats.totalKms.toLocaleString('pt-PT')} km
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {dashboardStats.costPerKm.toFixed(2)} €/km
                    </span>
                  </div>
                </div>
              </div>

              {/* Charts Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cost Categories Distribution */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 lg:col-span-1">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider mb-4">
                    Distribuição de Custos
                  </h4>
                  <div className="h-64 relative">
                    {categoryChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
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
                      <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                        Nenhum custo registado no período
                      </div>
                    )}
                  </div>

                  {/* Legend list */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                    {categoryChartData.map(c => (
                      <div key={c.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-slate-600 font-medium truncate">{c.name}</span>
                        <span className="text-slate-900 font-bold ml-auto">{c.value.toFixed(0)}€</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Costs vs Revenues monthly evolution */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 lg:col-span-2">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider mb-4">
                    Evolução Mensal (Custos vs Receita Alugueres)
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
                        <Area type="monotone" dataKey="custos" stroke="#EF4444" name="Custos" fillOpacity={1} fill="url(#colorCustos)" />
                        <Area type="monotone" dataKey="receitas" stroke="#10B981" name="Receita" fillOpacity={1} fill="url(#colorReceitas)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CUSTOS */}
          {activeTab === 'costs' && (
            <div className="space-y-6">
              {/* Top chart comparing vehicles */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider mb-4">
                  Custos por Viatura (€)
                </h4>
                <div className="h-64">
                  {profitabilityRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={profitabilityRows.filter(r => r.cost > 0)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="matricula" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => `${value.toFixed(2)} €`} />
                        <Bar dataKey="cost" fill="#3B82F6" name="Custo Total" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                      Sem dados de custos
                    </div>
                  )}
                </div>
              </div>

              {/* Table details */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider">
                    Grelha Detalhada de Custos
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Matrícula</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Combustível</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Manutenção</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Reparação</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Seguros</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">IUC</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">IPO</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Portagens</th>
                        <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                      {viaturas.map(v => {
                        const vCosts = filteredCosts.filter(c => c.vehicle_id === v.id);
                        const fSum = vCosts.filter(c => c.category === 'combustivel').reduce((acc, c) => acc + c.amount, 0);
                        const mSum = vCosts.filter(c => c.category === 'manutencao').reduce((acc, c) => acc + c.amount, 0);
                        const rSum = vCosts.filter(c => c.category === 'reparacao').reduce((acc, c) => acc + c.amount, 0);
                        const sSum = vCosts.filter(c => c.category === 'seguro').reduce((acc, c) => acc + c.amount, 0);
                        const iSum = vCosts.filter(c => c.category === 'iuc').reduce((acc, c) => acc + c.amount, 0);
                        const ipSum = vCosts.filter(c => c.category === 'ipo').reduce((acc, c) => acc + c.amount, 0);
                        const tSum = vCosts.filter(c => c.category === 'portagens').reduce((acc, c) => acc + c.amount, 0);
                        const total = fSum + mSum + rSum + sSum + iSum + ipSum + tSum;

                        if (total === 0) return null;

                        return (
                          <tr key={v.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3 font-bold text-[#0B2239]">{v.matricula}</td>
                            <td className="px-6 py-3">{fSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{mSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{rSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{sSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{iSum.toFixed(2)} €</td>
                            <td className="px-6 py-3">{ipSum.toFixed(2)} €</td>
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
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px] relative">
              {/* Map controls panel */}
              <div className="lg:col-span-1 bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6 overflow-y-auto">
                <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <MapIcon className="w-4 h-4" /> Camadas e Filtros
                </h4>

                {/* Map style toggle */}
                <div className="flex flex-col space-y-2">
                  <span className="text-xs font-semibold text-slate-500">Estilo do Mapa</span>
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
                    <button
                      onClick={() => setMapStyle('normal')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${mapStyle === 'normal' ? 'bg-white shadow text-[#0B2239]' : 'text-slate-500'}`}
                    >
                      Vetores
                    </button>
                    <button
                      onClick={() => setMapStyle('satellite')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${mapStyle === 'satellite' ? 'bg-white shadow text-[#0B2239]' : 'text-slate-500'}`}
                    >
                      Satélite
                    </button>
                  </div>
                </div>

                {/* Traffic flow layer toggle */}
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-4">
                  <span className="text-xs font-semibold text-slate-500">Trânsito em Tempo Real</span>
                  <button
                    onClick={() => setShowTraffic(!showTraffic)}
                    className={`w-10 h-6 rounded-full transition-all relative ${showTraffic ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${showTraffic ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                {/* Live indicators */}
                <div className="border-t border-slate-200/80 pt-4 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block">Legenda:</span>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-emerald-500 rounded-full border border-white" />
                    <span className="text-slate-600 font-medium">Ignição Ligada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-slate-500 rounded-full border border-white" />
                    <span className="text-slate-600 font-medium">Ignição Desligada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔧</span>
                    <span className="text-slate-600 font-medium">Oficinas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏨</span>
                    <span className="text-slate-600 font-medium">Clientes / Hotéis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🚗</span>
                    <span className="text-slate-600 font-medium">Garagens</span>
                  </div>
                </div>
              </div>

              {/* Map container */}
              <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-slate-100 relative h-full">
                <div ref={mapContainerRef} className="w-full h-full" />

                {/* Right Slide-over panel for selected vehicle details */}
                {panelOpen && selectedVehicleDetails && (
                  <div className="absolute top-4 right-4 z-50 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl w-80 shadow-2xl p-6 space-y-6 max-h-[90%] overflow-y-auto animate-in slide-in-from-right duration-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-slate-400 block">Detalhes da Viatura</span>
                        <h4 className="font-black text-xl text-[#0B2239] mt-0.5">{selectedVehicleDetails.matricula}</h4>
                        <p className="text-xs text-slate-500 font-medium capitalize">{selectedVehicleDetails.live?.make} {selectedVehicleDetails.live?.model}</p>
                      </div>
                      <button
                        onClick={() => setPanelOpen(false)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3.5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
                      <div className="flex justify-between">
                        <span>Motorista:</span>
                        <span className="font-bold text-slate-900">{selectedVehicleDetails.live?.driverName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Velocidade:</span>
                        <span className="font-bold text-slate-900">{selectedVehicleDetails.live?.speed > 0 ? `${Math.round(selectedVehicleDetails.live.speed)} km/h` : 'Parado'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Odómetro:</span>
                        <span className="font-bold text-slate-900">{selectedVehicleDetails.live?.odometer ? `${Math.round(selectedVehicleDetails.live.odometer).toLocaleString()} km` : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Morada:</span>
                        <span className="font-bold text-slate-900 text-right w-1/2 truncate" title={selectedVehicleDetails.live?.address}>{selectedVehicleDetails.live?.address || '—'}</span>
                      </div>
                    </div>

                    {/* Cost Summary on vehicle popup */}
                    <div className="border-t border-slate-100 pt-4 space-y-2">
                      <h5 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider mb-2">Despesas Filtradas</h5>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">Combustível</span>
                          <span className="text-slate-900 text-xs">{selectedVehicleDetails.costs.fuel.toFixed(2)} €</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">Manutenção</span>
                          <span className="text-slate-900 text-xs">{selectedVehicleDetails.costs.maint.toFixed(2)} €</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">Seguros</span>
                          <span className="text-slate-900 text-xs">{selectedVehicleDetails.costs.ins.toFixed(2)} €</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">Portagens</span>
                          <span className="text-slate-900 text-xs">{selectedVehicleDetails.costs.tolls.toFixed(2)} €</span>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl flex justify-between items-center text-white mt-3">
                        <span className="text-xs font-bold opacity-80">Total Gasto:</span>
                        <span className="font-black text-sm">{selectedVehicleDetails.costs.total.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: RENTABILIDADE */}
          {activeTab === 'profitability' && (
            <div className="space-y-6">
              {/* Indicators Grid */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Viatura</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Receita (Aluguer)</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Custos Globais</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Lucro</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Margem</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Consumo Médio</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">KM Percorridos</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase text-right">Custo / KM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                    {profitabilityRows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3">
                          <span className="font-bold text-[#0B2239] block">{row.matricula}</span>
                          <span className="text-slate-400 text-[10px]">{row.model}</span>
                        </td>
                        <td className="px-6 py-3 text-emerald-600 font-bold">{row.revenue.toFixed(2)} €</td>
                        <td className="px-6 py-3 text-slate-600">{row.cost.toFixed(2)} €</td>
                        <td className={`px-6 py-3 font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.profit.toFixed(2)} €
                        </td>
                        <td className={`px-6 py-3 ${row.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.margin.toFixed(1)} %
                        </td>
                        <td className="px-6 py-3">{row.consumption > 0 ? `${row.consumption.toFixed(1)} L/100km` : '—'}</td>
                        <td className="px-6 py-3">{row.kms.toLocaleString()} km</td>
                        <td className="px-6 py-3 font-bold text-slate-900 text-right">{row.costPerKm.toFixed(2)} €/km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rankings Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Ranking: Most Profitable */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-emerald-500" /> Mais Rentáveis
                  </h4>
                  <div className="space-y-3.5">
                    {rankings.mostProfitable.map((v, i) => (
                      <div key={v.id} className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500 font-black">#{i+1}</span>
                        <span className="text-slate-900 font-bold ml-2">{v.matricula}</span>
                        <span className="text-slate-400 text-[10px] truncate max-w-[80px]">{v.model}</span>
                        <span className="text-emerald-600 font-black ml-auto">{v.profit.toFixed(0)}€</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ranking: Highest Consumption */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-rose-500" /> Maior Consumo (L/100km)
                  </h4>
                  <div className="space-y-3.5">
                    {rankings.highestCons.map((v, i) => (
                      <div key={v.id} className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500 font-black">#{i+1}</span>
                        <span className="text-slate-900 font-bold ml-2">{v.matricula}</span>
                        <span className="text-slate-400 text-[10px] truncate max-w-[80px]">{v.model}</span>
                        <span className="text-rose-600 font-black ml-auto">{v.consumption.toFixed(1)} L</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ranking: Maintenance Costs */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-orange-500" /> Maior Gasto Manutenção
                  </h4>
                  <div className="space-y-3.5">
                    {rankings.highestMaint.map((v, i) => (
                      <div key={v.matricula} className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500 font-black">#{i+1}</span>
                        <span className="text-slate-900 font-bold ml-2">{v.matricula}</span>
                        <span className="text-slate-400 text-[10px] truncate max-w-[80px]">{v.model}</span>
                        <span className="text-slate-900 font-black ml-auto">{v.cost.toFixed(0)}€</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: HISTÓRICO */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider">
                  Log Consolidado de Despesas
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Matrícula</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Data</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Categoria</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase">Descrição</th>
                      <th className="px-6 py-3.5 text-xs font-black text-slate-500 uppercase text-right">Montante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                    {filteredCosts.map(c => {
                      const v = viaturas.find(vit => vit.id === c.vehicle_id);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3 font-bold text-[#0B2239]">{v?.matricula || '—'}</td>
                          <td className="px-6 py-3">{c.date ? new Date(c.date).toLocaleDateString('pt-PT') : '—'}</td>
                          <td className="px-6 py-3 uppercase text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold
                              ${c.category === 'combustivel' ? 'bg-blue-100 text-blue-800' : ''}
                              ${c.category === 'manutencao' || c.category === 'reparacao' ? 'bg-orange-100 text-orange-800' : ''}
                              ${c.category === 'seguro' ? 'bg-emerald-100 text-emerald-800' : ''}
                              ${c.category === 'portagens' ? 'bg-cyan-100 text-cyan-800' : ''}
                              ${!['combustivel', 'manutencao', 'reparacao', 'seguro', 'portagens'].includes(c.category) ? 'bg-slate-100 text-slate-700' : ''}
                            `}>
                              {c.category}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-500 truncate max-w-[200px]" title={c.description}>
                            {c.description}
                          </td>
                          <td className="px-6 py-3 font-bold text-slate-900 text-right">{c.amount.toFixed(2)} €</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: RELATÓRIOS & EXPORTAÇÕES */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h4 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider">
                Centro de Exportação de Relatórios
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PDF Generator Card */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between h-56 group hover:shadow-md transition-all">
                  <div>
                    <h5 className="font-extrabold text-base text-[#0B2239] flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-500" /> Relatório Executivo PDF
                    </h5>
                    <p className="text-slate-500 text-xs mt-2">
                      Gere um documento PDF profissional com o sumário de custos estruturado,
                      despesas consolidadas por categoria, ideal para impressão ou envio.
                    </p>
                  </div>
                  <button
                    onClick={handleExportPDF}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4" /> Exportar para PDF
                  </button>
                </div>

                {/* Excel/CSV Generator Card */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between h-56 group hover:shadow-md transition-all">
                  <div>
                    <h5 className="font-extrabold text-base text-[#0B2239] flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Folha de Cálculo Excel
                    </h5>
                    <p className="text-slate-500 text-xs mt-2">
                      Exporta a base de custos filtrada em formato estruturado Excel/CSV
                      para importação no SAP ou análise avançada no Microsoft Excel ou Power BI.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExportCSV}
                      className="py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      CSV
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      Excel (XLSX)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
