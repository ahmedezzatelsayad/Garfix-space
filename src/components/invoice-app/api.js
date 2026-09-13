const API_BASE = "/api";

function toApiInvoice(inv, companySlug) {
  const items = inv.items || [];
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const shipping = Number(inv.shipping) || 0;
  const total = subtotal + shipping;
  return {
    invoiceNumber: inv.invNum || `INV${Date.now()}`,
    companySlug: companySlug || inv.companySlug || null,
    clientName: inv.clientName || "عميل",
    clientEmail: null,
    clientPhone: inv.clientPhone || null,
    clientAddress: inv.clientAddress || null,
    issueDate: inv.date || new Date().toISOString().split("T")[0],
    dueDate: inv.dueDate || new Date().toISOString().split("T")[0],
    status: inv.status || "draft",
    lineItems: items.map((it) => ({
      name: it.name || "",
      desc: it.desc || null,
      qty: Number(it.qty) || 1,
      price: Number(it.price) || 0,
    })),
    subtotal,
    taxRate: 0,
    taxAmount: 0,
    total,
    shipping,
    paid: Number(inv.paid) || 0,
    notes: inv.notes || null,
    source: inv.source || "manual",
  };
}

function fromApiInvoice(apiInv) {
  return {
    id: apiInv.id,
    invNum: apiInv.invoiceNumber,
    companySlug: apiInv.companySlug,
    clientName: apiInv.clientName || "",
    clientPhone: apiInv.clientPhone || "",
    clientAddress: apiInv.clientAddress || "",
    items: (apiInv.lineItems || []).map((li) => ({
      name: li.name || li.description || "",
      desc: li.desc || "",
      qty: Number(li.qty) || Number(li.quantity) || 1,
      price: Number(li.price) || Number(li.unitPrice) || 0,
    })),
    shipping: Number(apiInv.shipping) || 0,
    date: apiInv.issueDate,
    dueDate: apiInv.dueDate,
    paid: Number(apiInv.paid) || 0,
    notes: apiInv.notes || "",
    status: apiInv.status || "",
    createdAt: apiInv.createdAt,
    updatedAt: apiInv.updatedAt,
    source: apiInv.source || null,
  };
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  async listInvoices(companySlug) {
    const qs = companySlug ? `?companySlug=${encodeURIComponent(companySlug)}` : "";
    const data = await request("GET", `/invoices${qs}`);
    return (data || []).map(fromApiInvoice);
  },

  async createInvoice(inv, companySlug) {
    const data = await request("POST", "/invoices", toApiInvoice(inv, companySlug));
    return fromApiInvoice(data);
  },

  async getInvoice(id) {
    const data = await request("GET", `/invoices/${id}`);
    return fromApiInvoice(data);
  },

  async updateInvoice(id, inv) {
    const data = await request("PUT", `/invoices/${id}`, toApiInvoice(inv, inv.companySlug));
    return fromApiInvoice(data);
  },

  async deleteInvoice(id) {
    await request("DELETE", `/invoices/${id}`);
  },

  async bulkCreateInvoices(invoices, companySlug) {
    const results = [];
    for (const inv of invoices) {
      const created = await this.createInvoice(inv, companySlug);
      results.push(created);
    }
    return results;
  },

  async listPurchaseInvoices(companySlug) {
    const qs = companySlug ? `?companySlug=${encodeURIComponent(companySlug)}` : "";
    return request("GET", `/purchase-invoices${qs}`);
  },

  async createPurchaseInvoice(data) {
    return request("POST", "/purchase-invoices", data);
  },

  async deletePurchaseInvoice(id) {
    await request("DELETE", `/purchase-invoices/${id}`);
  },

  async getCatalog(companySlug) {
    const qs = companySlug ? `?companySlug=${encodeURIComponent(companySlug)}` : "";
    return request("GET", `/catalog${qs}`);
  },

  async createCatalogProduct(data) {
    return request("POST", "/catalog", data);
  },

  async updateCatalogProduct(id, data) {
    return request("PUT", `/catalog/${id}`, data);
  },

  async deleteCatalogProduct(id) {
    await request("DELETE", `/catalog/${id}`);
  },

  // ── Payments (payment history per invoice) ──
  async listPayments(invoiceId) {
    return request("GET", `/invoices/${invoiceId}/payments`);
  },

  async addPayment(invoiceId, payment) {
    return request("POST", `/invoices/${invoiceId}/payments`, {
      amount: Number(payment.amount) || 0,
      method: payment.method || "knet",
      date: payment.date || new Date().toISOString().split("T")[0],
      note: payment.note || null,
    });
  },

  async deletePayment(paymentId) {
    await request("DELETE", `/payments/${paymentId}`);
  },

  // ── Client directory (saved customers) ──
  async listClients(company) {
    const qs = company ? `?company=${encodeURIComponent(company)}` : "";
    return request("GET", `/clients${qs}`);
  },

  // r11: دمج عميلين مكررين — توحيد الفواتير والدليل على العميل الهدف
  async mergeClients({ companySlug, from, to }) {
    return request("POST", "/clients/merge", { companySlug, from, to });
  },

  async createClient(data) {
    return request("POST", "/clients", data);
  },

  async updateClient(id, data) {
    return request("PUT", `/clients/${id}`, data);
  },

  async deleteClient(id) {
    await request("DELETE", `/clients/${id}`);
  },

  // ── PDF export (HTML → PDF via /api/pdf, returns Blob for download) ──
  async exportPdf(html, filename) {
    const res = await fetch(`${API_BASE}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename }),
    });
    if (!res.ok) {
      let msg = `فشل التصدير (${res.status})`;
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch {}
      throw new Error(msg);
    }
    return res.blob();
  },

  // ── Reminder log (WhatsApp reminders sent to clients) ──
  async listReminders(companySlug, invoiceId) {
    const parts = [];
    if (companySlug) parts.push(`companySlug=${encodeURIComponent(companySlug)}`);
    if (invoiceId != null) parts.push(`invoiceId=${encodeURIComponent(invoiceId)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    return request("GET", `/reminders${qs}`);
  },

  async logReminder(data) {
    return request("POST", "/reminders", {
      invoiceId: Number(data.invoiceId) || null,
      clientPhone: data.clientPhone || null,
      clientName: data.clientName || null,
      companySlug: data.companySlug || null, // r9: pass through (statement logs have no invoice to derive it from)
      channel: data.channel || "whatsapp",
      message: data.message || null,
      amount: data.amount != null ? Number(data.amount) : null,
    });
  },

  // ── Server-side company settings (r9: sync pay-link template & credit limits across devices) ──
  async getSettings(companySlug, keys) {
    if (!companySlug || !keys || !keys.length) return {};
    const qs = `?companySlug=${encodeURIComponent(companySlug)}&keys=${keys.map(encodeURIComponent).join(",")}`;
    const data = await request("GET", `/settings${qs}`);
    return (data && data.settings) || {};
  },

  async saveSetting(companySlug, key, value) {
    if (!companySlug) return null;
    return request("PUT", "/settings", { companySlug, key, value });
  },
};
