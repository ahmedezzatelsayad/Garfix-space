/**
 * r14: طبقة طوابير المهام — BullMQ فوق Valkey 8.1
 * - الجانب المُنتِج (Producer): تُستخدم من مسارات API لإضافة مهام وقراءة الإحصائيات.
 * - العامل الفعلي (Worker) يعمل كخدمة مستقلة: mini-services/job-worker (منفذ 3041).
 * - الاتصال: مثيلات BullMQ تُدار عبر globalThis حتى لا تتضاعف الاتصالات عند hot-reload.
 *
 * ملاحظة: BullMQ يرفض اتصال ioredis فيه maxRetriesPerRequest محدد —
 * لذلك نمرر خيارات اتصال خاصة به (تنشئ اتصالاتها الداخلية بنفسها).
 */
import { Queue } from "bullmq";

const VALKEY_HOST = process.env.VALKEY_HOST || "127.0.0.1";
const VALKEY_PORT = Number(process.env.VALKEY_PORT || 6379);
export const QUEUE_NAME = "garfix-tasks";

/** أسماء المهام المسموح بها (قائمة بيضاء) — يطابق معالجات العامل */
export const JOB_TYPES = ["backup", "cache-warm", "cleanup-backups", "db-maintenance"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_META: Record<JobType, { label: string; desc: string; icon: string }> = {
  backup: { label: "نسخة احتياطية", desc: "تفريغ كامل لقاعدة PostgreSQL إلى ملف JSON في مجلد النسخ", icon: "💾" },
  "cache-warm": { label: "تسخين الكاش", desc: "تحميل لوحات التحكم والصفحات العامة مسبقاً في كاش Valkey", icon: "🔥" },
  "cleanup-backups": { label: "تنظيف النسخ القديمة", desc: "حذف النسخ الاحتياطية الأقدم من 14 يوماً (مع الاحتفاظ بأحدث 5)", icon: "🧹" },
  "db-maintenance": { label: "صيانة القاعدة", desc: "VACUUM ANALYZE لقاعدة PostgreSQL — تحسين الأداء واستعادة المساحة", icon: "🛠️" },
};

const connection = () => ({ host: VALKEY_HOST, port: VALKEY_PORT, maxRetriesPerRequest: null as null });

const globalForQueue = globalThis as unknown as {
  garfixQueue: Queue | undefined;
  garfixQueueDead: Queue[] | undefined;
};

/** طابور وحيد على مستوى العملية (الإضافة/الإحصائيات فقط — لا معالجة هنا) */
export function getQueue(): Queue {
  if (globalForQueue.garfixQueue) return globalForQueue.garfixQueue;
  const q = new Queue(QUEUE_NAME, {
    connection: connection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
      removeOnComplete: { age: 3600 * 24, count: 200 }, // احتفظ بآخر 200 مهمة مكتملة ليوم واحد
      removeOnFail: { age: 3600 * 24 * 7, count: 500 }, // والفاشلة لأسبوع
    },
  });
  q.on("error", () => { /* أخطاء الاتصال تُدار عبر healthz */ });
  globalForQueue.garfixQueue = q;
  return q;
}

/** إضافة مهمة فورية */
export async function enqueueJob(name: JobType, data: Record<string, unknown> = {}) {
  const q = getQueue();
  const job = await q.add(name, data, { jobId: `jm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  return { id: job.id ?? "", name };
}

/** نبضة العامل — يستعلم خدمة job-worker على منفذها الداخلي */
export async function workerHealth(): Promise<Record<string, unknown> | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(`http://127.0.0.1:3041/healthz`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** إحصائيات شاملة للطابور + العامل (لوحة المراقبة) */
export async function queueOverview() {
  const q = getQueue();
  const [counts, schedulers, done, failed, worker] = await Promise.all([
    q.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    q.getJobSchedulers(0, 20),
    q.getJobs(["completed"], 0, 24, false),
    q.getJobs(["failed"], 0, 24, false),
    workerHealth(),
  ]);

  const shape = (j: unknown, state: string) => {
    const job = j as {
      id?: string; name?: string; timestamp?: number; processedOn?: number;
      finishedOn?: number; failedReason?: string; returnvalue?: unknown; opts?: { repeat?: unknown };
    };
    const dur = job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null;
    const repeat = Boolean(job.opts?.repeat);
    return {
      id: job.id ?? "", name: job.name ?? "", state,
      enqueuedAt: job.timestamp ?? null,
      processedAt: job.processedOn ?? null,
      finishedAt: job.finishedOn ?? null,
      durationMs: dur,
      repeat,
      failedReason: job.failedReason ?? null,
      result: job.returnvalue ?? null,
    };
  };

  // المهام المجدولة (Job Schedulers — واجهة BullMQ v6)
  const scheduled = schedulers.map((r) => ({
    id: r.id ?? "",
    name: r.name ?? "",
    cron: r.pattern ?? (r.every != null ? `كل ${Math.round(r.every / 1000)} ثانية` : ""),
    tz: r.tz ?? "",
    next: r.next ?? null,
  }));

  return {
    queue: QUEUE_NAME,
    engine: "bullmq@6",
    counts,
    scheduled,
    worker: worker ?? { connected: false },
    jobs: [...done.map((j) => shape(j, "completed")), ...failed.map((j) => shape(j, "failed"))]
      .sort((a, b) => (b.finishedAt ?? b.enqueuedAt ?? 0) - (a.finishedAt ?? a.enqueuedAt ?? 0))
      .slice(0, 24),
  };
}
