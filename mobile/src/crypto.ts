import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytes,
} from "expo-crypto";
import * as ed25519 from "@noble/ed25519";
import {
  trailMessageSigningPayload,
  type EncryptedTrailEnvelope,
  type TrailMeshMessage,
} from "@maistrilha/trail-core";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function generateSigningIdentity() {
  const privateKey = getRandomBytes(32);
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  return {
    signingPrivateKey: bytesToBase64(privateKey),
    signingPublicKey: bytesToBase64(publicKey),
  };
}

export function generateGroupKey() {
  return bytesToBase64(getRandomBytes(32));
}

export async function signTrailMessage(message: TrailMeshMessage, privateKeyBase64: string) {
  const signature = await ed25519.signAsync(
    encoder.encode(trailMessageSigningPayload(message)),
    base64ToBytes(privateKeyBase64),
  );
  return { ...message, signature: bytesToBase64(signature) };
}

export async function verifyTrailMessage(message: TrailMeshMessage, publicKeyBase64: string) {
  if (!message.signature) return false;
  return ed25519.verifyAsync(
    base64ToBytes(message.signature),
    encoder.encode(trailMessageSigningPayload(message)),
    base64ToBytes(publicKeyBase64),
  );
}

export async function encryptMeshMessage(
  message: TrailMeshMessage,
  groupKeyBase64: string,
): Promise<EncryptedTrailEnvelope> {
  const key = await AESEncryptionKey.import(groupKeyBase64, "base64");
  const sealed = await aesEncryptAsync(encoder.encode(JSON.stringify(message)), key, {
    additionalData: encoder.encode(message.operationId),
  });
  return {
    protocolVersion: 1,
    operationId: message.operationId,
    messageId: message.messageId,
    nonce: "",
    ciphertext: String(await sealed.combined("base64")),
    senderHint: message.originDeviceId.slice(-12),
  };
}

export async function decryptMeshMessage(
  envelope: EncryptedTrailEnvelope,
  groupKeyBase64: string,
) {
  const key = await AESEncryptionKey.import(groupKeyBase64, "base64");
  const sealed = AESSealedData.fromCombined(envelope.ciphertext);
  const decrypted = await aesDecryptAsync(sealed, key, {
    additionalData: encoder.encode(envelope.operationId),
  });
  return JSON.parse(decoder.decode(decrypted as Uint8Array)) as TrailMeshMessage;
}
