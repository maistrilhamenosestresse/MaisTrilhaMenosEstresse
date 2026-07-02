"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Editor from "@monaco-editor/react";
import { Folder, FileCode, Image as ImageIcon, Send, Loader2, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, BookOpen, MonitorPlay, X, LayoutTemplate, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Octokit } from "@octokit/rest";

export default function WebIDEClient({ accessToken }: { accessToken: string }) {
  // Tabs System
  const [openFiles, setOpenFiles] = useState<any[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isLowCodeMode, setIsLowCodeMode] = useState<boolean>(false);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');

  // GitHub Data
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // Initialize Octokit and fetch repos
  useEffect(() => {
    if (accessToken) {
      const okit = new Octokit({ auth: accessToken });
      setOctokit(okit);
      
      okit.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 50 })
        .then(res => {
          setRepos(res.data);
          setIsLoadingRepos(false);
          if (res.data.length > 0) {
             handleSelectRepo(res.data[0], okit);
          }
        })
        .catch(err => {
          console.error("Failed to fetch repos", err);
          setIsLoadingRepos(false);
        });
    }
  }, [accessToken]);

  const handleSelectRepo = async (repo: any, okitInstance = octokit) => {
    if (!okitInstance) return;
    setSelectedRepo(repo);
    setIsLoadingTree(true);
    setFileTree([]);
    setOpenFiles([]);
    setActiveFileId(null);
    setIsLowCodeMode(false);
    
    try {
      const branchInfo = await okitInstance.repos.getBranch({ owner: repo.owner.login, repo: repo.name, branch: repo.default_branch });
      const treeData = await okitInstance.git.getTree({ owner: repo.owner.login, repo: repo.name, tree_sha: branchInfo.data.commit.sha, recursive: "1" });

      const root: any[] = [];
      const map: any = { "": { children: root } };

      treeData.data.tree.forEach((item: any) => {
        const parts = item.path.split("/");
        const name = parts.pop();
        const parentPath = parts.join("/");
        
        const node = {
          id: item.sha,
          name,
          path: item.path,
          type: item.type === "tree" ? "folder" : item.path.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i) ? "image" : "file",
          extension: name.split('.').pop(),
          children: item.type === "tree" ? [] : undefined
        };

        map[item.path] = node;
        if (map[parentPath]) {
          map[parentPath].children.push(node);
        } else {
          root.push(node);
        }
      });

      const initialExpanded: any = {};
      root.forEach(n => { if(n.type === 'folder') initialExpanded[n.id] = true });
      
      setExpandedFolders(initialExpanded);
      setFileTree(root);
    } catch (error) {
      console.error("Failed to build tree", error);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const handleSelectFileNode = async (node: any) => {
    if (node.type === 'folder') return;
    setIsLowCodeMode(false); // Sair do modo low code se clicar em um arquivo
    
    // Check if already open
    const alreadyOpen = openFiles.find(f => f.id === node.id);
    if (alreadyOpen) {
      setActiveFileId(node.id);
      return;
    }

    let newFile = { ...node };

    if (node.type === 'image') {
      newFile.url = `https://raw.githubusercontent.com/${selectedRepo.owner.login}/${selectedRepo.name}/${selectedRepo.default_branch}/${node.path}`;
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileId(node.id);
    } else {
      // Loading state for text
      newFile.content = "Carregando...";
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileId(node.id);

      try {
        const res = await octokit?.repos.getContent({ owner: selectedRepo.owner.login, repo: selectedRepo.name, path: node.path });
        if (res?.data && 'content' in res.data) {
          const content = atob(res.data.content);
          setOpenFiles(prev => prev.map(f => f.id === node.id ? { ...f, content } : f));
        }
      } catch (err) {
        console.error("Failed to fetch file content", err);
        setOpenFiles(prev => prev.map(f => f.id === node.id ? { ...f, content: "Erro ao carregar o arquivo." } : f));
      }
    }
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newFiles = openFiles.filter(f => f.id !== id);
    setOpenFiles(newFiles);
    if (activeFileId === id) {
      setActiveFileId(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null);
    }
  };

  const activeFile = openFiles.find(f => f.id === activeFileId);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      alert(`Upload não implementado nesta fase do protótipo visual. Arquivo recebido: ${acceptedFiles[0].name}`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

  const toggleFolder = (id: string) => setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));

  const renderTree = (nodes: any[], level = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedFolders[node.id];
      const isSelected = activeFileId === node.id;

      if (node.type === "folder") {
        return (
          <div key={node.id}>
            <div 
              className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-[#2a2d2e] transition-colors`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onClick={() => toggleFolder(node.id)}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
              <Folder className="h-4 w-4 text-[#dcb67a]" />
              <span className="text-sm truncate text-gray-300">{node.name}</span>
            </div>
            {isExpanded && node.children && renderTree(node.children, level + 1)}
          </div>
        );
      }

      return (
        <div 
          key={node.id}
          className={`flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-[#2a2d2e] transition-colors ${isSelected ? 'bg-[#37373d] text-white' : 'text-gray-400'}`}
          style={{ paddingLeft: `${(level * 12) + 24}px` }}
          onClick={() => handleSelectFileNode(node)}
        >
          {node.type === 'image' ? <ImageIcon className="h-4 w-4 text-green-400 shrink-0" /> : <FileCode className="h-4 w-4 text-blue-400 shrink-0" />}
          <span className="text-sm truncate">{node.name}</span>
        </div>
      );
    });
  };

  const handleDeploy = () => {
    setIsDeploying(true);
    setDeployStatus('building');
    setTimeout(() => {
      setDeployStatus('success');
      setTimeout(() => { setIsDeploying(false); setDeployStatus('idle'); }, 3000);
    }, 2000);
  };

  return (
    <div className="flex h-full w-full relative" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Overlay Drag and Drop Visual */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#1e1e1e]/90 backdrop-blur-sm border-4 border-dashed border-[#F17B37] flex flex-col items-center justify-center rounded-lg m-4"
          >
            <ImageIcon className="h-20 w-20 text-[#F17B37] mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white">Solte a imagem aqui para enviar!</h2>
            <p className="text-gray-400 mt-2">Ela será salva automaticamente no repositório.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR - FILE EXPLORER */}
      <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0">
        
        {/* Repo Selector */}
        <div className="p-2 border-b border-[#3c3c3c]">
          <select 
            className="w-full bg-[#1e1e1e] border border-[#3c3c3c] text-sm text-gray-300 rounded p-1.5 outline-none focus:border-[#F17B37]"
            value={selectedRepo?.id || ""}
            onChange={(e) => {
              const r = repos.find(r => r.id.toString() === e.target.value);
              if(r) handleSelectRepo(r);
            }}
          >
            {isLoadingRepos ? <option>Carregando repositórios...</option> : null}
            {repos.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Low Code Mode Button */}
        <div className="p-2 border-b border-[#3c3c3c]">
          <button 
            onClick={() => { setIsLowCodeMode(true); setActiveFileId(null); }}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded font-bold text-xs transition-colors shadow-sm ${isLowCodeMode ? 'bg-[#F17B37] text-white' : 'bg-[#333333] text-gray-300 hover:bg-[#F17B37] hover:text-white'}`}
          >
            <LayoutTemplate className="h-4 w-4" />
            Modo Visual (Low-Code)
          </button>
        </div>

        <div className="uppercase text-[10px] font-bold text-gray-400 px-4 py-3 tracking-widest border-b border-[#3c3c3c] flex items-center justify-between">
          <span>Explorador</span>
          {isLoadingTree && <Loader2 className="h-3 w-3 animate-spin text-[#F17B37]" />}
        </div>
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          {renderTree(fileTree)}
        </div>
      </div>

      {/* RIGHT SIDE: SPLIT SCREEN (CODE vs PREVIEW) */}
      <div className="flex-1 flex min-w-0">
        
        {/* LEFT PANE: EDITOR / LOW-CODE */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] border-r border-[#3c3c3c]">
          
          {/* TABS BAR */}
          <div className="h-10 bg-[#252526] flex items-center overflow-x-auto custom-scrollbar border-b border-[#3c3c3c] shrink-0">
            {openFiles.map(file => (
              <div 
                key={file.id} 
                onClick={() => { setActiveFileId(file.id); setIsLowCodeMode(false); }}
                className={`group flex items-center gap-2 px-3 h-full border-r border-[#3c3c3c] cursor-pointer min-w-[120px] max-w-[200px] select-none ${activeFileId === file.id && !isLowCodeMode ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500' : 'text-gray-400 hover:bg-[#2d2d2d]'}`}
              >
                {file.type === 'image' ? <ImageIcon className="h-3.5 w-3.5 text-green-400 shrink-0" /> : <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                <span className="text-sm truncate flex-1">{file.name}</span>
                <button onClick={(e) => closeTab(e, file.id)} className={`p-0.5 rounded-md hover:bg-[#3c3c3c] ${activeFileId === file.id && !isLowCodeMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="h-10 bg-[#2d2d2d] flex items-center justify-between px-4 shrink-0 shadow-md z-10">
            <div className="text-xs text-gray-400 flex items-center gap-2 font-mono truncate">
               {isLowCodeMode ? "Painel Visual > Configurações de Tema" : activeFile?.path || "Nenhum arquivo aberto"}
            </div>
            
            <button 
              onClick={handleDeploy}
              disabled={isDeploying}
              className={`text-xs font-bold px-4 py-1.5 rounded-md flex items-center gap-2 transition-all shadow-sm ${
                deployStatus === 'building' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' :
                deployStatus === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                deployStatus === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                'bg-[#1D2A3A] hover:bg-gray-900 text-white border border-[#3c3c3c]'
              }`}
            >
              {deployStatus === 'building' ? <Loader2 className="h-3 w-3 animate-spin" /> : 
               deployStatus === 'success' ? <CheckCircle2 className="h-3 w-3" /> :
               deployStatus === 'error' ? <AlertCircle className="h-3 w-3" /> :
               <Send className="h-3 w-3" />}
              {deployStatus === 'building' ? 'Compilando p/ Vercel...' : 
               deployStatus === 'success' ? 'Site Atualizado!' :
               deployStatus === 'error' ? 'Erro no Compilador' :
               'Simular / Atualizar Site'}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            
            {/* MODO LOW-CODE */}
            {isLowCodeMode ? (
              <div className="absolute inset-0 bg-[#1e1e1e] p-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-8">
                  <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3"><Palette className="h-6 w-6 text-[#F17B37]"/> Design Global (Leigo)</h2>
                    <p className="text-gray-400 mt-1 text-sm">Altere as cores e textos principais do site visualmente. O sistema vai varrer e injetar o código para você.</p>
                  </div>

                  <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-6 shadow-xl">
                    <h3 className="font-bold text-white mb-4 border-b border-[#3c3c3c] pb-2">Identidade Visual</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Cor Principal (Primária)</label>
                        <div className="flex items-center gap-3 mt-1">
                          <input type="color" defaultValue="#F17B37" className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
                          <input type="text" defaultValue="#F17B37" className="bg-[#1e1e1e] border border-[#3c3c3c] text-white px-3 py-2 rounded w-32 font-mono text-sm outline-none focus:border-[#F17B37]" />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Isso tentará injetar alterações no tailwind.config.ts e globals.css.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-6 shadow-xl">
                    <h3 className="font-bold text-white mb-4 border-b border-[#3c3c3c] pb-2">Informações da Página</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Título do Site (Metatag)</label>
                        <input type="text" defaultValue="Mais Trilha Menos Estresse" className="mt-1 w-full bg-[#1e1e1e] border border-[#3c3c3c] text-white px-3 py-2 rounded text-sm outline-none focus:border-[#F17B37]" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Descrição Base (SEO)</label>
                        <textarea rows={3} defaultValue="Agência de trilhas e turismo..." className="mt-1 w-full bg-[#1e1e1e] border border-[#3c3c3c] text-white px-3 py-2 rounded text-sm outline-none focus:border-[#F17B37]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            // NENHUM ARQUIVO SELECIONADO
            ) : !activeFile ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <BookOpen className="h-16 w-16 mb-4 opacity-20" />
                <h2 className="text-xl font-medium">Editor Inteligente</h2>
                <p className="text-sm mt-2 text-center max-w-md">Abra um arquivo pelo explorador ou use o <b>Modo Visual</b> na barra lateral para edições sem código.</p>
              </div>

            // EDITOR DE CÓDIGO (PROGRAMADOR)
            ) : activeFile.type === 'file' ? (
              <Editor
                height="100%"
                theme="vs-dark"
                language={activeFile.extension === 'tsx' || activeFile.extension === 'ts' ? 'typescript' : activeFile.extension === 'css' ? 'css' : activeFile.extension === 'json' ? 'json' : 'javascript'}
                value={activeFile.content}
                onChange={(val) => {
                  setOpenFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content: val } : f));
                }}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", padding: { top: 16 } }}
              />

            // VISUALIZADOR DE IMAGENS (LOW-CODE)
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 overflow-y-auto">
                <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-2 truncate">{activeFile.name}</h3>
                  <p className="text-gray-400 text-xs mb-6">Substituição Rápida de Assets. Arraste uma nova imagem para cá.</p>
                  
                  <div className="rounded-lg overflow-hidden border border-[#3c3c3c] bg-black/50 p-2 mb-6 flex justify-center">
                    <img src={activeFile.url} alt={activeFile.name} className="max-h-[200px] object-contain rounded-md" />
                  </div>

                  <button className="bg-[#F17B37] w-full hover:bg-[#e06925] text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">
                    Upload de Nova Imagem
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: LIVE PREVIEW IFRAME */}
        <div className="w-[45%] flex flex-col min-w-0 bg-[#ffffff]">
           <div className="h-10 bg-[#f3f4f6] flex items-center px-4 border-b border-gray-200 shrink-0 gap-2 text-gray-600">
             <MonitorPlay className="h-4 w-4 text-blue-500" />
             <span className="text-xs font-bold uppercase tracking-wider">Simulador do Site</span>
             
             {/* Fake URL Bar */}
             <div className="ml-auto bg-white border border-gray-300 rounded-md px-3 py-1 text-[10px] text-gray-500 flex-1 max-w-[250px] truncate">
               {selectedRepo?.homepage || `https://${selectedRepo?.name}.vercel.app`}
             </div>
           </div>
           
           <div className="flex-1 relative bg-gray-50 flex items-center justify-center">
             {selectedRepo ? (
               <iframe 
                 src={selectedRepo.homepage || "https://maistrilhamenosestresse.com"} 
                 className="w-full h-full border-none shadow-inner"
                 title="Preview"
                 sandbox="allow-scripts allow-same-origin"
               />
             ) : (
               <div className="text-gray-400 text-sm flex flex-col items-center">
                 <Loader2 className="h-8 w-8 animate-spin mb-2" />
                 Aguardando compilação inicial...
               </div>
             )}
           </div>
        </div>
        
      </div>
    </div>
  );
}
