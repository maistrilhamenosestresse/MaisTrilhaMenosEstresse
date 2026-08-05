"use client";


import { AdminAgendasTab } from '@/components/admin/AdminAgendasTab';
import { AdminFinancesTab } from '@/components/admin/AdminFinancesTab';
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, FileText, Send, Image as ImageIcon, Video, Loader2, Trash2,
  CalendarDays, Edit2, Sparkles, CheckCircle2, FileUp, Mic, Square, Navigation, 
  AlertCircle, X, Plus, Eye, User, ShieldCheck, Search, ChevronDown, ChevronUp, MapPin, Users, Printer, Bell, LogOut, ExternalLink, DownloadCloud, Trophy, Gift, Copy, FileSignature, CreditCard, TrendingUp, Award, LockKeyhole, Images
} from "lucide-react";
import { PinModal } from "@/components/PinModal";
import CobrancasDashboard from "@/components/admin/CobrancasDashboard";
import LojaDashboard from "@/components/admin/LojaDashboard";
import GamificacaoDashboard from "@/components/admin/GamificacaoDashboard";
import AssistenteFinanceiroView from "@/components/admin/AssistenteFinanceiroView";
import { MediaUploadSection } from "@/components/admin/MediaUploadSection";
import { ReservationPaymentEditor } from "@/components/admin/ReservationPaymentEditor";
import { AdminReservationsTab } from "@/components/admin/AdminReservationsTab";
import { AdminClientsTab } from "@/components/admin/AdminClientsTab";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { calculateNetProfit } from "@/lib/fees";
import imageCompression from 'browser-image-compression';
import { uploadMediaToAws } from '@/lib/upload-media-client';
import { isArchivedTrailDate } from "@/lib/trails";

type AgendaForm = {
  title: string; location: string; date: string; price: string;
  meeting_point: string; description: string; requirements: string; max_capacity: string;
  duration_hours: string; distance_km: string; difficulty: string;
  flyer: FileList; images: FileList; video: FileList;
  taxa_gratis: string; // boolean handled via string value 'true' or 'false'
};

type ChatMessage = { sender: 'user' | 'bot'; text: string; };

const formatCurrency = (val: number | string) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const agendaMutationPayload = (agenda: any) => ({
  title: agenda.title,
  date: agenda.date,
  price: agenda.price,
  description: agenda.description,
  meeting_point: agenda.meeting_point,
  requirements: agenda.requirements,
  max_capacity: agenda.max_capacity,
  duration_hours: agenda.duration_hours,
  distance_km: agenda.distance_km,
  difficulty: agenda.difficulty || "easy",
  images: Array.isArray(agenda.images) ? agenda.images : [],
  video_url: agenda.video_url || null,
  flyer_url: agenda.flyer_url || null,
  accepted_payment_methods: Array.isArray(agenda.accepted_payment_methods)
    ? agenda.accepted_payment_methods
    : ["PIX"],
  taxa_gratis: Boolean(agenda.taxa_gratis),
});

const formatPaymentMethod = (method?: string) => {
  if (method === 'CREDIT_CARD') return 'Cartão (Asaas)';
  if (method === 'BOLETO') return 'Boleto (Asaas)';
  if (method === 'PIX') return 'Pix (Asaas)';
  if (method === 'ASAAS') return 'Asaas';
  return method || 'Não informado';
};

