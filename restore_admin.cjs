const fs = require('fs');
const { execSync } = require('child_process');

// Pega o conteúdo original do git
const originalContent = execSync('git show HEAD^:src/app/admin/page.tsx').toString();

const financasStart = originalContent.indexOf("{mainTab === 'financas' && (");
const financasEnd = originalContent.indexOf("</main>", financasStart);
const financasRealEnd = originalContent.lastIndexOf(")}", financasEnd - 1) + 2;

const financasBlock = originalContent.slice(financasStart, financasRealEnd);

fs.writeFileSync('src/components/admin/AbaFinancas.tsx', 
  "import React from 'react';\nimport { DollarSign, Loader2, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, CalendarDays, ChevronUp, ChevronDown, Users } from 'lucide-react';\nimport { motion, AnimatePresence } from 'framer-motion';\nimport { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, Cell } from 'recharts';\n\nexport function AbaFinancas(props: any) {\n  const { financasTab, setFinancasTab, selectedAgendaId, setSelectedAgendaId, agendas, isFetchingDetails, isFetchingGlobalFinances, handleAddCusto, novoCustoNome, setNovoCustoNome, novoCustoValor, setNovoCustoValor, handleDeleteCusto, totalRevenue, totalCosts, netProfit, profitMargin, reservas, selectedAgendaData, filteredAllReservas, filteredAllCustos, handleRefreshGlobalFinances, allCustos, mainTab, setReportMonth, reportMonth, reportYear, expandedReportId, setExpandedReportId, formatDateDisplay, allReservas } = props;\n  return (\n    <>\n      " + financasBlock + "\n    </>\n  );\n}");

console.log("SUCCESS_RESTORE");
