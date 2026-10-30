/**
 * Kith Food BCP: one-way near-real-time sync Firestore/Storage (GCP) -> AWS (S3 + SQS FIFO -> DynamoDB).
 * Auth to AWS uses NO keys: Google ID token of this function's service account ->
 * STS AssumeRoleWithWebIdentity (role trusts only this SA's unique id + audience).
 * Config (non-secret) comes from functions/.env.<projectId> (gitignored): KF_AWS_*.
 * Only users/{uid}/meals/{mealId} is touched. Diary data is never read here.
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { GoogleAuth } from "google-auth-library";
import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const REGION = "asia-northeast1";
const ALLOWED_EMAIL = process.env.OWNER_EMAIL ?? "";
const cfg = () => ({
  roleArn: process.env.KF_AWS_ROLE_ARN ?? "",
  queueUrl: process.env.KF_AWS_QUEUE_URL ?? "",
  bucket: process.env.KF_AWS_BUCKET ?? "",
  region: process.env.KF_AWS_REGION ?? "ap-northeast-1",
  audience: process.env.KF_AWS_AUDIENCE ?? "kith-food-aws-sync",
});
const enabled = () => { const c = cfg(); return !!(c.roleArn && c.queueUrl && c.bucket); };

type Creds = { accessKeyId: string; secretAccessKey: string; sessionToken: string; expiration: Date };
let cached: { creds: Creds; s3: S3Client; sqs: SQSClient } | null = null;
const gauth = new GoogleAuth();

function decodeJwt(t: string): Record<string, unknown> {
  try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString("utf8")); } catch { return {}; }
}

async function aws() {
  if (cached && cached.creds.expiration.getTime() - Date.now() > 5 * 60_000) return cached;
  const c = cfg();
  const client = await gauth.getIdTokenClient(c.audience);
  const token = await client.idTokenProvider.fetchIdToken(c.audience);
  try {
    const sts = new STSClient({ region: c.region });
    const r = await sts.send(new AssumeRoleWithWebIdentityCommand({
      RoleArn: c.roleArn, RoleSessionName: "kith-food-gcp-sync", WebIdentityToken: token, DurationSeconds: 3600,
    }));
    const k = r.Credentials!;
    const creds = { accessKeyId: k.AccessKeyId!, secretAccessKey: k.SecretAccessKey!, sessionToken: k.SessionToken!, expiration: k.Expiration! };
    cached = {
      creds,
      s3: new S3Client({ region: c.region, credentials: creds }),
      sqs: new SQSClient({ region: c.region, credentials: creds }),
    };
    return cached;
  } catch (e) {
    const p = decodeJwt(token);
    // Non-secret identifiers, needed to configure the AWS trust policy.
    console.error("AssumeRoleWithWebIdentity failed", { sub: p.sub, azp: p.azp, aud: p.aud, email: p.email }, e);
    throw e;
  }
}

/** Firestore value -> JSON-safe (Timestamps -> ISO strings). */
function plain(data: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) o[k] = v.toDate().toISOString();
    else if (v === null || ["string", "number", "boolean"].includes(typeof v)) o[k] = v;
  }
  return o;
}
const micros = (t: Timestamp) => t.seconds * 1_000_000 + Math.floor(t.nanoseconds / 1000);

async function copyPhoto(uid: string, mealId: string, photoPath: string) {
  const expected = `users/${uid}/meals/${mealId}.jpg`;
  if (photoPath !== expected) return false;
  const file = getStorage().bucket().file(expected);
  const [exists] = await file.exists();
  if (!exists) return false;
  const [buf] = await file.download();
  const a = await aws();
  await a.s3.send(new PutObjectCommand({ Bucket: cfg().bucket, Key: expected, Body: buf, ContentType: "image/jpeg" }));
  return true;
}

async function send(msg: { op: "upsert" | "delete"; uid: string; mealId: string; version: number; data?: unknown }) {
  const a = await aws();
  await a.sqs.send(new SendMessageCommand({
    QueueUrl: cfg().queueUrl,
    MessageBody: JSON.stringify(msg),
    MessageGroupId: `${msg.uid}#${msg.mealId}`,
    MessageDeduplicationId: `${msg.mealId}-${msg.op}-${msg.version}`.slice(0, 128),
  }));
}

export async function syncOne(uid: string, mealId: string, opts: { forcePhoto?: boolean } = {}) {
  const snap = await getFirestore().doc(`users/${uid}/meals/${mealId}`).get();
  if (!snap.exists) return "missing";
  const data = snap.data()!;
  if (opts.forcePhoto) await copyPhoto(uid, mealId, String(data.photoPath ?? ""));
  await send({ op: "upsert", uid, mealId, version: micros(snap.updateTime!), data: plain(data) });
  return "ok";
}

export const syncMealToAws = onDocumentWritten(
  { document: "users/{uid}/meals/{mealId}", region: REGION, retry: true, maxInstances: 3, timeoutSeconds: 60 },
  async (event) => {
    if (!enabled()) return;
    // Drop events older than 1h so a permanent failure doesn't retry for days.
    if (Date.now() - Date.parse(event.time) > 3600_000) { console.error("drop old event", event.id); return; }
    const { uid, mealId } = event.params;
    const before = event.data?.before;
    const after = event.data?.after;
    const t0 = Date.now();
    if (!after?.exists) {
      const a = await aws();
      await a.s3.send(new DeleteObjectCommand({ Bucket: cfg().bucket, Key: `users/${uid}/meals/${mealId}.jpg` }));
      const v = Math.floor(Date.parse(event.time) * 1000) || Date.now() * 1000;
      await send({ op: "delete", uid, mealId, version: v });
      console.log("kf-sync delete", mealId, Date.now() - t0, "ms");
      return;
    }
    const data = after.data()!;
    const photoChanged = !before?.exists || before.data()?.photoPath !== data.photoPath;
    if (photoChanged) await copyPhoto(uid, mealId, String(data.photoPath ?? ""));
    await send({ op: "upsert", uid, mealId, version: micros(after.updateTime!), data: plain(data) });
    console.log("kf-sync upsert", mealId, { photo: photoChanged }, Date.now() - t0, "ms");
  },
);

async function backfill(uid: string) {
  const snaps = await getFirestore().collection(`users/${uid}/meals`).get();
  let ok = 0, failed = 0;
  for (const d of snaps.docs) {
    try { await syncOne(uid, d.id, { forcePhoto: true }); ok++; }
    catch (e) { failed++; console.error("backfill failed", d.id, e); }
  }
  return { total: snaps.size, ok, failed };
}

/** Owner-only: copy all existing meals (and photos) to AWS. */
export const backfillMealsToAws = onCall(
  { region: REGION, timeoutSeconds: 540, memory: "512MiB", maxInstances: 1, invoker: "public" },
  async (request) => {
    const a = request.auth;
    if (!a || a.token.email !== ALLOWED_EMAIL || a.token.email_verified !== true) {
      throw new HttpsError("permission-denied", "許可されていません。");
    }
    if (!enabled()) throw new HttpsError("failed-precondition", "AWS同期が未設定です。");
    return backfill(a.uid);
  },
);
