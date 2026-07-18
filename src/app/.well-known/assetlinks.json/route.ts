const ANDROID_PACKAGE = "com.maistrilhasmenosestresse.app";
const ANDROID_CERTIFICATE_FINGERPRINT =
  "13:96:16:2D:D8:28:00:E6:1D:DB:CA:E2:EC:C9:50:6D:F8:0B:37:44:15:08:8E:49:B9:1E:32:B1:E9:1C:AF:7E";

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: [ANDROID_CERTIFICATE_FINGERPRINT],
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
