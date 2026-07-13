"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Camera, User, FileText, Calendar, Phone, HeartPulse, AlertTriangle, CheckCircle2, Loader2, ChevronRight, ShieldCheck, PenTool, Eraser } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { useSearchParams } from "next/navigation";

import { Suspense } from "react";
import { useCartStore } from "@/store/cartStore";
import { Users } from "lucide-react";

function CadastroContent() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDuplicateBlock, setIsDuplicateBlock] = useState(false);
  const [duplicateBlockMessage, setDuplicateBlockMessage] = useState("");
  
  const searchParams = useSearchParams();
  const agendaId = searchParams.get('agenda_id');
  const { items, clearCart } = useCartStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const primaryAgendas = items.map(i => i.agendaId);
  const hasExtraPassengers = false;
  
  // Update total steps
  const totalSteps = 4;

  const initialEmail = searchParams.get('email') || "";
  const initialCpf = searchParams.get('cpf') || "";
  const [agenda, setAgenda] = useState<any>(null);

  useEffect(() => {
    if (agendaId) {
      supabase.from('agendas').select('*').eq('id', agendaId).single().then(({data}) => {
        if (data) setAgenda(data);
      });
    }
  }, [agendaId]);

  useEffect(() => {
    if (initialCpf) {
      supabase.from('clients').select('*').eq('cpf', initialCpf).single().then(({data}) => {
        if (data) {
          if (data.rg && data.birth_date && data.emergency_contact_phone) {
             setDuplicateBlockMessage("Identificamos que seu cadastro já está completo em nosso sistema. Você não precisa preencher novamente.");
             setIsDuplicateBlock(true);
             return;
          }
          setFormData(prev => ({
            ...prev,
            full_name: data.full_name || prev.full_name,
            email: data.email || prev.email,
            rg: data.rg || prev.rg,
            birth_date: data.birth_date || prev.birth_date,
            phone: data.phone || prev.phone,
            emergency_contact_name: data.emergency_contact_name || prev.emergency_contact_name,
            emergency_contact_phone: data.emergency_contact_phone || prev.emergency_contact_phone,
            health_notes: data.health_notes || prev.health_notes
          }));
        }
      });
    }
  }, [initialCpf]);
  
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: initialEmail,
    cpf: initialCpf,
    rg: "",
    birth_date: "",
    phone: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    health_notes: "",
    allergies: "",
    medical_conditions: "",
    photo: null as File | null,
    image_authorization: "sim",
    signature_url: "" // will hold base64 temporarily before upload
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData({ ...formData, photo: file });
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  if (!mounted) return null;

  const handleNext = async () => {
    if (step === 2 && !initialCpf) {
      setIsLoading(true);
      try {
        const { data } = await supabase.from('clients').select('rg, birth_date, emergency_contact_phone').eq('cpf', formData.cpf).single();
        if (data) {
          if (data.rg && data.birth_date && data.emergency_contact_phone) {
             setDuplicateBlockMessage("Identificamos que seu cadastro já está completo em nosso sistema. Você não precisa preencher novamente.");
             setIsDuplicateBlock(true);
             setIsLoading(false);
             return;
          }
          if (items.length === 0 && !agendaId) {
             setDuplicateBlockMessage("Seu cadastro está pendente. Por favor, utilize o link de conclusão que foi enviado no seu e-mail.");
             setIsDuplicateBlock(true);
             setIsLoading(false);
             return;
          }
        }
      } catch (e) {
         // ignorar erro se cpf não encontrado
      }
      setIsLoading(false);
    }
    setStep(prev => prev + 1);
  };
  const handlePrev = () => setStep(prev => prev - 1);

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
      v = v.replace(/(\d{5})(\d)/, "$1-$2");
    }
    return v;
  };

  const formatRG = (v: string) => {
    v = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    let letters = v.replace(/[^A-Z]/g, "").substring(0, 2);
    let numbers = v.replace(/[^0-9]/g, "").substring(0, 9);
    
    if (numbers.length > 0) {
      if (numbers.length > 5) {
        numbers = numbers.replace(/^(\d{2})(\d{3})(\d{1,4})/, "$1.$2.$3");
      } else if (numbers.length > 2) {
        numbers = numbers.replace(/^(\d{2})(\d{1,3})/, "$1.$2");
      }
    }

    if (letters.length === 2) {
      return numbers.length > 0 ? `${letters}-${numbers}` : letters;
    }
    return letters + numbers;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Verifica Duplicidade - (Removido, faremos Upsert)

      let photoUrl = "";
      let signatureUrl = "";

      // 1. Upload Photo
      if (formData.photo) {
        const fileExt = formData.photo.name.split('.').pop();
        const fileName = `client_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('fotos_agendas')
          .upload(fileName, formData.photo);
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('fotos_agendas')
          .getPublicUrl(fileName);
          
        photoUrl = publicUrlData.publicUrl;
      }

      // 1.5 Upload Signature
      if (signatureData) {
        const res = await fetch(signatureData);
        const blob = await res.blob();
        
        const signatureName = `signature_${Math.random().toString(36).substring(2)}_${Date.now()}.png`;
        const { error: sigUploadError } = await supabase.storage
          .from('fotos_agendas')
          .upload(signatureName, blob, { contentType: 'image/png' });
          
        if (sigUploadError) throw sigUploadError;

        const { data: publicSigData } = supabase.storage
          .from('fotos_agendas')
          .getPublicUrl(signatureName);
        
        signatureUrl = publicSigData.publicUrl;
      }

      // Concatena as observações de saúde
      const formattedHealthNotes = `Alergias a medicação: ${formData.allergies || 'Não tem'}\nDoenças/Condições: ${formData.medical_conditions || 'Não tem'}\nOutras Notas: ${formData.health_notes || 'Nenhuma'}`;

      // 2. Save to Supabase (Clients)
      const payload = {
        full_name: formData.full_name,
        email: formData.email,
        cpf: formData.cpf,
        rg: formData.rg,
        birth_date: formData.birth_date,
        phone: formData.phone,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        health_notes: formattedHealthNotes,
        photo_url: photoUrl,
        image_authorization: formData.image_authorization === "sim",
        signature_url: signatureUrl
      };

      // Tenta atualizar se já existe, senão insere (Upsert simplificado)
      let savedClient;
      const { data: existingClient } = await supabase.from('clients').select('*').eq('cpf', formData.cpf).single();
      if (existingClient) {
        const { data: updatedData, error: updateError } = await supabase.from('clients').update(payload).eq('id', existingClient.id).select();
        if (updateError) throw updateError;
        savedClient = updatedData[0];
      } else {
        const { data: insertedData, error: insertError } = await supabase.from('clients').insert([payload]).select();
        if (insertError) throw insertError;
        savedClient = insertedData[0];
      }

        
        // 3. Criar Reserva se existir agendaId (Substituido por Carrinho)
        let reservaIds = [];
        let totalItemsPrice = 0;
        let checkoutTitle = "Trilhas (Combo)";

        if (items.length > 0 && savedClient) {
          // Calcula preco total
          totalItemsPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          if (items.length === 1) checkoutTitle = items[0].title;
          
          const allReservationsToCreate = [];
          
          // Primary buyer spots
          primaryAgendas.forEach(aId => {
             allReservationsToCreate.push({ client_id: savedClient.id, agenda_id: aId });
          });

          // Extra Passengers spots from Cart Store
          for (const item of items) {
             if (item.dependents && item.dependents.length > 0) {
               for (const dep of item.dependents) {
                 if (dep.name && dep.cpf) {
                   let epId;
                   const { data: existingEp } = await supabase.from('clients').select('*').eq('cpf', dep.cpf).single();
                   if (existingEp) {
                      const { data: updatedEp } = await supabase.from('clients').update({ full_name: dep.name }).eq('id', existingEp.id).select();
                      epId = updatedEp![0].id;
                   } else {
                      const { data: insertedEp } = await supabase.from('clients').insert([{ full_name: dep.name, cpf: dep.cpf }]).select();
                      epId = insertedEp![0].id;
                   }
                   allReservationsToCreate.push({ client_id: epId, agenda_id: item.agendaId });
                 }
               }
             }
          }

          const resReserva = await fetch('/api/create-reserva', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reservas: allReservationsToCreate
            })
          });
          
          if (!resReserva.ok) {
            const errData = await resReserva.json();
            throw new Error(errData.error || 'Erro ao criar reservas');
          }
          
          const reservaJson = await resReserva.json();
          reservaIds = reservaJson.reservas.map((r: any) => r.id);
        } else if (agendaId && savedClient) {
          // Fallback if accessed via direct URL instead of cart
          const resReserva = await fetch('/api/create-reserva', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reservas: [{ client_id: savedClient.id, agenda_id: agendaId }]
            })
          });
          const reservaJson = await resReserva.json();
          reservaIds = reservaJson.reservas.map((r: any) => r.id);
          totalItemsPrice = agenda?.price || 0;
          checkoutTitle = agenda?.title || 'Trilha';
        }

      // 4. Send Email Notification
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'new_registration', client: savedClient })
      }).catch(err => console.error("Erro ignorado de email", err));

      // 5. Pagamento via InfinitePay
      if (reservaIds.length > 0) {
        try {
          const reqCheckout = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reserva_ids: reservaIds,
              agenda_title: checkoutTitle,
              price: totalItemsPrice,
              customer: {
                name: savedClient.full_name,
                email: savedClient.email,
                phone_number: savedClient.phone
              }
            })
          });
          const resCheckout = await reqCheckout.json();
          
          if (resCheckout.url) {
            clearCart();
            window.location.href = resCheckout.url; // Redireciona para pagar
            return;
          }
        } catch (e) {
          console.error("Erro ao gerar link InfinitePay", e);
        }
      }

      // Se não tiver pagamento online ou falhar, vai para o sucesso genérico
      setIsSuccess(true);
      
    } catch (error: any) {
      console.error("Erro completo:", error);
      const errorMessage = error.message || error.error_description || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      alert("Ocorreu um erro ao enviar o cadastro: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isDuplicateBlock) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1a2332] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-[#25D366]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-[#25D366]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Cadastro Verificado!</h2>
          <p className="text-gray-300 mb-8 leading-relaxed">
            {duplicateBlockMessage}
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-[#F17B37] text-white py-3 rounded-xl font-bold hover:bg-[#d9682b] transition"
          >
            Voltar para o Início
          </button>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1a2332] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Cadastro Concluído!</h2>
          <p className="text-gray-400 mb-8">
            Sua vaga foi pré-reservada. Se você não foi redirecionado para o pagamento, aguarde o contato da equipe.
          </p>
          <button 
            onClick={() => window.location.href = `/agenda/${agendaId || ''}`}
            className="w-full bg-[#F17B37] text-white py-3 rounded-xl font-bold hover:bg-[#d9682b] transition"
          >
            Voltar para a Trilha
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1722] text-white font-sans pb-20 overflow-x-hidden relative flex flex-col items-center">
      {/* Background Decorativo */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#F17B37] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#25D366] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <header className="w-full max-w-2xl px-6 pt-12 pb-8 relative z-10 text-center">
        <ShieldCheck className="h-12 w-12 text-[#F17B37] mx-auto mb-4" />
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Ficha de Aventura</h1>
        <p className="text-gray-400 text-sm md:text-base">
          {agenda ? `Garantindo vaga para: ${agenda.title}` : 'Preencha seus dados para ativarmos o seu Seguro de Trilha.'}
        </p>
      </header>

      <div className="w-full max-w-2xl px-6 relative z-10">
        <form onSubmit={onSubmit} className="bg-[#1a2332] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
          
          <div className="flex mb-8">
            {Array.from({ length: totalSteps }).map((_, idx) => idx + 1).map((i) => (
              <div key={i} className="flex-1 h-2 bg-gray-800 first:rounded-l-full last:rounded-r-full overflow-hidden">
                <motion.div 
                  className="h-full bg-[#F17B37]"
                  initial={{ width: "0%" }}
                  animate={{ width: step >= i ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold flex items-center justify-center gap-2"><User className="text-[#F17B37]" /> Quem é você?</h2>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer">
                    <div className={`w-32 h-32 rounded-full border-2 overflow-hidden flex flex-col items-center justify-center transition-all ${photoPreview ? 'border-[#F17B37]' : 'border-dashed border-gray-600 bg-white/5 hover:border-[#F17B37] hover:bg-white/10'}`}>
                      {photoPreview ? (
                        <img src={photoPreview} alt="Sua foto" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="h-8 w-8 text-gray-500 mb-2 group-hover:text-[#F17B37]" />
                          <span className="text-xs text-gray-400 font-bold">Foto de Rosto</span>
                        </>
                      )}
                    </div>
                    <input type="file" accept="image/*" required onChange={handlePhotoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                    placeholder="João da Silva Pereira"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">E-mail</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                    placeholder="seuemail@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-4 h-5 w-5 text-gray-500" />
                    <input 
                      type="text" 
                      required
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})}
                      className="w-full pl-12 p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={handleNext}
                  disabled={!formData.full_name || !formData.phone || !formData.photo}
                  className="w-full mt-6 bg-white/10 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition disabled:opacity-50"
                >
                  Continuar <ChevronRight className="h-5 w-5" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold flex items-center justify-center gap-2"><FileText className="text-[#F17B37]" /> Documentos</h2>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">CPF</label>
                  <input 
                    type="text" 
                    required
                    disabled={!!initialCpf}
                    value={formData.cpf}
                    onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">RG</label>
                  <input 
                    type="text" 
                    required
                    value={formData.rg}
                    onChange={e => setFormData({...formData, rg: formatRG(e.target.value)})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                    placeholder="MG-00.000.000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Data de Nascimento</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-4 h-5 w-5 text-gray-500" />
                    <input 
                      type="date" 
                      required
                      value={formData.birth_date}
                      onChange={e => setFormData({...formData, birth_date: e.target.value})}
                      className="w-full pl-12 p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all text-white [&::-webkit-calendar-picker-indicator]:invert" 
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={handlePrev} className="flex-none px-6 bg-white/5 text-gray-300 rounded-2xl font-bold hover:bg-white/10 transition">
                    Voltar
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNext}
                    disabled={!formData.cpf || !formData.rg || !formData.birth_date || isLoading}
                    className="flex-1 bg-white/10 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continuar <ChevronRight className="h-5 w-5" /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold flex items-center justify-center gap-2"><HeartPulse className="text-[#F17B37]" /> Saúde e Segurança</h2>
                </div>

                <div className="bg-[#F17B37]/10 border border-[#F17B37]/30 p-4 rounded-2xl">
                  <p className="text-sm text-gray-300 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-[#F17B37] shrink-0" />
                    <span>Em caso de emergência na trilha, com quem devemos entrar em contato urgentemente?</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome do Contato de Emergência</label>
                  <input 
                    type="text" 
                    required
                    value={formData.emergency_contact_name}
                    onChange={e => setFormData({...formData, emergency_contact_name: e.target.value})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                    placeholder="Nome da pessoa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Telefone do Contato</label>
                  <input 
                    type="text" 
                    required
                    value={formData.emergency_contact_phone}
                    onChange={e => setFormData({...formData, emergency_contact_phone: formatPhone(e.target.value)})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Você possui alguma alergia a medicamentos?</label>
                  <input 
                    type="text" 
                    value={formData.allergies}
                    onChange={e => setFormData({...formData, allergies: e.target.value})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                    placeholder="Ex: Alergia a Dipirona, Penicilina, etc. (Opcional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Possui alguma condição médica/doença?</label>
                  <input 
                    type="text" 
                    value={formData.medical_conditions}
                    onChange={e => setFormData({...formData, medical_conditions: e.target.value})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600" 
                    placeholder="Ex: Pressão alta, asma, diabetes, etc. (Opcional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Outras Observações (Opcional)</label>
                  <textarea 
                    value={formData.health_notes}
                    onChange={e => setFormData({...formData, health_notes: e.target.value})}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#F17B37] outline-none transition-all placeholder-gray-600 resize-none h-24" 
                    placeholder="Tipagem sanguínea, cirurgias recentes ou outra nota."
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={handlePrev} className="flex-none px-6 bg-white/5 text-gray-300 rounded-2xl font-bold hover:bg-white/10 transition">
                    Voltar
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNext}
                    disabled={!formData.emergency_contact_name || !formData.emergency_contact_phone}
                    className="flex-1 bg-white/10 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition disabled:opacity-50"
                  >
                    Continuar <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            )}

            
            {step === (hasExtraPassengers ? 5 : 4) && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold flex items-center justify-center gap-2"><FileText className="text-[#F17B37]" /> Termos e Assinatura</h2>
                  <p className="text-gray-400 text-sm mt-2">Seguro Atleta e Reconhecimento de Riscos</p>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl max-h-64 overflow-y-auto text-xs text-gray-300 custom-scrollbar space-y-4">
                  <h3 className="font-bold text-white text-sm">Resumo da Cobertura de Seguro:</h3>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Morte Acidental (MA):</strong> Indenização integral em caso de morte acidental (R$ 30.000,00)</li>
                    <li><strong>Invalidez Permanente (IPA):</strong> Invalidez decorrente de acidente (R$ 30.000,00)</li>
                    <li><strong>DMHO:</strong> Despesas Médico Hospitalares e Odontológicas (R$ 3.000,00)</li>
                    <li><strong>Cobertura de deslocamento:</strong> Garante a cobertura no trajeto até o local da atividade</li>
                  </ul>
                  <hr className="border-white/10" />
                  <h3 className="font-bold text-white text-sm">TERMO DE RECONHECIMENTO DE RISCO E ISENÇÃO DE RESPONSABILIDADE</h3>
                  <p>Declaro estar ciente de que a expedição é uma atividade de turismo de aventura e montanhismo, realizada em ambiente natural, estando sujeita a riscos inerentes que não podem ser totalmente eliminados.</p>
                  <p>Declaro voluntariamente que gozo de boa saúde física e mental e que não possuo nenhuma contraindicação médica que me impeça de realizar esforços físicos de intensidade severa.</p>
                  <p>Estou ciente de que é minha estrita obrigação portar e utilizar os equipamentos e vestuários recomendados.</p>
                  <p>Ao assinar este termo de livre e espontânea vontade, assumo integralmente todos os riscos associados à expedição. Isento expressamente a organização Mais Trilha Menos Estresse de qualquer responsabilidade civil ou criminal.</p>
                  <p>Autorizo a equipe a tomar todas as medidas cabíveis de primeiros socorros e, se necessário, acionar serviços oficiais de resgate.</p>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <p className="block text-sm font-bold text-gray-300 mb-3">Autorização de Uso de Imagem</p>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="image_auth" 
                        value="sim" 
                        checked={formData.image_authorization === "sim"}
                        onChange={() => setFormData({...formData, image_authorization: "sim"})}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-300">
                        <strong className="text-white">AUTORIZO</strong> o uso de minha imagem e voz para fins de divulgação e marketing em redes sociais de forma gratuita e por prazo indeterminado.
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="image_auth" 
                        value="nao" 
                        checked={formData.image_authorization === "nao"}
                        onChange={() => setFormData({...formData, image_authorization: "nao"})}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-300">
                        <strong className="text-white">NÃO AUTORIZO</strong> o uso de minha imagem para fins promocionais.
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer p-2">
                    <input 
                      type="checkbox" 
                      required
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="w-5 h-5 accent-[#F17B37] shrink-0"
                    />
                    <span className="text-sm font-bold text-gray-300">Eu autorizo usar os dados para o seguro, entendo que é pela minha segurança e confirmo que todos os dados que foram preenchidos são verdadeiros.</span>
                  </label>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-300 mb-2">Assinatura igual o documento</label>
                  {!signatureData ? (
                    <button 
                      type="button" 
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="w-full bg-white/10 text-[#F17B37] border-2 border-dashed border-[#F17B37]/50 p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 hover:bg-[#F17B37]/10 transition"
                    >
                      <PenTool className="w-6 h-6" /> 
                      <span>Clique aqui para assinar</span>
                    </button>
                  ) : (
                    <div className="bg-white/10 border border-green-500/50 p-4 rounded-2xl text-center">
                      <div className="flex justify-center mb-2 bg-white rounded-xl p-2 w-full max-w-[200px] mx-auto">
                        <img src={signatureData} alt="Sua Assinatura" className="h-16 object-contain" />
                      </div>
                      <p className="text-green-400 font-bold flex items-center justify-center gap-1 mb-2">
                        <CheckCircle2 className="w-4 h-4" /> Assinatura Registrada
                      </p>
                      <button 
                        type="button" 
                        onClick={() => setIsSignatureModalOpen(true)}
                        className="text-xs text-gray-400 hover:text-white transition underline"
                      >
                        Refazer assinatura
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={handlePrev} className="flex-none px-6 bg-white/5 text-gray-300 rounded-2xl font-bold hover:bg-white/10 transition">
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading || !acceptedTerms || !signatureData}
                    className="flex-1 bg-gradient-to-r from-[#F17B37] to-[#f9a03f] text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-[#F17B37]/20 transition disabled:opacity-50 disabled:scale-100"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> Confirmar</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </form>
      </div>

      {/* MODAL DE ASSINATURA FULL SCREEN (Refatorado e Modernizado) */}
      <AnimatePresence>
        {isSignatureModalOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex flex-col bg-[#0F1722]/95 backdrop-blur-md h-[100dvh] w-screen overflow-hidden touch-none"
          >
            {/* Header Tecnológico */}
            <div className="p-5 bg-[#1a2332]/80 border-b border-white/10 shrink-0 shadow-lg z-10 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-[#F17B37]" /> Assinatura Digital
                </h3>
                <p className="text-gray-400 text-xs mt-1">Desenhe sua assinatura no centro do quadro.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsSignatureModalOpen(false)}
                className="bg-white/5 hover:bg-red-500/10 text-gray-300 hover:text-red-400 p-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 border border-transparent hover:border-red-500/20"
              >
                Cancelar
              </button>
            </div>
            
            {/* Área de Desenho (Quadro Branco) */}
            <div className="flex-1 relative w-full p-4 md:p-8 flex flex-col touch-none">
              <div className="flex-1 w-full bg-white rounded-[2rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden relative border-4 border-[#1a2332]">
                
                {/* Dica visual suave no fundo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 select-none">
                  <span className="text-4xl md:text-6xl font-black text-gray-300 transform -rotate-12">Assine Aqui</span>
                </div>

                <SignatureCanvas 
                  ref={sigCanvas}
                  canvasProps={{
                    // As classes absolutas garantem que o canvas ocupe 100% sem recalcular errado no mobile
                    className: 'w-full h-full absolute inset-0 cursor-crosshair touch-none z-10' 
                  }}
                  backgroundColor="transparent" // Fundo transparente para ver a marca d'água
                  penColor="#0F1722" // Cor da caneta combinando com o tema escuro
                />

                {/* Botão Flutuante de Limpar */}
                <div className="absolute top-4 right-4 z-20">
                  <button 
                    type="button" 
                    onClick={() => sigCanvas.current?.clear()}
                    className="bg-gray-100/80 backdrop-blur text-gray-700 border border-gray-200 px-4 py-2.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 hover:bg-red-50 hover:text-red-600 transition-all active:scale-95"
                  >
                    <Eraser className="w-4 h-4" /> Limpar Tudo
                  </button>
                </div>
              </div>
            </div>

            {/* Footer com Botão de Confirmação */}
            <div className="p-5 pb-8 md:pb-5 bg-[#1a2332]/80 border-t border-white/10 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-10">
              <button 
                type="button" 
                onClick={() => {
                  if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                    // Pega a assinatura sem os espaços em branco extras
                    setSignatureData(sigCanvas.current.getTrimmedCanvas().toDataURL("image/png"));
                    setIsSignatureModalOpen(false);
                  } else {
                    alert("Por favor, faça a sua assinatura na área em branco antes de confirmar.");
                  }
                }}
                className="w-full max-w-md mx-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#F17B37] to-[#f9a03f] text-white py-4 rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(241,123,55,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-6 h-6" /> Confirmar Assinatura
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F1722] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#F17B37]" /></div>}>
      <CadastroContent />
    </Suspense>
  );
}
