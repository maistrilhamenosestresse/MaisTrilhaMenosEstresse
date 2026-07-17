"use client";

import { Home, ShoppingBag, Map, Trophy, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RequireAuth from "@/components/app/RequireAuth";

export default function MobileAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/app/login";

  const navItems = [
    { name: "Início", path: "/app", icon: <Home className="w-6 h-6" /> },
    { name: "Trilhas", path: "/app/trilhas", icon: <Map className="w-6 h-6" /> },
    { name: "Loja", path: "/app/loja", icon: <ShoppingBag className="w-6 h-6" /> },
    { name: "Ranking", path: "/app/ranking", icon: <Trophy className="w-6 h-6" /> },
    { name: "Perfil", path: "/app/perfil", icon: <User className="w-6 h-6" /> },
  ];

  return (
    <RequireAuth>
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col pb-20">
        <main className="flex-1 w-full max-w-lg mx-auto bg-white shadow-xl min-h-screen relative overflow-x-hidden">
          {children}
        </main>

        {!isLoginPage && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.path || (item.path !== "/app" && pathname.startsWith(item.path));

                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? "text-purple-600" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <div className={`transition-transform duration-200 ${isActive ? "scale-110" : "scale-100"}`}>
                      {item.icon}
                    </div>
                    <span className="text-[10px] font-bold tracking-wide">{item.name}</span>
                    {isActive && <div className="absolute top-0 w-8 h-1 bg-purple-600 rounded-b-full" />}
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
