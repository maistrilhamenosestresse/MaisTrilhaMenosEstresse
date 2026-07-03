"use client";

import { useEffect, useState } from "react";

export default function VisualEditorBridge() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Só ativa se estiver rodando dentro de um iframe (Modo Edição do CMS)
    if (typeof window !== "undefined" && window !== window.parent) {
      setTimeout(() => setIsActive(true), 0);
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "CMS_PING") {
          window.parent.postMessage({ type: "CMS_PONG", url: window.location.pathname }, "*");
        }
        
        // Highlight Reverso: Quando clica no input do painel esquerdo, brilha no iframe
        if (event.data?.type === "CMS_FOCUS_ELEMENT") {
          const { originalText } = event.data.payload;
          const editables = document.querySelectorAll('[data-cms-editable="true"]');
          for (let i = 0; i < editables.length; i++) {
            const el = editables[i] as HTMLElement;
            if (el.getAttribute("data-original-text") === originalText || el.textContent === originalText) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Efeito de pulso rápido
              el.style.transition = 'all 0.3s ease';
              el.style.backgroundColor = 'rgba(241, 123, 55, 0.4)';
              el.style.outline = '4px solid #F17B37';
              
              setTimeout(() => {
                el.style.backgroundColor = '';
                el.style.outline = '';
              }, 1500);
              break;
            }
          }
        }
      };
      window.addEventListener("message", handleMessage);
      
      // Notifica o painel que a ponte está pronta
      window.parent.postMessage({ type: "CMS_BRIDGE_READY" }, "*");

      // Estilos injetados para mostrar modo de edição
      const style = document.createElement("style");
      style.innerHTML = `
        [data-cms-editable="true"]:hover {
          outline: 2px dashed #F17B37 !important;
          outline-offset: 4px;
          cursor: text !important;
          background-color: rgba(241, 123, 55, 0.1) !important;
          transition: all 0.2s ease;
        }
        [data-cms-editable="true"]:focus {
          outline: 2px solid #F17B37 !important;
          background-color: rgba(0, 0, 0, 0.5) !important;
          color: white !important;
        }
        img[data-cms-editable="true"]:hover {
          outline: 4px solid #F17B37 !important;
          cursor: pointer !important;
          opacity: 0.8;
        }
      `;
      document.head.appendChild(style);

      // Função para tornar elementos editáveis
      const makeEditable = () => {
        // Envia a rota atual sempre que o DOM mudar (soft navigation do Next.js)
        window.parent.postMessage({ type: "CMS_ROUTE_CHANGED", payload: { url: window.location.pathname } }, "*");

        const tags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "button", "a"];
        tags.forEach(tag => {
          const elements = document.getElementsByTagName(tag);
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            // Ignorar elementos vazios
            if ((el.textContent?.trim().length ?? 0) > 0 && !el.hasAttribute("data-cms-editable")) {
              el.setAttribute("data-cms-editable", "true");
              el.title = "Clique duplo para editar";
              
              // Navegação de Links: Shift+Click para navegar, Click simples para editar URL
              el.addEventListener("click", (e) => {
                const link = el.tagName.toLowerCase() === "a" ? el : el.closest("a");
                if (link) {
                  if (e.shiftKey) {
                    // Permite a navegação se estiver segurando Shift
                    return;
                  } else {
                    // Previne a navegação e abre a edição de URL
                    e.preventDefault();
                    
                    // Pequeno delay para garantir que duplo-clique de edição de texto tenha prioridade
                    if (e.detail === 1) { // Verifica se é um clique simples
                      setTimeout(() => {
                        // Só abre o prompt se não estiver focado (que significa que o duplo clique ativou o modo texto)
                        if (document.activeElement !== link && document.activeElement !== el) {
                          const newHref = prompt("Modo Visual: Digite o novo link (Ex: /contato ou https://google.com)\n\nDica: Segure SHIFT e clique para acessar o link em vez de editar.", link.getAttribute("href") || "");
                          if (newHref !== null && newHref.trim() !== "") {
                            window.parent.postMessage({
                              type: "CMS_TEXT_UPDATED",
                              payload: {
                                originalText: link.getAttribute("href") || "",
                                newText: newHref
                              }
                            }, "*");
                            link.setAttribute("href", newHref);
                          }
                        }
                      }, 250);
                    }
                  }
                }
              });
              
              el.addEventListener("dblclick", (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.contentEditable = "true";
                el.focus();
              });

              el.addEventListener("blur", () => {
                el.contentEditable = "false";
                // Envia a alteração para o painel pai (IDE)
                window.parent.postMessage({
                  type: "CMS_TEXT_UPDATED",
                  payload: {
                    tag: el.tagName.toLowerCase(),
                    originalText: el.getAttribute("data-original-text") || el.textContent,
                    newText: el.textContent,
                    url: window.location.pathname
                  }
                }, "*");
                // Atualiza o texto original guardado
                el.setAttribute("data-original-text", el.textContent || "");
              });

              // Guardar o texto original na primeira vez
              if (!el.getAttribute("data-original-text")) {
                el.setAttribute("data-original-text", el.textContent || "");
              }
            }
          }
        });

        // Torna Imagens editáveis (Clique simples abre file picker)
        const images = document.getElementsByTagName("img");
        for (let i = 0; i < images.length; i++) {
          const img = images[i] as HTMLImageElement;
          if (!img.hasAttribute("data-cms-editable")) {
            img.setAttribute("data-cms-editable", "true");
            img.title = "Clique para trocar a imagem";
            
            img.addEventListener("click", (e) => {
              e.preventDefault();
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (ev: Event) => {
                const target = ev.target as HTMLInputElement;
                const file = target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (readerEvent) => {
                    const base64 = readerEvent.target?.result as string;
                    const originalSrc = img.getAttribute("src") || "";
                    
                    window.parent.postMessage({
                      type: "CMS_IMAGE_UPDATED",
                      payload: {
                        originalSrc: originalSrc,
                        base64Data: base64,
                        fileName: file.name
                      }
                    }, "*");
                    
                    img.src = base64; // Atualiza local para preview
                  };
                  reader.readAsDataURL(file);
                }
              };
              input.click();
            });
          }
        }
      };

      // Tentar tornar editável logo que carregar e sempre que a rota mudar
      makeEditable();
      const observer = new MutationObserver(() => makeEditable());
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        window.removeEventListener("message", handleMessage);
        observer.disconnect();
      };
    }
  }, []);

  if (!isActive) return null;

  return (
    <div style={{ position: "fixed", bottom: 10, right: 10, backgroundColor: "#F17B37", color: "white", padding: "4px 8px", fontSize: "10px", fontWeight: "bold", borderRadius: "4px", zIndex: 9999, pointerEvents: "none" }}>
      MODO EDIÇÃO VISUAL ATIVO
    </div>
  );
}
