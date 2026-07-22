"use client";

import { User, Settings, ShieldCheck, LogOut, Heart, ChevronRight, Camera, Loader2 } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { ProfilePhotoCropper } from "@/components/app/ProfilePhotoCropper";
import { clearOfflineUserData, getOfflineData, saveOfflineData } from "@/lib/app/offline-data";
import { useNetworkStatus } from "@/lib/app/use-network-status";
import { clearAllOfflineTrailData } from "@/lib/app/offline-trails";

export default function PwaPerfil() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const online = useNetworkStatus();

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        router.push("/app/login");
        return;
      }

      const cached = getOfflineData<any>(user.id, "profile");
      if (cached) setClient(cached.data);

      let data = cached?.data || null;
      if (navigator.onLine) {
        const profileResponse = await fetch("/api/clients/me", { cache: "no-store" });
        const profileResult = await profileResponse.json().catch(() => ({}));
        data = profileResponse.ok ? profileResult.client : data;
      }
        
      if (data) {
        setClient(data);
        saveOfflineData(user.id, "profile", data);
      } else {
        setClient({
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Aventureiro",
          email: user.email,
          pontos: 0,
          cashback_saldo: 0,
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, [online, router, supabase]);

  const handleSignOut = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    clearOfflineUserData(session?.user.id);
    await clearAllOfflineTrailData().catch(() => undefined);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) saveOfflineData(session.user.id, "profile", profileResult.client);
      setSelectedPhoto(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao enviar foto: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="mt-app-page flex min-h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#D96224]" /></div>;
  }

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}`.toUpperCase() : name.substring(0,2).toUpperCase();
  };

  return (
    <div className="mt-app-page flex min-h-full flex-col">
      {/* Header Profile */}
      <div className="mt-app-header relative z-10 flex flex-col items-center border-b px-5 pb-7 pt-[max(2.75rem,env(safe-area-inset-top))] sm:px-6">
        
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="relative mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[linear-gradient(145deg,#0B2540,#F17B37)] shadow-lg">
            {client?.photo_url ? (
              <img 
                src={client.photo_url} 
                alt="Foto de perfil"
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
            <div className="absolute bottom-4 right-0 rounded-full border-2 border-white bg-[#F17B37] p-2 shadow-md transition-colors hover:bg-[#D96224]">
              <Camera className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />

        <h1 className="text-2xl font-black text-gray-800">{client?.full_name || 'Visitante'}</h1>
        <p className="text-gray-500 text-sm font-medium">{client?.email}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-xs">
          <div className="bg-green-50 text-green-700 px-3 py-2 rounded-xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">💳 Saldo</p>
            <p className="font-black text-sm">R$ {Number(client?.cashback_saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">⭐ Pontos</p>
            <p className="font-black text-sm">{client?.pontos || 0} pts</p>
          </div>
        </div>
      </div>

      {/* Menu Settings */}
      <div className="flex-1 space-y-6 px-4 py-7 pb-24 sm:px-6">
        <div>
          <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-3 px-2">Minha Conta</h3>
          <div className="mt-surface rounded-3xl p-2">
            <button onClick={() => router.push('/app/perfil/dados')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left">
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
          <div className="mt-surface rounded-3xl p-2">
            <button onClick={() => router.push('/app/termos')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left">
              <div className="flex items-center gap-4">
                <div className="bg-gray-50 p-2.5 rounded-xl text-gray-600"><ShieldCheck className="w-5 h-5" /></div>
                <span className="font-bold text-gray-800 text-sm">Termos, contratos e seguro</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
            <button onClick={() => router.push('/app/configuracoes')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left">
              <div className="flex items-center gap-4">
                <div className="bg-gray-50 p-2.5 rounded-xl text-gray-600"><Settings className="w-5 h-5" /></div>
                <span className="font-bold text-gray-800 text-sm">Configurações do aplicativo</span>
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
