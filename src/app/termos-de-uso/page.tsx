"use client";

import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TermosDeUso() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0F1722] text-gray-300 py-24 px-6 md:px-12 font-sans selection:bg-[#F17B37] selection:text-white">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" /> Voltar para o início
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#151D2A] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl"
        >
          <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
            <ShieldAlert className="w-10 h-10 text-[#F17B37]" />
            <h1 className="text-3xl md:text-4xl font-black text-white">Termos de Uso e Direitos Autorais</h1>
          </div>

          <div className="space-y-8 text-sm md:text-base leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Propriedade Intelectual e Direitos Autorais (Copyright)</h2>
              <p>
                Todo o conteúdo presente neste site, incluindo, mas não se limitando a, textos, gráficos, logotipos, ícones, imagens, fotografias, vídeos, clipes de áudio, downloads digitais, compilações de dados e software (código-fonte e objeto), é de propriedade exclusiva e integral da <strong>Mais Trilha Menos Estresse</strong> e/ou de seus respectivos criadores, estando protegido e amparado pelas leis brasileiras (Lei de Direitos Autorais - Lei nº 9.610/98) e pelos tratados internacionais de proteção à propriedade intelectual.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Proibições e Restrições de Uso</h2>
              <p>
                Fica estrita e expressamente proibida a reprodução, cópia, duplicação, distribuição, modificação, engenharia reversa, publicação, transmissão, exibição, venda, licenciamento ou qualquer outra forma de exploração comercial ou não comercial de qualquer parte do conteúdo, design ou layout deste site.
              </p>
              <p className="mt-3">
                A utilização não autorizada do material constitui infração direta aos direitos autorais, sujeitando o infrator às sanções civis e criminais previstas em lei, incluindo indenizações por perdas e danos materiais e morais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Uso da Marca</h2>
              <p>
                O nome "Mais Trilha Menos Estresse", seus logotipos, slogans, designs exclusivos e outras marcas comerciais e de serviço (registradas ou não) apresentadas neste site são de titularidade da marca. É vetado o uso destas marcas em conexão com qualquer produto ou serviço que não seja fornecido por nós, de maneira que possa causar confusão entre os clientes ou que desqualifique e prejudique a reputação da <strong>Mais Trilha Menos Estresse</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Exceções Mediante Autorização</h2>
              <p>
                Qualquer uso excepcional do conteúdo deste site somente será permitido caso haja uma solicitação formal e a respectiva autorização por escrito e assinada pelos representantes legais da <strong>Mais Trilha Menos Estresse</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Comprovação de Anterioridade</h2>
              <p>
                Todo o material textual, visual e de código que compõe este sistema e landing page encontra-se registrado em plataformas globais de comprovação de anterioridade e certificação de direitos autorais (com carimbo de tempo válido em mais de 170 países). Qualquer tentativa de plágio será identificada e processada com base nas provas irrevogáveis de criação originária.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 text-center text-xs text-gray-500">
            <p>© {new Date().getFullYear()} MaisTrilhaMenosEstresse. Todos os direitos reservados.</p>
            <p className="mt-2">Este documento tem validade legal sob a jurisdição do território brasileiro.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
