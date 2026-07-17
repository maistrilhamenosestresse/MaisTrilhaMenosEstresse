/**
 * @file WebIDEClient.tsx
 * @description Editor de código na nuvem com integração direta ao GitHub API.
 *              Inclui suporte ao VS Code Editor (Monaco), menu superior e atalhos customizados.
 * @module WebIDEClient
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Editor from "@monaco-editor/react";
import { Folder, FileCode, Image as ImageIcon, Send, Loader2, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, BookOpen, MonitorPlay, X, LayoutTemplate, Palette, Globe, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Octokit } from "@octokit/rest";
import { toast } from "sonner";
import { uploadMediaToAws } from "@/lib/upload-media-client";

/**
 * @function WebIDEClient
 * @description Componente cliente do Web IDE. Gerencia árvore de arquivos e abas do Monaco Editor.
 * @param {Object} props - Propriedades do componente.
 * @param {string} props.accessToken - Token de autenticação OAuth do GitHub.
 * @returns {JSX.Element} Interface completa de edição com painel lateral e editor central.
 */
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

  // Editor Reference for Actions
  const [editorRef, setEditorRef] = useState<any>(null);
  const handleEditorDidMount = (editor: any) => setEditorRef(editor);
  const triggerMonacoAction = (actionId: string) => {
    if (editorRef) editorRef.getAction(actionId)?.run();
  };

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, file: any | null }>({ visible: false, x: 0, y: 0, file: null });
  const [isScreenSmall, setIsScreenSmall] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsScreenSmall(window.innerWidth < 1000);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    const blockInspect = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', blockInspect);

    const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', closeMenu);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', checkScreenSize);
      window.removeEventListener('keydown', blockInspect);
    };
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
    const handleIframeMessage = async (event: MessageEvent) => {
      if (!previewUrl) return;
      try {
        if (event.origin !== new URL(previewUrl).origin) return;
      } catch {
        return;
      }
      if (event.data?.type === "CMS_TEXT_UPDATED") {
        const { originalText, newText } = event.data.payload;
        
        setCmsData((prevCmsData: any) => {
          if (!prevCmsData) return prevCmsData;
          
          const deepReplace = (obj: any, oldVal: string, newVal: string): any => {
            if (typeof obj === 'string') {
              return obj.trim() === oldVal.trim() ? newVal : obj;
            }
            if (Array.isArray(obj)) {
              return obj.map(item => deepReplace(item, oldVal, newVal));
            }
            if (typeof obj === 'object' && obj !== null) {
              const newObj: any = {};
              for (const key in obj) {
                newObj[key] = deepReplace(obj[key], oldVal, newVal);
              }
              return newObj;
            }
            return obj;
          };
          
          return deepReplace(prevCmsData, originalText, newText);
        });
      }
      
      if (event.data?.type === "CMS_ROUTE_CHANGED") {
        setPreviewUrl(event.data.payload.url);
      }
      if (event.data?.type === "CMS_IMAGE_UPDATED") {
        const { originalSrc, base64Data, fileName } = event.data.payload;
        try {
          toast.info(`Enviando ${fileName} para a AWS...`);
          const blob = await (await fetch(base64Data)).blob();
          const result = await uploadMediaToAws(new File([blob], fileName, { type: blob.type || 'image/png' }), fileName);
          setCmsData((prevCmsData: any) => {
            if (!prevCmsData) return prevCmsData;
            const deepReplace = (obj: any, oldVal: string, newVal: string): any => {
              if (typeof obj === 'string') return obj.trim() === oldVal.trim() ? newVal : obj;
              if (Array.isArray(obj)) return obj.map(item => deepReplace(item, oldVal, newVal));
              if (typeof obj === 'object' && obj !== null) {
                const newObj: any = {};
                for (const key in obj) newObj[key] = deepReplace(obj[key], oldVal, newVal);
                return newObj;
              }
              return obj;
            };
            return deepReplace(prevCmsData, originalSrc, result.url);
          });
          toast.success('Imagem salva na AWS com sucesso!');
        } catch (error: any) {
          toast.error(error.message || 'Falha ao fazer upload da imagem.');
        }
      }
    };

    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, [previewUrl]);

  const handleSelectRepo = async (repo: any, okitInstance = octokit) => {
    if (!okitInstance) return;
    setSelectedRepo(repo);
    setIsLoadingTree(true);
    setFileTree([]);
    setOpenFiles([]);
    setActiveFileId(null);
    setIsLowCodeMode(false);
    setCmsData(null);
    // Vercel Auto-Detect: Rastreia a última URL real gerada pela Vercel através da API do GitHub
    setPreviewUrl(""); // Limpa o iframe temporariamente
    try {
      const deployments = await okitInstance.repos.listDeployments({ owner: repo.owner.login, repo: repo.name, per_page: 1 });
      if (deployments.data.length > 0) {
        const statuses = await okitInstance.repos.listDeploymentStatuses({ owner: repo.owner.login, repo: repo.name, deployment_id: deployments.data[0].id });
        const successStatus = statuses.data.find(s => s.environment_url);
        if (successStatus && successStatus.environment_url) {
          setPreviewUrl(successStatus.environment_url);
        } else {
          setPreviewUrl(`https://${repo.name}.vercel.app`);
        }
      } else {
        setPreviewUrl(repo.homepage || `https://${repo.name}.vercel.app`);
      }
    } catch (e) {
      console.warn("Deployments API check failed, falling back to basic URL.");
      setPreviewUrl(repo.homepage || `https://${repo.name}.vercel.app`);
    }
    
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

  const fetchCmsData = async () => {
    if (!octokit || !selectedRepo) return;
    setIsLoadingCms(true);
    try {
      const res = await octokit.repos.getContent({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        path: 'site-content.json'
      });

      if (res?.data && 'content' in res.data) {
        const content = decodeURIComponent(escape(atob(res.data.content)));
        setCmsData(JSON.parse(content));
        setCmsFileSha((res.data as any).sha);
      }
    } catch (e) {
      console.warn("Arquivo site-content.json não encontrado.", e);
      setCmsData(null);
    } finally {
      setIsLoadingCms(false);
    }
  };

  const toggleLowCodeMode = () => {
    if (isLowCodeMode) {
      setIsLowCodeMode(false);
    } else {
      setIsLowCodeMode(true);
      setActiveFileId(null);
      if (!cmsData) fetchCmsData();
    }
  };

  const handleSelectFileNode = async (node: any) => {
    if (node.type === 'folder') return;
    setIsLowCodeMode(false);
    
    const alreadyOpen = openFiles.find(f => f.id === node.id);
    if (alreadyOpen) {
      setActiveFileId(node.id);
      return;
    }

    const newFile = { ...node };

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
          const content = decodeURIComponent(escape(atob(res.data.content)));
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
    for (const file of acceptedFiles) {
      try {
        const result = await uploadMediaToAws(file, file.name);
        await navigator.clipboard.writeText(result.url);
        alert(`Upload de ${file.name} concluído na AWS. A URL foi copiada.`);
      } catch(e) {
        console.error("Erro no upload", e);
        alert(`Erro ao fazer upload de ${file.name}`);
      }
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

  const commitToGithub = async (filePath: string, newContent: string, message: string, isBase64: boolean = false) => {
    if (!octokit || !selectedRepo) return false;
    
    try {
      let currentSha = undefined;
      // 1. Tenta pegar o SHA atual do arquivo se ele já existir
      try {
        const fileInfo = await octokit.repos.getContent({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          path: filePath,
        });
        currentSha = (fileInfo.data as any).sha;
      } catch (err) {
        // Arquivo não existe, será criado. Ignora o erro.
      }
  
      // 2. Transforma o conteúdo em Base64 (suporta acentos) ou usa o Base64 cru
      const contentBase64 = isBase64 ? newContent : btoa(unescape(encodeURIComponent(newContent)));
  
      // 3. Faz o Commit real
      await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        path: filePath,
        message: message,
        content: contentBase64,
        sha: currentSha,
        branch: selectedRepo.default_branch
      });
      
      return true;
    } catch (error) {
      console.error("Erro no commit:", error);
      return false;
    }
  };

  const handleSaveCmsEdits = async () => {
    if (!cmsData) return;
    setIsDeploying(true);
    const success = await commitToGithub('site-content.json', JSON.stringify(cmsData, null, 2), 'Atualização de conteúdo via Modo Visual');
    setIsDeploying(false);
    if (success) {
      toast.success('Alterações salvas com sucesso no GitHub!');
    } else {
      toast.error('Erro ao salvar as alterações.');
    }
  };

  const updateCmsField = (path: string[], value: string) => {
    setCmsData((prev: any) => {
      const newData = JSON.parse(JSON.stringify(prev));
      let current = newData;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newData;
    });
  };

  const renderCmsForms = (data: any, path: string[] = []) => {
    if (!data) return null;
    return Object.keys(data).map(key => {
      const val = data[key];
      const currentPath = [...path, key];
      
      if (typeof val === 'object' && val !== null) {
        return (
          <div key={currentPath.join('-')} className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-6 shadow-xl mb-6">
            <h3 className="font-bold text-[#F17B37] mb-4 border-b border-[#3c3c3c] pb-2 capitalize">{key.replace(/_/g, ' ')}</h3>
            <div className="space-y-4">
              {renderCmsForms(val, currentPath)}
            </div>
          </div>
        );
      }
      
      const isColor = typeof val === 'string' && val.startsWith('#') && (val.length === 4 || val.length === 7);
      const isImage = typeof val === 'string' && val.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i) != null;
      const isVideo = typeof val === 'string' && val.match(/\.(mp4|webm|ogg)$/i) != null;

      const handleFocus = () => {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'CMS_FOCUS_ELEMENT', payload: { originalText: val } }, '*');
        }
      };

      if (isImage) {
        return (
          <div key={currentPath.join('-')} className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg p-4 relative group hover:border-[#F17B37] transition-colors">
            <div className="absolute -top-3 left-3 bg-[#3c3c3c] text-[10px] px-2 py-0.5 rounded font-mono text-gray-300 uppercase tracking-widest border border-[#4c4c4c]">{key.replace(/_/g, ' ')} (IMAGEM)</div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
              <div className="w-full sm:w-32 h-24 bg-black rounded-md overflow-hidden flex items-center justify-center shrink-0 border border-[#3c3c3c]">
                <img src={val.startsWith('/') && selectedRepo ? `https://raw.githubusercontent.com/${selectedRepo.owner.login}/${selectedRepo.name}/${selectedRepo.default_branch}${val}` : val} className="max-w-full max-h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
              <div className="flex-1 w-full space-y-2">
                 <input type="text" value={val} onChange={(e) => updateCmsField(currentPath, e.target.value)} className="w-full bg-[#252526] border border-[#3c3c3c] text-white px-3 py-2 rounded text-sm outline-none focus:border-[#F17B37]" placeholder="Caminho ou URL da Imagem..." />
              </div>
            </div>
          </div>
        );
      }

      if (isVideo) {
        return (
          <div key={currentPath.join('-')} className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg p-4 relative group hover:border-[#F17B37] transition-colors">
            <div className="absolute -top-3 left-3 bg-[#3c3c3c] text-[10px] px-2 py-0.5 rounded font-mono text-gray-300 uppercase tracking-widest border border-[#4c4c4c]">{key.replace(/_/g, ' ')} (VÍDEO)</div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
              <div className="w-full sm:w-32 h-24 bg-black rounded-md overflow-hidden flex items-center justify-center shrink-0 border border-[#3c3c3c]">
                 <MonitorPlay className="h-8 w-8 text-blue-500" />
              </div>
              <div className="flex-1 w-full space-y-2">
                 <input type="text" value={val} onChange={(e) => updateCmsField(currentPath, e.target.value)} className="w-full bg-[#252526] border border-[#3c3c3c] text-white px-3 py-2 rounded text-sm outline-none focus:border-[#F17B37]" placeholder="Caminho ou URL do Vídeo..." />
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={currentPath.join('-')} className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg p-4 relative group hover:border-[#F17B37] transition-colors mt-4">
          <div className="absolute -top-3 left-3 bg-[#F17B37] text-[10px] px-2 py-0.5 rounded font-bold text-white uppercase tracking-widest shadow-sm">
            {key.replace(/_/g, ' ')}
          </div>
          {isColor ? (
            <div className="flex items-center gap-3 mt-2">
              <input type="color" value={val} onChange={(e) => updateCmsField(currentPath, e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
              <input type="text" value={val} onChange={(e) => updateCmsField(currentPath, e.target.value)} className="bg-[#252526] border border-[#3c3c3c] text-white px-3 py-2 rounded w-32 font-mono text-sm outline-none focus:border-[#F17B37]" />
            </div>
          ) : val.length > 60 ? (
             <textarea rows={3} value={val} onChange={(e) => updateCmsField(currentPath, e.target.value)} onFocus={handleFocus} className="mt-2 w-full bg-transparent text-white px-1 text-sm outline-none resize-none focus:bg-[#252526] focus:rounded" />
          ) : (
             <input type="text" value={val} onChange={(e) => updateCmsField(currentPath, e.target.value)} onFocus={handleFocus} className="mt-2 w-full bg-transparent text-white px-1 text-sm outline-none focus:bg-[#252526] focus:rounded" />
          )}
        </div>
      );
    });
  };

  if (isScreenSmall) {
    return (
      <div className="flex flex-col h-full w-full bg-[#1e1e1e] items-center justify-center text-center p-6 select-none" onContextMenu={(e) => e.preventDefault()}>
        <MonitorPlay className="h-20 w-20 text-[#F17B37] mb-6" />
        <h1 className="text-3xl font-black text-white mb-2">Por favor, maximize a tela</h1>
        <p className="text-gray-400 max-w-md">
          O ambiente avançado do Web IDE exige uma tela totalmente expandida para o uso dos painéis de código e edição visual. Expanda a janela do seu navegador para continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex-1 flex min-h-0 relative w-full" {...getRootProps()}>
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
          <div className="flex gap-2">
            <button onClick={toggleLowCodeMode} className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded font-bold transition-all ${isLowCodeMode ? 'bg-[#F17B37] text-white shadow-lg' : 'bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white'}`}>
              {isLowCodeMode ? <X className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
              {isLowCodeMode ? "Sair do Modo Visual" : "Modo Visual (Leigo)"}
            </button>
          </div>
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

      {/* CENTER PANE (Escondido no Modo Visual para Imersão Total) */}
      {!isLowCodeMode && (
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] border-r border-[#3c3c3c]">
            
            {/* VS CODE TOP MENU BAR */}
            <div className="h-8 bg-[#333333] flex items-center px-2 text-[13px] text-[#cccccc] select-none shrink-0 border-b border-[#252526]">
               <div className="flex items-center">
                 <div className="px-3 hover:bg-[#505050] hover:text-white cursor-pointer py-1 rounded">File</div>
                 <div className="px-3 hover:bg-[#505050] hover:text-white cursor-pointer py-1 rounded group relative">
                    Edit
                    <div className="absolute left-0 top-full mt-0 hidden group-hover:block bg-[#252526] border border-[#454545] shadow-xl rounded-b py-1 min-w-[200px] z-50 text-white">
                       <div className="px-4 py-1.5 hover:bg-[#04395e] flex justify-between cursor-pointer" onClick={() => triggerMonacoAction('actions.find')}><span>Localizar</span><span className="text-gray-500">Ctrl+F</span></div>
                       <div className="px-4 py-1.5 hover:bg-[#04395e] flex justify-between cursor-pointer" onClick={() => triggerMonacoAction('editor.action.startFindReplaceAction')}><span>Substituir</span><span className="text-gray-500">Ctrl+H</span></div>
                       <div className="h-px bg-[#454545] my-1"></div>
                       <div className="px-4 py-1.5 hover:bg-[#04395e] flex justify-between cursor-pointer" onClick={() => triggerMonacoAction('editor.action.gotoLine')}><span>Ir para Linha...</span><span className="text-gray-500">Ctrl+G</span></div>
                       <div className="h-px bg-[#454545] my-1"></div>
                       <div className="px-4 py-1.5 hover:bg-[#04395e] flex justify-between cursor-pointer" onClick={() => triggerMonacoAction('editor.action.formatDocument')}><span>Formatar Documento</span><span className="text-gray-500">Alt+Shift+F</span></div>
                    </div>
                 </div>
                 <div className="px-3 hover:bg-[#505050] hover:text-white cursor-pointer py-1 rounded">Selection</div>
                 <div className="px-3 hover:bg-[#505050] hover:text-white cursor-pointer py-1 rounded">View</div>
                 <div className="px-3 hover:bg-[#505050] hover:text-white cursor-pointer py-1 rounded">Go</div>
                 <div className="px-3 hover:bg-[#505050] hover:text-white cursor-pointer py-1 rounded">Run</div>
                 <div className="px-3 hover:bg-[#505050] hover:text-white cursor-pointer py-1 rounded">Terminal</div>
               </div>
            </div>

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
            
            <div className="flex gap-2">
              {/* Botão de Salvar do Dev (Só aparece fora do Modo Visual) */}
              {!isLowCodeMode && activeFile && activeFile.type === 'file' && (
                <button 
                  onClick={async () => {
                    setIsDeploying(true);
                    const success = await commitToGithub(activeFile.path, activeFile.content, `Atualização dev: ${activeFile.name}`);
                    setIsDeploying(false);
                    if(success) toast.success("Código salvo no GitHub com sucesso!");
                    else toast.error("Falha ao salvar código.");
                  }}
                  disabled={isDeploying}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-md flex items-center gap-2 transition-all shadow-sm"
                >
                  <Save className="h-3 w-3" />
                  Salvar Código
                </button>
              )}
  
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
          </div>

          <div className="flex-1 overflow-hidden relative">
            {!activeFile ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <BookOpen className="h-16 w-16 mb-4 opacity-20" />
                <h2 className="text-xl font-medium">Editor Inteligente</h2>
                <p className="text-sm mt-2 text-center max-w-md">Abra um arquivo pelo explorador ou use o <b>Modo Visual</b> na barra lateral para edições sem código.</p>
              </div>
            ) : activeFile.type === 'file' ? (
              <Editor
                height="100%"
                theme="vs-dark"
                language={
                  activeFile.extension === 'tsx' || activeFile.extension === 'ts' ? 'typescript' : 
                  activeFile.extension === 'css' ? 'css' : 
                  activeFile.extension === 'json' ? 'json' : 
                  activeFile.extension === 'html' ? 'html' : 
                  activeFile.extension === 'php' ? 'php' : 
                  activeFile.extension === 'py' ? 'python' : 
                  activeFile.extension === 'md' ? 'markdown' : 
                  activeFile.extension === 'js' || activeFile.extension === 'jsx' ? 'javascript' : 
                  'javascript'
                }
                value={activeFile.content}
                onMount={handleEditorDidMount}
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
      </div>
    )}

      {/* RIGHT PANE: LIVE PREVIEW IFRAME */}
      <div className={`${isLowCodeMode ? 'flex-1' : 'w-[45%]'} flex flex-col min-w-0 bg-[#ffffff] transition-all duration-300 ease-in-out`}>
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

           {isLowCodeMode && cmsData && (
             <button onClick={handleSaveCmsEdits} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-colors ml-2 shrink-0">
               <Save className="h-3 w-3" /> Salvar Edições
             </button>
           )}
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
      
      {/* Status Bar no Rodapé corrigido (Fora do Flex Row principal) */}
      <div className="h-8 w-full bg-[#333333] border-t border-[#2d2d2d] flex items-center px-4 shrink-0 z-20 justify-between">
        <div className={`flex items-center gap-2 text-xs font-bold transition-colors ${isLowCodeMode ? 'text-green-400' : 'text-red-400'}`}>
          <div className={`h-2.5 w-2.5 rounded-full ${isLowCodeMode ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
          {isLowCodeMode ? 'MODO DE EDIÇÃO VISUAL: ATIVO' : 'MODO DE EDIÇÃO VISUAL: DESATIVADO'}
        </div>
      </div>
    </div>
  );
}
