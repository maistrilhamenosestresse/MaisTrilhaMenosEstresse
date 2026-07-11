"use client";

import React from "react";

export default function Home() {
  return (
    <div className="fixed inset-0 z-[99999] bg-[#0F1722] flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white/5 p-8 rounded-3xl backdrop-blur-md border border-white/10 max-w-lg w-full shadow-2xl">
        <div className="w-20 h-20 bg-[#F17B37] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(241,123,55,0.4)]">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white mb-4">Site em Manutenção</h1>
        <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-8">
          Estamos preparando os servidores e atualizando nossos sistemas para o lançamento oficial do novo Aplicativo MaisTrilha. Estaremos de volta em breve!
        </p>
        <div className="w-10 h-10 border-4 border-[#F17B37] border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}
