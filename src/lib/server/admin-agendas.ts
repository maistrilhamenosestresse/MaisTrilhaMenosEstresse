import "server-only";

import { NextResponse } from "next/server";
import { hasAdminSensitiveUnlock } from "@/lib/server/admin-sensitive-session";
import { requireServerEnv } from "@/lib/server/env";
import { isArchivedTrailDate } from "@/lib/trails";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_METHODS = new Set(["PIX", "CREDIT_CARD", "BOLETO"]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

export type AgendaMutationInput = {
  title?: unknown;
  date?: unknown;
  price?: unknown;
  description?: unknown;
  meeting_point?: unknown;
  requirements?: unknown;
  max_capacity?: unknown;
  duration_hours?: unknown;
  distance_km?: unknown;
  difficulty?: unknown;
  images?: unknown;
  video_url?: unknown;
  flyer_url?: unknown;
  accepted_payment_methods?: unknown;
  taxa_gratis?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finiteNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function optionalAwsMediaUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  if (normalized.length > 2_048) throw new Error("URL de mídia inválida");
  const url = new URL(normalized);
  const bucket = requireServerEnv("AWS_S3_BUCKET_NAME");
  const region = process.env.AWS_REGION || "us-east-1";
  if (url.hostname !== `${bucket}.s3.${region}.amazonaws.com`) {
    throw new Error("A mídia deve estar armazenada no AWS S3 oficial");
  }
  if (url.protocol !== "https:") throw new Error("URL de mídia inválida");
  return url.toString();
}

export function isValidAgendaId(id: string) {
  return UUID_PATTERN.test(id);
}

export function parseAgendaMutation(input: AgendaMutationInput) {
  const title = cleanText(input.title, 180);
  const date = cleanText(input.date, 10);
  const description = cleanText(input.description, 20_000);
  const meetingPoint = cleanText(input.meeting_point, 5_000);
  const requirements = cleanText(input.requirements, 10_000);
  const price = finiteNumber(input.price, 0, 1_000_000);
  const maxCapacity = finiteNumber(input.max_capacity, 1, 10_000);
  const durationHours = input.duration_hours === null || input.duration_hours === ""
    ? null
    : finiteNumber(input.duration_hours, 0, 10_000);
  const distanceKm = input.distance_km === null || input.distance_km === ""
    ? null
    : finiteNumber(input.distance_km, 0, 100_000);
  const difficulty = cleanText(input.difficulty || "easy", 20);

  if (!title || !DATE_PATTERN.test(date) || price === null ||
      maxCapacity === null || !DIFFICULTIES.has(difficulty)) {
    throw new Error("Dados obrigatórios da trilha são inválidos");
  }

  const methods = Array.isArray(input.accepted_payment_methods)
    ? Array.from(new Set(input.accepted_payment_methods
        .map((method) => String(method).toUpperCase())
        .filter((method) => PAYMENT_METHODS.has(method))))
    : [];
  if (!methods.length) throw new Error("Selecione uma forma de pagamento válida");

  const images = Array.isArray(input.images)
    ? input.images.slice(0, 100).map(optionalAwsMediaUrl).filter(Boolean)
    : [];

  return {
    title,
    date,
    price,
    description,
    meeting_point: meetingPoint,
    requirements,
    max_capacity: Math.trunc(maxCapacity),
    duration_hours: durationHours,
    distance_km: distanceKm,
    difficulty,
    images,
    video_url: optionalAwsMediaUrl(input.video_url),
    flyer_url: optionalAwsMediaUrl(input.flyer_url),
    accepted_payment_methods: methods,
    taxa_gratis: Boolean(input.taxa_gratis),
  };
}

export async function requireArchivedAgendaUnlock(
  adminId: string,
  currentDate: unknown,
  nextDate?: unknown,
) {
  if (!isArchivedTrailDate(currentDate) && !isArchivedTrailDate(nextDate)) {
    return null;
  }
  if (await hasAdminSensitiveUnlock(adminId)) return null;
  return NextResponse.json(
    {
      error: "Trilha encerrada. Confirme a senha administrativa para editar.",
      code: "ARCHIVED_TRAIL_LOCKED",
    },
    { status: 423 },
  );
}
