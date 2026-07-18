import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import webpush from 'web-push';

const root = process.cwd();
const targets = ['.env.local', '.env.vercel.production'];
const subject = 'mailto:maistrilhamenosestresse@gmail.com';

let keys = null;
for (const target of targets) {
  try {
    const content = await readFile(path.join(root, target), 'utf8');
    const publicKey = readEnv(content, 'WEB_PUSH_VAPID_PUBLIC_KEY');
    const privateKey = readEnv(content, 'WEB_PUSH_VAPID_PRIVATE_KEY');
    if (publicKey && privateKey) {
      keys = { publicKey, privateKey };
      break;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
keys ||= webpush.generateVAPIDKeys();

for (const target of targets) {
  const file = path.join(root, target);
  let content = '';
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  content = upsertEnv(content, 'WEB_PUSH_VAPID_SUBJECT', subject);
  content = upsertEnv(content, 'WEB_PUSH_VAPID_PUBLIC_KEY', keys.publicKey);
  content = upsertEnv(content, 'WEB_PUSH_VAPID_PRIVATE_KEY', keys.privateKey);
  await writeFile(file, content, 'utf8');
}

process.stdout.write('Web Push configurado nos arquivos locais ignorados pelo Git. A chave privada não foi exibida.\n');

function readEnv(content, name) {
  return content.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim() || '';
}

function upsertEnv(content, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  return `${content.trimEnd()}\n${line}\n`;
}
