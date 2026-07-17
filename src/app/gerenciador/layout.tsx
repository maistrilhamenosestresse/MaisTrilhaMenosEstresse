import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gerenciador Web IDE | Mais Trilha Menos Estresse',
  description: 'Ambiente de desenvolvimento e CMS integrado.',
};

export default async function GerenciadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full bg-[#1e1e1e] text-[#cccccc] overflow-hidden flex flex-col font-mono">
      {/* Top Menu Bar (Like VS Code) */}
      <div className="h-10 bg-[#333333] border-b border-[#2d2d2d] flex items-center px-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-xs font-medium tracking-wider text-gray-300">Mais Trilha - Web IDE</span>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
