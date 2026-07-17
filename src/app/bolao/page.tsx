"use client";

import { useState, useEffect } from "react";
import { Trophy, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Head from "next/head";

export default function BolaoPage() {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [placarBrasil, setPlacarBrasil] = useState<number | "">("");
  const [placarRival, setPlacarRival] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [apostas, setApostas] = useState<any[]>([]);

  const rivalName = "Noruega"; // Hoje é Brasil x Noruega

  // Trava de Horário (16:55 do dia 05/07/2026)
  const isLocked = () => {
    const lockTime = new Date('2026-07-05T16:55:00-03:00').getTime();
    return new Date().getTime() >= lockTime;
  };
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setLocked(isLocked());
    const interval = setInterval(() => {
      setLocked(isLocked());
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadApostas = async () => {
    try {
      const res = await fetch("/api/bolao");
      const data = await res.json();
      if (data.apostas) {
        setApostas(data.apostas);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadApostas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !whatsapp || placarBrasil === "" || placarRival === "") {
      setMessage({ text: "Preencha todos os campos!", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/bolao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp,
          placar_brasil: Number(placarBrasil),
          placar_rival: Number(placarRival),
          rival_nome: rivalName
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error, type: "error" });
      } else {
        setMessage({ text: "Aposta registrada com sucesso! Boa sorte!", type: "success" });
        setNome("");
        setPlacarBrasil("");
        setPlacarRival("");
        loadApostas();
      }
    } catch (error) {
      setMessage({ text: "Erro ao conectar com o servidor.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-[#F17B37] to-yellow-500 font-sans pb-10">
      <Head>
        <title>Palpite Mais Trilha - Copa</title>
      </Head>

      {/* Header */}
      <div className="w-full pt-8 pb-6 px-4 text-center">
        <div className="inline-flex items-center justify-center bg-white/90 rounded-full mb-3 shadow-lg border border-white/50 p-2">
          <img src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/LogoDoBrasilMaisTrilhas.PNG" alt="Mais Trilha Copa" className="h-20 w-auto rounded-full object-contain" />
        </div>
        <h1 className="text-3xl font-black text-white uppercase tracking-wider drop-shadow-md">
          Bolão Mais Trilhas
        </h1>
        <p className="text-white/90 mt-2 font-medium text-lg drop-shadow-sm">Adivinhe o placar e ganhe prêmios!</p>
      </div>

      {/* Main Card */}
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 relative overflow-hidden">
          {/* Decoração sutil de fundo */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-yellow-100 rounded-full opacity-50 blur-2xl"></div>
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-green-100 rounded-full opacity-50 blur-2xl"></div>

          {locked ? (
            <div className="relative z-10 flex flex-col items-center justify-center py-8 text-center space-y-6">
              <Trophy className="w-20 h-20 text-yellow-500 mb-2 drop-shadow-md" />
              <h2 className="text-3xl font-black text-gray-800 uppercase tracking-wide">
                Bolão Encerrado!
              </h2>
              <p className="text-gray-600 font-medium text-lg">
                Os palpites foram fechados às 16:55.
              </p>
              <div className="bg-[#F17B37]/10 p-4 rounded-xl border border-[#F17B37]/20 w-full mt-4">
                <p className="text-[#F17B37] font-black text-xl">Boa Sorte! 🇧🇷🍀</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Seu Nome Completo</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F17B37] focus:border-transparent outline-none transition-all"
                  placeholder="Ex: João Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Seu WhatsApp</label>
                <input
                  type="tel"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F17B37] focus:border-transparent outline-none transition-all"
                  placeholder="(31) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>

              <div className="pt-4 pb-2 border-t border-gray-100">
                <p className="text-center text-sm font-bold text-gray-500 mb-4 uppercase tracking-widest">O Jogo de Hoje</p>

                <div className="flex items-center justify-between gap-2">
                  {/* Brasil */}
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full border-4 border-yellow-400 flex items-center justify-center shadow-md overflow-hidden">
                      <img src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/Brasil.png" alt="Brasil" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold text-gray-800">Brasil</span>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      required
                      className="w-16 text-center text-2xl font-black py-2 bg-gray-100 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                      value={placarBrasil}
                      onChange={(e) => setPlacarBrasil(e.target.value ? parseInt(e.target.value) : "")}
                    />
                  </div>

                  <div className="text-xl font-black text-gray-300 pt-8">X</div>

                  {/* Rival */}
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center shadow-md overflow-hidden">
                      <img src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/Noruega.jpg" alt="Noruega" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold text-gray-800">{rivalName}</span>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      required
                      className="w-16 text-center text-2xl font-black py-2 bg-gray-100 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none"
                      value={placarRival}
                      onChange={(e) => setPlacarRival(e.target.value ? parseInt(e.target.value) : "")}
                    />
                  </div>
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-xl flex items-start gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <p>{message.text}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-2 bg-[#F17B37] hover:bg-[#d96220] active:scale-95 transition-all text-white font-black text-lg rounded-xl shadow-[0_4px_14px_0_rgba(241,123,55,0.39)] disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "REGISTRAR PALPITE"}
              </button>
              <p className="text-xs text-center text-gray-400 mt-2">
                Regra: Não é permitido placares repetidos! Quem chutar primeiro, leva.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Lista de Apostas */}
      {apostas.length > 0 && (
        <div className="max-w-md mx-auto px-4 mt-8">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-300" /> Palpites Registrados
          </h2>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/20">
            <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {apostas.map((ap, i) => (
                <div key={i} className="flex justify-between items-center bg-white/90 p-3 rounded-xl shadow-sm">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800 truncate max-w-[120px]">{ap.nome.split(' ')[0]}</span>
                    {ap.created_at && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(ap.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {new Date(ap.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-black bg-gray-100 px-3 py-1 rounded-lg">
                    <span className="text-green-600">{ap.placar_brasil}</span>
                    <span className="text-gray-400 text-xs">x</span>
                    <span className="text-red-600">{ap.placar_rival}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
