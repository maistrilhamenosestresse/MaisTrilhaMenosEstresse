export const RESPONSIBILITY_CONTRACT_VERSION = "2026.07.17";
export const INSURANCE_CONTRACT_VERSION = "2026.07.17";

export type ContractType = "responsibility" | "insurance";

export type ContractSection = {
  title: string;
  paragraphs: string[];
};

export type ContractDefinition = {
  type: ContractType;
  version: string;
  title: string;
  intro: string;
  sections: ContractSection[];
  acceptance: string;
};

export type ContractSnapshot = ContractDefinition & {
  participant: {
    id: string;
    fullName: string;
    cpf: string;
    rg: string;
    birthDate: string;
    phone: string;
    email: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    healthNotes: string;
    imageAuthorization: boolean;
  };
};

const responsibilityContract: ContractDefinition = {
  type: "responsibility",
  version: RESPONSIBILITY_CONTRACT_VERSION,
  title: "Termo de ciência de riscos e responsabilidade em turismo de aventura",
  intro:
    "Este termo registra as informações de segurança prestadas ao participante e seu compromisso de cooperação durante trilhas, viagens e atividades promovidas pela Mais Trilha Menos Estresse.",
  sections: [
    {
      title: "1. Natureza da atividade e riscos inerentes",
      paragraphs: [
        "Declaro estar ciente de que trilhas e atividades em ambientes naturais envolvem riscos que não podem ser totalmente eliminados, mesmo com planejamento e condução responsável. Entre eles estão quedas, torções, fraturas, fadiga, desidratação, mudanças climáticas, raios, baixa visibilidade, terreno irregular, animais, insetos, dificuldade de comunicação e demora em resgates.",
        "Confirmo que recebi ou terei acesso, antes da atividade, às informações sobre dificuldade, duração, percurso, equipamentos, alimentação, hidratação, ponto de encontro e condições específicas da experiência contratada.",
      ],
    },
    {
      title: "2. Saúde e informações verdadeiras",
      paragraphs: [
        "Declaro que forneci informações verdadeiras e atualizadas sobre minha saúde, alergias, limitações, medicamentos e contato de emergência. Comprometo-me a comunicar qualquer alteração relevante antes do início da atividade.",
        "Se houver dúvida sobre minha aptidão, procurarei avaliação profissional antes de participar. Entendo que omitir informação relevante pode aumentar riscos para mim e para o grupo.",
      ],
    },
    {
      title: "3. Conduta, equipamentos e decisões de segurança",
      paragraphs: [
        "Comprometo-me a seguir as orientações dos guias, respeitar os limites ambientais e do grupo, utilizar os equipamentos indicados, não abandonar o percurso sem comunicar a equipe e não participar sob efeito de substâncias que prejudiquem minha capacidade.",
        "Reconheço que a organização poderá alterar, interromper ou cancelar a atividade por clima, segurança, condição do percurso, orientação de autoridades ou condição física de participantes, observados os direitos aplicáveis ao consumidor.",
      ],
    },
    {
      title: "4. Atendimento de emergência",
      paragraphs: [
        "Autorizo a prestação de primeiros socorros e o acionamento de serviços públicos ou privados de emergência quando a equipe considerar necessário. Despesas não cobertas por seguro ou serviço público seguirão as regras legais e contratuais aplicáveis.",
      ],
    },
    {
      title: "5. Responsabilidade das partes",
      paragraphs: [
        "Assumo responsabilidade por atos próprios praticados contra as orientações recebidas, inclusive imprudência, desobediência deliberada e uso inadequado de equipamentos.",
        "Este termo não elimina deveres legais da organizadora, não afasta direitos do consumidor e não cobre dano causado por conduta que a lei atribua à prestadora do serviço.",
      ],
    },
    {
      title: "6. Cancelamento, alterações e reembolso",
      paragraphs: [
        "As regras comerciais apresentadas no momento da compra integram a contratação. Cancelamentos, remarcações, créditos e reembolsos serão tratados conforme a oferta, a legislação aplicável e as circunstâncias concretas da atividade.",
      ],
    },
    {
      title: "7. Imagem e privacidade",
      paragraphs: [
        "Minha escolha sobre uso de imagem será respeitada conforme registrada no cadastro. Dados pessoais serão usados para executar o serviço, promover segurança, cumprir obrigações e exercer direitos, com acesso restrito e medidas de proteção.",
      ],
    },
  ],
  acceptance:
    "Declaro que li, compreendi e tive oportunidade de esclarecer dúvidas. Assino eletronicamente por livre manifestação de vontade.",
};

