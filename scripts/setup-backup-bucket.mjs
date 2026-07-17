import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CreateBucketCommand,
  PutBucketEncryptionCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketVersioningCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from '@aws-sdk/client-s3';

await loadEnv(path.join(process.cwd(), '.env.local'));
const region = process.env.AWS_REGION || 'us-east-1';
const sourceBucket = required('AWS_S3_BUCKET_NAME');
const backupBucket = process.env.AWS_BACKUP_BUCKET_NAME || `${sourceBucket}-backups`;
if (backupBucket === sourceBucket) throw new Error('O bucket de backup deve ser separado do bucket de mídia.');
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
  },
});

try {
  await s3.send(new CreateBucketCommand({
    Bucket: backupBucket,
    ...(region === 'us-east-1' ? {} : { CreateBucketConfiguration: { LocationConstraint: region } }),
  }));
} catch (error) {
  if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error?.name)) throw error;
  if (error?.name === 'BucketAlreadyExists') throw new Error(`O nome global ${backupBucket} já pertence a outra conta.`);
}

await s3.send(new PutPublicAccessBlockCommand({
  Bucket: backupBucket,
  PublicAccessBlockConfiguration: {
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: true,
    RestrictPublicBuckets: true,
  },
}));
await s3.send(new PutBucketEncryptionCommand({
  Bucket: backupBucket,
  ServerSideEncryptionConfiguration: {
    Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' }, BucketKeyEnabled: true }],
  },
}));
await s3.send(new PutBucketVersioningCommand({
  Bucket: backupBucket,
  VersioningConfiguration: { Status: 'Enabled' },
}));
await s3.send(new PutBucketLifecycleConfigurationCommand({
  Bucket: backupBucket,
  LifecycleConfiguration: {
    Rules: [{
      ID: 'retain-backup-versions',
      Status: 'Enabled',
      Filter: {},
      NoncurrentVersionExpiration: { NoncurrentDays: 90 },
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
    }],
  },
}));
process.stdout.write(`Bucket de backup configurado: ${backupBucket}\nDefina AWS_BACKUP_BUCKET_NAME=${backupBucket}\n`);

async function loadEnv(file) {
  const content = await readFile(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}
