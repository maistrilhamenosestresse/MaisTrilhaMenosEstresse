const fs = require('fs');

let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// Find boundaries
const trilhasStart = content.indexOf("{mainTab === 'trilhas' && (");
const clientesStart = content.indexOf("{mainTab === 'clientes' && (");
const reservasStart = content.indexOf("{mainTab === 'reservas' && (");
const financasStart = content.indexOf("{mainTab === 'financas' && (");
const financasEnd = content.indexOf("</main>", financasStart);

if (trilhasStart > -1 && clientesStart > -1 && reservasStart > -1 && financasStart > -1) {
  
  // Extract JSX blocks (rough approximation using string offsets)
  const trilhasBlock = content.slice(trilhasStart, clientesStart);
  const clientesBlock = content.slice(clientesStart, reservasStart);
  const reservasBlock = content.slice(reservasStart, financasStart);
  const financasBlock = content.slice(financasStart, financasEnd);

  // We write them out to separate files wrapped in a basic component
  fs.writeFileSync('src/components/admin/AbaTrilhas.tsx', 
    import React from 'react';\nimport { motion } from 'framer-motion';\nimport { Plus, CheckCircle2, Copy, Users, DollarSign, Calendar, Edit2, Trash2, MapPin, Search } from 'lucide-react';\nimport Image from 'next/image';\n\nexport function AbaTrilhas(props: any) {\n  const { agendas, filteredAgendas, globalViews, openCreateModal, setIsEditing, setSelectedAgenda, handleCopyLink, handleDelete, formatDateDisplay, searchTerm, setSearchTerm } = props;\n  return (\n    <>\n      \n    </>\n  );\n});

  fs.writeFileSync('src/components/admin/AbaClientes.tsx', 
    import React from 'react';\nimport { Search, User, FileText, Send, Edit2, Trash2, Loader2, Printer, MapPin } from 'lucide-react';\nimport { motion } from 'framer-motion';\n\nexport function AbaClientes(props: any) {\n  const { clientesTab, setClientesTab, searchTerm, setSearchTerm, filteredClients, expandedClientId, setExpandedClientId, setEditingClient, handleDeleteClient, handleResendContract, agendas, selectedAgendaId, setSelectedAgendaId, isFetchingDetails, generateWhatsAppVan, generateWhatsAppSeguro, handlePrint, printMode, clients, reservas, avaliacoesAdmin, toggleAvaliacao, deleteAvaliacao, formatDateDisplay } = props;\n  return (\n    <>\n      \n    </>\n  );\n});

  fs.writeFileSync('src/components/admin/AbaReservas.tsx', 
    import React from 'react';\nimport { Search, User, Loader2, RefreshCw } from 'lucide-react';\nimport { motion } from 'framer-motion';\n\nexport function AbaReservas(props: any) {\n  const { reservasTab, setReservasTab, searchTerm, setSearchTerm, filteredReservas, isFetchingGlobalFinances, fetchGlobalFinances, formatDateDisplay, setAllReservas } = props;\n  return (\n    <>\n      \n    </>\n  );\n});

  fs.writeFileSync('src/components/admin/AbaFinancas.tsx', 
    import React from 'react';\nimport { DollarSign, Loader2, Plus, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';\nimport { motion } from 'framer-motion';\n\nexport function AbaFinancas(props: any) {\n  const { financasTab, setFinancasTab, selectedAgendaId, setSelectedAgendaId, agendas, isFetchingDetails, isFetchingGlobalFinances, handleAddCusto, novoCustoNome, setNovoCustoNome, novoCustoValor, setNovoCustoValor, handleDeleteCusto, totalRevenue, totalCosts, netProfit, profitMargin, reservas, selectedAgendaData, filteredAllReservas, filteredAllCustos, handleRefreshGlobalFinances, allCustos } = props;\n  return (\n    <>\n      \n    </>\n  );\n});

  // Now replace the blocks in page.tsx
  const newContent = content.slice(0, trilhasStart) + 
    \n        <AbaTrilhas {...{agendas, filteredAgendas, globalViews, openCreateModal, setIsEditing, setSelectedAgenda, handleCopyLink, handleDelete, formatDateDisplay, searchTerm, setSearchTerm, mainTab}} />\n +
    \n        <AbaClientes {...{clientesTab, setClientesTab, searchTerm, setSearchTerm, filteredClients, expandedClientId, setExpandedClientId, setEditingClient, handleDeleteClient, handleResendContract, agendas, selectedAgendaId, setSelectedAgendaId, isFetchingDetails, generateWhatsAppVan, generateWhatsAppSeguro, handlePrint, printMode, clients, reservas, avaliacoesAdmin, toggleAvaliacao, deleteAvaliacao, formatDateDisplay, mainTab}} />\n +
    \n        <AbaReservas {...{reservasTab, setReservasTab, searchTerm, setSearchTerm, filteredReservas, isFetchingGlobalFinances, fetchGlobalFinances, formatDateDisplay, setAllReservas, mainTab}} />\n +
    \n        <AbaFinancas {...{financasTab, setFinancasTab, selectedAgendaId, setSelectedAgendaId, agendas, isFetchingDetails, isFetchingGlobalFinances, handleAddCusto, novoCustoNome, setNovoCustoNome, novoCustoValor, setNovoCustoValor, handleDeleteCusto, totalRevenue, totalCosts, netProfit, profitMargin, reservas, selectedAgendaData, filteredAllReservas, filteredAllCustos, handleRefreshGlobalFinances, allCustos, mainTab}} />\n +
    content.slice(financasEnd);

  fs.writeFileSync('src/app/admin/page.tsx', newContent);
  console.log("SUCCESS");
} else {
  console.log("FAILED TO FIND BOUNDARIES");
}
