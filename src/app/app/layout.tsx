import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, MonitorX, Smartphone } from "lucide-react";
import MobileAppShell from "@/components/app/MobileAppShell";

function isMobileRequest(requestHeaders: Headers) {
  const userAgent = requestHeaders.get("user-agent") || "";
  const clientHintMobile = requestHeaders.get("sec-ch-ua-mobile");

  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const browserReportsMobile = clientHintMobile === "?1";

  return mobileUserAgent || browserReportsMobile;
}

function DesktopBlockedScreen() {
  return (
    <div className="min-h-[100dvh] bg-[#0F1722] text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#F17B37]/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg text-center bg-white/5 border border-white/10 rounded-[2rem] p-8 md:p-12 shadow-2xl backdrop-blur-xl">
        <div className="w-24 h-24 mx-auto mb-7 rounded-3xl bg-purple-500/15 border border-purple-400/20 flex items-center justify-center">
          <MonitorX className="w-12 h-12 text-purple-300" />
        </div>

        <p className="text-purple-300 text-xs font-black uppercase tracking-[0.25em] mb-3">MaisTrilha App</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Acesso exclusivo pelo celular</h1>
        <p className="text-gray-300 leading-relaxed mb-8">
          Esta área foi desenvolvida especialmente para dispositivos móveis. Abra este endereço no seu celular ou tablet para acessar sua carteira, trilhas, loja, ranking e perfil.
        </p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-xl bg-[#F17B37]/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-[#F17B37]" />
          </div>
          <div>
            <p className="font-bold text-white">Continue no seu dispositivo móvel</p>
            <p className="text-sm text-gray-400">Use o mesmo endereço que está aberto neste computador.</p>
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 w-full bg-[#F17B37] hover:bg-[#df6d2f] text-white py-4 px-6 rounded-2xl font-black transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para o site
        </Link>
      </div>
    </div>
  );
}

export default async function PwaLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();

  if (!isMobileRequest(requestHeaders)) {
    return <DesktopBlockedScreen />;
  }

  return <MobileAppShell>{children}</MobileAppShell>;
}
