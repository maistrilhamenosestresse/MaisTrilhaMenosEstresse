"use client";

import { User, Settings, ShieldCheck, LogOut, Heart, ChevronRight, Camera, Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { ProfilePhotoCropper } from "@/components/app/ProfilePhotoCropper";

export default function PwaPerfil() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/app/login");
        return;
      }
      
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user.email)
        .single();
        
      if (data) {
        setClient(data);
      } else {
        // Fallback for users that exist in auth but not in clients table yet
        setClient({ full_name: 'Usuário', email: user.email, pontos: 0, cashback_saldo: 0 });
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/app/login");
  };

  const handleComingSoon = () => {
    alert("Esta funcionalidade estará disponível em breve!");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    setSelectedPhoto(file);
    e.target.value = "";
  };

  const uploadCroppedPhoto = async (photo: Blob) => {
    setUploading(true);
    try {
      // 1. Pedir URL pré-assinada para a AWS
      const formData = new FormData();
      formData.append('folder', 'app-profiles');
      formData.append('file', new File([photo], 'perfil-recortado.jpg', { type: 'image/jpeg' }));

      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();
      
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "Falha ao enviar foto para AWS.");
      const uploadedPhotoUrl = uploadResult.publicUrl;

      // 3. Atualizar pela API autenticada; a RLS não permite escrita direta em clients.
      const profileResponse = await fetch('/api/clients/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: uploadedPhotoUrl }),
      });
      const profileResult = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profileResult.error || 'Falha ao atualizar o perfil.');

      setClient(profileResult.client);
      setSelectedPhoto(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao enviar foto: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  }

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}`.toUpperCase() : name.substring(0,2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Profile */}
      <div className="bg-white pt-16 pb-8 px-6 rounded-b-[2.5rem] shadow-sm relative z-10 border-b border-gray-100 flex flex-col items-center">
        
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden mb-4 relative">
            {client?.photo_url ? (
              <img 
                src={client.photo_url} 
                alt="Profile" 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const initials = e.currentTarget.parentElement?.querySelector('.initials-fallback') as HTMLElement;
                  if (initials) initials.style.display = 'flex';
                }}
              />
            ) : null}
            
            <span 
              className={`initials-fallback text-white font-black text-3xl ${client?.photo_url ? 'hidden' : 'flex'}`}
            >
              {getInitials(client?.full_name)}
            </span>
            
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          
          {!uploading && (
            <div className="absolute bottom-4 right-0 bg-purple-600 p-2 rounded-full border-2 border-white shadow-md hover:bg-purple-700 transition-colors">
              <Camera className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />

        <h1 className="text-2xl font-black text-gray-800">{client?.full_name || 'Visitante'}</h1>
        <p className="text-gray-500 text-sm font-medium">{client?.email}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-xs">
          <div className="bg-green-50 text-green-700 px-3 py-2 rounded-xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">💳 Cashback</p>
            <p className="font-black text-sm">R$ {Number(client?.cashback_saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">⭐ Pontos</p>
            <p className="font-black text-sm">{client?.pontos || 0} pts</p>
          </div>
        </div>
      </div>

      {/* Menu Settings */}
      <div className="px-6 py-8 flex-1 pb-24 overflow-y-auto space-y-6">
        <div>
          <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-3 px-2">Minha Conta</h3>
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
            <button onClick={() => router.push('/app/termos')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><User className="w-5 h-5" /></div>
                <span className="font-bold text-gray-800 text-sm">Dados Pessoais</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
            <button onClick={handleComingSoon} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left">
              <div className="flex items-center gap-4">
                <div className="bg-red-50 p-2.5 rounded-xl text-red-600"><Heart className="w-5 h-5" /></div>
                <span className="font-bold text-gray-800 text-sm">Trilhas Favoritas</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-3 px-2">Segurança e Mais</h3>
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
            <button onClick={handleComingSoon} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left">
              <div className="flex items-center gap-4">
                <div className="bg-gray-50 p-2.5 rounded-xl text-gray-600"><ShieldCheck className="w-5 h-5" /></div>
                <span className="font-bold text-gray-800 text-sm">Termos, contratos e seguro</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
            <button onClick={handleComingSoon} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left">
              <div className="flex items-center gap-4">
                <div className="bg-gray-50 p-2.5 rounded-xl text-gray-600"><Settings className="w-5 h-5" /></div>
                <span className="font-bold text-gray-800 text-sm">Configurações do App</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        <button onClick={handleSignOut} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5" /> Sair da Conta
        </button>
      </div>

      <ProfilePhotoCropper
        file={selectedPhoto}
        onCancel={() => setSelectedPhoto(null)}
        onConfirm={uploadCroppedPhoto}
      />
    </div>
  );
}
