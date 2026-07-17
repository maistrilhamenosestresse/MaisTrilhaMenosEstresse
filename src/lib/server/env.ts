import "server-only";

export function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }

  return value;
}

export function getAdminEmails(): string[] {
  const configured = process.env.ADMIN_EMAILS
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured || [];
}
