"use client";

import { useEffect, useState } from "react";

export default function VisualEditorBridge() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Só ativa se estiver rodando dentro de um iframe (Modo Edição do CMS)
    if (typeof window !== "undefined" && window !== window.parent) {
      setIsActive(true);
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "CMS_PING") {
          window.parent.postMessage({ type: "CMS_PONG", url: window.location.pathname }, "*");
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
      `;
      document.head.appendChild(style);

      // Função para tornar elementos editáveis
      const makeEditable = () => {
        const tags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "button", "a"];
        tags.forEach(tag => {
          const elements = document.getElementsByTagName(tag);
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            // Ignorar elementos muito complexos ou com filhos HTML (pra não quebrar o layout)
            if (el.children.length === 0 && el.textContent?.trim().length! > 0) {
              el.setAttribute("data-cms-editable", "true");
              el.title = "Clique duplo para editar";
              
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
              });

              // Guardar o texto original na primeira vez
              if (!el.getAttribute("data-original-text")) {
                el.setAttribute("data-original-text", el.textContent || "");
              }
            }
          }
        });
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
