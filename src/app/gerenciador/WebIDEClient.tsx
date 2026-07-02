"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Editor from "@monaco-editor/react";
import { Folder, FileCode, Image as ImageIcon, Send, Loader2, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, BookOpen, MonitorPlay, X, LayoutTemplate, Palette, Globe, Save } from "lucide-react";
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

  // Preview State
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, file: any | null }>({ visible: false, x: 0, y: 0, file: null });

  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleDeleteFile = async () => {
     if (!contextMenu.file || !octokit || !selectedRepo) return;
     if (!confirm(`Tem certeza que deseja deletar ${contextMenu.file.name}?`)) return;
     
     try {
       await octokit.repos.deleteFile({
         owner: selectedRepo.owner.login,
         repo: selectedRepo.name,
         path: contextMenu.file.path,
         message: `Deletado via Web IDE: ${contextMenu.file.name}`,
         sha: contextMenu.file.id,
         branch: selectedRepo.default_branch
       });
       alert("Arquivo deletado com sucesso!");
       handleSelectRepo(selectedRepo); // Reload tree
     } catch (e) {
       console.error("Erro ao deletar", e);
       alert("Erro ao deletar arquivo.");
     }
  };

  // Low Code CMS State
  const [cmsData, setCmsData] = useState<any>(null);
  const [isLoadingCms, setIsLoadingCms] = useState<boolean>(false);
  const [cmsFileSha, setCmsFileSha] = useState<string | null>(null);

  // GitHub Data
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

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

  // Iframe Bridge Listener
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data?.type === "CMS_TEXT_UPDATED") {
        const { originalText, newText } = event.data.payload;
        
        // Atualiza a representação visual (AST) do painel esquerdo quando o Iframe é editado
        setCmsData((prevCmsData: any) => {
          if (!prevCmsData) return prevCmsData;
          const newData = { ...prevCmsData };
          
          Object.keys(newData).forEach(folderKey => {
             newData[folderKey] = newData[folderKey].map((node: any) => {
               if (node.type === 'text' && node.text.trim() === originalText.trim()) {
                 return { ...node, newText: newText };
               }
               return node;
             });
          });
          return newData;
        });
      }
    };

    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, []);

  const handleSelectRepo = async (repo: any, okitInstance = octokit) => {
    if (!okitInstance) return;
    setSelectedRepo(repo);
    setIsLoadingTree(true);
    setFileTree([]);
    setOpenFiles([]);
    setActiveFileId(null);
    setIsLowCodeMode(false);
    setCmsData(null);
    setPreviewUrl(repo.homepage || `https://${repo.name}.vercel.app`);
    
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

  // AST/Regex Parser State
  const [scannedFiles, setScannedFiles] = useState<any[]>([]);

  // Extrai recursivamente todos os arquivos com um determinado nome da árvore
  const findFilesByName = (nodes: any[], name: string, results: any[] = []) => {
    nodes.forEach(node => {
      if (node.type === 'file' && node.name === name) results.push(node);
      if (node.type === 'folder' && node.children) findFilesByName(node.children, name, results);
    });
    return results;
  };

  const scanSourceCode = async () => {
    if (!octokit || !selectedRepo) return;
    setIsLoadingCms(true);
    setCmsData(null); // Reset CMS data
    
    try {
      // 1. Encontrar todas as page.tsx
      const pages = findFilesByName(fileTree, 'page.tsx');
      const layouts = findFilesByName(fileTree, 'layout.tsx');
      const targetFiles = [...pages, ...layouts];
      
      const newScannedFiles = [];
      const newCmsData: any = {};

      for (const file of targetFiles) {
        // Baixar conteúdo do GitHub
        const res = await octokit.repos.getContent({ owner: selectedRepo.owner.login, repo: selectedRepo.name, path: file.path });
        if (res?.data && 'content' in res.data) {
          const content = atob(res.data.content);
          
          // Regex para encontrar Textos (evitando chaves {} do React)
          const textRegex = /(<(?:h1|h2|h3|h4|h5|h6|p|span|button|a|label)[^>]*>)\s*([^<{\n]+?)\s*(<\/(?:h1|h2|h3|h4|h5|h6|p|span|button|a|label)>)/g;
          const imageRegex = /(<(?:Image|img)[^>]*src=["'])([^"']*)(["'][^>]*>)/g;
          
          let match;
          const nodes = [];
          
          // Escanear Textos
          while ((match = textRegex.exec(content)) !== null) {
            if (match[2].trim().length > 1) { // Ignorar espaços em branco puros
              nodes.push({ type: 'text', originalMatch: match[0], openTag: match[1], text: match[2], closeTag: match[3], newText: match[2] });
            }
          }
          
          // Escanear Imagens
          while ((match = imageRegex.exec(content)) !== null) {
            nodes.push({ type: 'image', originalMatch: match[0], prefix: match[1], src: match[2], suffix: match[3], newSrc: match[2] });
          }

          if (nodes.length > 0) {
            newScannedFiles.push({ ...file, content, nodes });
            // Agrupar no objeto CmsData para compatibilidade com a UI
            const folderName = file.path.replace('src/app/', '').replace('/page.tsx', '').replace('page.tsx', 'raiz').toUpperCase();
            newCmsData[folderName] = nodes;
          }
        }
      }
      
      setScannedFiles(newScannedFiles);
      setCmsData(newCmsData);
    } catch (e) {
      console.error("Erro ao escanear código-fonte:", e);
    } finally {
      setIsLoadingCms(false);
    }
  };

  const openLowCodeMode = () => {
    setIsLowCodeMode(true);
    setActiveFileId(null);
    if (!cmsData) scanSourceCode();
  };

  const handleSaveCmsEdits = async () => {
    if (!cmsData || !scannedFiles) return;
    setIsDeploying(true);
    
    // Simula a aplicação do AST de volta ao Código Fonte
    let updatedFilesCount = 0;
    
    scannedFiles.forEach(file => {
      let newContent = file.content;
      const folderKey = file.path.replace('src/app/', '').replace('/page.tsx', '').replace('page.tsx', 'raiz').toUpperCase();
      const nodes = cmsData[folderKey];
      
      if (nodes && Array.isArray(nodes)) {
        nodes.forEach((node: any) => {
          if (node.type === 'text' && node.text !== node.newText) {
            const newHTML = `${node.openTag}${node.newText}${node.closeTag}`;
            newContent = newContent.replace(node.originalMatch, newHTML);
            // Atualiza o match original para não quebrar em futuros saves
            node.originalMatch = newHTML;
            node.text = node.newText;
          }
          if (node.type === 'image' && node.src !== node.newSrc) {
            const newHTML = `${node.prefix}${node.newSrc}${node.suffix}`;
            newContent = newContent.replace(node.originalMatch, newHTML);
            node.originalMatch = newHTML;
            node.src = node.newSrc;
          }
        });
      }
      
      if (newContent !== file.content) {
        file.content = newContent;
        updatedFilesCount++;
        // Se o arquivo estiver aberto na aba, atualiza lá também
        setOpenFiles(prev => prev.map(f => f.id === file.id ? { ...f, content: newContent } : f));
      }
    });

    setTimeout(() => {
      alert(`Sucesso! ${updatedFilesCount} arquivo(s) modificado(s) pelo Modo Visual. (Na versão final, faríamos o Commit no GitHub aqui).`);
      setIsDeploying(false);
    }, 1000);
  };

  const handleSelectFileNode = async (node: any) => {
    if (node.type === 'folder') return;
    setIsLowCodeMode(false);
    
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedRepo || !octokit) {
      alert("Selecione um repositório primeiro.");
      return;
    }
    
    for (const file of acceptedFiles) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Content = (event.target?.result as string).split(',')[1];
        
        try {
          await octokit.repos.createOrUpdateFileContents({
            owner: selectedRepo.owner.login,
            repo: selectedRepo.name,
            path: `public/images/${file.name.replace(/\s+/g, '-')}`,
            message: `Upload de ${file.name} via Web IDE`,
            content: base64Content,
            branch: selectedRepo.default_branch
          });
          alert(`Upload de ${file.name} concluído com sucesso! Recarregue a página para ver no repositório.`);
        } catch(e) {
          console.error("Erro no upload", e);
          alert(`Erro ao fazer upload de ${file.name}`);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [octokit, selectedRepo]);

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
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ visible: true, x: e.pageX, y: e.pageY, file: node });
              }}
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
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ visible: true, x: e.pageX, y: e.pageY, file: node });
          }}
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

  // Função para atualizar o AST Node
  const updateAstNode = (folderKey: string, nodeIndex: number, field: string, value: string) => {
    setCmsData((prev: any) => {
      const newData = { ...prev };
      newData[folderKey][nodeIndex][field] = value;
      return newData;
    });
  };

  const renderAstForms = (data: any) => {
    if (!data) return null;
    
    const handleFocus = (originalText: string) => {
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'CMS_FOCUS_ELEMENT', payload: { originalText } }, '*');
      }
    };
    
    return Object.keys(data).map(folderKey => {
      const nodes = data[folderKey];
      if (!Array.isArray(nodes)) return null;

      return (
        <div key={folderKey} className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-6 shadow-xl mb-6">
          <h3 className="font-bold text-[#F17B37] mb-6 border-b border-[#3c3c3c] pb-2 flex items-center gap-2 uppercase tracking-widest text-sm">
            <Folder className="h-4 w-4" /> Rota: {folderKey}
          </h3>
          <div className="space-y-6">
            {nodes.map((node, index) => {
              if (node.type === 'text') {
                return (
                  <div key={index} className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg p-4 relative group hover:border-[#F17B37] transition-colors">
                    <div className="absolute -top-3 left-3 bg-[#3c3c3c] text-[10px] px-2 py-0.5 rounded font-mono text-gray-300 uppercase tracking-widest border border-[#4c4c4c]">{node.openTag.replace(/[<>]/g, '').split(' ')[0]}</div>
                    <textarea 
                      rows={2} 
                      value={node.newText} 
                      onChange={(e) => updateAstNode(folderKey, index, 'newText', e.target.value)} 
                      onFocus={() => handleFocus(node.text)}
                      className="mt-2 w-full bg-transparent text-white px-1 text-sm outline-none resize-none focus:bg-[#252526] focus:rounded" 
                    />
                  </div>
                );
              }
              if (node.type === 'image') {
                return (
                  <div key={index} className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg p-4 relative group hover:border-[#F17B37] transition-colors">
                    <div className="absolute -top-3 left-3 bg-[#3c3c3c] text-[10px] px-2 py-0.5 rounded font-mono text-gray-300 uppercase tracking-widest border border-[#4c4c4c]">IMAGEM</div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                      <div className="w-full sm:w-32 h-24 bg-black rounded-md overflow-hidden flex items-center justify-center shrink-0 border border-[#3c3c3c]">
                        <img src={node.newSrc.startsWith('/') && selectedRepo ? `https://raw.githubusercontent.com/${selectedRepo.owner.login}/${selectedRepo.name}/${selectedRepo.default_branch}${node.newSrc}` : node.newSrc} className="max-w-full max-h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                      <div className="flex-1 w-full space-y-2">
                         <input type="text" value={node.newSrc} onChange={(e) => updateAstNode(folderKey, index, 'newSrc', e.target.value)} className="w-full bg-[#252526] border border-[#3c3c3c] text-white px-3 py-2 rounded text-sm outline-none focus:border-[#F17B37]" placeholder="Caminho ou URL..." />
                         <button className="bg-[#2d2d2d] hover:bg-[#3c3c3c] border border-[#4c4c4c] text-white text-xs px-4 py-2 rounded font-bold transition-colors w-full sm:w-auto">⬆️ Substituir Imagem</button>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-full relative" {...getRootProps()}>
      <input {...getInputProps()} />
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

      {/* SIDEBAR */}
      <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0">
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

        <div className="p-2 border-b border-[#3c3c3c]">
          <button 
            onClick={openLowCodeMode}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded font-bold text-xs transition-colors shadow-sm ${isLowCodeMode ? 'bg-[#F17B37] text-white' : 'bg-[#333333] text-gray-300 hover:bg-[#F17B37] hover:text-white'}`}
          >
            <LayoutTemplate className="h-4 w-4" />
            Modo Visual (Leigo)
          </button>
        </div>

        <div className="uppercase text-[10px] font-bold text-gray-400 px-4 py-3 tracking-widest border-b border-[#3c3c3c] flex items-center justify-between">
          <span>Explorador de Arquivos</span>
          {isLoadingTree && <Loader2 className="h-3 w-3 animate-spin text-[#F17B37]" />}
        </div>
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          {isLowCodeMode ? (
             <div className="p-4 text-xs text-gray-500 text-center">
               <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
               <p>O Explorador de Arquivos Técnicos fica oculto no Modo Visual para evitar confusão.</p>
             </div>
          ) : (
             renderTree(fileTree)
          )}
        </div>
      </div>

      {/* CENTER PANE */}
      <div className="flex-1 flex min-w-0">
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] border-r border-[#3c3c3c]">
          
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
               {isLowCodeMode ? "Tudo Editável > Base de Dados (JSON)" : activeFile?.path || "Nenhum arquivo aberto"}
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
              {deployStatus === 'building' ? 'Enviando p/ Vercel...' : 
               deployStatus === 'success' ? 'Site Atualizado!' :
               deployStatus === 'error' ? 'Erro no Deploy' :
               'Simular / Atualizar Site'}
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {isLowCodeMode ? (
              <div className="absolute inset-0 bg-[#1e1e1e] p-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-white flex items-center gap-3"><Palette className="h-6 w-6 text-[#F17B37]"/> Editor Visual (CMS)</h2>
                      <p className="text-gray-400 mt-1 text-sm">Altere qualquer texto, botão ou cor do site por aqui sem tocar no código.</p>
                    </div>
                    {cmsData && (
                      <button onClick={handleSaveCmsEdits} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">
                        <Save className="h-4 w-4" /> Salvar Edições
                      </button>
                    )}
                  </div>

                  {isLoadingCms ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                      <Loader2 className="h-10 w-10 animate-spin mb-4" />
                      <p>Varrendo o código fonte (`.tsx`) em busca de textos editáveis...</p>
                    </div>
                  ) : cmsData ? (
                    <div className="pb-20">
                      {renderAstForms(cmsData)}
                    </div>
                  ) : (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-8 text-center">
                      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white mb-2">Arquivo Mestre não encontrado!</h3>
                      <p className="text-gray-400 text-sm max-w-md mx-auto">
                        Para o Modo Visual completo funcionar, o desenvolvedor precisa extrair os textos do código (`.tsx`) e criar um arquivo `site-content.json` na raiz do projeto.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : !activeFile ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <BookOpen className="h-16 w-16 mb-4 opacity-20" />
                <h2 className="text-xl font-medium">Editor Inteligente</h2>
                <p className="text-sm mt-2 text-center max-w-md">Abra um arquivo pelo explorador ou use o <b>Modo Visual</b> na barra lateral para edições sem código.</p>
              </div>
            ) : activeFile.type === 'file' ? (
              <Editor
                height="100%"
                theme="vs-dark"
                language={activeFile.extension === 'tsx' || activeFile.extension === 'ts' ? 'typescript' : activeFile.extension === 'css' ? 'css' : activeFile.extension === 'json' ? 'json' : 'javascript'}
                value={activeFile.content}
                onChange={(val) => setOpenFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content: val } : f))}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", padding: { top: 16 } }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 overflow-y-auto">
                <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-2 truncate">{activeFile.name}</h3>
                  <div className="rounded-lg overflow-hidden border border-[#3c3c3c] bg-black/50 p-2 mb-6 flex justify-center">
                    <img src={activeFile.url} alt={activeFile.name} className="max-h-[200px] object-contain rounded-md" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: LIVE PREVIEW IFRAME */}
        <div className="w-[45%] flex flex-col min-w-0 bg-[#ffffff]">
           <div className="h-10 bg-[#f3f4f6] flex items-center px-4 border-b border-gray-200 shrink-0 gap-3 text-gray-600">
             <Globe className="h-4 w-4 text-blue-500 shrink-0" />
             <span className="text-xs font-bold uppercase tracking-wider shrink-0 hidden lg:block">Preview</span>
             
             {/* Editable URL Bar */}
             <input 
               type="text"
               value={previewUrl}
               onChange={(e) => setPreviewUrl(e.target.value)}
               className="ml-auto bg-white border border-gray-300 rounded-md px-3 py-1 text-xs text-gray-600 flex-1 max-w-full outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
               placeholder="Cole o link do seu site aqui se der 404..."
             />
           </div>
           
           <div className="flex-1 relative bg-gray-50 flex items-center justify-center">
             {previewUrl ? (
               <iframe 
                 src={previewUrl} 
                 className="w-full h-full border-none shadow-inner"
                 title="Preview"
                 sandbox="allow-scripts allow-same-origin allow-forms"
               />
             ) : (
               <div className="text-gray-400 text-sm flex flex-col items-center">
                 <Loader2 className="h-8 w-8 animate-spin mb-2" />
                 Digite a URL no topo para simular...
               </div>
             )}
           </div>
        </div>
        
      </div>
      
      {/* Context Menu flutuante */}
      {contextMenu.visible && (
        <div 
          className="fixed bg-[#252526] border border-[#3c3c3c] shadow-2xl rounded py-1 z-[99999] min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-[#3c3c3c] truncate">
            {contextMenu.file?.name}
          </div>
          <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#F17B37] hover:text-white transition-colors" onClick={() => alert("Renomear será implementado em breve.")}>Renomear</button>
          <button className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white transition-colors" onClick={handleDeleteFile}>Excluir Arquivo</button>
        </div>
      )}
    </div>
  );
}
