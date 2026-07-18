import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BUCKET_NAME, s3Client } from "@/lib/aws";

const ANDROID_APK_KEY = "app/android/mais-trilha.apk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: ANDROID_APK_KEY,
    }));

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: ANDROID_APK_KEY,
        ResponseContentType: "application/vnd.android.package-archive",
        ResponseContentDisposition: 'attachment; filename="Mais-Trilha.apk"',
      }),
      { expiresIn: 300 },
    );

    return Response.redirect(downloadUrl, 307);
  } catch (error: any) {
    const status = Number(error?.$metadata?.httpStatusCode || 0);
    if (status === 404 || error?.name === "NotFound") {
      return Response.json(
        { error: "O instalador Android ainda está sendo preparado. Tente novamente em alguns minutos." },
        { status: 404 },
      );
    }

    console.error("Falha ao disponibilizar APK Android:", error);
    return Response.json(
      { error: "Não foi possível baixar o instalador agora." },
      { status: 500 },
    );
  }
}
