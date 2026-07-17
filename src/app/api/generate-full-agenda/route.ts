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

    const parsed = await readJsonBody<{ text?: string; history?: unknown[] }>(request, 200_000);
    if (parsed.response) return parsed.response;
    const { text, history } = parsed.data;

    if (!text) {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 });
    }

    // Usando gemini-flash-lite-latest E forçando o formato JSON nativo para não quebrar a tela
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-lite-latest",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    let historyContext = "";
    if (history && history.length > 0) {
      historyContext = "\n\n=== HISTÓRICO DA CONVERSA ===\n";
      history.forEach((msg: any) => {
        historyContext += `${msg.sender === 'user' ? 'Dono' : 'Você'}: ${msg.text}\n`;
      });
      historyContext += "=============================\n\n";
    }

    const prompt = `
    Atue como um assistente executivo autônomo de uma Agência de Ecoturismo ("Mais Trilha Menos Estresse").
    Você está conversando no chat com o dono da agência.
    
    Analise a ÚLTIMA MENSAGEM DO DONO:
    1. Se for uma pergunta solta, pedido de dica, ou conversa normal (Ex: "Qual cachoeira é melhor?", "O que levar pra Ibitipoca?"), você deve RESPONDER COMO UM CHAT NORMAL.
    2. Se for uma ordem clara para CADASTRAR/CRIAR uma trilha (Ex: "Cria a trilha pra Capitólio", "Agenda uma trilha pro dia 20..."), você DEVE EXTRAIR OS DADOS para preencher o sistema.

    REGRAS DE EXTRAÇÃO DE TRILHA (Quando for cadastrar):
    1. title: O título ou local da trilha. (Ex: "Serra do Cipó")
    2. date: A data do evento no formato YYYY-MM-DD. Tente deduzir o ano (ex: 2024 ou 2025). Ex: "2024-05-20".
    3. price: O valor cobrado. Apenas números e vírgulas. Ex: "150,00".
    4. meeting_point: Locais de embarque e horários. Formate sem asteriscos, use CAIXA ALTA para destaques, coloque emojis 📍 e ⏰, e formate o horário para 24h oficial de Brasília.
    5. description: Crie um roteiro super empolgante, INJETANDO pesquisas e curiosidades reais. 
       - REGRA SUPREMA: NUNCA USE ASTERISCOS PARA NEGRITO. USE CAIXA ALTA PARA DESTAQUES!
       - REGRA DE INCLUSOS (PRIORIDADE MÁXIMA): Se o dono mencionar no áudio/texto que tem algo incluso, você DEVE OBRIGATORIAMENTE criar uma sessão "O QUE ESTÁ INCLUSO" (em caixa alta) na descrição.

    RETORNE ESTRITAMENTE NESTE FORMATO JSON (e nada mais):
    Se for conversa:
    {
      "type": "chat",
      "message": "Sua resposta amigável e profissional aqui, sem usar asteriscos de markdown."
    }

    Se for cadastrar trilha:
    {
      "type": "agenda",
      "title": "string",
      "date": "YYYY-MM-DD",
      "price": "string",
      "meeting_point": "string",
      "description": "string"
    }

    ${historyContext}
    ÚLTIMA MENSAGEM DO DONO:
    "${text}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const data = JSON.parse(responseText);

    return NextResponse.json({ result: data });

  } catch (error: any) {
    console.error("Erro na API do Agente IA:", error);
    return NextResponse.json({ error: 'Erro ao processar', details: error.message }, { status: 500 });
  }
}
