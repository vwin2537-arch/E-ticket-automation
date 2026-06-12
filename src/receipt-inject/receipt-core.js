// receipt-core.js — ตรรกะล้วน (ดึงข้อมูล + สร้าง HTML ใบเสร็จ)
// ใช้ร่วมกันทั้งใน content script (เบราว์เซอร์) และสคริปต์ทดสอบ (node + jsdom)
(function (root) {
  "use strict";

  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  function getTicketNo(loc) {
    const m = (loc.pathname || "").match(/ticketDetail\/(\d+)/);
    return m ? m[1] : "";
  }

  function getSummary(doc) {
    const valueOf = (iconClass) => {
      const icon = doc.querySelector("." + iconClass);
      const box = icon && icon.closest('[class*="bg-gray-bg-text-color"]');
      if (!box) return "";
      const ps = box.querySelectorAll("p");
      return ps.length ? txt(ps[ps.length - 1]) : "";
    };
    return {
      persons: valueOf("mdi-account-multiple"),
      vehicle: valueOf("mdi-car"),
    };
  }

  // ดึง QR ทุกจุด — scope #my-node ก่อน แล้ว dedupe กันซ้ำ
  function getQRBlocks(doc) {
    const scope = doc.querySelector("#my-node") || doc;
    const imgs = [...scope.querySelectorAll('img[src^="data:image"]')];
    const seen = new Set();
    const blocks = [];

    for (const img of imgs) {
      const qrBox = img.closest("div.flex.flex-col.items-center.justify-center");
      if (!qrBox) continue;
      const marker = qrBox.querySelector(".mdi-map-marker");
      if (!marker) continue;
      if (seen.has(img.src)) continue;
      seen.add(img.src);

      const location = txt(marker.parentElement);
      const infoBox = qrBox.previousElementSibling;
      let park = "",
        date = "",
        time = "";
      if (infoBox) {
        park = txt(infoBox.querySelector("p.text-sm"));
        const greens = infoBox.querySelectorAll(".text-green-color");
        date = txt(greens[0]);
        time = txt(greens[1]);
      }
      blocks.push({ qr: img.src, location, park, date, time });
    }
    return blocks;
  }

  // ดึงกล่อง "สรุปค่าบริการ" บนหน้าตั๋ว — แยกประเภท + จำนวน + ราคา + ยอดรวม (กันไกด์โกงหัวคน/รถ)
  // โครง: h3"สรุปค่าบริการ" → กล่อง .bg-white → หัวกลุ่ม(ผู้เดินทาง/พาหนะ) + .ml-6 รายการย่อย + h2"ค่าบริการทั้งหมด"
  function getOrder(doc) {
    const head = [...doc.querySelectorAll("h3")].find((h) => txt(h) === "สรุปค่าบริการ");
    const box = head && head.closest(".mt-4") && head.closest(".mt-4").querySelector(".bg-white");
    if (!box) return null;

    const order = { groups: [], discount: "", total: "" };
    let cur = null;
    for (const el of box.children) {
      const ps = el.querySelectorAll(":scope > p");
      // หัวกลุ่ม เช่น <p>ผู้เดินทาง</p><p>2 คน</p>
      if (el.matches(".flex.justify-between") && ps.length === 2 && /คน|คัน/.test(txt(ps[1]))) {
        cur = { label: txt(ps[0]), count: txt(ps[1]), items: [] };
        order.groups.push(cur);
        continue;
      }
      // รายการย่อยในกลุ่ม: ชื่อ(p.w-52) + จำนวน(span เช่น x2) + ราคา(p ลูกตรงของแถว)
      if (el.classList.contains("ml-6") && cur) {
        el.querySelectorAll(".flex.justify-between").forEach((row) => {
          const name = txt(row.querySelector("p.w-52")) || txt(row.querySelector(".items-center p"));
          const qty = txt(row.querySelector("span"));
          const priceEl = [...row.children].find((c) => c.tagName === "P");
          if (name) cur.items.push({ name, qty, price: txt(priceEl) });
        });
        continue;
      }
      const t = txt(el);
      if (/ส่วนลดค่าบริการ/.test(t)) {
        const h = el.querySelectorAll("h4");
        if (h.length >= 2) order.discount = txt(h[1]);
      } else if (/ค่าบริการทั้งหมด/.test(t)) {
        const h = el.querySelectorAll("h2");
        if (h.length >= 2) order.total = txt(h[1]);
      }
    }
    return order.groups.length ? order : null;
  }

  function collect(doc, loc) {
    return {
      ticketNo: getTicketNo(loc),
      summary: getSummary(doc),
      order: getOrder(doc),
      blocks: getQRBlocks(doc),
    };
  }

  function nowStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function buildReceiptHTML(data) {
    const park = (data.blocks[0] && data.blocks[0].park) || "อุทยานแห่งชาติ";
    const bookingDate = (data.blocks[0] && data.blocks[0].date) || "";

    const summaryLine = [
      data.summary.persons ? "ผู้เดินทาง " + esc(data.summary.persons) : "",
      data.summary.vehicle ? "ยานพาหนะ " + esc(data.summary.vehicle) : "",
    ]
      .filter(Boolean)
      .join("  •  ");

    // ตารางรายการสั่งซื้อ (จากกล่องสรุปค่าบริการของ DNP) — ให้ไกด์/นทท.ตรวจหัวคนที่จองมาครบไหม
    // โชว์รายการล้วน (ไม่แยกหัวกลุ่ม ผู้เดินทาง/พาหนะ) + ยอดรวม. ถ้า scrape ไม่ได้ → fallback บรรทัดสรุปเดิม
    const order = data.order;
    const orderItems = order ? order.groups.flatMap((g) => g.items) : [];
    const orderBlock = order
      ? `<hr class="solid">
  <div class="osec">
    <div class="onote">สรุปค่าบริการ</div>
    ${orderItems
      .map(
        (it) =>
          `<div class="orow oitem"><span class="oname">${esc(it.name)}</span><span class="oqty">${esc(it.qty)}</span><span class="oprice">${esc(it.price.replace(/\s*บาท\s*/, ""))}</span></div>`
      )
      .join("\n    ")}
    ${order.discount && !/^0\s*บาท$/.test(order.discount) ? `<div class="orow"><span>ส่วนลด</span><span>${esc(order.discount)}</span></div>` : ""}
    <div class="orow ototal"><span>รวมทั้งหมด</span><span>${esc(order.total || "")}</span></div>
  </div>`
      : summaryLine
      ? `<div class="meta">${summaryLine}</div>`
      : "";

    const points = data.blocks
      .map(
        (b, i) => `
      <div class="point">
        <div class="ptitle">จุดที่ ${i + 1}: ${esc(b.location || "-")}</div>
        <img class="qr" src="${b.qr}" alt="QR">
        ${b.time ? `<div class="ptime">เวลา ${esc(b.time)}</div>` : ""}
      </div>`
      )
      .join('<hr class="dash">');

    const headLine = [data.ticketNo ? "เลขที่ " + esc(data.ticketNo) : "", esc(bookingDate)]
      .filter(Boolean)
      .join("  •  ");

    // ขนาดกระดาษ: อ่านจาก window.__DNP_RECEIPT_WIDTH (autofill ฉีดตามที่เลือกตอนเปิดระบบ) — default 80mm
    const W = (typeof window !== "undefined" && Number(window.__DNP_RECEIPT_WIDTH)) || 80;
    const P = W === 57
      ? { page: "57mm", pad: "2mm 3mm 4mm", base: 13, park: 16, sub: 11, meta: 12, ptitle: 14, qr: "38mm", ptime: 12, foot: 10 }
      : { page: "80mm", pad: "3mm 4mm 5mm", base: 16, park: 20, sub: 13, meta: 14, ptitle: 17, qr: "42mm", ptime: 14, foot: 12 };
    return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<style>
  /* กระดาษ ${P.page} (thermal) — Tahoma ฟอนต์หลัก เส้นหนากว่า Sarabun พิมพ์ติดคมบน 180dpi
     ทุกอย่างตัวหนา + ขนาดใหญ่ขึ้น เพราะเส้นบางจะหายตอนพิมพ์ */
  @page { size: ${P.page} auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${P.page}; background: #fff; }
  body {
    font-family: "Tahoma", "TH Sarabun New", "Sarabun", sans-serif;
    font-size: ${P.base}px; line-height: 1.3; color: #000; font-weight: 400;
    padding: ${P.pad};
  }
  .park { font-size: ${P.park}px; font-weight: 700; text-align: center; line-height: 1.2; }
  .sub { font-size: ${P.sub}px; font-weight: 400; text-align: center; }
  .meta { font-size: ${P.meta}px; font-weight: 400; text-align: center; margin-top: 0.8mm; }
  hr.solid { border: none; border-top: 2px solid #000; margin: 2mm 0; }
  hr.dash { border: none; border-top: 2px dashed #000; margin: 2mm 0; }
  .point { text-align: center; padding: 1mm 0; }
  .ptitle { font-size: ${P.ptitle}px; font-weight: 700; margin-bottom: 1mm; }
  .qr { width: ${P.qr}; height: ${P.qr}; display: block; margin: 0 auto; image-rendering: pixelated; }
  .ptime { font-size: ${P.ptime}px; font-weight: 700; margin-top: 1mm; }
  .foot { font-size: ${P.foot}px; font-weight: 400; text-align: center; margin-top: 2mm; }
  .osec { font-size: ${P.meta}px; }
  .onote { font-size: ${P.ptitle}px; font-weight: 700; margin-bottom: 1.2mm; }
  .orow { display: flex; justify-content: space-between; align-items: baseline; margin: 0.5mm 0; }
  .oitem { padding-left: 1mm; }
  .oitem .oname { flex: 1; padding-right: 1mm; }
  .oitem .oqty { width: 8mm; text-align: right; font-weight: 700; }
  .oitem .oprice { width: 13mm; text-align: right; }
  .ototal { font-weight: 700; font-size: ${P.ptitle}px; margin-top: 1mm; border-top: 1px solid #000; padding-top: 0.8mm; }
</style></head>
<body>
  <div class="park">${esc(park)}</div>
  <div class="sub">บัตรเข้าอุทยาน • e-Ticket</div>
  ${headLine ? `<div class="meta">${headLine}</div>` : ""}
  ${orderBlock}
  <hr class="solid">
  ${points || '<div style="text-align:center">ไม่พบ QR ในหน้านี้</div>'}
  <hr class="solid">
  <div class="foot">โปรดตรวจสอบความถูกต้อง และแสดง QR ต่อเจ้าหน้าที่ด่านตรวจ</div>
  <div class="foot">พิมพ์ ${nowStamp()}</div>
</body></html>`;
  }

  // ใบทดสอบเครื่องปริ้น (กดตอนเปิดด่าน เช็คว่าเครื่องพร้อม) — สั้น ประหยัดกระดาษ
  function buildTestHTML() {
    const W = (typeof window !== "undefined" && Number(window.__DNP_RECEIPT_WIDTH)) || 80;
    const P = W === 57
      ? { page: "57mm", pad: "2mm 3mm 4mm", base: 13, big: 16, ok: 20, small: 12 }
      : { page: "80mm", pad: "3mm 4mm 5mm", base: 16, big: 20, ok: 24, small: 14 };
    return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<style>
  @page { size: ${P.page} auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${P.page}; background: #fff; }
  body {
    font-family: "Tahoma", "TH Sarabun New", "Sarabun", sans-serif;
    font-size: ${P.base}px; line-height: 1.3; color: #000; font-weight: 400;
    padding: ${P.pad}; text-align: center;
  }
  .big { font-size: ${P.big}px; font-weight: 700; }
  .ok { font-size: ${P.ok}px; font-weight: 700; margin: 3mm 0; }
  .small { font-size: ${P.small}px; font-weight: 400; }
  hr { border: none; border-top: 2px dashed #000; margin: 3mm 0; }
</style></head>
<body>
  <div class="big">อุทยานแห่งชาติเอราวัณ</div>
  <div class="small">ทดสอบเครื่องปริ้น</div>
  <hr>
  <div class="ok">✓ พร้อมใช้งาน</div>
  <div class="small">ถ้าเห็นใบนี้ = เครื่องปริ้นเชื่อมต่อปกติ</div>
  <hr>
  <div class="small">${nowStamp()}</div>
</body></html>`;
  }

  const api = { collect, buildReceiptHTML, buildTestHTML, getQRBlocks, getSummary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DNPReceipt = api;
})(typeof window !== "undefined" ? window : globalThis);
