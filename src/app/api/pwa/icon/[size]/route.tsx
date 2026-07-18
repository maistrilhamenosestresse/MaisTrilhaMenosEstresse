import { ImageResponse } from "next/og";

const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL ||
  "https://maistrilha-menosestresse.s3.us-east-2.amazonaws.com/legacy-media/images/logo.png";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/pwa/icon/[size]">,
) {
  const { size: rawSize } = await context.params;
  const size = rawSize === "512" ? 512 : rawSize === "192" ? 192 : 0;
  if (!size) return new Response("Tamanho inválido", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #061526, #0B2540)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          width={Math.round(size * 0.74)}
          height={Math.round(size * 0.74)}
          style={{ objectFit: "contain", borderRadius: size * 0.12 }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
