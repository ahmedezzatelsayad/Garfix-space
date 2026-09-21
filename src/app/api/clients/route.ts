import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBody } from "@/lib/serialize";
import { cacheWrap, invalidateClients } from "@/lib/cache";
import { getSessionAppUser, getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";
import { checkCustomersQuota } from "@/lib/plans";
import { companyMatchKeys } from "@/lib/company-access";

/**
 * GET /api/clients?search=&company= — (r10: كاش Valkey 30 ثانية)
 * r29 (S1/C9): تتطلب جلسة؛ المدير يرى الدليل كاملاً والمشترك/الموظف عملاء
 * شركاتهم فقط (مطابقة company بكل صيغها: slug/code/name/nameAr).
 * الكاش لا يتضمن search/company (تفعيل بعد الكاش) فلا يتضخم مفتاحه بإدخال المستخدم.
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const search = (req.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 80);
    const company = (req.nextUrl.searchParams.get("company") ?? "").trim().slice(0, 80);

    let rows;
    if (scope.all) {
      rows = await cacheWrap(`clients:v2:all`, 30, () =>
        db.client.findMany({ orderBy: { createdAt: "desc" } }),
      );
    } else {
      const keys = await companyMatchKeys(scope.slugs);
      const sig = scope.slugs.join("+");
      rows = await cacheWrap(`clients:v2:own:${sig}`, 30, async () => {
        const all = await db.client.findMany({ orderBy: { createdAt: "desc" } });
        // نطاق المستخدم يُطبَّق داخل مولّد الكاش — القيمة المخزنة عملاؤه فقط
        return all.filter((r) => {
          const v = String(r.company ?? "").trim().toLowerCase();
          return !!v && keys.has(v);
        });
      });
    }
    if (company) {
      rows = rows.filter((r) => (r.company || "") === company);
    }
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.email || "").toLowerCase().includes(s) ||
          (r.phone || "").includes(s),
      );
    }

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/clients — body: { name, email?, phone?, company?, address?, country?, governorate?, companyId? }
// r17: المشترك المسجّل محدود بعدد عملاء خطته (المدير/الموظف/الوضع المحلي بلا حدود)
// r29 (S1/C3): تتطلب جلسة + ملكية الشركة، وسقوف أطوال للنصوص
export async function POST(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();
    const subscriber = await getSessionAppUser(req);
    if (subscriber) {
      const quota = await checkCustomersQuota(subscriber.appUser);
      if (!quota.ok) {
        return NextResponse.json({ error: quota.message, code: quota.code }, { status: 403 });
      }
    }

    const body = await readBody(req);
    if (body.name == null) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const str = (v: unknown, max: number): string | null =>
      v == null ? null : String(v).trim().slice(0, max) || null;
    const name = str(body.name, 500);
    if (!name) {
      return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
    }
    const company = str(body.company, 200);

    // r29 (S1): العميل الجديد يجب أن يتبع إحدى شركات الجلسة (المدير بلا قيد)
    if (!scope.all) {
      if (!company) {
        return NextResponse.json(
          { error: "الشركة مطلوبة — أضف العميل إلى إحدى شركاتك", code: "COMPANY_REQUIRED" },
          { status: 403 },
        );
      }
      const keys = await companyMatchKeys(scope.slugs);
      if (!keys.has(String(company).toLowerCase())) {
        return forbiddenCompanyResponse();
      }
    }

    const created = await db.client.create({
      data: {
        name,
        email: str(body.email, 320),
        phone: str(body.phone, 40),
        company,
        address: str(body.address, 500),
        country: str(body.country, 2)?.toUpperCase() || null,
        governorate: str(body.governorate, 200),
        companyId: body.companyId == null ? null : Number(body.companyId) || null,
      },
    });

    await invalidateClients();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
