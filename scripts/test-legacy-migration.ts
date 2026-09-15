// test-legacy-migration.ts — offline test of the legacy backup adapter against the real sample file
import { isLegacyBackup, migrateLegacyBackup } from "../src/lib/backup-legacy";
import * as fs from "fs";

async function main() {
  const raw = JSON.parse(fs.readFileSync("/home/z/my-project/upload/backup-2026-09-12_19-01-39.json", "utf8"));
  console.log("isLegacyBackup:", isLegacyBackup(raw));

  // simulate current companies (as Prisma would return)
  const currentCompanies = [
    { id: 1, name: "Tawfeer Online Shop", slug: "tw_inv_tawfeer_v1", code: null, currency: "KWD", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: 2, name: "Mahhal Online Store", slug: "tw_inv_mahhal_v1", code: null, currency: "KWD", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: 3, name: "Boss Neolife", slug: "tw_inv_boss_v1", code: null, currency: "KWD", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: 4, name: "Laqta Online Store", slug: "tw_inv_laqta_v1", code: null, currency: "KWD", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  ];

  const { dump, skipped } = migrateLegacyBackup(raw, currentCompanies as any);
  console.log("skipped:", skipped);
  console.log("generatedAt:", dump.generatedAt, "engine:", dump.engine);
  for (const [k, v] of Object.entries(dump.data)) {
    console.log(`  ${k}: ${v.length}`);
  }
  // verify slug mapping
  const slugs = new Set(dump.data.invoices.map((i: any) => i.companySlug));
  console.log("mapped invoice slugs:", [...slugs]);
  // verify lineItems are JSON strings
  const inv = dump.data.invoices[0] as any;
  console.log("lineItems type:", typeof inv.lineItems, "| parsed items:", JSON.parse(inv.lineItems).length);
  // verify catalog aliases
  const cat = dump.data.productCatalog[0] as any;
  console.log("catalog aliases type:", typeof cat.aliases);
  // verify companies kept current
  console.log("companies:", dump.data.companies.map((c: any) => `${c.id}:${c.slug}`).join(", "));
  // verify invoice sample fields
  console.log("inv sample:", { invoiceNumber: inv.invoiceNumber, clientName: inv.clientName, issueDate: inv.issueDate, paid: inv.paid, total: inv.total, status: inv.status });
  // check required invoice fields present for all
  const bad = dump.data.invoices.filter((i: any) => !i.invoiceNumber || !i.clientName);
  console.log("invoices missing required fields:", bad.length);
}
main();
