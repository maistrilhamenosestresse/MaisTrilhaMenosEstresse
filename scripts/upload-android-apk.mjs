import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = process.cwd();
await loadEnv(path.join(root, process.env.ENV_FILE || ".env.local"));

const apkPath = path.resolve(process.argv[2] || path.join(root, "dist", "android", "app-release-signed.apk"));
const apkInfo = await stat(apkPath);
const bucket = required("AWS_S3_BUCKET_NAME");
const key = "app/android/mais-trilha.apk";
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: required("AWS_ACCESS_KEY_ID"),
    secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
  },
});

await s3.send(new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: createReadStream(apkPath),
  ContentLength: apkInfo.size,
  ContentType: "application/vnd.android.package-archive",
  ContentDisposition: 'attachment; filename="Mais-Trilha.apk"',
  CacheControl: "private, no-cache, no-store, must-revalidate",
  Metadata: {
    package: "com.maistrilhasmenosestresse.app",
    certificateSha256: "1396162dd82800e61ddbcae2ecc9506df80b374415088e49b91e32b1e91caf7e",
  },
}));

const uploaded = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
if (Number(uploaded.ContentLength || 0) !== apkInfo.size) {
  throw new Error("O tamanho do APK no S3 não corresponde ao arquivo compilado.");
}

console.log(`APK Android publicado com sucesso: s3://${bucket}/${key} (${apkInfo.size} bytes)`);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

async function loadEnv(file) {
  const content = await readFile(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
