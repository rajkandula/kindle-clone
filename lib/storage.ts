/**
 * Media storage: any S3-compatible bucket (covers, illustrations).
 *
 * Configure with STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID,
 * STORAGE_SECRET_ACCESS_KEY, STORAGE_ENDPOINT and STORAGE_PUBLIC_URL (the
 * public base URL objects are served from). Without them, cover uploads answer
 * "Media storage not configured" and books keep their generated covers.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY &&
      process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_PUBLIC_URL
  );
}

function getClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error(
      "Media storage is not configured. Set the STORAGE_* variables (see .env.example)."
    );
  }
  if (!client) {
    client = new S3Client({
      region: process.env.STORAGE_REGION || "auto",
      endpoint: process.env.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/** The canonical public URL for an object — never trust a client-supplied one. */
export function publicUrlForKey(key: string): string {
  const base = process.env.STORAGE_PUBLIC_URL!.replace(/\/$/, "");
  return `${base}/${key}`;
}

/** True when a URL points at our own bucket (guards stored cover URLs). */
export function isOwnBucketUrl(url: string): boolean {
  const base = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, "");
  return Boolean(base) && url.startsWith(`${base}/`);
}

/**
 * Presigned PUT URL so the browser uploads large media directly to the bucket.
 * ContentLength is part of the signature, so the declared size is enforced by
 * the storage service itself — a client can't sign for 1 MB and then upload
 * 10 GB.
 */
export async function presignUpload(
  key: string,
  contentType: string,
  contentLength: number
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET!,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: 600,
    signableHeaders: new Set(["content-length", "content-type"]),
  });
  return { uploadUrl, publicUrl: publicUrlForKey(key) };
}

/** Server-side upload — used for media Lectoire generates itself. */
export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return publicUrlForKey(key);
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: process.env.STORAGE_BUCKET!, Key: key })
  );
}
