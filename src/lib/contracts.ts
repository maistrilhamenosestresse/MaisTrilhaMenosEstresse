export const RESPONSIBILITY_CONTRACT_VERSION = "2026.07.29";
export const INSURANCE_CONTRACT_VERSION = "2026.07.29";

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
  title: "Termo de ciência de riscos, responsabilidade e condições de participação",
  intro:
    "Este instrumento integra a contratação das trilhas, viagens e experiências de turismo de aventura promovidas pela Mais Trilha Menos Estresse. Ele registra as informações essenciais de segurança, os deveres de cooperação do participante e as condições aplicáveis à participação, sem afastar direitos assegurados pela legislação brasileira.",
  sections: [
    {
      title: "1. Objeto, documentos integrantes e prevalência legal",
      paragraphs: [
        "Este termo aplica-se às atividades contratadas pelo participante e deve ser lido em conjunto com a oferta específica, o comprovante de compra, as orientações da trilha, a política de cancelamento, o termo de seguro e a política de privacidade vigentes na data da contratação.",
        "Informações específicas apresentadas antes da compra, como percurso, data, preço, serviços incluídos, dificuldade, requisitos e fornecedores terceiros, integram a contratação. Em caso de conflito, prevalecerá a condição mais favorável ao consumidor e a legislação obrigatória aplicável.",
      ],
    },
    {
      title: "2. Natureza da atividade e riscos inerentes",
      paragraphs: [
        "Declaro estar ciente de que atividades em ambientes naturais envolvem riscos inerentes que não podem ser totalmente eliminados, mesmo com planejamento, equipamentos e condução responsável. Entre eles estão quedas, escorregões, torções, fraturas, fadiga, desidratação, insolação, hipotermia, mudanças climáticas, raios, baixa visibilidade, terreno irregular, travessias de água, animais, insetos, comunicação limitada e demora no atendimento ou resgate.",
        "Confirmo que recebi ou terei acesso, em prazo razoável antes da atividade, às informações sobre dificuldade, duração estimada, percurso, distância, desnível quando disponível, equipamentos obrigatórios, alimentação, hidratação, ponto de encontro, transporte e condições específicas da experiência.",
      ],
    },
    {
      title: "3. Saúde, aptidão e informações verdadeiras",
      paragraphs: [
        "Declaro que forneci informações verdadeiras, completas e atualizadas sobre saúde, alergias, limitações físicas, condições preexistentes, medicamentos de uso contínuo e contato de emergência. Comprometo-me a informar alteração relevante antes do início da atividade.",
        "Se houver dúvida sobre minha aptidão, buscarei avaliação de profissional de saúde. Compreendo que a omissão deliberada de informação relevante pode aumentar riscos para mim, para os demais participantes e para a equipe.",
        "A organização poderá recomendar que o participante não inicie ou interrompa a atividade quando houver indício concreto de risco incompatível com o percurso, sempre com tratamento respeitoso e registro da justificativa de segurança.",
      ],
    },
    {
      title: "4. Conduta, equipamentos e decisões de segurança",
      paragraphs: [
        "Comprometo-me a seguir as orientações dos guias, manter-me junto ao grupo, respeitar limites ambientais e comunitários, utilizar corretamente os equipamentos indicados, não abandonar o percurso sem comunicar a equipe e não participar sob efeito de álcool ou substâncias que reduzam minha capacidade de decisão.",
        "Devo levar os itens informados como obrigatórios e comunicar imediatamente sintomas, acidente, perda de equipamento, afastamento do grupo ou situação de risco. Atos deliberadamente contrários às orientações de segurança poderão justificar a interrupção da participação.",
        "A equipe poderá adaptar percurso, horário, ritmo ou pontos de parada diante de clima, segurança, condição do terreno, orientação de autoridades, restrição ambiental ou necessidade do grupo.",
      ],
    },
    {
      title: "5. Atendimento de emergência e resgate",
      paragraphs: [
        "Autorizo a prestação de primeiros socorros, o contato com a pessoa indicada para emergência e o acionamento de serviços públicos ou privados de atendimento e resgate quando houver necessidade razoável.",
        "Informações de saúde estritamente necessárias poderão ser compartilhadas com profissionais envolvidos no atendimento. Despesas não cobertas por seguro ou serviço público serão tratadas conforme a apólice, a legislação aplicável e a responsabilidade efetivamente apurada, sem transferência automática de obrigação ao participante.",
      ],
    },
    {
      title: "6. Responsabilidade das partes",
      paragraphs: [
        "Assumo responsabilidade por atos próprios praticados deliberadamente contra orientações claras de segurança, incluindo afastamento não autorizado, imprudência consciente e uso inadequado de equipamentos.",
        "A organização permanece responsável pelos deveres que a legislação lhe atribui, inclusive informação, segurança, qualidade, boa-fé e adequada prestação do serviço. Este termo não constitui renúncia a direitos, não exclui responsabilidade por falha do serviço e não limita indenização devida nos casos previstos em lei.",
      ],
    },
    {
      title: "7. Direito de arrependimento nas contratações eletrônicas",
      paragraphs: [
        "Quando aplicável o artigo 49 do Código de Defesa do Consumidor, a desistência comunicada em até sete dias corridos da contratação eletrônica será processada sem multa e com restituição integral dos valores pagos, inclusive contratos acessórios, ressalvadas as hipóteses em que o serviço já tenha sido integralmente prestado antes do pedido, na medida permitida pela legislação.",
        "O pedido deverá ser feito por canal oficial informado no site, aplicativo ou comprovante. A organização confirmará o recebimento e adotará as providências de estorno junto ao meio de pagamento.",
      ],
    },
    {
      title: "8. Desistência do participante após o prazo legal",
      paragraphs: [
        "Após o prazo de arrependimento, a desistência deve ser comunicada assim que conhecida. Quando houver aviso com pelo menos sete dias corridos de antecedência do início da atividade, o participante poderá escolher, conforme disponibilidade, remarcação ou restituição do valor pago, descontadas somente despesas diretas, individualizáveis, já assumidas e não recuperáveis perante terceiros.",
        "Quando a desistência for comunicada com menos de sete dias de antecedência, no dia da atividade ou não houver comparecimento sem aviso, poderão ser descontados do valor pago os custos efetivamente incorridos e não recuperáveis relacionados à vaga: hospedagem, transporte e logística, ingressos ou entradas em parques, autorizações, reservas, seguro, alimentação encomendada e serviços de terceiros especificamente contratados.",
        "Os descontos não são automáticos nem punitivos: deverão ser proporcionais, limitados ao valor pago, sem cobrança em duplicidade e demonstráveis por registros, contratos ou comprovantes quando solicitados. Valores posteriormente recuperados junto a fornecedores serão repassados ao participante.",
        "Se restar saldo após os descontos legítimos, ele será devolvido pelo meio disponível ou por transferência acordada, observados os prazos operacionais do processador de pagamento. Crédito ou remarcação dependerão da concordância do participante e não substituirão reembolso legalmente devido.",
        "Quando operacionalmente possível, poderá ser autorizada a substituição do participante ou transferência da vaga, desde que solicitada antes do prazo informado, com atualização cadastral, aceite dos contratos, elegibilidade para seguro e concordância dos fornecedores envolvidos.",
      ],
    },
    {
      title: "9. Cancelamento ou alteração pela organização",
      paragraphs: [
        "Se a organização cancelar a atividade ou realizar alteração essencial que impeça a participação, o consumidor poderá escolher entre remarcação, crédito expressamente aceito ou restituição dos serviços não prestados, sem imposição de crédito obrigatório.",
        "Em condições meteorológicas severas, interdições, risco ambiental, determinação de autoridade ou outro evento alheio ao controle razoável, a prioridade será a segurança. A solução comercial será apresentada com transparência e observará os direitos do consumidor e a recuperação possível de valores junto a fornecedores.",
      ],
    },
    {
      title: "10. Imagem, privacidade e proteção de dados",
      paragraphs: [
        "Minha escolha sobre uso de imagem será respeitada conforme registrada no cadastro e poderá ser alterada para usos futuros pelos canais oficiais. A recusa de uso promocional de imagem não impedirá a participação.",
        "Dados pessoais serão tratados para cadastro, execução do serviço, pagamento, segurança, seguro, comunicação, cumprimento de obrigações e exercício regular de direitos. Dados de saúde terão acesso restrito e serão utilizados apenas quando necessários às finalidades legítimas informadas.",
        "O tratamento observará a Política de Privacidade e a legislação aplicável, incluindo direitos de confirmação, acesso, correção, informação, oposição, revogação de consentimento e eliminação quando cabível.",
      ],
    },
    {
      title: "11. Assinatura eletrônica e integridade do documento",
      paragraphs: [
        "A assinatura eletrônica será vinculada à versão do documento, ao cadastro do participante, à data e aos registros técnicos de integridade disponíveis. Uma cópia poderá ser baixada ou solicitada pelos canais oficiais.",
        "A publicação de nova versão materialmente relevante poderá exigir novo aceite. A assinatura não substitui as informações específicas que devem ser fornecidas antes de cada atividade.",
      ],
    },
  ],
  acceptance:
    "Declaro que li integralmente este documento, compreendi seus efeitos, tive oportunidade de esclarecer dúvidas e recebi informação clara sobre riscos, cancelamento e tratamento de dados. Assino eletronicamente por livre manifestação de vontade, sem renunciar a direitos assegurados por lei.",
};

