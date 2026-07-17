"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { getLowestGrossPrice } from "@/lib/fees";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, ChevronLeft, ShieldCheck, MapPin, Users, ChevronDown, ChevronUp } from "lucide-react";

export default function CarrinhoPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, updateDependent, getTotalPrice, getTotalQuantity } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [expandedDeps, setExpandedDeps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleDeps = (agendaId: string) => {
    setExpandedDeps(prev => ({ ...prev, [agendaId]: !prev[agendaId] }));
  };

  const handleCpfChange = (agendaId: string, idx: number, val: string) => {
    const formatted = formatCPF(val);
    updateDependent(agendaId, idx, 'cpf', formatted);
  };

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

  if (!mounted) return null;

  const hasMissingDependents = items.some(item => 
    item.quantity > 1 && item.dependents?.some(dep => !dep.name || !dep.cpf || dep.cpf.length < 14 || !dep.phone || dep.phone.length < 14)
  );

  const cartTotalGross = items.reduce((acc, item) => acc + (getLowestGrossPrice(item.price, item.taxa_gratis) * item.quantity), 0);

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans pb-32 lg:pb-12">
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#F17B37] rounded-full blur-[180px] opacity-10 pointer-events-none" />
      
      <header className="px-6 pt-16 pb-6 relative z-10 border-b border-white/5 bg-[#0F1722]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/agenda')} className="bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition group">
              <ChevronLeft className="h-5 w-5 text-gray-400 group-hover:text-white transition" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                Meu Carrinho
              </h1>
              <p className="text-gray-400 text-sm mt-1">{getTotalQuantity()} {getTotalQuantity() === 1 ? 'experiência selecionada' : 'experiências selecionadas'}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-8 relative z-10">
        {items.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center shadow-2xl backdrop-blur-sm max-w-2xl mx-auto">
            <ShoppingCart className="h-16 w-16 text-gray-500 mx-auto mb-6 opacity-50" />
            <h2 className="text-2xl font-bold mb-3 text-white">Sua mochila está vazia</h2>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto">Adicione algumas trilhas ao carrinho para começar sua próxima grande aventura.</p>
            <button 
              onClick={() => router.push('/agenda')}
              className="bg-[#F17B37] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#d9682b] transition shadow-[0_0_20px_rgba(241,123,55,0.3)] hover:shadow-[0_0_30px_rgba(241,123,55,0.5)] active:scale-95"
            >
              Explorar Trilhas
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Coluna da Esquerda (Itens) */}
            <div className="lg:col-span-2 space-y-6">
              {items.map((item) => (
                <motion.div 
                  key={item.agendaId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-5 md:p-8 shadow-xl flex flex-col gap-6 backdrop-blur-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-2 h-full bg-[#F17B37]" />
                  
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex-1">
                      <span className="bg-white/10 text-gray-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Trilha</span>
                      <h3 className="font-extrabold text-xl md:text-2xl text-white mb-2 leading-tight">{item.title}</h3>
                      <p className="text-sm text-gray-400 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[#F17B37]" /> {item.date}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex items-center gap-1 bg-[#0F1722] p-1.5 rounded-2xl border border-white/10 shadow-inner">
                        <button 
                          onClick={() => updateQuantity(item.agendaId, Math.max(1, item.quantity - 1))}
                          className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition"
                        >
                          -
                        </button>
                        <span className="font-black w-8 text-center text-lg">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.agendaId, item.quantity + 1)}
                          disabled={item.quantity >= (item.availableSpots || 100)}
                          className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="text-right min-w-[100px]">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Subtotal</p>
                        <p className="font-black text-white text-xl"><span className="text-xs font-normal text-gray-400 mr-2">a partir de</span>R$ {(getLowestGrossPrice(item.price, item.taxa_gratis) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      
                      <button 
                        onClick={() => removeItem(item.agendaId)}
                        className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                        title="Remover Item"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {item.quantity > 1 && (
                    <div className="bg-[#0F1722]/50 border border-white/5 rounded-2xl overflow-hidden transition-all mt-2">
                      <button 
                        onClick={() => toggleDeps(item.agendaId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#F17B37]/10 flex items-center justify-center">
                            <Users className="text-[#F17B37] h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-sm text-gray-200">Acompanhantes ({item.quantity - 1})</h4>
                            <p className="text-xs text-red-400 font-medium">
                              {item.dependents?.some(dep => !dep.name || !dep.cpf || dep.cpf.length < 14) ? '⚠ Preenchimento pendente' : '✅ Todos preenchidos'}
                            </p>
                          </div>
                        </div>
                        {expandedDeps[item.agendaId] ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                      </button>

                      <AnimatePresence>
                        {expandedDeps[item.agendaId] && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4"
                          >
                            <p className="text-xs text-gray-400 mb-2">1 vaga é sua (Titular). Preencha os dados abaixo para gerar os tickets dos amigos.</p>
                            {item.dependents?.map((dep, idx) => (
                              <div key={idx} className="flex flex-col md:flex-row gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                <div className="flex-1 relative">
                                  <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">CPF</label>
                                  <input 
                                    type="text" 
                                    value={dep.cpf || ''}
                                    maxLength={14}
                                    onChange={(e) => handleCpfChange(item.agendaId, idx, e.target.value)}
                                    placeholder="000.000.000-00"
                                    className="w-full p-3 bg-[#0F1722] border border-white/10 rounded-lg focus:ring-1 focus:ring-[#F17B37] outline-none text-sm transition"
                                  />
                                </div>
                                <div className="flex-[1.5]">
                                  <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Nome Completo</label>
                                  <input 
                                    type="text" 
                                    value={dep.name || ''}
                                    onChange={(e) => updateDependent(item.agendaId, idx, 'name', e.target.value)}
                                    placeholder="Nome do acompanhante"
                                    className="w-full p-3 bg-[#0F1722] border border-white/10 rounded-lg focus:ring-1 focus:ring-[#F17B37] outline-none text-sm transition"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">WhatsApp</label>
                                  <input 
                                    type="text" 
                                    value={dep.phone || ''}
                                    maxLength={15}
                                    onChange={(e) => handlePhoneChange(item.agendaId, idx, e.target.value)}
                                    placeholder="(00) 00000-0000"
                                    className="w-full p-3 bg-[#0F1722] border border-white/10 rounded-lg focus:ring-1 focus:ring-[#F17B37] outline-none text-sm transition"
                                  />
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              ))}
              
              <div className="hidden lg:block">
                 <button 
                    onClick={() => router.push('/agenda')}
                    className="mt-4 px-6 py-4 bg-white/5 text-white rounded-2xl font-bold hover:bg-white/10 transition border border-white/10 inline-block"
                  >
                    + Adicionar mais trilhas
                  </button>
              </div>
            </div>

            {/* Coluna da Direita (Sidebar Desktop / Rodapé Mobile) */}
            <div className="lg:col-span-1">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md sticky top-32 lg:shadow-2xl">
                <h3 className="text-xl font-bold mb-6 hidden lg:block">Resumo da Compra</h3>
                
                <div className="hidden lg:flex justify-between items-center mb-4 text-gray-400 text-sm">
                  <span>Subtotal ({getTotalQuantity()} itens)</span>
                  <span>R$ {cartTotalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                
                <div className="hidden lg:block border-t border-white/10 my-4"></div>

                <div className="flex items-center justify-between gap-8 mb-6">
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-widest font-bold block mb-1">Total a Pagar</span>
                    <p className="text-2xl md:text-4xl font-black text-white leading-none">R$ {cartTotalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="lg:hidden">
                    {hasMissingDependents && (
                      <div className="text-xs text-red-400 font-bold leading-tight text-right">
                        Preencha os acompanhantes.
                      </div>
                    )}
                  </div>
                </div>

                {hasMissingDependents && (
                  <div className="hidden lg:flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl font-bold mb-6">
                    ⚠ É necessário preencher os dados de todos os acompanhantes antes de seguir.
                  </div>
                )}
                
                <div className="flex lg:flex-col gap-3">
                  <button 
                    onClick={() => router.push('/agenda')}
                    className="flex-1 lg:hidden px-4 py-4 bg-white/5 text-white rounded-2xl font-bold hover:bg-white/10 transition border border-white/10 text-sm"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={() => router.push('/checkout')}
                    disabled={hasMissingDependents}
                    className="flex-[2] lg:w-full bg-gradient-to-r from-[#25D366] to-[#20b858] text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] shadow-[0_0_20px_rgba(37,211,102,0.2)] hover:shadow-[0_0_30px_rgba(37,211,102,0.4)] transition disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-lg"
                  >
                    <ShieldCheck className="h-6 w-6" />
                    Ir para Pagamento
                  </button>
                </div>
              </div>
            </div>
            
            {/* O painel fixo no rodapé do mobile agora está integrado na estrutura acima via classes LG */}
            {/* Num celular (onde LG não aplica), essa sidebar vira o bloco inferior, mas sem position fixed pra não bugar teclados */}
            
          </div>
        )}
      </div>
      
      {/* Ajuste mobile: O bloco acima não é "fixed" mais, ele desce naturalmente. 
          Se preferir fixed no mobile, descomente o bloco abaixo. */}
      
    </div>
  );
}
