import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoicePaymentStatus, invoiceTotal, num, todayISODate } from "@/lib/serialize";
import { cacheWrap } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";
import { companyMatchKeys } from "@/lib/company-access";

/**
 * GET /api/dashboard/stats?companySlug= — (r10: كاش Valkey 30 ثانية)
 * r29 (S1): تتطلب جلسة؛ شركة محددة يجب أن تكون ضمن شركات الجلسة، وبلا شركة
 * يرى المدير الكل ويرى المشترك/الموظف شركاتهم فقط.
 * r29 (C5): totalClients محصور بالشركة (كان عدد عملاء كل الشركات)، وoverdue
 * يحسب فعلياً: استحقاق مضى + غير مسدد + غير ملغاة (كان صفراً دائماً).
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const companySlug = req.nextUrl.searchParams.get("companySlug")?.trim() || undefined;
    if (companySlug && !scope.all && !scope.slugs.includes(companySlug)) {
      return forbiddenCompanyResponse();
    }

    const where = companySlug
      ? { companySlug }
      : scope.all
        ? {}
        : { companySlug: { in: scope.slugs } };
    const scopeKey = companySlug || (scope.all ? "all" : scope.slugs.join("+"));

    const payload = await cacheWrap(`stats:v2:${scopeKey}`, 30, async () => {
      const invoices = await db.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      // r29 (C5): عملاء الشركة بمطابقة كل صيغ عمود company (slug/code/name/nameAr)
      const companyKeys = await companyMatchKeys(companySlug ? [companySlug] : scope.all ? [] : scope.slugs);
      let totalClients = 0;
      if (companyKeys.size) {
        const clientRows = await db.client.findMany({ select: { company: true } });
        totalClients = clientRows.filter((r) => {
          const v = String(r.company ?? "").trim().toLowerCase();
          return !!v && companyKeys.has(v);
        }).length;
      } else if (!companySlug && scope.all) {
        totalClients = await db.client.count();
      }

      let totalRevenue = 0;
      let outstanding = 0;
      let overdue = 0;
      let paidCount = 0;
      let sentCount = 0;
      let overdueCount = 0;
      let draftCount = 0;

      const today = todayISODate(); // YYYY-MM-DD — المقارنة النصية صالحة زمنياً
      for (const inv of invoices) {
        const tot = invoiceTotal(inv);
        const paid = num(inv.paid);
        const st = invoicePaymentStatus(inv);
        if (st === "paid") {
          totalRevenue += tot;
          paidCount++;
        } else if (st === "part") {
          totalRevenue += paid;
          outstanding += tot - paid;
          sentCount++;
        } else if (st === "unp") {
          outstanding += tot;
          draftCount++;
        }
        // r29 (C5): متأخرة = تجاوزت الاستحقاق ولم تُسدد ولم تُلغَ (كما في الواجهة)
        if (inv.status !== "cancelled" && paid < tot && inv.dueDate && inv.dueDate < today) {
          overdue += tot - paid;
          overdueCount++;
        }
      }

      return {
        totalRevenue,
        outstanding,
        overdue,
        draftCount,
        paidCount,
        sentCount,
        overdueCount,
        totalInvoices: invoices.length,
        totalClients,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