export default function AdminPage() {
  const { register, handleSubmit, reset, watch, setValue, getValues } = useForm<AgendaForm>({
    shouldUnregister: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [globalViews, setGlobalViews] = useState<number>(0);
  const [clients, setClients] = useState<any[]>([]);
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(['PIX', 'CREDIT_CARD']);
  
  const getReservaNetProfit = (reserva: any, agenda: any) => {
    if (!agenda || !agenda.price) return 0;
    if (!agenda.taxa_gratis) {
      return Number(agenda.price);
    } else {
      const method = reserva.metodo_pagamento || 'PIX';
      return calculateNetProfit(Number(agenda.price), method, 1);
    }
  };

  const [expandedTrilhas, setExpandedTrilhas] = useState<string | null>(null);
  const [clientTrails, setClientTrails] = useState<{ [clientId: string]: any[] }>({});

  const loadClientTrails = async (clientId: string) => {
    if (expandedTrilhas === clientId) {
      setExpandedTrilhas(null);
      return;
    }
    if (!clientTrails[clientId]) {
      const { data } = await supabase.from('reservas').select('status_pagamento, agendas(title, date)').eq('client_id', clientId);
      setClientTrails(prev => ({ ...prev, [clientId]: data || [] }));
    }
    setExpandedTrilhas(clientId);
  };

  const [isFetching, setIsFetching] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  
  // Novos estados para a UI tipo App
  const [mainTab, setMainTab] = useState<'trilhas' | 'clientes' | 'reservas' | 'financas' | 'cobrancas' | 'loja' | 'gamificacao' | 'assistente'>('trilhas');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clientesTab, setClientesTab] = useState<'todos' | 'listas' | 'avaliacoes'>('todos');
  const [clientSortMode, setClientSortMode] = useState<'recentes' | 'antigos' | 'az' | 'za'>('recentes');
  const [avaliacoesAdmin, setAvaliacoesAdmin] = useState<any[]>([]);
  const [avaliacoesError, setAvaliacoesError] = useState('');
  const [printMode, setPrintMode] = useState<'todos' | 'van' | 'seguro'>('todos');
  const [printIssuedAt, setPrintIssuedAt] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState<{ name: string; onConfirm: () => void; onCancel: () => void } | null>(null);

  const requirePin = async (actionName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setPinAction({
        name: actionName,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
      setIsPinModalOpen(true);
    });
  };



  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [expandedAgendaId, setExpandedAgendaId] = useState<string | null>(null);
  const [editingAgenda, setEditingAgenda] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'textos' | 'midias'>('geral');

  // --- Estados de Reservas e Finanças ---
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>('');
  const [reservas, setReservas] = useState<any[]>([]);
  const [reservaFilter, setReservaFilter] = useState<'ALL' | 'pago' | 'pendente' | 'atrasado'>('ALL');
  const [custos, setCustos] = useState<any[]>([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [financasTab, setFinancasTab] = useState<'asaas' | 'receitas' | 'despesas' | 'relatorios'>('asaas');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [allReservas, setAllReservas] = useState<any[]>([]);
  const [allCustos, setAllCustos] = useState<any[]>([]);
  const [isFetchingGlobalFinances, setIsFetchingGlobalFinances] = useState(false);
  
  // Filtros do Dashboard
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);

  // IA CFO
  const [isCFOModalOpen, setIsCFOModalOpen] = useState(false);
  const [isFetchingCFO, setIsFetchingCFO] = useState(false);
  const [cfoAdvice, setCfoAdvice] = useState<string>('');

  const [novoCustoNome, setNovoCustoNome] = useState('');
  const [novoCustoValor, setNovoCustoValor] = useState('');
  const [novaReservaClientId, setNovaReservaClientId] = useState('');
  const [novaReservaClientSearch, setNovaReservaClientSearch] = useState('');
  const [isNovaReservaSearchFocused, setIsNovaReservaSearchFocused] = useState(false);
  const [novaReservaStatus, setNovaReservaStatus] = useState('pago');
  const [novaReservaValorPago, setNovaReservaValorPago] = useState('');
  const [editingReservationPayment, setEditingReservationPayment] = useState<any | null>(null);

  // Estados de IA e Gravação (Mantidos intactos)
  const [isFormattingMeetingPoint, setIsFormattingMeetingPoint] = useState(false);
  const [isFormattingDescription, setIsFormattingDescription] = useState(false);
  const [aiSuccessMeeting, setAiSuccessMeeting] = useState(false);
  const [aiSuccessDesc, setAiSuccessDesc] = useState(false);
  const [recordingType, setRecordingType] = useState<'meeting_point' | 'description' | 'assistant' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isAssistantProcessing, setIsAssistantProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([{ sender: 'bot', text: 'Olá! Sou sua assistente. Pergunte qualquer coisa ou me mande cadastrar uma trilha!' }]);
  const [chatInput, setChatInput] = useState("");

  // --- Estados de Notificações ---
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationReceipt, setNotificationReceipt] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const selectedVideo = watch("video");

  // --- Funções de Exportação (Excel/CSV) ---
  const handleExportCSV = (type: 'reservas' | 'relatorios') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (type === 'reservas') {
      csvContent += "Nome,CPF,Telefone,Status de Pagamento,Valor Pago,Forma de Pagamento,Data da Compra,Referência\n";
      reservas.forEach(r => {
        const row = [
          r.clients?.full_name,
          r.clients?.cpf,
          r.clients?.phone,
          r.status_pagamento?.toUpperCase(),
          Number(r.valor_pago || 0).toFixed(2),
          formatPaymentMethod(r.metodo_pagamento),
          r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '',
          r.nsu_transacao || '',
        ].map(csvCell).join(',');
        csvContent += row + "\n";
      });
    } else if (type === 'relatorios') {
      csvContent += "Nome da Trilha,Data,Passageiros Pagos,Faturamento Liquido (R$),Custos Totais (R$),Lucro Liquido (R$)\n";
      agendas.forEach(agenda => {
        const rev = allReservas.filter(r => r.agenda_id === agenda.id && r.status_pagamento === 'pago').reduce((acc, r) => acc + getReservaNetProfit(r, agenda), 0);
        const cst = allCustos.filter(c => c.agenda_id === agenda.id).reduce((acc, curr) => acc + Number(curr.valor_custo), 0);
        const row = `${agenda.title},${agenda.date},${allReservas.filter(r => r.agenda_id === agenda.id && r.status_pagamento === 'pago').length},${rev},${cst},${rev - cst}`;
        csvContent += row + "\n";
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${type}_maistrilhas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  
  const generateWhatsAppVan = async () => {
    if (!(await requirePin('Mensagem da Van'))) return;
    if (!selectedAgendaId) return;
    const agenda = agendas.find(a => a.id === selectedAgendaId);
    let text = `🚐 *LISTA DE EMBARQUE - ${agenda?.title.toUpperCase()}*\n📅 Data: ${formatDateDisplay(agenda?.date || '')}\n\n`;
    const sorted = [...reservas].filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'pendente').sort((a,b) => a.clients.full_name.localeCompare(b.clients.full_name));
    if (sorted.length === 0) text += "Nenhum passageiro confirmado.";
    sorted.forEach((r, idx) => {
      text += `*${idx + 1}. ${r.clients.full_name}*\nCPF: ${r.clients.cpf || 'N/A'} | Tel: ${r.clients.phone || 'N/A'}\n\n`;
    });
    navigator.clipboard.writeText(text);
    alert("Lista de Van copiada para o WhatsApp!");
  };

  const generateWhatsAppSeguro = async () => {
    if (!(await requirePin('Mensagem de Seguro'))) return;
    if (!selectedAgendaId) return;
    const agenda = agendas.find(a => a.id === selectedAgendaId);
    let text = `🛡️ *LISTA PARA SEGURO - ${agenda?.title.toUpperCase()}*\n📅 Data: ${formatDateDisplay(agenda?.date || '')}\n\n`;
    const sorted = [...reservas].filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'pendente').sort((a,b) => a.clients.full_name.localeCompare(b.clients.full_name));
    if (sorted.length === 0) text += "Nenhum passageiro confirmado.";
    sorted.forEach((r, idx) => {
      text += `*${idx + 1}. ${r.clients.full_name}*\nE-mail: ${r.clients.email || 'N/A'}\nCPF: ${r.clients.cpf || 'N/A'} | RG: ${r.clients.rg || 'N/A'}\nNascimento: ${r.clients.birth_date ? formatDateDisplay(r.clients.birth_date) : 'N/A'}\nContato Emergência: ${r.clients.emergency_contact_name || 'N/A'} - ${r.clients.emergency_contact_phone || 'N/A'}\nSaúde/Obs: ${r.clients.health_notes || 'Nenhuma'}\n\n`;
    });
    navigator.clipboard.writeText(text);
    alert("Lista de Seguro copiada para o WhatsApp!");
  };

  const handlePrint = async (mode: 'todos' | 'van' | 'seguro') => {
    if (!(await requirePin('Impressão de Listas'))) return;
    setPrintMode(mode);
    setPrintIssuedAt(new Date().toLocaleDateString('pt-BR'));
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode('todos'), 1000);
    }, 500);
  };


  const handleGenerateCFOAdvice = async (financialData: any) => {
    setIsFetchingCFO(true);
    setIsCFOModalOpen(true);
    try {
      const response = await fetch('/api/generate-cfo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialData })
      });
      const data = await response.json();
      setCfoAdvice(data.result || "Nenhuma análise gerada.");
    } catch (e) {
      setCfoAdvice("Não foi possível gerar a análise no momento.");
    }
    setIsFetchingCFO(false);
  };

  const fetchAgendasAndCleanup = async () => {
    setIsFetching(true);
      try {
        const { data, error } = await supabase.from('agendas').select('*, reservas(status_pagamento)').order('date', { ascending: true });
        if (error) throw error;
        const orderedAgendas = [...(data || [])].sort((left, right) => {
          const leftArchived = isArchivedTrailDate(left.date);
          const rightArchived = isArchivedTrailDate(right.date);
          if (leftArchived !== rightArchived) return leftArchived ? 1 : -1;
          return leftArchived
            ? String(right.date).localeCompare(String(left.date))
            : String(left.date).localeCompare(String(right.date));
        });
        setAgendas(orderedAgendas);
      
      const { data: resSettings } = await supabase.from('settings').select('*').single();
      if (resSettings) setIsMaintenance(resSettings.maintenance_mode);

      const { data: statsData } = await supabase.from('global_stats').select('total_views').eq('id', 1).single();
      if (statsData) setGlobalViews(statsData.total_views || 0);

      const { data: clientsData } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      setClients(clientsData || []);

      const { data: avaliacoesData, error: avaliacoesFetchError } = await supabase.from('avaliacoes').select('*, agendas(title)').order('created_at', { ascending: false });
      if (avaliacoesFetchError) {
        setAvaliacoesAdmin([]);
        setAvaliacoesError('Não foi possível carregar as avaliações. Confirme se o login administrativo está ativo e tente novamente.');
      } else {
        setAvaliacoesAdmin(avaliacoesData || []);
        setAvaliacoesError('');
      }
    } catch (error) {
      console.error("Erro ao buscar agendas:", error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchAgendasAndCleanup();
  }, [mainTab]);

  useEffect(() => {
    
    // --- SEGURANÇA: LOG DE ACESSO DO DESENVOLVEDOR ---
    async function checkDevAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email === 'wellingtonf.social@gmail.com') {
          const lastLog = sessionStorage.getItem('dev_access_logged');
          if (!lastLog) {
            sessionStorage.setItem('dev_access_logged', 'true');
            fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: 'maistrilhamenosestresse@gmail.com, niveamariamagalhaes28@gmail.com',
                subject: '⚠️ LOG DE SEGURANÇA - ACESSO DO DESENVOLVEDOR',
                text: `Olá Nívea,\n\nEste é um aviso automático de segurança do sistema.\n\nO painel de administrador foi acessado pelo desenvolvedor (Wellington) em ${new Date().toLocaleString('pt-BR')}.\n\nIsso garante transparência total sobre quem está visualizando ou modificando as informações do painel.\n\nAtenciosamente,\nSistema Mais Trilha Menos Estresse`
              })
            }).catch(e => console.error("Falha ao enviar log de segurança", e));
          }
        }
      } catch (e) { console.error(e); }
    }
    checkDevAccess();

    async function fetchNotifications() {
      const { data } = await supabase.from('notificacoes')
        .select('*')
        .not('mensagem', 'ilike', 'WEBHOOK RAW%')
        .not('mensagem', 'ilike', 'CHECKOUT_MAPPING%')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.lida).length);
      }
    }
    fetchNotifications();

    const channel = supabase
      .channel('notificacoes-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, (payload) => {
        const msg = payload.new.mensagem || "";
        if (!msg.startsWith('WEBHOOK RAW') && !msg.startsWith('CHECKOUT_MAPPING')) {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    // ★ REALTIME: Atualiza reservas em tempo real quando o webhook altera o status
    const reservasChannel = supabase
      .channel('reservas-status-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservas' }, (payload) => {
        const updated = payload.new;
        // Atualiza apenas os campos de status na lista local de reservas (sem recarregar tudo)
        setReservas(prev => prev.map(r => r.id === updated.id 
          ? { ...r, status_pagamento: updated.status_pagamento, status: updated.status, valor_pago: updated.valor_pago } 
          : r
        ));
        // Também atualiza os counts de vagas na listagem de agendas
        setAgendas(prev => prev.map(agenda => {
          if (agenda.id !== updated.agenda_id) return agenda;
          const updatedReservas = (agenda.reservas || []).map((r: any) => 
            r.id === updated.id ? { ...r, status_pagamento: updated.status_pagamento } : r
          );
          return { ...agenda, reservas: updatedReservas };
        }));
      })
      .subscribe();

    return () => { 
      if (timerRef.current) clearInterval(timerRef.current); 
      supabase.removeChannel(channel);
      supabase.removeChannel(reservasChannel);
    };
  }, []);

  const handleOpenNotifications = async () => {
    setIsNotificationsOpen(!isNotificationsOpen);
    if (!isNotificationsOpen && unreadCount > 0) {
      setUnreadCount(0);
      const unreadIds = notifications.filter(n => !n.lida).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase.from('notificacoes').update({ lida: true }).in('id', unreadIds);
        setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
      }
    }
  };

  const handleClearNotifications = async () => {
    await supabase.from('notificacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setNotifications([]);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.reserva_id) return;
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select('*, clients!reservas_client_id_fkey(*), agendas(*)')
        .eq('id', notif.reserva_id)
        .single();
        
      if (data) {
        setNotificationReceipt(data);
        setIsNotificationsOpen(false); // Fecha o dropdown
      }
    } catch (e) {
      console.error("Erro ao buscar detalhes da notificação", e);
    }
  };

  const handleToggleMaintenance = async () => {
    if (!(await requirePin('Pausar/Ativar Site'))) return;
    setIsTogglingMaintenance(true);
    try {
      const { error } = await supabase.from('settings').update({ maintenance_mode: !isMaintenance }).eq('id', 1);
      if (error) throw error;
      setIsMaintenance(!isMaintenance);
    } catch (err: any) {
      alert("Erro ao alterar modo de manutenção: " + err.message + "\nLembre-se de rodar o script SQL no Supabase!");
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAssistantProcessing]);

  // --- Funções de Clientes ---
  const normalizeString = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
  
  const isBirthday = (birthDateStr: string | null) => {
    if (!birthDateStr) return false;
    const today = new Date();
    const bDate = new Date(birthDateStr);
    bDate.setFullYear(today.getFullYear());
    if (bDate < new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)) {
      bDate.setFullYear(today.getFullYear() + 1);
    }
    const diffTime = Math.abs(bDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  };

  const filteredClients = clients
    .filter(c => normalizeString(c.full_name).includes(normalizeString(searchTerm)) || (c.cpf && c.cpf.includes(searchTerm)))
    .sort((a, b) => {
      const aBday = isBirthday(a.birth_date);
      const bBday = isBirthday(b.birth_date);
      if (aBday && !bBday) return -1;
      if (!aBday && bBday) return 1;

      if (clientSortMode === 'az') return normalizeString(a.full_name).localeCompare(normalizeString(b.full_name));
      if (clientSortMode === 'za') return normalizeString(b.full_name).localeCompare(normalizeString(a.full_name));
      if (clientSortMode === 'antigos') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const toggleClientExpand = (id: string) => {
    setExpandedClientId(expandedClientId === id ? null : id);
  };

  const handleBulkDelete = async () => {
    if (!(await requirePin(`Excluir ${selectedClients.length} Clientes`))) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedClients.length} clientes permanentemente?`)) return;
    try {
      const { error } = await supabase.from('clients').delete().in('id', selectedClients);
      if (error) throw error;
      setClients(clients.filter(c => !selectedClients.includes(c.id)));
      setSelectedClients([]);
      alert(`${selectedClients.length} clientes excluídos com sucesso!`);
    } catch (err: any) { alert("Erro ao excluir clientes em massa."); }
  };

  const handleDeleteClient = async (id: string) => {
    if (!(await requirePin('Excluir Cliente'))) return;
    if (!window.confirm("Tem certeza que deseja excluir este cliente permanentemente?")) return;
    try {
      await supabase.from('clients').delete().eq('id', id);
      setClients(clients.filter(c => c.id !== id));
    } catch (err: any) { alert("Erro ao excluir cliente."); }
  };

  const handleSaveEditedClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const originalClient = clients.find(c => c.id === editingClient.id);
      const isEmailChanged = originalClient && originalClient.email !== editingClient.email;
      
      await supabase.from('clients').update({
        full_name: editingClient.full_name, email: editingClient.email,
        cpf: editingClient.cpf, rg: editingClient.rg,
        phone: editingClient.phone, health_notes: editingClient.health_notes
      }).eq('id', editingClient.id);
      
      setClients(clients.map(c => c.id === editingClient.id ? editingClient : c));
      
      let message = "Cliente atualizado!";
      
      if (isEmailChanged) {
        const res = await fetch("/api/send-client-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client: editingClient }),
        });
        if (res.ok) message += " O contrato foi reenviado para o novo e-mail.";
        else message += " Mas ocorreu um erro ao reenviar o contrato.";
      }
      
      setEditingClient(null);
      alert(message);
    } catch (err: any) { alert("Erro ao editar cliente."); }
  };

  // --- Funções de Reservas e Finanças ---
  useEffect(() => {
    if (agendas.length > 0 && !selectedAgendaId) {
      setSelectedAgendaId(agendas[0].id);
    }
  }, [agendas, selectedAgendaId]);

  useEffect(() => {
    if (!selectedAgendaId) return;
    const fetchDetails = async () => {
      setIsFetchingDetails(true);
      setDetailsError('');
      setReservas([]);
      setCustos([]);
      try {
        const [resReservas, resCustos] = await Promise.all([
          supabase.from('reservas').select('*, clients!reservas_client_id_fkey(*)').eq('agenda_id', selectedAgendaId).order('created_at', { ascending: false }),
          supabase.from('trilha_custos').select('*').eq('agenda_id', selectedAgendaId).order('created_at', { ascending: true })
        ]);
        if (resReservas.error) throw resReservas.error;
        if (resCustos.error) throw resCustos.error;
        setReservas(resReservas.data || []);
        setCustos(resCustos.data || []);
      } catch (e) {
        console.error("Erro ao buscar detalhes financeiros/reservas:", e);
        setDetailsError('Não foi possível carregar as compras e os dados financeiros desta trilha. Tente novamente.');
      } finally {
        setIsFetchingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedAgendaId]);

  useEffect(() => {
    if ((mainTab === 'financas' && financasTab === 'relatorios') || mainTab === 'assistente') {
      const fetchGlobalFinances = async () => {
        setIsFetchingGlobalFinances(true);
        try {
          const [resReservas, resCustos] = await Promise.all([
            supabase.from('reservas').select('id, agenda_id, status_pagamento, valor_pago, metodo_pagamento, client_id, clients!reservas_client_id_fkey(full_name, phone, photo_url, birth_date), agendas(date)'),
            supabase.from('trilha_custos').select('agenda_id, valor_custo')
          ]);
          setAllReservas(resReservas.data || []);
          setAllCustos(resCustos.data || []);
        } catch (e) {
          console.error("Erro ao buscar finanças globais:", e);
        } finally {
          setIsFetchingGlobalFinances(false);
        }
      };
      fetchGlobalFinances();
    }
  }, [mainTab, financasTab]);

  const handleAddCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCustoNome || !novoCustoValor) return;
    try {
      const valor = parseFloat(novoCustoValor.replace(',', '.'));
      const { data, error } = await supabase.from('trilha_custos').insert([
        { agenda_id: selectedAgendaId, item_nome: novoCustoNome, valor_custo: valor }
      ]).select().single();
      if (error) throw error;
      setCustos([...custos, data]);
      setNovoCustoNome(''); setNovoCustoValor('');
    } catch (err: any) { alert("Erro ao adicionar custo: " + err.message); }
  };

  const handleDeleteCusto = async (id: string) => {
    if (!(await requirePin('Excluir Custo'))) return;
    try {
      await supabase.from('trilha_custos').delete().eq('id', id);
      setCustos(custos.filter(c => c.id !== id));
    } catch (err: any) { alert("Erro ao excluir custo."); }
  };

  const handleAddReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaReservaClientId) return alert("Selecione um cliente.");
    
    // Verifica se já está na lista
    if (reservas.some(r => r.client_id === novaReservaClientId)) {
      return alert("Este cliente já está na lista desta trilha.");
    }

    try {
      const response = await fetch('/api/admin/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agenda_id: selectedAgendaId,
          client_id: novaReservaClientId,
          status_pagamento: novaReservaStatus,
          valor_pago: Number(novaReservaValorPago.replace(',', '.')) || 0,
          metodo_pagamento: 'PIX',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao criar reserva manual');
      setReservas([...reservas, result.reservation]);
      setNovaReservaClientId('');
      setNovaReservaValorPago('');
    } catch (err: any) { alert("Erro ao adicionar passageiro: " + err.message); }
  };

  const handleDeleteReserva = async (id: string) => {
    if (!(await requirePin('Excluir Reserva'))) return;
    if (!window.confirm("Remover este passageiro da trilha?")) return;
    try {
      await supabase.from('reservas').delete().eq('id', id);
      setReservas(reservas.filter(r => r.id !== id));
    } catch (err: any) { alert("Erro ao remover passageiro."); }
  };

  const handleEditReservationPayment = async (reservation: any) => {
    if (!(await requirePin(`Editar pagamento de ${reservation.clients?.full_name || 'reserva'}`))) return;
    setEditingReservationPayment(reservation);
  };

  const handleReservationPaymentSaved = (updated: any) => {
    setReservas((current) => current.map((reservation) =>
      reservation.id === updated.id ? { ...reservation, ...updated } : reservation
    ));
    setAllReservas((current) => current.map((reservation) =>
      reservation.id === updated.id ? { ...reservation, ...updated } : reservation
    ));
  };

  const selectedAgendaData = agendas.find(a => a.id === selectedAgendaId);
  const totalRevenue = reservas.filter(r => r.status_pagamento === 'pago').reduce((acc, curr) => acc + Number(curr.valor_pago || 0), 0);
  const paidReservations = reservas.filter(r => r.status_pagamento === 'pago');
  const paidReservationsWithoutValue = paidReservations.filter(r => Number(r.valor_pago || 0) <= 0);
  const totalCosts = custos.reduce((acc, curr) => acc + Number(curr.valor_custo), 0);

  // --- Funções de Trilhas e IA (Mantidas intactos) ---
  const deleteAgenda = async (id: string) => {
    if (!(await requirePin('Excluir Trilha'))) return;
    if (!window.confirm("Excluir esta trilha?")) return;
    try {
      const response = await fetch(`/api/admin/agendas/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Erro ao excluir a trilha");
      await fetchAgendasAndCleanup();
    } catch (error: any) {
      alert(error.message || "Erro ao excluir.");
    }
  };

  const handleEdit = async (agenda: any) => {
    if (
      isArchivedTrailDate(agenda.date) &&
      !(await requirePin(`Editar trilha encerrada: ${agenda.title}`))
    ) return;
    setEditingAgenda(agenda);
    
    setValue("title", agenda.title);
    setValue("date", agenda.date);
    setValue("price", agenda.price.toString().replace('.', ','));
    setValue("description", agenda.description);
    setValue("meeting_point", agenda.meeting_point);
    setValue("requirements", agenda.requirements);
    setValue("max_capacity", agenda.max_capacity?.toString() || '');
    setValue("duration_hours", agenda.duration_hours?.toString() || '');
    setValue("distance_km", agenda.distance_km?.toString().replace('.', ',') || '');
    setValue("difficulty", agenda.difficulty || 'easy');
    setValue("taxa_gratis", agenda.taxa_gratis ? 'true' : 'false');
    
    // Configura os checks do payment methods baseados na agenda editada
    setAcceptedPaymentMethods(
      Array.isArray(agenda.accepted_payment_methods) && agenda.accepted_payment_methods.length
        ? Array.from(new Set<string>(
            (agenda.accepted_payment_methods as unknown[]).filter(
              (method: unknown): method is string => typeof method === 'string',
            ),
          ))
        : ['PIX'],
    );
    
    setActiveTab('geral');
    setIsFormModalOpen(true);
  };

  const handleDeleteAgendaImage = async (url: string, type: 'flyer' | 'gallery') => {
    if (!editingAgenda) return;
    if (!window.confirm(`Tem certeza que deseja excluir esta foto do ${type === 'flyer' ? 'flyer principal' : 'álbum da trilha'}?`)) return;

    try {
      // Para S3: remover da lista no banco de dados (não deletamos o arquivo do S3 aqui)
      // O arquivo permanece no S3 mas é removido da agenda no BD

      // Atualizar no Banco de Dados
      let updatedPayload: any = {};
      if (type === 'flyer') {
        updatedPayload = { flyer_url: null };
      } else {
        const newImages = (editingAgenda.images || []).filter((img: string) => img !== url);
        updatedPayload = { images: newImages };
      }

      const nextAgenda = { ...editingAgenda, ...updatedPayload };
      const response = await fetch(`/api/admin/agendas/${encodeURIComponent(editingAgenda.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agendaMutationPayload(nextAgenda)),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível remover a foto");

      // Atualiza o estado local para a UI refletir a exclusão na hora
      setEditingAgenda(result.agenda || nextAgenda);
      await fetchAgendasAndCleanup();

      alert("Foto excluída com sucesso!");
    } catch (e: any) {
      alert("Erro ao excluir foto: " + e.message);
    }
  };

  const cancelEdit = () => {
    setEditingAgenda(null); reset(); setIsFormModalOpen(false);
    setAcceptedPaymentMethods(['PIX', 'CREDIT_CARD']);
  };

  const startRecording = async (type: 'meeting_point' | 'description' | 'assistant') => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) { alert("Navegador não suporta voz."); return; }

      if ((window as any).currentRecognition) {
        try { (window as any).currentRecognition.stop(); } catch(e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR'; recognition.continuous = true; recognition.interimResults = true;

      const initialText = type === 'assistant' ? "" : (getValues(type) || "");
      let finalTranscript = "";

      recognition.onstart = () => {
        setRecordingType(type); setRecordingTime(0);
        if (type === 'assistant') setChatInput("");
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " ";
          else interimTranscript += event.results[i][0].transcript;
        }
        const currentText = finalTranscript + interimTranscript;
        if (type === 'assistant') setChatInput(currentText);
        else setValue(type, initialText + (initialText ? "\\n" : "") + currentText);
      };

      recognition.onend = () => {
        setRecordingType(null); if (timerRef.current) clearInterval(timerRef.current);
        if (type !== 'assistant') formatTextWithAI(type);
      };

      (window as any).currentRecognition = recognition; recognition.start();
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if ((window as any).currentRecognition) {
      try { (window as any).currentRecognition.stop(); } catch(e) {}
    }
    setRecordingType(null); if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSendChatMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg = text.trim(); setChatInput("");
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIsAssistantProcessing(true);

    try {
      const res = await fetch("/api/generate-full-agenda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userMsg, history: chatHistory.slice(-5) })
      });
      
      if (!res.ok) throw new Error(`Erro no servidor: ${res.status}`);
      
      const data = await res.json();
      
      if (data.result) {
        if (data.result.type === 'chat') {
          setChatHistory(prev => [...prev, { sender: 'bot', text: data.result.message }]);
        } else if (data.result.type === 'agenda') {
          setValue('title', data.result.title);
          if (data.result.date) setValue('date', data.result.date);
          setValue('price', data.result.price);
          setValue('meeting_point', data.result.meeting_point);
          setValue('description', data.result.description);
          setChatHistory(prev => [...prev, { sender: 'bot', text: `✨ Preenchi os dados de "${data.result.title}".` }]);
          setIsFormModalOpen(true);
        }
      }
    } catch (error: any) {
      console.error("Erro no Chat da IA:", error);
      setChatHistory(prev => [...prev, { sender: 'bot', text: `❌ Falha na IA. Verifique o terminal do servidor ou sua API Key. (Erro: ${error.message})` }]);
    } finally { setIsAssistantProcessing(false); }
  };

  const formatTextWithAI = async (type: 'meeting_point' | 'description') => {
    const text = getValues(type);
    if (!text || text.trim().length < 5) return;

    if (type === 'meeting_point') setIsFormattingMeetingPoint(true);
    else setIsFormattingDescription(true);

    try {
      const res = await fetch("/api/generate-message", {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, type })
      });
      
      if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
      
      const data = await res.json();
      if (data.result) {
        setValue(type, data.result);
        if (type === 'meeting_point') setAiSuccessMeeting(true); else setAiSuccessDesc(true);
      }
    } catch (error: any) {
      console.error("Erro na Formatação da IA:", error);
      alert(`Ops! A Inteligência Artificial falhou. Verifique se o backend está rodando ou se sua chave (API Key) não expirou.\n\nDetalhe: ${error.message}`);
    } 
    finally {
      if (type === 'meeting_point') setIsFormattingMeetingPoint(false);
      else setIsFormattingDescription(false);
    }
  };

  const onSubmit = async (data: AgendaForm) => {
    if (acceptedPaymentMethods.length === 0) {
      alert("Selecione pelo menos uma forma de pagamento.");
      return;
    }
    setIsLoading(true);
    try {
      let imageUrls: string[] = editingAgenda ? editingAgenda.images || [] : [];
      let videoUrl: string | null = editingAgenda ? editingAgenda.video_url : null;
      let flyerUrl: string | null = editingAgenda ? editingAgenda.flyer_url : null;

      const compressOptions = {
        maxSizeMB: 0.15,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: "image/webp"
      };
      
      // Helper para upload via API (S3)
      const uploadToS3 = async (file: File | Blob, originalName: string): Promise<string> => {
        const result = await uploadMediaToAws(file, originalName);
        return result.url;
      };

      // Upload Flyer
      if (data.flyer && data.flyer.length > 0) {
        let file: File | Blob = data.flyer[0];
        if (file.type.startsWith('image/')) {
          file = await imageCompression(file as File, compressOptions);
        }
        const ext = file.type === 'image/webp' ? 'webp' : (data.flyer[0].name.split('.').pop() || 'jpg');
        flyerUrl = await uploadToS3(file, `flyer_${Date.now()}.${ext}`);
      }
      // Upload Images
      if (data.images && data.images.length > 0) {
        if (!editingAgenda) imageUrls = [];
        for (let i = 0; i < data.images.length; i++) {
          let file: File | Blob = data.images[i];
          if (file.type.startsWith('image/')) {
            file = await imageCompression(file as File, compressOptions);
          }
          const ext = file.type === 'image/webp' ? 'webp' : (data.images[i].name.split('.').pop() || 'jpg');
          const url = await uploadToS3(file, `img_${Date.now()}_${i}.${ext}`);
          imageUrls.push(url);
        }
      }

      if (data.video && data.video.length > 0) {
        const file = data.video[0];
        videoUrl = await uploadToS3(file, `vid_${Date.now()}.${file.name.split('.').pop()}`);
      }

      const payload = {
        title: data.title, date: data.date, 
        price: data.price ? parseFloat(String(data.price).replace(',', '.')) : 0,
        description: data.description, meeting_point: data.meeting_point,
        requirements: data.requirements, max_capacity: parseInt(String(data.max_capacity)) || 0,
        duration_hours: data.duration_hours ? parseFloat(String(data.duration_hours).replace(',', '.')) : null,
        distance_km: data.distance_km ? parseFloat(String(data.distance_km).replace(',', '.')) : null,
        difficulty: data.difficulty,
        images: imageUrls, video_url: videoUrl, flyer_url: flyerUrl,
        accepted_payment_methods: acceptedPaymentMethods,
        taxa_gratis: false
      };

      const endpoint = editingAgenda
        ? `/api/admin/agendas/${encodeURIComponent(editingAgenda.id)}`
        : "/api/admin/agendas";
      const sendAgenda = () => fetch(endpoint, {
        method: editingAgenda ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let response = await sendAgenda();
      if (
        response.status === 423 &&
        editingAgenda &&
        await requirePin(`Salvar alterações em trilha encerrada: ${editingAgenda.title}`)
      ) {
        response = await sendAgenda();
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível salvar a trilha");
      }
      
      setIsFormModalOpen(false);
      reset();
      setEditingAgenda(null);
      await fetchAgendasAndCleanup();
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAvaliacao = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/moderate-avaliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'update', approved: !currentStatus })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Falha ao atualizar');
      setAvaliacoesAdmin(previous => previous.map(item => item.id === id ? { ...item, approved: !currentStatus } : item));
      setAvaliacoesError('');
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar avaliação");
    }
  };
  
  const deleteAvaliacao = async (id: string) => {
    if (!(await requirePin('Excluir Avaliação'))) return;
    if(!window.confirm("Excluir esta avaliação permanentemente?")) return;
    try {
      const res = await fetch('/api/moderate-avaliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Falha ao excluir');
      setAvaliacoesAdmin(previous => previous.filter(item => item.id !== id));
      setAvaliacoesError('');
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir avaliação");
    }
  };

  const formatDateDisplay = (dateString: string) => {
    const [year, month, day] = dateString.split('-'); return `${day}/${month}/${year}`;
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`⛰️ A nossa agenda oficial chegou! Prepare as botas!\n\n👉 https://www.maistrilhasmenosestresse.com/agenda`)}`;

  return (
    <div suppressHydrationWarning className="mt-admin-shell relative flex h-[100dvh] w-full flex-col overflow-hidden print:h-auto print:min-h-screen print:overflow-visible md:flex-row">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="mt-admin-sidebar z-20 hidden h-full w-60 shrink-0 flex-col border-r bg-white md:flex">
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 p-5">
          <div className="rounded-xl bg-[#071829] p-2 shadow-md">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900 leading-tight">Admin</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Painel de Controle</p>
          </div>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
          <button 
            onClick={() => setMainTab('trilhas')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${mainTab === 'trilhas' ? 'bg-[#FFF0E6] text-[#D96224]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <CalendarDays className="h-5 w-5" />
            Trilhas
          </button>

          <button
            type="button"
            onClick={() => window.location.assign('/admin/albuns')}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-bold text-gray-500 transition-all hover:bg-purple-50 hover:text-purple-700"
          >
            <Images className="h-5 w-5" />
            Álbuns e fotos
          </button>
          
          <button 
            onClick={() => setMainTab('clientes')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${mainTab === 'clientes' ? 'bg-[#FFF0E6] text-[#D96224]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <FileText className="h-5 w-5" />
            Clientes
          </button>

          <button 
            onClick={() => setMainTab('reservas')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${mainTab === 'reservas' ? 'bg-[#FFF0E6] text-[#D96224]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <CheckCircle2 className="h-5 w-5" />
            Reservas
          </button>

            <button 
              onClick={() => setMainTab('financas')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${mainTab === 'financas' ? 'bg-[#E7EEF6] text-[#0B2540]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <DollarSign className="h-5 w-5" />
              Finanças & Asaas
            </button>

            <button 
              onClick={() => setMainTab('loja')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${mainTab === 'loja' ? 'bg-[#FFF0E6] text-[#D96224]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Gift className="h-5 w-5" />
              Loja
            </button>

            <button 
              onClick={() => setMainTab('gamificacao')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${mainTab === 'gamificacao' ? 'bg-[#FFF0E6] text-[#D96224]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Trophy className="h-5 w-5" />
              Gamificação
            </button>

            <button
              type="button"
              onClick={() => window.location.assign('/admin/notificacoes')}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-bold text-gray-500 transition-all hover:bg-[#E7EEF6] hover:text-[#0B2540]"
            >
              <Send className="h-5 w-5" />
              Notificações do app
            </button>

            <button 
              onClick={() => setMainTab('assistente')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${mainTab === 'assistente' ? 'bg-[#FFF0E6] text-[#D96224]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <TrendingUp className="h-5 w-5" />
              CFO Assistente
            </button>
        </nav>

        <div className="p-4 border-t border-gray-100 flex flex-col items-center shrink-0">
           <button
              onClick={() => setIsAssistantOpen(true)}
              className="w-full bg-[#F17B37] hover:bg-[#e06925] text-white flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(241,123,55,0.3)] transition-all hover:scale-105"
            >
              <Sparkles className="h-5 w-5" />
              IA Assistente
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="z-10 flex shrink-0 items-center justify-between border-b border-gray-100 bg-white/95 px-3 py-3 shadow-sm backdrop-blur-xl print:hidden sm:px-4">
          <div className="flex items-center gap-3 md:hidden">
            <div className="bg-[#1D2A3A] p-2 rounded-xl shadow-md hidden sm:block">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 leading-tight">Painel Admin</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mais Trilha Menos Estresse</p>
            </div>
          </div>

          <div className="hidden min-w-0 md:block">
            <p className="mt-eyebrow">Mais Trilha Menos Estresse</p>
            <h2 className="truncate text-lg font-black text-[#071829]">
              {mainTab === 'trilhas' && 'Gestão de trilhas'}
              {mainTab === 'clientes' && 'Clientes e contratos'}
              {mainTab === 'reservas' && 'Reservas e pagamentos'}
              {mainTab === 'financas' && 'Financeiro'}
              {mainTab === 'loja' && 'Loja'}
              {mainTab === 'gamificacao' && 'Pontos e benefícios'}
              {mainTab === 'assistente' && 'CFO Assistente'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 ml-auto">
            
            {deferredPrompt && (
              <button 
                onClick={async () => {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  if (outcome === 'accepted') setDeferredPrompt(null);
                }}
                className="hidden md:flex items-center gap-1.5 bg-orange-100 text-[#F17B37] hover:bg-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                title="Instalar Aplicativo"
              >
                <DownloadCloud className="h-4 w-4" /> Instalar App
              </button>
            )}

            {deferredPrompt && (
              <button 
                onClick={async () => {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  if (outcome === 'accepted') setDeferredPrompt(null);
                }}
                className="md:hidden flex items-center justify-center p-2 text-[#F17B37] bg-orange-100 rounded-lg"
                title="Instalar Aplicativo"
              >
                <DownloadCloud className="h-5 w-5" />
              </button>
            )}

            <button 
              onClick={() => window.open('/agenda', '_blank')}
              className="hidden md:flex items-center gap-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              title="Acessar Página de Agendas Pública"
            >
              <ExternalLink className="h-4 w-4" /> Ver Site
            </button>

            <button 
              onClick={() => window.open('/agenda', '_blank')}
              className="md:hidden flex items-center justify-center p-2 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-lg"
              title="Acessar Página de Agendas Pública"
            >
              <ExternalLink className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => window.location.assign('/admin/notificacoes')}
              className="hidden items-center gap-1.5 rounded-lg bg-[#E7EEF6] px-3 py-1.5 text-xs font-bold text-[#0B2540] transition-colors hover:bg-blue-100 md:flex"
              title="Enviar notificação para o app"
            >
              <Send className="h-4 w-4" /> Avisar clientes
            </button>

            {/* NOTIFICAÇÕES */}
            <div className="relative">
              <button 
                onClick={handleOpenNotifications}
                className="relative p-2 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <Bell className="h-5 w-5 md:h-6 md:w-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Notificações</h3>
                      {notifications.length > 0 && (
                        <button onClick={handleClearNotifications} className="text-xs text-red-500 hover:text-red-700 font-bold">
                          Limpar
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-6 text-center text-gray-400 text-sm">Nenhuma notificação.</p>
                      ) : (
                        notifications.map((notif, idx) => (
                          <div 
                            key={notif.id} 
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 border-b border-gray-50 text-sm transition-colors ${notif.reserva_id ? 'cursor-pointer hover:bg-gray-100' : ''} ${idx === 0 && !notif.lida ? 'bg-blue-50/30' : ''}`}
                          >
                            <p className="text-gray-800">{notif.mensagem}</p>
                            <span className="text-[10px] text-gray-400 mt-1 block">
                              {new Date(notif.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button onClick={handleLogout} className="hidden md:flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-red-500 transition-colors px-2">
              Sair
            </button>
            <button onClick={handleLogout} className="md:hidden flex items-center justify-center p-2 text-gray-500 hover:text-red-500" title="Sair">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
      </header>

      {/* 2. ÁREA CENTRAL DE CONTEÚDO ROLÁVEL */}
      <main className="mt-admin-main custom-scrollbar min-w-0 flex-1 overflow-y-auto overscroll-contain p-2.5 pb-28 print:overflow-visible sm:p-4 md:pb-5 lg:p-5">
        <div className="max-w-7xl mx-auto w-full">
          
          <AnimatePresence mode="wait">
            {/* --- VISÃO DAS TRILHAS --- */}
            {mainTab === 'trilhas' && (
              <motion.div key="trilhas" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <AdminAgendasTab
                  agendas={agendas}
                  whatsappLink={whatsappLink}
                  isMaintenance={isMaintenance}
                  isTogglingMaintenance={isTogglingMaintenance}
                  handleToggleMaintenance={handleToggleMaintenance}
                  isArchivedTrailDate={isArchivedTrailDate}
                  globalViews={globalViews}
                  isFetching={isFetching}
                  expandedAgendaId={expandedAgendaId}
                  setExpandedAgendaId={setExpandedAgendaId}
                  formatDateDisplay={formatDateDisplay}
                  handleEdit={handleEdit}
                  deleteAgenda={deleteAgenda}
                />
              </motion.div>
            )}

            {/* --- VISÃO DOS CLIENTES --- */}
            {mainTab === 'clientes' && (
              <motion.div key="clientes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <AdminClientsTab
                  clients={clients}
                  setClients={setClients}
                  clientesTab={clientesTab}
                  setClientesTab={setClientesTab}
                  clientSortMode={clientSortMode}
                  setClientSortMode={setClientSortMode}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  expandedClientId={expandedClientId}
                  setExpandedClientId={setExpandedClientId}
                  selectedClients={selectedClients}
                  setSelectedClients={setSelectedClients}
                  editingClient={editingClient}
                  setEditingClient={setEditingClient}
                  expandedTrilhas={expandedTrilhas}
                  setExpandedTrilhas={setExpandedTrilhas}
                  clientTrails={clientTrails}
                  loadClientTrails={loadClientTrails}
                  requirePin={requirePin}
                  handleBulkDelete={handleBulkDelete}
                  handleDeleteClient={handleDeleteClient}
                  handleSaveEditedClient={handleSaveEditedClient}
                  filteredClients={filteredClients}
                  isBirthday={isBirthday}
                  agendas={agendas}
                  selectedAgendaId={selectedAgendaId}
                  setSelectedAgendaId={setSelectedAgendaId}
                  formatDateDisplay={formatDateDisplay}
                  isFetchingDetails={isFetchingDetails}
                  avaliacoesAdmin={avaliacoesAdmin}
                  avaliacoesError={avaliacoesError}
                  toggleAvaliacao={toggleAvaliacao}
                  deleteAvaliacao={deleteAvaliacao}
                  reloadAvaliacoes={fetchAgendasAndCleanup}
                  generateWhatsAppVan={generateWhatsAppVan}
                  generateWhatsAppSeguro={generateWhatsAppSeguro}
                  handlePrint={handlePrint}
                />
              </motion.div>
            )}

            {/* --- VISÃO DE RESERVAS (LISTA DE PASSAGEIROS) --- */}
            {mainTab === 'reservas' && (
              <motion.div key="reservas" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6">
                <AdminReservationsTab
                  agendas={agendas}
                  selectedAgendaId={selectedAgendaId}
                  setSelectedAgendaId={setSelectedAgendaId}
                  reservas={reservas}
                  reservaFilter={reservaFilter}
                  setReservaFilter={setReservaFilter}
                  formatCurrency={formatCurrency}
                  formatDateDisplay={formatDateDisplay}
                  formatPaymentMethod={formatPaymentMethod}
                  isFetchingDetails={isFetchingDetails}
                  detailsError={detailsError}
                  requirePin={requirePin}
                  setReservas={setReservas}
                  handleExportCSV={handleExportCSV}
                  handlePrint={handlePrint}
                  generateWhatsAppVan={generateWhatsAppVan}
                  generateWhatsAppSeguro={generateWhatsAppSeguro}
                  clients={clients}
                  novaReservaClientId={novaReservaClientId}
                  setNovaReservaClientId={setNovaReservaClientId}
                  novaReservaClientSearch={novaReservaClientSearch}
                  setNovaReservaClientSearch={setNovaReservaClientSearch}
                  isNovaReservaSearchFocused={isNovaReservaSearchFocused}
                  setIsNovaReservaSearchFocused={setIsNovaReservaSearchFocused}
                  novaReservaStatus={novaReservaStatus}
                  setNovaReservaStatus={setNovaReservaStatus}
                  novaReservaValorPago={novaReservaValorPago}
                  setNovaReservaValorPago={setNovaReservaValorPago}
                  handleAddReserva={handleAddReserva}
                  setEditingReservationPayment={setEditingReservationPayment}
                />
              </motion.div>
            )}

            {/* --- VISÃO FINANCEIRA --- */}
            {mainTab === 'financas' && (
              <motion.div key="financas" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                <AdminFinancesTab
                  financasTab={financasTab}
                  setFinancasTab={setFinancasTab}
                  selectedAgendaId={selectedAgendaId}
                  setSelectedAgendaId={setSelectedAgendaId}
                  agendas={agendas}
                  formatDateDisplay={formatDateDisplay}
                  isFetchingDetails={isFetchingDetails}
                  novoCustoNome={novoCustoNome}
                  setNovoCustoNome={setNovoCustoNome}
                  novoCustoValor={novoCustoValor}
                  setNovoCustoValor={setNovoCustoValor}
                  handleAddCusto={handleAddCusto}
                  handleDeleteCusto={handleDeleteCusto}
                  custos={custos}
                  totalCosts={totalCosts}
                  formatCurrency={formatCurrency}
                  totalRevenue={totalRevenue}
                  reservas={reservas}
                  selectedAgendaData={selectedAgendaData}
                  getReservaNetProfit={getReservaNetProfit}
                  isFetchingGlobalFinances={isFetchingGlobalFinances}
                  allReservas={allReservas}
                  allCustos={allCustos}
                  reportYear={reportYear}
                  setReportYear={setReportYear}
                  reportMonth={reportMonth}
                  setReportMonth={setReportMonth}
                  expandedReportId={expandedReportId}
                  setExpandedReportId={setExpandedReportId}
                  handleGenerateCFOAdvice={handleGenerateCFOAdvice}
                  handleExportCSV={handleExportCSV}
                />
              </motion.div>
            )}

              {/* --- VISÃO DE LOJA --- */}
              {mainTab === 'loja' && (
                <motion.div key="loja" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                  <LojaDashboard />
                </motion.div>
              )}

              {/* --- VISÃO DE GAMIFICAÇÃO --- */}
              {mainTab === 'gamificacao' && (
                <motion.div key="gamificacao" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                  <GamificacaoDashboard />
                </motion.div>
              )}

              {mainTab === 'assistente' && (
                <motion.div key="assistente" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <h2 className="text-xl font-black text-gray-800 mb-2 flex items-center gap-2"><TrendingUp className="h-6 w-6 text-amber-500" /> Assistente Financeiro (CFO)</h2>
                    <p className="text-gray-500 mb-6">Selecione uma trilha abaixo para ver a análise de lucros, custos declarados e simulador de desconto máximo.</p>
                    
                    <label className="text-sm font-bold text-gray-700 mb-2 block">Selecione a Trilha para análise:</label>
                    <select
                      value={selectedAgendaId}
                      onChange={(e) => setSelectedAgendaId(e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-gray-700"
                    >
                      <option value="">-- Escolha uma trilha --</option>
                      {agendas.map(a => (
                        <option key={a.id} value={a.id}>{a.title} ({a.date ? a.date.split('-').reverse().join('/') : ''})</option>
                      ))}
                    </select>
                  </div>

                  {selectedAgendaId && (() => {
                    const selectedAgenda = agendas.find(a => a.id === selectedAgendaId);
                    if (!selectedAgenda) return null;
                    return (
                      <AssistenteFinanceiroView 
                        agenda={selectedAgenda} 
                        reservas={allReservas} 
                        custos={allCustos} 
                      />
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>

            <section id="admin-print-report" className="hidden print:block">
              <div className="text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="text-2xl font-black uppercase tracking-widest mb-2">
                  {printMode === 'van'
                    ? `Lista de embarque — ${agendas.find(agenda => agenda.id === selectedAgendaId)?.title || 'Trilha'}`
                    : printMode === 'seguro'
                      ? `Lista para seguro — ${agendas.find(agenda => agenda.id === selectedAgendaId)?.title || 'Trilha'}`
                      : 'Relatório geral de clientes'}
                </h1>
                <p className="text-sm text-gray-600">
                  Mais Trilha Menos Estresse · Emissão: {printIssuedAt || '—'}
                </p>
              </div>

              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  {printMode === 'van' ? (
                    <tr>
                      <th className="border p-2 w-12 text-center">#</th>
                      <th className="border p-2">Passageiro</th>
                      <th className="border p-2">CPF</th>
                      <th className="border p-2">Telefone</th>
                      <th className="border p-2">Embarque</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="border p-2 w-12 text-center">#</th>
                      <th className="border p-2">Cliente</th>
                      <th className="border p-2">Documentos</th>
                      <th className="border p-2">Contato</th>
                      <th className="border p-2">Emergência</th>
                      <th className="border p-2">Saúde e observações</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {(printMode === 'todos'
                    ? clients
                    : reservas
                        .filter(reserva => reserva.status_pagamento === 'pago' || reserva.status_pagamento === 'pendente')
                        .map(reserva => reserva.clients)
                        .filter(Boolean)
                  ).map((client, index) => (
                    printMode === 'van' ? (
                      <tr key={`${client.id}-${index}`}>
                        <td className="border p-2 text-center font-bold">{index + 1}</td>
                        <td className="border p-2 font-bold text-xs">{client.full_name || 'Nome não informado'}</td>
                        <td className="border p-2 text-xs">{client.cpf || 'N/A'}</td>
                        <td className="border p-2 text-xs">{client.phone || 'N/A'}</td>
                        <td className="border p-2">□</td>
                      </tr>
                    ) : (
                      <tr key={`${client.id}-${index}`}>
                        <td className="border p-2 text-center font-bold">{index + 1}</td>
                        <td className="border p-2 font-bold">
                          {client.full_name || 'Nome não informado'}<br />
                          <span className="font-normal text-[8px]">Nascimento: {client.birth_date ? String(client.birth_date).split('-').reverse().join('/') : 'N/A'}</span>
                        </td>
                        <td className="border p-2">CPF: {client.cpf || 'N/A'}<br />RG: {client.rg || 'N/A'}</td>
                        <td className="border p-2">{client.phone || 'N/A'}<br />{client.email || 'N/A'}</td>
                        <td className="border p-2">{client.emergency_contact_name || 'N/A'}<br />{client.emergency_contact_phone || 'N/A'}</td>
                        <td className="border p-2 text-red-700 font-bold max-w-[220px] whitespace-pre-wrap">{client.health_notes || 'Nenhuma observação'}</td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <PinModal isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); if(pinAction) pinAction.onCancel(); }} onSuccess={() => { if(pinAction) pinAction.onConfirm(); }} actionName={pinAction?.name} />
      </main>

      {/* 3. BOTÃO FLUTUANTE (FAB) PARA NOVA TRILHA */}
      {mainTab === 'trilhas' && (
        <button 
          onClick={() => {
            reset();
            setEditingAgenda(null);
            setAcceptedPaymentMethods(['PIX', 'CREDIT_CARD']);
            setValue("taxa_gratis", "false");
            setIsFormModalOpen(true);
          }}
          className="fixed bottom-24 right-5 md:bottom-8 md:right-8 bg-[#F17B37] text-white p-4 rounded-full shadow-[0_8px_30px_rgba(241,123,55,0.4)] hover:scale-105 active:scale-95 transition-all z-20 print:hidden flex items-center justify-center"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      
        {/* MOBILE DRAWER MENU */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
              <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 bottom-0 left-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-2xl">
                <div className="p-6 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#1D2A3A] p-2 rounded-xl shadow-md"><ShieldCheck className="h-6 w-6 text-white" /></div>
                    <div><h1 className="text-lg font-black text-gray-900 leading-tight">Admin</h1></div>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X className="h-5 w-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <button onClick={() => { setMainTab('trilhas'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mainTab === 'trilhas' ? 'bg-orange-50 text-[#F17B37]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><CalendarDays className="h-5 w-5" /> Trilhas</button>
                  <button type="button" onClick={() => window.location.assign('/admin/albuns')} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-500 transition-all hover:bg-purple-50 hover:text-purple-700"><Images className="h-5 w-5" /> Álbuns e fotos</button>
                  <button onClick={() => { setMainTab('clientes'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mainTab === 'clientes' ? 'bg-orange-50 text-[#F17B37]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><FileText className="h-5 w-5" /> Clientes</button>
                  <button onClick={() => { setMainTab('reservas'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mainTab === 'reservas' ? 'bg-orange-50 text-[#F17B37]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><CheckCircle2 className="h-5 w-5" /> Reservas</button>
                  <button onClick={() => { setMainTab('financas'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mainTab === 'financas' ? 'bg-green-50 text-[#25D366]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><DollarSign className="h-5 w-5" /> Finanças</button>
                  <button onClick={() => { setMainTab('loja'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mainTab === 'loja' ? 'bg-blue-50 text-blue-500' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><Gift className="h-5 w-5" /> Loja Virtual</button>
                  <button onClick={() => { setMainTab('gamificacao'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mainTab === 'gamificacao' ? 'bg-purple-50 text-purple-500' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><Trophy className="h-5 w-5" /> Gamificação</button>
                  <button type="button" onClick={() => window.location.assign('/admin/notificacoes')} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold text-gray-500 transition-all hover:bg-blue-50 hover:text-[#0B2540]"><Send className="h-5 w-5" /> Notificações do app</button>
                  <button onClick={() => { setMainTab('assistente'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mainTab === 'assistente' ? 'bg-amber-50 text-amber-500' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><TrendingUp className="h-5 w-5" /> CFO Assistente</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 4. MENU INFERIOR (BOTTOM NAVIGATION) TIPO APP */}
        <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full z-30 pb-safe print:hidden md:hidden shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
          <div className="flex justify-around items-center max-w-lg mx-auto relative px-2">
            
            <button 
              onClick={() => setMainTab('trilhas')}
              className={`flex flex-col items-center justify-center w-full py-3 transition-colors relative ${mainTab === 'trilhas' ? 'text-[#F17B37]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {mainTab === 'trilhas' && <motion.div layoutId="nav-pill" className="absolute top-0 w-10 h-1 bg-[#F17B37] rounded-b-full" />}
              <CalendarDays className="h-5 w-5 mb-1" />
              <span className="text-[11px] font-bold tracking-wide">Trilhas</span>
            </button>
  
            <button 
              onClick={() => setMainTab('financas')}
              className={`flex flex-col items-center justify-center w-full py-3 transition-colors relative ${mainTab === 'financas' ? 'text-[#25D366]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {mainTab === 'financas' && <motion.div layoutId="nav-pill" className="absolute top-0 w-10 h-1 bg-[#25D366] rounded-b-full" />}
              <DollarSign className="h-5 w-5 mb-1" />
              <span className="text-[11px] font-bold tracking-wide">Finanças</span>
            </button>
            
            {/* BOTÃO ASSISTENTE IA CENTRALIZADO */}
            <div className="relative -top-6 flex justify-center w-[70px] shrink-0 mx-1">
              <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 w-[56px] h-[56px] bg-[#F17B37] rounded-full z-30 pointer-events-none" />
              <motion.button
                onClick={() => setIsAssistantOpen(true)}
                animate={{ y: [0, -4, 0] }} transition={{ y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9, rotate: -5 }}
                className="absolute bg-white rounded-full shadow-[0_0_20px_rgba(241,123,55,0.6)] z-40 border-[3px] border-[#F17B37] overflow-hidden flex items-center justify-center p-0.5" style={{ width: '56px', height: '56px' }}
              >
                <img src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/logo.png" alt="IA" className="h-full w-full object-cover scale-110 rounded-full" />
              </motion.button>
            </div>
  
            <button 
              onClick={() => setMainTab('loja')}
              className={`flex flex-col items-center justify-center w-full py-3 transition-colors relative ${mainTab === 'loja' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {mainTab === 'loja' && <motion.div layoutId="nav-pill" className="absolute top-0 w-10 h-1 bg-blue-500 rounded-b-full" />}
              <Gift className="h-5 w-5 mb-1" />
              <span className="text-[11px] font-bold tracking-wide">Loja</span>
            </button>
  
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center w-full py-3 transition-colors relative text-gray-400 hover:text-gray-600"
            >
              <Navigation className="h-5 w-5 mb-1" />
              <span className="text-[11px] font-bold tracking-wide">Mais</span>
            </button>
  
          </div>
        </nav>

      </div>

      {/* --- MODAL: FORMULÁRIO DE TRILHA (TELA CHEIA) --- */}
      <AnimatePresence>
        {isFormModalOpen && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[60] bg-white flex flex-col h-[100dvh] overflow-hidden print:hidden"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CalendarDays className={`h-5 w-5 ${editingAgenda ? 'text-blue-500' : 'text-[#F17B37]'}`} /> 
                {editingAgenda ? 'Editar Trilha' : 'Nova Trilha'}
              </h2>
              <button type="button" onClick={cancelEdit} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex border-b border-gray-100 bg-white shrink-0">
              <button type="button" onClick={() => setActiveTab('geral')} className={`flex-1 min-w-0 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'geral' ? 'border-[#F17B37] text-[#F17B37]' : 'border-transparent text-gray-500'}`}>Dados</button>
              <button type="button" onClick={() => setActiveTab('textos')} className={`flex-1 min-w-0 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'textos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>IA / Textos</button>
              <button type="button" onClick={() => setActiveTab('midias')} className={`flex-1 min-w-0 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'midias' ? 'border-orange-400 text-orange-500' : 'border-transparent text-gray-500'}`}>Mídias</button>
            </div>
            
            <form id="admin-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-24">
              
              <div className={activeTab === 'geral' ? 'block' : 'hidden'}>
                <div className="space-y-4 max-w-2xl mx-auto">
                  <div><label className="block text-sm font-bold mb-1">Título</label><input {...register("title", { required: true })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#F17B37]" placeholder="Ex: Serra do Cipó" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-bold mb-1">Data</label><input type="date" {...register("date", { required: true })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#F17B37]" /></div>
                    <div>
                      <label className="block text-sm font-bold mb-1">Valor líquido desejado</label>
                      <input {...register("price", { required: true })} inputMode="decimal" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#F17B37]" placeholder="150,00" />
                      <p className="mt-1 text-[10px] leading-tight text-gray-500">
                        Este é o valor líquido da venda. Pix e cartão serão processados pela InfinitePay; boleto será processado pelo Asaas.
                      </p>
                    </div>
                    <div><label className="block text-sm font-bold mb-1">Vagas</label><input type="number" {...register("max_capacity", { required: true })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#F17B37]" placeholder="15" /></div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-bold mb-1">Duração (h)</label><input type="number" step="0.5" {...register("duration_hours")} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#F17B37]" placeholder="4.5" /></div>
                    <div><label className="block text-sm font-bold mb-1">Distância (km)</label><input type="number" step="0.1" {...register("distance_km")} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#F17B37]" placeholder="12" /></div>
                    <div>
                      <label className="block text-sm font-bold mb-1">Dificuldade</label>
                      <select {...register("difficulty")} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#F17B37]">
                        <option value="easy">Fácil</option>
                        <option value="medium">Média</option>
                        <option value="hard">Difícil</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* FORMAS DE PAGAMENTO ACEITAS */}
                  <div className="mt-4 p-4 border border-gray-200 rounded-2xl bg-gray-50/50">
                    <label className="block text-sm font-bold mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600"/> Formas de Pagamento Permitidas
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { key: 'PIX', methods: ['PIX'], label: 'Pix (Asaas)' },
                        { key: 'CREDIT_CARD', methods: ['CREDIT_CARD'], label: 'Cartão (Asaas)' },
                        { key: 'BOLETO', methods: ['BOLETO'], label: 'Boleto (Asaas)' },
                      ].map(option => (
                        <label key={option.key} className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-gray-200 hover:border-orange-300 transition-colors">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-[#F17B37] rounded focus:ring-[#F17B37]"
                            checked={option.methods.some(method => acceptedPaymentMethods.includes(method))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAcceptedPaymentMethods(prev => [...new Set([...prev, ...option.methods])]);
                              } else {
                                setAcceptedPaymentMethods(prev => prev.filter(method => !option.methods.includes(method)));
                              }
                            }}
                          />
                          <span className="text-sm font-medium text-gray-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                      <CreditCard className="h-4 w-4" /> Repasse automático das tarifas
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                      O sistema calcula a tarifa da forma escolhida e acrescenta o valor necessário para preservar o preço líquido configurado.
                    </p>
                  </div>
                </div>
              </div>

              <div className={activeTab === 'textos' ? 'block' : 'hidden'}>
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div className="p-4 rounded-2xl border bg-blue-50/50 border-blue-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-bold text-gray-800">📍 Pontos de Encontro</label>
                      <button type="button" onClick={() => recordingType === 'meeting_point' ? stopRecording() : startRecording('meeting_point')} className={`text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1 ${recordingType === 'meeting_point' ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-blue-600 shadow-sm border border-blue-200'}`}>
                        {recordingType === 'meeting_point' ? <Square className="h-3 w-3 fill-white" /> : <Mic className="h-4 w-4" />} Gravar
                      </button>
                    </div>
                    <textarea {...register("meeting_point", { required: true })} className="w-full h-32 p-4 bg-white border border-gray-200 rounded-xl outline-none resize-none text-sm" placeholder="Grave ou digite..." />
                    <button 
                        type="button" 
                        onClick={() => formatTextWithAI('meeting_point')}
                        disabled={isFormattingMeetingPoint || !watch('meeting_point')}
                        className="mt-2 w-full text-sm bg-blue-600 text-white py-2 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {isFormattingMeetingPoint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {aiSuccessMeeting ? "Texto Formatado!" : "Formatar com IA"}
                      </button>
                  </div>

                  <div className="p-4 rounded-2xl border bg-purple-50/50 border-purple-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-bold text-gray-800">📝 Roteiro</label>
                      <button type="button" onClick={() => recordingType === 'description' ? stopRecording() : startRecording('description')} className={`text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1 ${recordingType === 'description' ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-purple-600 shadow-sm border border-purple-200'}`}>
                        {recordingType === 'description' ? <Square className="h-3 w-3 fill-white" /> : <Mic className="h-4 w-4" />} Gravar
                      </button>
                    </div>
                    <textarea {...register("description", { required: true })} className="w-full h-40 p-4 bg-white border border-gray-200 rounded-xl outline-none resize-none text-sm" placeholder="Grave ou digite..." />
                    <button 
                        type="button" 
                        onClick={() => formatTextWithAI('description')}
                        disabled={isFormattingDescription || !watch('description')}
                        className="mt-2 w-full text-sm bg-purple-600 text-white py-2 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-purple-700 transition disabled:opacity-50"
                      >
                        {isFormattingDescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {aiSuccessDesc ? "Texto Formidável!" : "Gerar Texto Lindo com IA"}
                      </button>
                  </div>
                </div>
              </div>

              <div className={activeTab === 'midias' ? 'block' : 'hidden'}>
                <div className="space-y-6 max-w-2xl mx-auto">
                  
                  {/* FLYER PRINCIPAL */}
                  <div>
                    <h3 className="font-black text-gray-800 mb-2">Flyer Principal</h3>
                    {editingAgenda?.flyer_url && (
                      <div className="relative w-full h-48 rounded-2xl overflow-hidden mb-3 border border-gray-200 group">
                        <img src={editingAgenda.flyer_url} alt="Flyer" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={() => handleDeleteAgendaImage(editingAgenda.flyer_url, 'flyer')}
                            className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg transform hover:scale-110 transition-transform"
                            title="Excluir Flyer"
                          >
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="border-2 border-dashed border-[#F17B37] bg-[#F17B37]/5 hover:bg-[#F17B37]/10 transition-colors rounded-2xl p-6 text-center relative group">
                      <FileUp className="mx-auto h-8 w-8 text-[#F17B37] mb-2" />
                      <p className="font-bold text-gray-700">{editingAgenda?.flyer_url ? 'Substituir Flyer' : 'Adicionar Flyer Principal'}</p>
                      <input type="file" accept="image/*" {...register("flyer")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* FOTOS DA GALERIA */}
                  <div>
                    <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="font-black text-gray-800">Galeria comercial da trilha</h3>
                        <p className="mt-1 text-xs text-gray-500">Estas imagens aparecem na página de venda antes da compra. Não são o álbum dos participantes.</p>
                      </div>
                      <a href="/admin/albuns" className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">
                        <Images className="h-4 w-4" /> Gerenciar álbum dos clientes
                      </a>
                    </div>
                    {editingAgenda?.images && editingAgenda.images.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {editingAgenda.images.map((img: string, idx: number) => (
                          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group shadow-sm">
                            <img src={img} alt={`Galeria ${idx}`} className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 flex items-center justify-center">
                              <button 
                                type="button"
                                onClick={() => handleDeleteAgendaImage(img, 'gallery')}
                                className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg transform hover:scale-110 transition-transform"
                                title="Excluir Foto"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="border-2 border-dashed border-orange-200 bg-orange-50/50 hover:bg-orange-50 transition-colors rounded-2xl p-6 text-center relative">
                      <ImageIcon className="mx-auto h-8 w-8 text-orange-400 mb-2" />
                      <p className="font-bold text-gray-700">Adicionar fotos para a página de venda</p>
                      <input type="file" multiple accept="image/*" {...register("images")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* VIDEO PROMOCIONAL */}
                  <div>
                    <h3 className="font-black text-gray-800 mb-2">Vídeo Promocional</h3>
                    {editingAgenda?.video_url && (
                       <p className="text-sm text-green-600 font-bold mb-3 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Vídeo já cadastrado na trilha</p>
                    )}
                    <div className="border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors rounded-2xl p-6 text-center relative group">
                      <Video className="mx-auto h-8 w-8 text-blue-400 mb-2" />
                      <p className="font-bold text-gray-700">{editingAgenda?.video_url ? 'Substituir Vídeo Promocional' : 'Upload de Vídeo'}</p>
                      <p className="text-xs font-bold text-blue-600 mt-2 bg-white inline-block px-3 py-1 rounded-full shadow-sm">
                        {selectedVideo && selectedVideo.length > 0 ? 'Vídeo selecionado' : 'Opcional (Máx 15MB recomendado)'}
                      </p>
                      <input type="file" accept="video/*" {...register("video")} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>

                  <MediaUploadSection agendaId={editingAgenda?.id || ''} />

                </div>
              </div>
            </form>

            <div className="p-4 bg-white border-t border-gray-100 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-safe">
              <button type="submit" form="admin-form" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-[#1D2A3A] text-white p-4 rounded-2xl font-bold shadow-lg disabled:opacity-70">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingAgenda ? 'Salvar Edição' : 'Cadastrar Trilha')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CFO VIRTUAL */}
      <AnimatePresence>
        {isCFOModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <h2 className="font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-300" /> CFO Virtual IA</h2>
                <button onClick={() => setIsCFOModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition"><X className="h-5 w-5"/></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                {isFetchingCFO ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
                    <p className="font-bold">O CFO está analisando suas planilhas...</p>
                    <p className="text-sm">Isso pode levar alguns segundos.</p>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm md:text-base">
                    {cfoAdvice}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                <button onClick={() => setIsCFOModalOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-xl font-bold transition">
                  Fechar Relatório
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    
      {isAssistantOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col h-[85vh] max-h-[800px]">
            
            <div className="bg-gradient-to-r from-gray-900 to-black border-b-2 border-[#F17B37] p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="rounded-full overflow-hidden border border-white/20 shadow-sm w-10 h-10 flex shrink-0">
                  <img src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/logo.png" alt="Logo" className="w-full h-full object-cover scale-110" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Assistente IA</h3>
                  <p className="text-purple-100 text-xs mt-0.5">Converse ou mande cadastrar trilhas</p>
                </div>
              </div>
              <button onClick={() => { setIsAssistantOpen(false); stopRecording(); }} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 bg-gray-50 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.sender === 'user' 
                      ? 'bg-purple-600 text-white rounded-br-none shadow-sm' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm whitespace-pre-wrap'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              
              {isAssistantProcessing && (
                <div className="flex w-full justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1.5 shadow-sm">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="bg-white border-t border-gray-100 p-3 shrink-0">
              <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 p-1.5 rounded-3xl focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-400 transition-all">
                <textarea 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isAssistantProcessing && recordingType !== 'assistant') {
                        handleSendChatMessage(chatInput);
                      }
                    }
                  }}
                  placeholder="Digite ou grave áudio..."
                  className="flex-1 max-h-32 min-h-[44px] bg-transparent outline-none p-3 text-sm resize-none custom-scrollbar"
                  rows={1}
                />
                
                {chatInput.trim() && recordingType !== 'assistant' ? (
                  <button 
                    onClick={() => handleSendChatMessage(chatInput)}
                    disabled={isAssistantProcessing}
                    className="bg-purple-600 text-white h-11 w-11 rounded-full flex items-center justify-center shrink-0 hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    <Send className="h-5 w-5 ml-1" />
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      if (recordingType === 'assistant') {
                        stopRecording();
                        // Como o finalTranscript de dentro da closure pode estar desatualizado,
                        // pegamos o texto atual do chatInput e enviamos
                        if (chatInput.trim().length > 3) {
                          handleSendChatMessage(chatInput.trim());
                        }
                      } else {
                        startRecording('assistant');
                      }
                    }}
                    disabled={isAssistantProcessing}
                    className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      recordingType === 'assistant' 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {recordingType === 'assistant' ? <Square className="h-5 w-5 fill-white" /> : <Mic className="h-5 w-5" />}
                  </button>
                )}
              </div>
              {recordingType === 'assistant' && (
                <p className="text-center text-xs text-red-500 font-bold mt-2 animate-pulse">Gravando... {formatRecordingTime(recordingTime)}</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE RECIBO DE COMPRA (NOTIFICAÇÃO) */}
      {notificationReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setNotificationReceipt(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black text-gray-900">Compra Aprovada!</h2>
              <p className="text-sm text-gray-500 mt-1">Detalhes do passageiro</p>
            </div>
            
            <div className="space-y-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Passageiro(a)</span>
                <span className="font-bold text-gray-900 text-right">{notificationReceipt.clients?.full_name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Trilha</span>
                <span className="font-bold text-gray-900 text-right">{notificationReceipt.agendas?.title}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Valor da Vaga</span>
                <span className="font-bold text-green-600">{notificationReceipt.valor_pago ? formatCurrency(notificationReceipt.valor_pago) : "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Método de Pag.</span>
                <span className="font-bold text-gray-900 uppercase">{notificationReceipt.metodo_pagamento || "PIX/Cartão"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data e Hora</span>
                <span className="font-bold text-gray-900 text-right">{new Date(notificationReceipt.created_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <button 
              onClick={() => {
                setNotificationReceipt(null);
                setMainTab('reservas');
                setSelectedAgendaId(notificationReceipt.agenda_id);
              }}
              className="mt-6 w-full py-3 bg-[#F17B37] text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              Ver Lista da Trilha
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE CLIENTE */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditedClient} className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button 
              type="button"
              onClick={() => setEditingClient(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-500" /> Editar Cliente
            </h2>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                <input 
                  type="text" required
                  value={editingClient.full_name}
                  onChange={e => setEditingClient({...editingClient, full_name: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">CPF</label>
                  <input 
                    type="text" required
                    value={editingClient.cpf}
                    onChange={e => setEditingClient({...editingClient, cpf: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">RG</label>
                  <input 
                    type="text" required
                    value={editingClient.rg}
                    onChange={e => setEditingClient({...editingClient, rg: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
                  <input 
                    type="email" required
                    value={editingClient.email}
                    onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                  <input 
                    type="text" required
                    value={editingClient.phone}
                    onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Saúde / Observações</label>
                <textarea 
                  value={editingClient.health_notes}
                  onChange={e => setEditingClient({...editingClient, health_notes: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none" 
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                type="button" 
                onClick={() => setEditingClient(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" /> Salvar Edição
              </button>
            </div>
          </form>
        </div>
      )}

      <ReservationPaymentEditor
        reservation={editingReservationPayment}
        onClose={() => setEditingReservationPayment(null)}
        onSaved={handleReservationPaymentSaved}
      />

    </div>
  );
}