const insuranceContract: ContractDefinition = {
  type: "insurance",
  version: INSURANCE_CONTRACT_VERSION,
  title: "Declaração e autorização para inclusão no seguro aventura",
  intro:
    "Este documento autoriza o tratamento dos dados necessários à contratação ou inclusão do participante em seguro relacionado à atividade de turismo de aventura.",
  sections: [
    {
      title: "1. Autorização para uso dos dados",
      paragraphs: [
        "Autorizo a Mais Trilha Menos Estresse a utilizar e, quando necessário, compartilhar com seguradora, corretora e prestadores envolvidos os dados estritamente necessários à cotação, contratação, emissão, atendimento e eventual regulação de sinistro.",
        "Dados de saúde são sensíveis e serão tratados apenas quando necessários à segurança, ao seguro ou ao atendimento de emergência, com acesso restrito.",
      ],
    },
    {
      title: "2. Veracidade e atualização",
      paragraphs: [
        "Confirmo que nome, documentos, nascimento, contatos e informações de saúde fornecidos são verdadeiros. Comprometo-me a corrigir qualquer dado incorreto antes da atividade.",
      ],
    },
    {
      title: "3. Cobertura e condições da apólice",
      paragraphs: [
        "Estou ciente de que coberturas, valores, vigência, riscos excluídos, carências e procedimentos de sinistro são definidos pela apólice ou certificado emitido pela seguradora. Este termo não amplia nem substitui essas condições.",
        "A inclusão depende da aceitação e emissão pela seguradora. Quando houver certificado ou apólice individual disponível, ele deverá ser consultado junto com este documento.",
      ],
    },
    {
      title: "4. Emergência e comunicação",
      paragraphs: [
        "Autorizo o contato com a pessoa indicada para emergência e o fornecimento, aos profissionais responsáveis pelo atendimento, das informações necessárias à proteção da minha vida e integridade física.",
      ],
    },
    {
      title: "5. Privacidade e direitos do titular",
      paragraphs: [
        "Poderei solicitar acesso e correção de meus dados pelos canais da organização. A conservação observará prazos legais, contratuais e de exercício regular de direitos.",
      ],
    },
  ],
  acceptance:
    "Declaro que li e compreendi esta autorização, confirmo a veracidade dos dados e assino eletronicamente.",
};

export function getContractDefinition(type: ContractType): ContractDefinition {
  return type === "insurance" ? insuranceContract : responsibilityContract;
}

export function getCurrentContractVersion(type: ContractType) {
  return getContractDefinition(type).version;
}

export function buildContractSnapshot(
  type: ContractType,
  client: Record<string, any>,
): ContractSnapshot {
  return {
    ...getContractDefinition(type),
    participant: {
      id: String(client.id || ""),
      fullName: String(client.full_name || ""),
      cpf: String(client.cpf || ""),
      rg: String(client.rg || ""),
      birthDate: String(client.birth_date || ""),
      phone: String(client.phone || ""),
      email: String(client.email || ""),
      emergencyContactName: String(client.emergency_contact_name || ""),
      emergencyContactPhone: String(client.emergency_contact_phone || ""),
      healthNotes: String(client.health_notes || ""),
      imageAuthorization: client.image_authorization === true,
    },
  };
}

export function isContractType(value: string): value is ContractType {
  return value === "responsibility" || value === "insurance";
}
