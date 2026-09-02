// تبديل علم «listed» على منشور بعينه (per-row) —
// يُستخدم من قائمة «صفحات منشورة» في الاستوديو لإدراج صفحة بعينها في
// المتجر العام أو إخفائها. التحقق من الملكية يتمّ خادمياً؛ الفحص
// الذاتي (current/max) غير مطلوب — لا يأخذ حصة.

import { NextResponse } from "next/server";
import {
  getPublishedMeta,
  getPublishedOwner,
  setPublishedMeta,
} from "@/app/lib/publishStore";
import { isDeviceApprovedOnly, isDeviceBanned, getDeviceOwner } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";

export const dynamic = "force-dynamic";

async function resolveOwner(fingerprint: string): Promise<string> {
  const email = await getProfileEmail(fingerprint);
  return email ?? getDeviceOwner(fingerprint);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  // حماية الجهاز: معتمد + غير محظور
  try {
    const approved = await isDeviceApprovedOnly(fingerprint);
    if (!approved) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const banned = await isDeviceBanned(fingerprint);
    if (banned) return NextResponse.json({ error: "banned" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const obj = body as { slug?: unknown; listed?: unknown } | null;
  const slug = typeof obj?.slug === "string" ? obj.slug.trim() : "";
  const listed = Boolean(obj?.listed);
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

  // حماية: لا يمكن تغيير listed لمن لم يربط بريده بعد
  const ownerEmail = await getProfileEmail(fingerprint);
  if (!ownerEmail) {
    return NextResponse.json({ error: "incomplete" }, { status: 403 });
  }

  // فحص الملكية: المنشور يجب أن يكون للملالك نفسه
  let owner: string;
  try {
    owner = await resolveOwner(fingerprint);
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
  let prevOwner: string | null;
  try {
    prevOwner = await getPublishedOwner(slug);
  } catch {
    prevOwner = null;
  }
  if (!prevOwner || prevOwner !== owner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // دمج الميتا القائمة مع التحديث الجديد — يحفظ banned/hidden/host/createdAt
  let prevMeta: Awaited<ReturnType<typeof getPublishedMeta>> = null;
  try {
    prevMeta = await getPublishedMeta(slug);
  } catch {
    prevMeta = null;
  }
  try {
    await setPublishedMeta(slug, {
      ...(prevMeta ?? {}),
      owner,
      createdAt: prevMeta?.createdAt ?? new Date().toISOString(),
      listed,
    });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, slug, listed });
}
