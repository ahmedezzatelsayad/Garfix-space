import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getQueue, enqueueJob, queueOverview, JOB_TYPES, JOB_META, JobType } from "@/lib/queue";

// r14: طوابير المهام (BullMQ) — مراقبة وإدارة
// GET  /api/jobs          → إحصائيات الطابور + العامل + آخر المهام + المجدولة
// POST /api/jobs          → {action:"enqueue", name, data?} | {action:"retry", jobId} | {action:"remove", jobId}
// ملاحظة أمان: كل الأفعال إدارية — تتطلب جلسة مدير (requireAdmin).

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const overview = await queueOverview();
    return NextResponse.json({ ...overview, types: JOB_META });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "enqueue");
    const q = getQueue();

    if (action === "enqueue") {
      const name = String(body.name ?? "") as JobType;
      if (!JOB_TYPES.includes(name)) {
        return NextResponse.json({ error: `نوع مهمة غير معروف: ${name}` }, { status: 400 });
      }
      const data =
        name === "cleanup-backups"
          ? { days: Number(body.days ?? 14), keepMin: Number(body.keepMin ?? 5) }
          : {};
      const job = await enqueueJob(name, data);
      return NextResponse.json({ ok: true, job });
    }

    if (action === "retry" || action === "remove") {
      const jobId = String(body.jobId ?? "");
      if (!jobId) return NextResponse.json({ error: "jobId مطلوب" }, { status: 400 });
      const job = await q.getJob(jobId);
      if (!job) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
      if (action === "retry") {
        if (await job.getState() !== "failed") {
          return NextResponse.json({ error: "لا يمكن إعادة محاولة مهمة غير فاشلة" }, { status: 400 });
        }
        await job.retry();
        return NextResponse.json({ ok: true, retried: jobId });
      }
      // remove: مسموح فقط لغير النشطة
      const st = await job.getState();
      if (st === "active") return NextResponse.json({ error: "لا يمكن حذف مهمة قيد التنفيذ" }, { status: 400 });
      await job.remove();
      return NextResponse.json({ ok: true, removed: jobId });
    }

    return NextResponse.json({ error: `فعل غير معروف: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
