import "server-only";

import { NextResponse } from "next/server";

const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export async function readJsonBody<T>(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<
  | { data: T; response?: never }
  | { data?: never; response: NextResponse }
> {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > maxBytes) {
    return {
      response: NextResponse.json({ error: "Payload excede o limite permitido" }, { status: 413 }),
    };
  }

  try {
    return { data: await request.json() as T };
  } catch {
    return {
      response: NextResponse.json({ error: "JSON inválido" }, { status: 400 }),
    };
  }
}

export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const requestUrl = new URL(request.url);
  if (new URL(origin).host !== requestUrl.host) {
    return NextResponse.json({ error: "Origem não permitida" }, { status: 403 });
  }

  return null;
}
