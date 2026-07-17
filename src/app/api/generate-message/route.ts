import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAdminUser } from '@/lib/server/auth';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const originError = assertSameOrigin(request);
    if (originError) return originError;
    // SECURITY: Verifica autenticação
    const auth = await requireAdminUser();
    if (auth.response) return auth.response;

    const parsed = await readJsonBody<{ text?: string; type?: string }>(request, 100_000);
    if (parsed.response) return parsed.response;
    const { text, type } = parsed.data;

    if (!text) {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    let prompt = "";
    
    if (type === 'meeting_point') {
      prompt = `
      Atue como um redator profissional de turismo e aventuras.
      Você receberá uma transcrição bruta de voz com os "Pontos de Embarque e Horários".
      Sua tarefa é extrair APENAS as informações úteis e ignorar falas aleatórias, vícios de linguagem ou interrupções.

      REGRAS DE FORMATAÇÃO (MUITO IMPORTANTE):
      1. NÃO use formatação Markdown (como **asteriscos** ou # hashtags).
      2. Para destacar palavras importantes, use CAIXA ALTA (letras maiúsculas). Exemplo: SHOPPING ESTAÇÃO.
      3. Não use código HTML. Apenas texto puro.
      4. Formate como uma lista vertical clara, usando quebras de linha reais.
      5. Coloque um emoji de pin (📍) antes do local e um emoji de relógio (⏰) antes do horário.
      6. ATENÇÃO AOS HORÁRIOS: Identifique o contexto. Se for falado "5 da manhã", escreva 05:00. Se for falado "5 da tarde", escreva 17:00. Sempre converta para o formato 24 horas oficial de Brasília.
      
      Apenas retorne o texto final formatado, sem introduções ou conclusões.
      `;
    } else {
      prompt = `
      Atue como um redator profissional de ecoturismo e trilhas.
      Você receberá uma transcrição bruta de voz com a "Descrição, Roteiro e Recomendações" de uma trilha.
      Sua tarefa é expandir o texto, tornando-o extremamente empolgante, rico e convidativo.

      REGRAS DE CONTEÚDO E FORMATAÇÃO (MUITO IMPORTANTE):
      1. IDENTIFIQUE O LOCAL DA TRILHA (Ex: Serra do Cipó, Tiradentes, etc) com base na transcrição.
      2. PESQUISE DADOS REAIS sobre esse local e INJETE curiosidades interessantes, informações sobre belezas naturais, cachoeiras ou fatos históricos marcantes do destino no texto, enriquecendo o que foi dito.
      3. Seja farto no uso de EMOJIS (🌿, 🥾, ⛰️, 💧, etc) para deixar o texto visualmente bonito e chamativo.
      4. NÃO use formatação Markdown (como **asteriscos** ou # hashtags). Para destacar palavras ou subtítulos, use CAIXA ALTA (letras maiúsculas).
      5. Separe os assuntos usando parágrafos bem espaçados.
      6. Crie listas bonitas usando emojis para o roteiro ou recomendações.
      
      Apenas retorne o texto final formatado, pronto para o site, sem introduções de conversa.
      `;
    }

    // Processar Texto
    prompt += `\n\n=== TRANSCRIÇÃO DE VOZ ===\n"${text}"\n===========================`;
    const result = await model.generateContent(prompt);

    const response = await result.response;
    const formattedText = response.text();

    return NextResponse.json({ result: formattedText });

  } catch (error: any) {
    console.error("Erro na API Gemini:", error);
    return NextResponse.json({ error: 'Erro ao gerar mensagem', details: error.message }, { status: 500 });
  }
}
