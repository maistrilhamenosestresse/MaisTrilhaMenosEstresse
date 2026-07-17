import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { requireServerEnv } from "@/lib/server/env";

const region = process.env.AWS_REGION || "us-east-1";
const credentials = {
  accessKeyId: requireServerEnv("AWS_ACCESS_KEY_ID"),
  secretAccessKey: requireServerEnv("AWS_SECRET_ACCESS_KEY"),
};

// S3 Client
export const s3Client = new S3Client({
  region,
  credentials,
});

// Rekognition Client
export const rekognitionClient = new RekognitionClient({
  region,
  credentials,
});

export const BUCKET_NAME = requireServerEnv("AWS_S3_BUCKET_NAME");
