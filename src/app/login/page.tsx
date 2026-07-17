"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // E-mails autorizados para acessar o painel de administrador
    const ALLOWED_EMAILS = [
      "niveamariamagalhaes28@gmail.com",
      "wellingtonf.social@gmail.com",
      "maistrilhamenosestresse@gmail.com"
    ];

    if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
      setMessage({ type: "error", text: "Acesso Negado: Seu e-mail não tem permissão de administrador." });
      setLoading(false);
      return;
    }

    const supabase = createClient();
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {}
    });

    if (error) {
      console.error("Supabase Auth Error:", error);
      setMessage({ type: "error", text: `Erro: Ocorreu um problema ao enviar o código (${error.message}). Você já tentou recentemente? Aguarde 1 minuto.` });
    } else {
      setMessage({ type: "success", text: "Código enviado! Verifique sua caixa de entrada (e Spam)." });
      setStep(2);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    
    let { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) {
      const retry1 = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'magiclink'
      });
      data = retry1.data;
      error = retry1.error;
    }

    if (error) {
      const retry2 = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });
      data = retry2.data;
      error = retry2.error;
    }

    if (error) {
      console.error("Supabase Verify Error:", error);
      setMessage({ type: "error", text: `Código inválido ou expirado. Tente pedir um novo código.` });
      setLoading(false);
    } else if (data?.session) {
      setMessage({ type: "success", text: "Autenticado com sucesso! Redirecionando..." });
      router.push("/admin");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Mais Trilha Menos Estresse
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Acesso Restrito ao Painel Administrativo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {step === 1 ? (
            <form suppressHydrationWarning className="space-y-6" onSubmit={handleRequestOTP}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  E-mail Institucional
                </label>
                <div className="mt-1">
                  <input
                    suppressHydrationWarning
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#F17B37] focus:border-[#F17B37] sm:text-sm"
                    placeholder="admin@maistrilha.com.br"
                  />
                </div>
              </div>

              {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {message.text}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#F17B37] hover:bg-[#d96a2d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F17B37] disabled:opacity-70"
                >
                  {loading ? "Enviando..." : "Receber Chave de Acesso"}
                </button>
              </div>
            </form>
          ) : (
            <form suppressHydrationWarning className="space-y-6" onSubmit={handleVerifyOTP}>
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                  Chave de Autenticação
                </label>
                <div className="mt-1">
                  <input
                    suppressHydrationWarning
                    id="token"
                    name="token"
                    type="text"
                    required
                    maxLength={8}
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#F17B37] focus:border-[#F17B37] sm:text-sm text-center text-2xl tracking-widest"
                    placeholder="00000000"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Enviamos uma chave para <strong>{email}</strong>
                </p>
              </div>

              {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {message.text}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading || token.length < 8}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#F17B37] hover:bg-[#d96a2d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F17B37] disabled:opacity-70"
                >
                  {loading ? "Verificando..." : "Entrar no Sistema"}
                </button>
              </div>
              
              <div className="text-center">
                <button 
                  type="button" 
                  onClick={() => setStep(1)}
                  className="text-sm text-[#F17B37] hover:underline"
                >
                  Voltar e tentar outro e-mail
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-6 text-center text-xs text-gray-500">
            Acesso 100% seguro sem senhas.<br/>
            A chave de autenticação expira em alguns minutos.
          </div>
        </div>
      </div>
    </div>
  );
}
