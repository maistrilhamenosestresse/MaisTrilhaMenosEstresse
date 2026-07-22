"use client";

import { Home, ShoppingBag, Map, Trophy, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RequireAuth from "@/components/app/RequireAuth";
import { ConnectionStatus } from "@/components/app/ConnectionStatus";

export default function MobileAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/app/login";

  const navItems = [
    { name: "Início", path: "/app", icon: Home },
    { name: "Trilhas", path: "/app/trilhas", icon: Map },
    { name: "Loja", path: "/app/loja", icon: ShoppingBag },
    { name: "Classificação", path: "/app/ranking", icon: Trophy },
    { name: "Perfil", path: "/app/perfil", icon: User },
  ];

  return (
    <RequireAuth>
      <div className="mt-app-shell h-[100dvh] flex flex-col overflow-hidden">
        <ConnectionStatus />
        <main className="mt-app-canvas app-mobile-scroll flex-1 min-h-0 w-full max-w-2xl mx-auto relative overflow-x-hidden overflow-y-auto overscroll-contain">
          {children}
        </main>

        {!isLoginPage && (
          <nav aria-label="Navegação principal do app" className="mt-app-nav shrink-0 border-t z-50 pb-safe">
            <div className="flex items-center h-[4.35rem] max-w-2xl mx-auto px-1.5 sm:px-4">
              {navItems.map((item) => {
                const isActive = pathname === item.path || (item.path !== "/app" && pathname.startsWith(item.path));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                      isActive ? "text-[#D96224]" : "text-[#718096] hover:text-[#0B2540]"
                    }`}
                  >
                    <div className={`grid h-8 w-11 place-items-center rounded-full transition-all duration-200 ${
                      isActive ? "bg-[#FFF0E6] -translate-y-0.5" : ""
                    }`}>
                      <Icon className="h-[1.3rem] w-[1.3rem]" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-extrabold tracking-wide">{item.name}</span>
                    {isActive && <span className="absolute top-0 h-1 w-9 rounded-b-full bg-[#F17B37]" />}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </RequireAuth>
  );
}
