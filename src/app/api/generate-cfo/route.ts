import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    // SECURITY: Verifica autenticação
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { financialData } = await request.json();

    if (!financialData) {
      return NextResponse.json({ error: 'Dados financeiros são obrigatórios' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const prompt = `
    Atue como um Diretor Financeiro (CFO) Virtual experiente de uma agência de Ecoturismo ("Mais Trilha Menos Estresse").
    Abaixo estão os resultados financeiros recentes da empresa gerados a partir do painel de controle.
    
    === DADOS FINANCEIROS ===
    ${JSON.stringify(financialData, null, 2)}
    =========================

    Sua tarefa é analisar os lucros, prejuízos, receitas e despesas informados e dar um feedback ESTRATÉGICO para a direção da empresa.
    
    DICAS PARA A RESPOSTA:
    1. Se houver prejuízo em alguma trilha, aponte isso e sugira um corte específico de despesas ou aumento do ingresso.
    2. Se a margem de lucro global estiver boa (acima de 30%), elogie e dê sugestões para reinvestir (ex: anúncios).
    3. Escreva de forma profissional, direta e em tom encorajador, afinal você trabalha para a agência.
    4. NÃO use Markdown complexo. Use apenas texto puro, dividindo em parágrafos. Você pode usar CAIXA ALTA para destacar títulos e Emojis para facilitar a leitura.
    
    Apenas retorne o conselho de forma direta.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const formattedText = response.text();

    return NextResponse.json({ result: formattedText });

  } catch (error: any) {
    console.error("Erro na API CFO Virtual:", error);
    return NextResponse.json({ error: 'Erro ao analisar finanças', details: error.message }, { status: 500 });
  }
}
