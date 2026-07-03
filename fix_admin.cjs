const fs = require('fs');

let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

const trilhasStart = content.indexOf("{mainTab === 'trilhas' && (");
const clientesStart = content.indexOf("{mainTab === 'clientes' && (");
const reservasStart = content.indexOf("{mainTab === 'reservas' && (");
const financasStart = content.indexOf("{mainTab === 'financas' && (");
const financasEnd = content.indexOf("</main>", financasStart);
const financasRealEnd = content.lastIndexOf(")}", financasEnd - 1) + 2;

if (trilhasStart > -1 && clientesStart > -1 && reservasStart > -1 && financasStart > -1) {
  
  const trilhasBlock = content.slice(trilhasStart, clientesStart);
  const clientesBlock = content.slice(clientesStart, reservasStart);
  const reservasBlock = content.slice(reservasStart, financasStart);
  const financasBlock = content.slice(financasStart, financasRealEnd);

  fs.writeFileSync('src/components/admin/AbaTrilhas.tsx', 
    "import React from 'react';\nimport { motion } from 'framer-motion';\nimport { Plus, CheckCircle2, Copy, Users, DollarSign, Calendar, Edit2, Trash2, MapPin, Search } from 'lucide-react';\nimport Image from 'next/image';\n\nexport function AbaTrilhas(props: any) {\n  const { agendas, filteredAgendas, globalViews, openCreateModal, setIsEditing, setSelectedAgenda, handleCopyLink, handleDelete, formatDateDisplay, searchTerm, setSearchTerm, mainTab } = props;\n  return (\n    <>\n      " + trilhasBlock + "\n    </>\n  );\n}");

  fs.writeFileSync('src/components/admin/AbaClientes.tsx', 
    "import React from 'react';\nimport { Search, User, FileText, Send, Edit2, Trash2, Loader2, Printer, MapPin } from 'lucide-react';\nimport { motion } from 'framer-motion';\n\nexport function AbaClientes(props: any) {\n  const { clientesTab, setClientesTab, searchTerm, setSearchTerm, filteredClients, expandedClientId, setExpandedClientId, setEditingClient, handleDeleteClient, handleResendContract, agendas, selectedAgendaId, setSelectedAgendaId, isFetchingDetails, generateWhatsAppVan, generateWhatsAppSeguro, handlePrint, printMode, clients, reservas, avaliacoesAdmin, toggleAvaliacao, deleteAvaliacao, formatDateDisplay, mainTab } = props;\n  return (\n    <>\n      " + clientesBlock + "\n    </>\n  );\n}");

  fs.writeFileSync('src/components/admin/AbaReservas.tsx', 
    "import React from 'react';\nimport { Search, User, Loader2, RefreshCw } from 'lucide-react';\nimport { motion } from 'framer-motion';\n\nexport function AbaReservas(props: any) {\n  const { reservasTab, setReservasTab, searchTerm, setSearchTerm, filteredReservas, isFetchingGlobalFinances, fetchGlobalFinances, formatDateDisplay, setAllReservas, mainTab } = props;\n  return (\n    <>\n      " + reservasBlock + "\n    </>\n  );\n}");

  fs.writeFileSync('src/components/admin/AbaFinancas.tsx', 
    "import React from 'react';\nimport { DollarSign, Loader2, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, CalendarDays, ChevronUp, ChevronDown, Users } from 'lucide-react';\nimport { motion, AnimatePresence } from 'framer-motion';\nimport { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, Cell } from 'recharts';\n\nexport function AbaFinancas(props: any) {\n  const { financasTab, setFinancasTab, selectedAgendaId, setSelectedAgendaId, agendas, isFetchingDetails, isFetchingGlobalFinances, handleAddCusto, novoCustoNome, setNovoCustoNome, novoCustoValor, setNovoCustoValor, handleDeleteCusto, totalRevenue, totalCosts, netProfit, profitMargin, reservas, selectedAgendaData, filteredAllReservas, filteredAllCustos, handleRefreshGlobalFinances, allCustos, mainTab, setReportMonth, reportMonth, reportYear, expandedReportId, setExpandedReportId, formatDateDisplay, allReservas } = props;\n  return (\n    <>\n      " + financasBlock + "\n    </>\n  );\n}");

  console.log("SUCCESS");
} else {
  console.log("FAILED TO FIND BOUNDARIES");
}
