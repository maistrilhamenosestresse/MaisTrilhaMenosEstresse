"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Navigation } from "@/components/Navigation";
import { Heart, Users, Map, Leaf, ChevronDown } from "lucide-react";

export default function SobrePage() {
  const [activeTab, setActiveTab] = useState<'historia' | 'equipe'>('historia');

  return (
    <div className="bg-[#0F1722] text-white min-h-screen overflow-x-hidden font-sans selection:bg-[#F17B37] selection:text-white pb-20 relative">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-40 pb-10 px-6 flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#F17B37]/10 via-[#0F1722]/80 to-[#0F1722] z-0" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          <h2 className="text-[#F17B37] font-bold tracking-[0.3em] uppercase text-sm mb-6 drop-shadow-lg">Conheça o Mais Trilha</h2>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 drop-shadow-2xl">
            Quem <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F17B37] to-amber-500">Somos</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 leading-relaxed max-w-3xl mx-auto mb-10">
            Não somos apenas uma agência de turismo, somos uma verdadeira família de trilheiros apaixonados por aventura, superação e bem-estar.
          </p>
        </motion.div>

        {/* Tab Selector - Estilo Painel/Pílula */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 flex bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-2xl max-w-md mx-auto w-full"
        >
          <button
            onClick={() => setActiveTab('historia')}
            className={`flex-1 py-3 px-6 rounded-full font-bold text-sm transition-all duration-300 ${activeTab === 'historia' ? 'bg-[#F17B37] text-white shadow-[0_0_15px_rgba(241,123,55,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            A Nossa História
          </button>
          <button
            onClick={() => setActiveTab('equipe')}
            className={`flex-1 py-3 px-6 rounded-full font-bold text-sm transition-all duration-300 ${activeTab === 'equipe' ? 'bg-[#F17B37] text-white shadow-[0_0_15px_rgba(241,123,55,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            Nossa Equipe
          </button>
        </motion.div>
      </section>

      {/* Content Section - Tabs */}
      <section className="py-10 px-6 relative z-10 min-h-[50vh]">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">

            {activeTab === 'historia' && (
              <motion.div
                key="historia"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-24">
                  <div>
                    <Image
                      src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/Nivea/IMG_0521.JPG"
                      alt="Nossa história"
                      width={800}
                      height={500}
                      className="w-full h-[500px] object-cover rounded-[2rem] shadow-2xl shadow-[#F17B37]/20 border border-white/10"
                    />
                  </div>
                  <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
                    <h2 className="text-4xl font-black text-white mb-8">Sobre Nós</h2>
                    <p>
                      O Mais Trilha Menos Estresse nasceu de um propósito maior: guiar pessoas até lugares incríveis e transformar a vida de cada uma delas pelo caminho. Nós somos muito mais do que um grupo de trilhas ou uma agência de turismo; somos uma empresa dedicada ao seu bem-estar, onde a natureza é o nosso principal refúgio.
                    </p>
                    <p>
                      Acreditamos profundamente que o mundo foi feito para ser explorado por absolutamente todos. Aqui, cada passo é uma vitória e cada caminhada é uma chance de superar os próprios limites. O Mais Trilha foi feito para quem acredita na própria força: crianças, jovens, adultos e as nossas queridas “pessoas com experiência de vida” (afinal, a alma aventureira não tem idade e nós preferimos colecionar momentos a usar rótulos!).
                    </p>
                    <p>
                      Nossa maior conquista não são apenas os quilômetros que percorremos, mas a comunidade que criamos. Construímos uma verdadeira família, um lugar seguro onde nos apoiamos mutuamente, celebramos cada conquista e vivemos experiências que ficam marcadas para sempre no coração.
                    </p>
                    <p>
                      Essa é a nossa essência. Essa é a ideologia do Mais Trilha Menos Estresse: colecionar memórias, superar desafios e viver o melhor da vida, juntos.
                    </p>
                  </div>
                </div>

                {/* Icons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-20">
                  {[
                    { icon: Heart, title: "Paixão", desc: "Amamos o que fazemos e a natureza que nos cerca." },
                    { icon: Users, title: "Comunidade", desc: "Uma família unida por aventuras e boas risadas." },
                    { icon: Map, title: "Exploração", desc: "Roteiros exclusivos e destinos surpreendentes." },
                    { icon: Leaf, title: "Ecoturismo", desc: "Respeito total ao meio ambiente em cada passo." },
                  ].map((item, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                      <div className="w-14 h-14 bg-[#F17B37]/20 rounded-2xl flex items-center justify-center text-[#F17B37] mb-6">
                        <item.icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                      <p className="text-gray-400">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'equipe' && (
              <motion.div
                key="equipe"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-32"
              >
                {/* Membro 1: Nívea */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                  <div className="order-2 md:order-1 space-y-6 text-lg text-gray-300 leading-relaxed">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-2">Nívea Maria</h2>
                    <h3 className="text-[#F17B37] font-bold tracking-[0.2em] uppercase text-sm mb-8">Guia e Fundadora</h3>

                    <p>
                      Me chamo Nívea Maria, tenho 35 anos e, há três, o ecoturismo transformou a minha vida. Minha conexão com a natureza vem de berço: sempre amei o simples, o essencial, e é nela que me sinto verdadeiramente em casa.
                    </p>
                    <p>
                      Cresci vendo meu tio desbravar trilhas e escalar montanhas. Eu ajudava a arrumar a mochila dele fascinada por aquele universo, mas, por muito tempo, sufoquei esse sonho. Acreditava que aquela vida não era para mim — que não era o lugar de uma mulher, mãe e casada, aos 32 anos.
                    </p>
                    <p>
                      Tudo mudou quando organizei uma viagem para a Cachoeira do Tabuleiro, na tentativa de animar esse meu tio que passava por um momento difícil. Ele acabou não podendo ir, e eu decidi encarar o desafio sozinha. Mas a vida tem formas lindas de nos surpreender: o que seria uma viagem solitária virou uma expedição inesquecível de cinco mulheres. Amigas e até a minha mãe embarcaram comigo de madrugada, rumo ao desconhecido.
                    </p>
                    <p>
                      Nesse dia aconteceu de tudo: enfrentamos um frio de 7 graus, o carro ferveu na estrada e até o dono de uma carteira perdida nós tivemos que procurar. Mas sabe de uma coisa? Nada disso ofuscou a magia daquele momento. Pelo contrário: foi ali, superando cada obstáculo, que eu resgatei uma força e uma coragem que nem sabia que existiam em mim.
                    </p>
                    <p>
                      Hoje, fiz dessa descoberta o meu grande propósito de vida. Guiar pessoas e levá-las a lugares que elas achavam ser impossíveis de alcançar é o que faz o meu coração bater mais forte. Ver de perto o brilho nos olhos e a emoção de cada um ao se conectar com a natureza é um privilégio indescritível. Eu não apenas amo o que eu faço: eu vivo o meu maior sonho.
                    </p>
                  </div>
                  <div className="order-1 md:order-2 relative">
                    <div className="absolute inset-0 bg-[#F17B37] blur-[100px] opacity-20 rounded-full" />
                    <Image
                      src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/equipe/Nivea.jpeg"
                      alt="Nívea Maria"
                      width={600}
                      height={600}
                      className="relative z-10 w-full h-[600px] object-cover rounded-[2rem] shadow-2xl border-4 border-white/10 hover:border-[#F17B37]/50 transition-colors duration-500"
                    />
                  </div>
                </div>

                {/* Membro 2: Palestino */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#25D366] blur-[100px] opacity-10 rounded-full" />
                    <Image
                      src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/equipe/Palestino.jpeg"
                      alt="Palestino"
                      width={600}
                      height={600}
                      className="relative z-10 w-full h-[600px] object-cover rounded-[2rem] shadow-2xl border-4 border-white/10 hover:border-[#25D366]/50 transition-colors duration-500"
                    />
                  </div>
                  <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-2">Palestino</h2>
                    <h3 className="text-[#F17B37] font-bold tracking-[0.2em] uppercase text-sm mb-8">Motorista Oficial</h3>

                    <p>
                      Conheci o Mais Trilha através do meu antigo trabalho, quando fui escalado para um frete com o grupo. Fui tão bem acolhido por todos que, nas viagens seguintes, me tornei o motorista oficial. O que começou como uma simples prestação de serviço transformou-se em amizade, parceria e família.
                    </p>
                    <p>
                      Essa jornada mudou completamente a minha vida. Eu vinha de uma rotina exaustiva nas estradas, e o ecoturismo me conectou profundamente com a natureza, onde o estresse e as preocupações ficaram para trás. O grupo se tornou minha rede de apoio, sempre me motivando a evoluir. Hoje, o Mais Trilha é parte de quem eu sou. Na trilha, ninguém solta a mão de ninguém e somos todos iguais.
                    </p>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </section>

      {/* Footer simplificado */}
      <footer className="mt-20 border-t border-white/10 pt-10 text-center text-gray-500 text-sm flex flex-col items-center gap-4">
        <Image
          src="https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/FotosEvideos/logo/rodape.JPG"
          alt="Montanhas Mais Trilha"
          width={300}
          height={48}
          className="h-12 w-auto mix-blend-screen opacity-50"
          style={{ filter: 'contrast(1.8) brightness(0.8)' }}
        />
        <p>© {new Date().getFullYear()} Todos os direitos reservados a Mais Trilha Menos Estresse.</p>
      </footer>
    </div>
  );
}
