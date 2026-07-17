export type RegistrationValidationInput = {
  full_name?: unknown;
  email?: unknown;
  cpf?: unknown;
  rg?: unknown;
  birth_date?: unknown;
  phone?: unknown;
  emergency_contact_name?: unknown;
  emergency_contact_phone?: unknown;
  signature_url?: unknown;
  accepted_terms?: unknown;
};

export type RegistrationValidationError = {
  field: keyof RegistrationValidationInput;
  message: string;
  step: 1 | 2 | 3 | 4;
};

export function validateRegistrationInput(
  input: RegistrationValidationInput,
): RegistrationValidationError | null {
  const name = String(input.full_name || "").trim();
  const email = String(input.email || "").trim();
  const cpf = digits(input.cpf);
  const rg = String(input.rg || "").trim();
  const birthDate = String(input.birth_date || "");
  const phone = digits(input.phone);
  const emergencyName = String(input.emergency_contact_name || "").trim();
  const emergencyPhone = digits(input.emergency_contact_phone);

  if (name.length < 3 || name.length > 150) {
    return { field: "full_name", message: "Informe seu nome completo.", step: 1 };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { field: "email", message: "Informe um e-mail válido.", step: 1 };
  }
  if (phone.length < 10 || phone.length > 11) {
    return { field: "phone", message: "Informe um telefone com DDD válido.", step: 1 };
  }
  if (!isValidCpf(cpf)) {
    return { field: "cpf", message: "Informe um CPF válido.", step: 2 };
  }
  if (rg.length < 4) {
    return { field: "rg", message: "Informe seu RG.", step: 2 };
  }
  if (!isValidPastDate(birthDate)) {
    return { field: "birth_date", message: "Informe uma data de nascimento válida.", step: 2 };
  }
  if (emergencyName.length < 3) {
    return {
      field: "emergency_contact_name",
      message: "Informe o nome do contato de emergência.",
      step: 3,
    };
  }
  if (emergencyPhone.length < 10 || emergencyPhone.length > 11) {
    return {
      field: "emergency_contact_phone",
      message: "Informe um telefone de emergência com DDD válido.",
      step: 3,
    };
  }
  if (input.accepted_terms !== true) {
    return {
      field: "accepted_terms",
      message: "Marque o aceite dos dois contratos.",
      step: 4,
    };
  }
  if (!String(input.signature_url || "").trim()) {
    return {
      field: "signature_url",
      message: "Faça sua assinatura antes de confirmar.",
      step: 4,
    };
  }
  return null;
}

export function isValidCpf(value: string) {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    const sum = cpf.slice(0, length).split("").reduce(
      (total, number, index) => total + Number(number) * (length + 1 - index),
      0,
    );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidPastDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}
