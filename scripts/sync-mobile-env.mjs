import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, ".env.local");
const destinationPath = path.join(root, "mobile", ".env.local");
const source = await readFile(sourcePath, "utf8");
const values = new Map();

for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  values.set(match[1], value);
}

const required = (name) => {
  const value = values.get(name);
  if (!value) throw new Error(`Variável ausente em .env.local: ${name}`);
  return value;
};

const output = [
  "# Gerado por npm run mobile:env. Não enviar ao Git.",
  "EXPO_PUBLIC_API_URL=https://www.maistrilhasmenosestresse.com",
  `EXPO_PUBLIC_SUPABASE_URL=${required("NEXT_PUBLIC_SUPABASE_URL")}`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${required("NEXT_PUBLIC_SUPABASE_ANON_KEY")}`,
  values.get("EXPO_PUBLIC_EAS_PROJECT_ID")
    ? `EXPO_PUBLIC_EAS_PROJECT_ID=${values.get("EXPO_PUBLIC_EAS_PROJECT_ID")}`
    : "# EXPO_PUBLIC_EAS_PROJECT_ID=",
  "",
].join("\n");

await writeFile(destinationPath, output, { encoding: "utf8", mode: 0o600 });
process.stdout.write("Ambiente público do app nativo sincronizado em mobile/.env.local\n");
