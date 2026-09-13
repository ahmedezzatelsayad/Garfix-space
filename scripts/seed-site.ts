/**
 * r13: بذر محتوى الموقع العام (رسالة المؤسس + فريق العمل) — يعمل مرة واحدة بأمان
 * (upsert: لا يكرر ولا يستبدل تعديلات المدير اللاحقة).
 * Usage: DATABASE_URL=postgresql://… bun run scripts/seed-site.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const CONTENT: Record<string, string> = {
  site_name: "الشركة القابضة المتحدة",
  site_name_en: "United Holding Group",
  hero_badge: "نظام إدارة الحسابات المتكامل",
  hero_title: "إدارة مالية ذكية لكل شركاتك، في مكان واحد",
  hero_sub:
    "من الفاتورة الأولى حتى آخر دينار محصَّل: فواتير فورية، مدفوعات جزئية، تذكيرات واتساب، تقارير لحظية، ومساعد ذكي يقرأ بياناتك ويجيبك — بعملة كل شركة وبالعربية الكاملة.",
  founder_name: "أحمد عزت السيد",
  founder_title: "المؤسس والرئيس التنفيذي",
  founder_emoji: "👨‍💼",
  founder_photo: "",
  founder_message: `بدأنا من سؤال واحد بسيط سأله لي صاحب متجر في الكويت: «ليش كل شهر بقضي ساعتين أطابق الفواتير باليد؟» — من ذلك السؤال وُلد هذا النظام.

أؤمن أن إدارة المال ليست جداول وأرقاماً، بل ثقة: ثقة العميل بأن فاتورته واضحة، وثقة التاجر بأن رصيده محسوب بدقة إلى آخر قرش، وثقة الفريق بأن كل عملية مكتوبة ومسؤولة.

لهذا بنينا النظام على ثلاث مبادئ لا نساوم عليها:

الدقة قبل كل شيء — كل رقم له مصدر واحد موثّق، وأي تعديل يُسجَّل ولا يُمحى.
البساطة التي يستحقها التاجر — الموظف الجديد يتقن النظام في يوم واحد، بلا تدريب معقّد ولا شاشات غامضة.
التطوير المستمر — نقرأ كل ملاحظة، ونطلق تحسينات كل أسبوع تقريباً.

هذا المشروع بالنسبة لي ليس منتجاً نقطة وننتهي، بل رحلة نشارككم فيها: نظام ينمو مع كل شركة تنضم إلينا، ويتعلم من كل فاتورة تُصدر.

شكراً لثقتكم — وكل عام والتجارة الكويتية بخير وازدهار.`,
  founder_signature: "أحمد عزت السيد",
  contact_phone: "+96598737207",
  contact_email: "ahmedezzatelsayad@gmail.com",
  contact_address: "الكويت — حولي",
};

const TEAM: {
  name: string;
  role: string;
  bio: string;
  emoji: string;
  sortOrder: number;
}[] = [
  {
    name: "أيمن",
    role: "مدير العمليات",
    bio: "يشرف على التشغيل اليومي للشركات الأربع ويضمن سير الفواتير والمدفوعات دون تأخير.",
    emoji: "🧑‍💼",
    sortOrder: 1,
  },
  {
    name: "آية سيد",
    role: "مديرة المبيعات",
    bio: "تدير علاقات العملاء الكبار ومتابعة التحصيل — صاحبة أدنى نسبة مديونيات متأخرة في الفريق.",
    emoji: "👩‍💼",
    sortOrder: 2,
  },
  {
    name: "قسم الحسابات",
    role: "المحاسبة والمراجعة",
    bio: "مراجعة يومية لكل القيود، مطابقة المدفوعات الجزئية، وإعداد تقارير الإدارة الأسبوعية.",
    emoji: "🧾",
    sortOrder: 3,
  },
  {
    name: "فريق الدعم",
    role: "دعم العملاء",
    bio: "رد سريع على استفسارات الفواتير والروابط عبر واتساب خلال ساعات العمل الرسمية.",
    emoji: "🎧",
    sortOrder: 4,
  },
];

async function main() {
  for (const [key, value] of Object.entries(CONTENT)) {
    await db.siteContent.upsert({
      where: { key },
      update: {}, // لا نستبدل تعديلات المدير
      create: { key, value },
    });
  }
  const existing = await db.teamMember.count();
  if (existing === 0) {
    await db.teamMember.createMany({ data: TEAM });
  }
  const counts = {
    content: await db.siteContent.count(),
    team: await db.teamMember.count(),
  };
  console.log("seed-site OK:", JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error("seed-site FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
