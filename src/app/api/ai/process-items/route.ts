import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/ai-provider";

interface CatalogProduct {
  id: number;
  name: string;
  aliases: string[];
  purchasePrice: number | null;
  sellingPrice: number | null;
}

// POST /api/ai/process-items — body: { rawText, catalog }
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    const rawText = typeof body.rawText === "string" ? body.rawText : "";
    const catalog: CatalogProduct[] = Array.isArray(body.catalog)
      ? (body.catalog as CatalogProduct[])
      : [];

    if (!rawText.trim()) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const catalogText =
      catalog.length > 0
        ? `\nProduct catalog:\n${catalog
            .map(
              (p) =>
                `- ID ${p.id}: "${p.name}"${
                  p.aliases?.length ? ` (aliases: ${p.aliases.join(", ")})` : ""
                }${p.purchasePrice ? ` | purchase: ${p.purchasePrice} KD` : ""}${
                  p.sellingPrice ? ` | selling: ${p.sellingPrice} KD` : ""
                }`,
            )
            .join("\n")}`
        : "\n(No catalog provided — use your best judgment for normalization)";

    const systemPrompt = `You are an AI assistant for a Kuwaiti invoice/purchase system.
Your job is to parse raw product text (which may be in Arabic, English, or mixed), extract items with quantities, normalize product names, and optionally match them to a catalog.

Rules:
- Detect quantity even if written as Arabic numerals (٥ = 5), words (واحد=1, اثنين=2, ثلاثة=3, أربعة=4, خمسة=5, ستة=6, سبعة=7, ثمانية=8, تسعة=9, عشرة=10, etc.), or digits
- Normalize product names: fix spelling, capitalize properly, remove filler words, standardize
- If quantity is not specified, assume 1
- Match to catalog if a close match exists (by name similarity or alias) — set catalogId and catalogName if matched
- Return confidence 0.0–1.0: 1.0=exact catalog match, 0.9=very confident normalization, 0.7=reasonable guess, 0.5=uncertain
- Treat each line (or comma/newline-separated segment) as one product entry
- purchasePrice: copy from catalog if matched, else null

${catalogText}

IMPORTANT: Respond ONLY with a JSON object with an "items" array. No markdown, no explanation. Schema:
{
  "items": [
    {
      "rawText": "original text segment",
      "normalizedName": "Clean Product Name",
      "quantity": 3,
      "catalogId": null,
      "catalogName": null,
      "purchasePrice": null,
      "confidence": 0.85,
      "notes": "optional short explanation"
    }
  ]
}`;

    // r10: يمر عبر مزوّد الذكاء الموحّد — DeepSeek عند تفعيله، وإلا المزوّد المدمج
    const completion = await chatComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawText.trim() },
      ],
      { json: true, maxTokens: 3000 },
    );
    const content = completion.content || "{}";

    let items: unknown[];
    try {
      const raw = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const obj: unknown = JSON.parse(raw);
      if (Array.isArray(obj)) {
        items = obj;
      } else {
        const rec = (obj && typeof obj === "object" ? obj : {}) as Record<
          string,
          unknown
        >;
        const extracted = rec.items ?? rec.results ?? rec.products ?? [];
        items = Array.isArray(extracted) ? extracted : [];
      }
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: content },
        { status: 500 },
      );
    }

    return NextResponse.json({ items, model: completion.model, provider: completion.provider, latencyMs: completion.latencyMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function readJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
