import crypto from "crypto";

export function getMaxFileSizeMB(): number {
  const envVal = process.env.MAX_FILE_SIZE_MB || process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB;
  const num = envVal ? parseInt(envVal, 10) : 5;
  return isNaN(num) || num <= 0 ? 5 : num;
}

export function getMaxFileSizeBytes(): number {
  return getMaxFileSizeMB() * 1024 * 1024;
}

export function getMaxBase64Length(): number {
  return Math.ceil(getMaxFileSizeBytes() * 1.37) + 200_000;
}

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getS3Config(): S3Config | null {
  const endpoint = (process.env.B2_ENDPOINT || process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || "").trim().replace(/^https?:\/\//, "");
  const bucket = (process.env.B2_BUCKET || process.env.S3_BUCKET || process.env.R2_BUCKET || "").trim();
  const accessKeyId = (process.env.B2_KEY_ID || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.B2_APPLICATION_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "").trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  let region = (process.env.B2_REGION || process.env.S3_REGION || process.env.AWS_REGION || "us-east-1").trim();
  if (endpoint.includes("backblazeb2.com") && !process.env.B2_REGION) {
    const parts = endpoint.split(".");
    if (parts.length >= 2 && (parts[1].startsWith("us-") || parts[1].startsWith("eu-"))) {
      region = parts[1];
    }
  }

  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

export function isExternalStorageEnabled(): boolean {
  return getS3Config() !== null;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const gDate = hmac("AWS4" + key, dateStamp);
  const kRegion = crypto.createHmac("sha256", gDate).update(regionName, "utf8").digest();
  const kService = crypto.createHmac("sha256", kRegion).update(serviceName, "utf8").digest();
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request", "utf8").digest();
  return kSigning;
}

export async function uploadToExternalStorage(key: string, payload: string): Promise<boolean> {
  const cfg = getS3Config();
  if (!cfg) return false;

  try {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const bodyBuffer = Buffer.from(payload, "utf8");
    const payloadHash = sha256Hex(bodyBuffer);

    const canonicalUri = `/${encodeURIComponent(cfg.bucket)}/${encodeURIComponent(key)}`;
    const host = cfg.endpoint;

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

    const signingKey = getSignatureKey(cfg.secretAccessKey, dateStamp, cfg.region, "s3");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${cfg.endpoint}${canonicalUri}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Host: host,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authHeader,
        "Content-Type": "text/plain",
      },
      body: bodyBuffer,
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function downloadFromExternalStorage(key: string): Promise<string | null> {
  const cfg = getS3Config();
  if (!cfg) return null;

  try {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex("");

    const canonicalUri = `/${encodeURIComponent(cfg.bucket)}/${encodeURIComponent(key)}`;
    const host = cfg.endpoint;

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = ["GET", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

    const signingKey = getSignatureKey(cfg.secretAccessKey, dateStamp, cfg.region, "s3");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${cfg.endpoint}${canonicalUri}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Host: host,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authHeader,
      },
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function deleteFromExternalStorage(key: string): Promise<boolean> {
  const cfg = getS3Config();
  if (!cfg) return false;

  try {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex("");

    const canonicalUri = `/${encodeURIComponent(cfg.bucket)}/${encodeURIComponent(key)}`;
    const host = cfg.endpoint;

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = ["DELETE", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

    const signingKey = getSignatureKey(cfg.secretAccessKey, dateStamp, cfg.region, "s3");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${cfg.endpoint}${canonicalUri}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Host: host,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authHeader,
      },
    });

    return res.ok;
  } catch {
    return false;
  }
}