const insuranceContract: ContractDefinition = {
  type: "insurance",
  version: INSURANCE_CONTRACT_VERSION,
  title: "Declaração de dados e autorização para seguro de acidentes pessoais",
  intro:
    "Este documento disciplina o uso dos dados necessários à cotação, contratação, inclusão e atendimento do participante em seguro relacionado à atividade, sem substituir a proposta, o certificado individual ou as condições da apólice emitida pela seguradora.",
  sections: [
    {
      title: "1. Finalidade e agentes envolvidos",
      paragraphs: [
        "Autorizo a Mais Trilha Menos Estresse a utilizar e, quando necessário, compartilhar com seguradora, corretora, assistência e prestadores envolvidos os dados estritamente necessários à cotação, contratação, emissão, vigência, atendimento e eventual regulação de sinistro.",
        "Cada destinatário tratará os dados conforme suas responsabilidades legais e contratuais. Informações sobre a seguradora, coberturas e canais de atendimento deverão constar da apólice, certificado ou comunicação da atividade.",
      ],
    },
    {
      title: "2. Dados pessoais e dados sensíveis",
      paragraphs: [
        "Poderão ser tratados dados de identificação, contato, nascimento, documentos, atividade contratada e informações necessárias à avaliação ou atendimento. Dados de saúde são sensíveis e terão acesso restrito, sendo utilizados apenas quando necessários ao seguro, à segurança ou à proteção da vida e integridade física.",
        "O tratamento observará bases legais aplicáveis, medidas de segurança e prazos compatíveis com obrigações legais, contratuais e exercício regular de direitos.",
      ],
    },
    {
      title: "3. Veracidade e atualização",
      paragraphs: [
        "Confirmo que nome, documentos, nascimento, contatos e informações de saúde fornecidos são verdadeiros, completos e atuais. Comprometo-me a corrigir dado incorreto antes da atividade.",
        "Estou ciente de que informação materialmente incorreta ou omitida poderá afetar a emissão ou análise do seguro conforme a legislação e as condições da seguradora, sem autorizar negativa automática fora das hipóteses legalmente admitidas.",
      ],
    },
    {
      title: "4. Cobertura, vigência e exclusões",
      paragraphs: [
        "Coberturas, capitais segurados, beneficiários, vigência, territorialidade, riscos excluídos, franquias, carências e procedimentos de sinistro são definidos exclusivamente na apólice ou certificado emitido pela seguradora. Este termo não amplia, reduz nem substitui essas condições.",
        "A inclusão depende da aceitação e emissão pela seguradora. A organização não atua como seguradora e não garante pagamento de indenização, mas deverá cooperar com o fornecimento dos registros que estiverem sob sua guarda.",
      ],
    },
    {
      title: "5. Emergência, sinistro e documentação",
      paragraphs: [
        "Autorizo o contato com a pessoa indicada para emergência e o fornecimento, aos profissionais responsáveis, das informações estritamente necessárias à proteção da vida e integridade física.",
        "Em caso de evento potencialmente coberto, o participante ou responsável deverá comunicar a ocorrência assim que possível e preservar documentos exigidos pela seguradora. A relação de documentos e o canal de aviso deverão ser informados de forma acessível.",
      ],
    },
    {
      title: "6. Privacidade, conservação e direitos do titular",
      paragraphs: [
        "Poderei solicitar confirmação, acesso, correção e informações sobre compartilhamento pelos canais da organização, além dos demais direitos previstos na legislação. Pedidos também poderão ser direcionados à seguradora quanto aos tratamentos sob sua responsabilidade.",
        "Os dados serão conservados pelo período necessário à execução do seguro, atendimento de sinistro, cumprimento de obrigações e exercício regular de direitos, com eliminação ou anonimização quando cabível.",
      ],
    },
    {
      title: "7. Assinatura eletrônica e cópia",
      paragraphs: [
        "A assinatura eletrônica ficará vinculada a esta versão, ao cadastro e aos registros técnicos disponíveis. Uma cópia assinada poderá ser baixada ou solicitada pelos canais oficiais.",
      ],
    },
  ],
  acceptance:
    "Declaro que li e compreendi esta declaração, confirmo a veracidade dos dados, estou ciente de que a cobertura depende da apólice emitida e autorizo o tratamento necessário nos limites informados.",
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
