"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, ChevronLeft, ChevronRight, ShieldCheck, MapPin, Users, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CarrinhoPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, updateDependent, getTotalPrice, getTotalQuantity } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [loadingDep, setLoadingDep] = useState<string | null>(null); // Armazena a chave agendaId-idx para mostrar spinner

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCpfChange = async (agendaId: string, idx: number, val: string) => {
    const formatted = formatCPF(val);
    updateDependent(agendaId, idx, 'cpf', formatted);

    if (formatted.length === 14) {
      setLoadingDep(`${agendaId}-${idx}`);
      try {
        const { data } = await supabase.from('clients').select('full_name').eq('cpf', formatted).single();
        if (data && data.full_name) {
          updateDependent(agendaId, idx, 'name', data.full_name);
        }
      } catch (err) {
        // Ignora erro se no existir
      }
      setLoadingDep(null);
    }
  };

  if (!mounted) return null;

  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return v;
  };

  const formatPhone = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
      v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
      v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    }
    return v;
  };

  const handlePhoneChange = (agendaId: string, idx: number, val: string) => {
    const formatted = formatPhone(val);
    updateDependent(agendaId, idx, 'phone', formatted);
  };

  const hasMissingDependents = items.some(item => 
    item.quantity > 1 && item.dependents?.some(dep => !dep.name || dep.cpf.length < 14 || !dep.phone || dep.phone.length < 14)
  );

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans pb-32">
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F17B37] rounded-full blur-[150px] opacity-5 pointer-events-none" />
      
      <header className="px-6 pt-24 pb-8 relative z-10">
        <button onClick={() => router.push('/agenda')} className="bg-white/5 p-3 rounded-full border border-white/10 hover:bg-white/10 transition mb-6">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-[#F17B37]" /> Meu Carrinho
        </h1>
        <p className="text-gray-400 mt-2">Você tem {getTotalQuantity()} itens no carrinho.</p>
      </header>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        {items.length === 0 ? (
          <div className="bg-[#1a2332] border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
            <ShoppingCart className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h2>
            <p className="text-gray-400 mb-8">Bora escolher sua próxima aventura?</p>
            <button 
              onClick={() => router.push('/')}
              className="bg-white/10 text-white px-8 py-3 rounded-xl font-bold hover:bg-white/20 transition"
            >
              Ver Trilhas Disponíveis
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((item) => (
              <motion.div 
                key={item.agendaId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1a2332] border border-white/10 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col gap-6"
              >
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg md:text-xl text-[#F17B37] mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {item.date}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/10">
                      <button 
                        onClick={() => updateQuantity(item.agendaId, Math.max(1, item.quantity - 1))}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                      >
                        -
                      </button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.agendaId, item.quantity + 1)}
                        disabled={item.quantity >= (item.availableSpots || 100)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Subtotal</p>
                      <p className="font-bold text-[#25D366] text-lg">R$ {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    
                    <button 
                      onClick={() => removeItem(item.agendaId)}
                      className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition"
                      title="Remover Item"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {item.quantity > 1 && (
                  <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="text-[#F17B37] h-5 w-5" />
                      <h4 className="font-bold text-sm text-gray-300">Dados dos Acompanhantes</h4>
                    </div>
                    <p className="text-xs text-gray-400">1 vaga é sua (Titular). Preencha os dados das {item.quantity - 1} vagas extras para gerar as reservas.</p>
                    
                    {item.dependents?.map((dep, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-4 pt-2 border-t border-white/5 first:border-0 first:pt-0">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-400 mb-1">Nome Completo (Acompanhante {idx + 1})</label>
                          <input 
                            type="text" 
                            value={dep.name}
                            onChange={(e) => updateDependent(item.agendaId, idx, 'name', e.target.value)}
                            placeholder="Nome completo do acompanhante"
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#F17B37] outline-none text-sm transition"
                          />
                        </div>
                        <div className="flex-1 relative">
                          <label className="block text-xs font-bold text-gray-400 mb-1">CPF (Acompanhante {idx + 1})</label>
                          <input 
                            type="text" 
                            value={dep.cpf}
                            maxLength={14}
                            onChange={(e) => handleCpfChange(item.agendaId, idx, e.target.value)}
                            placeholder="000.000.000-00"
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#F17B37] outline-none text-sm transition"
                          />
                          {loadingDep === `${item.agendaId}-${idx}` && (
                            <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-[#F17B37]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-gray-400 mb-1">WhatsApp (Acompanhante {idx + 1})</label>
                          <input 
                            type="text" 
                            value={dep.phone || ''}
                            maxLength={15}
                            onChange={(e) => handlePhoneChange(item.agendaId, idx, e.target.value)}
                            placeholder="(00) 00000-0000"
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#F17B37] outline-none text-sm transition"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="mt-2 text-xs text-[#F17B37] font-medium bg-[#F17B37]/10 p-3 rounded-lg border border-[#F17B37]/20">
                      Importante: Peça para seus acompanhantes entrarem no site depois para finalizar o próprio cadastro e assinar o contrato.
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            <div className="bg-[#1a2332] border border-white/10 rounded-2xl p-6 shadow-xl mt-8">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-6">
                <span className="text-xl font-bold text-gray-300">Total da Compra</span>
                <span className="text-3xl font-black text-[#25D366]">R$ {getTotalPrice().toFixed(2)}</span>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                <button 
                  onClick={() => router.push('/agenda')}
                  className="flex-1 px-6 py-4 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition border border-white/10"
                >
                  Continuar Comprando
                </button>
                <button 
                  onClick={() => router.push('/checkout')}
                  disabled={hasMissingDependents}
                  className="flex-[2] bg-gradient-to-r from-[#F17B37] to-[#f9a03f] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-[#F17B37]/20 transition disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Finalizar Compra Segura
                </button>
              </div>
              {hasMissingDependents && (
                <p className="text-red-400 text-xs text-center mt-3 font-bold">
                  Preencha o Nome, CPF e WhatsApp de todos os acompanhantes para continuar.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
