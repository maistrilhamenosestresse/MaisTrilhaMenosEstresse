const fs = require('fs');

try {
  let content = fs.readFileSync('src/app/admin/page.tsx', 'utf-8');

  // Add imports
  if (!content.includes('import { PinModal }')) {
    content = content.replace('from "lucide-react";', 'FileSignature, Trash2\n} from "lucide-react";\nimport { PinModal } from "@/components/PinModal";');
  }

  // Add state variables and requirePin promise
  if (!content.includes('const [isPinModalOpen')) {
    const stateInjection = `
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

  const handleBulkDelete = async () => {
    if (!(await requirePin('Excluir ' + selectedClients.length + ' Clientes'))) return;
    try {
      const { error } = await supabase.from('clients').delete().in('id', selectedClients);
      if (error) throw error;
      setClients(clients.filter(c => !selectedClients.includes(c.id)));
      setSelectedClients([]);
      alert(selectedClients.length + ' clientes excluídos com sucesso!');
    } catch (err: any) { alert('Erro ao excluir clientes.'); }
  };
`;
    content = content.replace('const [deferredPrompt, setDeferredPrompt] = useState<any>(null);', 'const [deferredPrompt, setDeferredPrompt] = useState<any>(null);\n' + stateInjection);
  }

  // Inject requirePin into functions
  const injections = [
    { func: 'const handleDeleteClient = async (id: string) => {', label: 'Excluir Cliente' },
    { func: 'const handleDeleteCusto = async (id: string) => {', label: 'Excluir Custo' },
    { func: 'const handleDeleteReserva = async (id: string) => {', label: 'Excluir Reserva' },
    { func: 'const handleDeleteAgenda = async (id: string) => {', label: 'Excluir Trilha' },
    { func: 'const handleNovaTrilha = async (data: AgendaForm) => {', label: 'Salvar Trilha' },
    { func: 'const handleToggleMaintenance = async () => {', label: 'Pausar/Ativar Site' },
    { func: 'const generateWhatsAppGrupo = () => {', label: 'Mensagem Grupo VIP', asyncify: true },
    { func: 'const generateWhatsAppSeguro = () => {', label: 'Mensagem de Seguro', asyncify: true },
    { func: 'const generateWhatsAppVan = () => {', label: 'Mensagem da Van', asyncify: true },
    { func: "const handlePrint = (mode: 'todos' | 'van' | 'seguro') => {", label: 'Impressão de Listas', asyncify: true }
  ];

  injections.forEach(inj => {
    if (content.includes(inj.func) && !content.includes(`requirePin('${inj.label}')`)) {
      let newFunc = inj.func;
      if (inj.asyncify) {
        if (newFunc.includes("const handlePrint")) {
            newFunc = newFunc.replace("const handlePrint = (mode: 'todos' | 'van' | 'seguro') => {", "const handlePrint = async (mode: 'todos' | 'van' | 'seguro') => {");
        } else {
            newFunc = newFunc.replace('() =>', 'async () =>');
        }
      }
      content = content.replace(inj.func, newFunc + `\n    if (!(await requirePin('${inj.label}'))) return;`);
    }
  });

  // Inject the checkboxes and bulk delete button
  const clientsListBlock = `                <div className="print:hidden">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-2">Total: {filteredClients.length} Cadastrados</p>`;
  
  const clientsListReplacement = `                <div className="print:hidden">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">Total: {filteredClients.length} Cadastrados</p>
                    {selectedClients.length > 0 && (
                      <button 
                        onClick={handleBulkDelete}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir {selectedClients.length}
                      </button>
                    )}
                  </div>`;
  
  if (content.includes(clientsListBlock)) {
    content = content.replace(clientsListBlock, clientsListReplacement);
  }

  const clientCardHeader = `<div className="flex items-center gap-3 min-w-0">
                              {client.photo_url ? (`;
  const clientCardHeaderReplacement = `<div className="flex items-center gap-3 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={selectedClients.includes(client.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.checked) setSelectedClients([...selectedClients, client.id]);
                                  else setSelectedClients(selectedClients.filter(id => id !== client.id));
                                }}
                                className="w-5 h-5 rounded border-gray-300 text-[#F17B37] focus:ring-[#F17B37] cursor-pointer"
                              />
                              {client.photo_url ? (`;

  // Use split/join to replace all occurrences if needed, though there should be only one in map
  if (content.includes(clientCardHeader)) {
      content = content.split(clientCardHeader).join(clientCardHeaderReplacement);
  }

  // Inject the PinModal in the render (at the very bottom before closing div)
  if (!content.includes('<PinModal isOpen={isPinModalOpen}')) {
    content = content.replace('</main>', '  <PinModal isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); if(pinAction) pinAction.onCancel(); }} onSuccess={() => { if(pinAction) pinAction.onConfirm(); }} actionName={pinAction?.name} />\n      </main>');
  }

  fs.writeFileSync('src/app/admin/page.tsx', content);
  console.log('Script executado com sucesso e page.tsx atualizada.');
} catch (error) {
  console.error("Erro:", error);
}
