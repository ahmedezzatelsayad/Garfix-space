// Create test invoice files (Excel .xlsx + CSV) for E2E import testing
import * as XLSX from "xlsx";

// Test data: 3 invoices — one multi-item (AL-5001 with 2 rows), dd/mm/yyyy dates, Arabic headers
const rows = [
  ["رقم الفاتورة", "التاريخ", "اسم العميل", "رقم الهاتف", "العنوان", "اسم المنتج", "الوصف", "الكمية", "سعر الوحدة", "التوصيل", "المدفوع", "ملاحظات"],
  ["AL-5001", "05/09/2026", "شركة النور للتوريدات", "96591234567", "السالمية - الكويت", "كرسي مكتبي", "كرسي دوار أسود", 2, 45.5, 5, 96, "فاتورة اختبار متعددة البنود"],
  ["AL-5001", "05/09/2026", "شركة النور للتوريدات", "96591234567", "السالمية - الكويت", "مكتب خشبي", "مكتب 120سم", 1, 120, 0, 0, ""],
  ["AL-5002", "07/09/2026", "مؤسسة الفجر", "96598765432", "حولي - الكويت", "شاشة كمبيوتر", "شاشة 24 بوصة", 3, 85, 10, 100, "دفعة أولى"],
  ["AL-5003", "10/09/2026", "Ahmed Trading", "+96590123456", "Farwaniya", "Keyboard", "Mechanical RGB", 5, 18.75, 2.5, 0, "English row test"],
];

// Excel file
const ws = XLSX.utils.aoa_to_sheet(rows);
ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 28 }];
const wb = XLSX.utils.book_new();
wb.Workbook = { Views: [{ RTL: true }] };
XLSX.utils.book_append_sheet(wb, ws, "الفواتير");
XLSX.writeFile(wb, "/home/z/my-project/scripts/e2e-import-test.xlsx");
console.log("✓ xlsx written");

// CSV file (same data)
const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = rows.map(r => r.map(esc).join(",")).join("\r\n");
require("fs").writeFileSync("/home/z/my-project/scripts/e2e-import-test.csv", "\uFEFF" + csv, "utf8");
console.log("✓ csv written");

// Also test round-trip: read the xlsx back like the browser parser does
const back = XLSX.read(require("fs").readFileSync("/home/z/my-project/scripts/e2e-import-test.xlsx"), { type: "array" });
const aoa = XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]], { header: 1, defval: "", raw: false });
console.log("round-trip rows:", aoa.length, "| header[0]:", aoa[0][0], "| sample date:", aoa[1][1], "| sample price:", aoa[1][8]);
