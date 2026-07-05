/**
 * Integração com Evolution API
 * Motor de comunicação via WhatsApp
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'maistrilhas';

export async function sendWhatsAppText(number: string, text: string) {
  if (!EVOLUTION_API_KEY) {
    console.warn("[WhatsApp] Chave da Evolution API não configurada. Mensagem ignorada.");
    return false;
  }

  // O Evolution API exige o número com o DDI (55) e geralmente a extensão @s.whatsapp.net, 
  // mas enviar apenas os números costuma ser suficiente dependendo da versão.
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const targetNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: targetNumber,
        options: {
          delay: 1200, // 1.2 segundos simulando digitação
          presence: "composing"
        },
        textMessage: {
          text: text
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[WhatsApp] Falha ao enviar mensagem:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[WhatsApp] Erro de conexão com Evolution API:", error);
    return false;
  }
}

export async function sendWhatsAppImage(number: string, imageUrl: string, caption: string = "") {
  if (!EVOLUTION_API_KEY) {
    console.warn("[WhatsApp] Chave da Evolution API não configurada. Imagem ignorada.");
    return false;
  }

  const cleanNumber = number.replace(/[^0-9]/g, '');
  const targetNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: targetNumber,
        options: {
          delay: 1500,
          presence: "composing"
        },
        mediaMessage: {
          mediatype: "image",
          caption: caption,
          media: imageUrl
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[WhatsApp] Falha ao enviar imagem:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[WhatsApp] Erro de conexão com Evolution API:", error);
    return false;
  }
}
