import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import {
  CreateEventSourceMappingCommand,
  CreateFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
  ListEventSourceMappingsCommand,
  UpdateEventSourceMappingCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

await loadEnv(path.join(process.cwd(), ".env.local"));
const region = process.env.AWS_REGION || "us-east-1";
const credentials = {
  accessKeyId: required("AWS_ACCESS_KEY_ID"),
  secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
};
const bucket = required("AWS_S3_BUCKET_NAME");
const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const supabaseServiceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const googleClientId = required("GOOGLE_PHOTOS_CLIENT_ID");
const googleClientSecret = required("GOOGLE_PHOTOS_CLIENT_SECRET");
const encryptionKey = tokenEncryptionKey();
const functionName = process.env.GOOGLE_PHOTOS_IMPORT_FUNCTION_NAME || "maistrilha-google-photos-import";
const queueName = process.env.GOOGLE_PHOTOS_IMPORT_QUEUE_NAME || "maistrilha-google-photos-import";
const deadLetterQueueName = `${queueName}-dlq`;
const roleName = `${functionName}-role`;
const sqs = new SQSClient({ region, credentials });
const iam = new IAMClient({ region, credentials });
const lambda = new LambdaClient({ region, credentials });

const deadLetterQueueUrl = await createQueue(deadLetterQueueName, {
  VisibilityTimeout: "900",
  MessageRetentionPeriod: "1209600",
  SqsManagedSseEnabled: "true",
});
const deadLetterQueueArn = await queueArn(deadLetterQueueUrl);
const queueUrl = await createQueue(queueName, {
  VisibilityTimeout: "5400",
  MessageRetentionPeriod: "345600",
  SqsManagedSseEnabled: "true",
});
await sqs.send(new SetQueueAttributesCommand({
  QueueUrl: queueUrl,
  Attributes: {
    RedrivePolicy: JSON.stringify({ deadLetterTargetArn: deadLetterQueueArn, maxReceiveCount: "3" }),
  },
}));
const mainQueueArn = await queueArn(queueUrl);

const roleArn = await ensureRole(roleName);
await iam.send(new PutRolePolicyCommand({
  RoleName: roleName,
  PolicyName: `${functionName}-policy`,
  PolicyDocument: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Resource: "arn:aws:logs:*:*:*",
      },
      {
        Effect: "Allow",
        Action: ["s3:PutObject", "s3:AbortMultipartUpload"],
        Resource: `arn:aws:s3:::${bucket}/trilhas/*`,
      },
      {
        Effect: "Allow",
        Action: ["rekognition:CreateCollection", "rekognition:IndexFaces"],
        Resource: "*",
      },
      {
        Effect: "Allow",
        Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
        Resource: mainQueueArn,
      },
    ],
  }),
}));

const source = await readFile(path.join(process.cwd(), "infra", "google-photos-import-worker", "index.mjs"), "utf8");
const zip = new JSZip();
zip.file("index.mjs", source);
const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const environment = {
  Variables: {
    AWS_BUCKET_NAME: bucket,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
    GOOGLE_PHOTOS_CLIENT_ID: googleClientId,
    GOOGLE_PHOTOS_CLIENT_SECRET: googleClientSecret,
    GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY: encryptionKey,
  },
};

let functionExists = true;
try {
  await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
} catch (error) {
  if (error?.name !== "ResourceNotFoundException") throw error;
  functionExists = false;
}

if (functionExists) {
  await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: functionName, ZipFile: zipBuffer }));
  await wait(2500);
  await lambda.send(new UpdateFunctionConfigurationCommand({
    FunctionName: functionName,
    Runtime: "nodejs20.x",
    Handler: "index.handler",
    Role: roleArn,
    Timeout: 900,
    MemorySize: 512,
    EphemeralStorage: { Size: 2048 },
    Environment: environment,
  }));
} else {
  await retry(async () => lambda.send(new CreateFunctionCommand({
    FunctionName: functionName,
    Runtime: "nodejs20.x",
    Handler: "index.handler",
    Role: roleArn,
    Timeout: 900,
    MemorySize: 512,
    EphemeralStorage: { Size: 2048 },
    Code: { ZipFile: zipBuffer },
    Environment: environment,
    Description: "Importa originais selecionados no Google Fotos para o álbum Mais Trilha no S3.",
  })), 6, 5000);
}

const mappings = await lambda.send(new ListEventSourceMappingsCommand({
  FunctionName: functionName,
  EventSourceArn: mainQueueArn,
}));
const mapping = mappings.EventSourceMappings?.[0];
if (mapping?.UUID) {
  await lambda.send(new UpdateEventSourceMappingCommand({
    UUID: mapping.UUID,
    Enabled: true,
    BatchSize: 1,
    FunctionResponseTypes: ["ReportBatchItemFailures"],
    ScalingConfig: { MaximumConcurrency: 10 },
  }));
} else {
  await lambda.send(new CreateEventSourceMappingCommand({
    FunctionName: functionName,
    EventSourceArn: mainQueueArn,
    Enabled: true,
    BatchSize: 1,
    FunctionResponseTypes: ["ReportBatchItemFailures"],
    ScalingConfig: { MaximumConcurrency: 10 },
  }));
}

process.stdout.write([
  "Infraestrutura do importador Google Fotos configurada.",
  `Função: ${functionName}`,
  `Fila: ${queueUrl}`,
  "Adicione na Vercel e no .env.local:",
  `GOOGLE_PHOTOS_IMPORT_QUEUE_URL=${queueUrl}`,
].join("\n") + "\n");

async function createQueue(name, attributes) {
  const result = await sqs.send(new CreateQueueCommand({ QueueName: name, Attributes: attributes }));
  if (!result.QueueUrl) throw new Error(`AWS não retornou a URL da fila ${name}`);
  return result.QueueUrl;
}

async function queueArn(queueUrlValue) {
  const result = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: queueUrlValue, AttributeNames: ["QueueArn"] }));
  const arn = result.Attributes?.QueueArn;
  if (!arn) throw new Error("AWS não retornou o ARN da fila");
  return arn;
}

async function ensureRole(name) {
  try {
    const existing = await iam.send(new GetRoleCommand({ RoleName: name }));
    if (!existing.Role?.Arn) throw new Error("IAM não retornou o ARN da função");
    return existing.Role.Arn;
  } catch (error) {
    if (error?.name !== "NoSuchEntityException") throw error;
  }
  const created = await iam.send(new CreateRoleCommand({
    RoleName: name,
    AssumeRolePolicyDocument: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Principal: { Service: "lambda.amazonaws.com" }, Action: "sts:AssumeRole" }],
    }),
    Description: "Execução segura do importador Google Fotos Mais Trilha.",
  }));
  if (!created.Role?.Arn) throw new Error("IAM não criou a função de execução");
  return created.Role.Arn;
}

function tokenEncryptionKey() {
  const configured = required("GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY");
  const decoded = Buffer.from(configured, "base64url");
  if (decoded.length !== 32) throw new Error("GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY deve possuir 32 bytes em base64url");
  return configured;
}

async function loadEnv(file) {
  const content = await readFile(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

async function retry(operation, attempts, delay) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try { return await operation(); } catch (error) { lastError = error; await wait(delay); }
  }
  throw lastError;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}
