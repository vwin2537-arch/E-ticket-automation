// content.js — ฝังปุ่มลอย + preview + สั่งปริ้น (ใช้ตรรกะจาก receipt-core.js)
(function () {
  "use strict";

  const BTN_ID = "dnp-receipt-btn";
  const TEST_ID = "dnp-test-btn";
  const MODAL_ID = "dnp-receipt-modal";
  const core = window.DNPReceipt;

  // ปริ้นเอกสารแบบเงียบผ่าน iframe ซ่อน (ใน Kiosk mode = ออกเลยไม่เด้ง dialog)
  function printHTML(html) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    f.onload = () => {
      const w = f.contentWindow;
      w.onafterprint = () => f.remove();
      w.focus();
      w.print();
      setTimeout(() => {
        if (document.body.contains(f)) f.remove();
      }, 5000);
    };
    document.body.appendChild(f);
    f.srcdoc = html;
  }

  function openPreview(data) {
    closeModal();
    const html = core.buildReceiptHTML(data);
    const found = data.blocks.length;

    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.innerHTML = `
      <div class="dnp-modal-card">
        <div class="dnp-modal-head">
          ตัวอย่างใบเข้าอุทยาน
          <span class="dnp-modal-count">พบ ${found} จุด/QR</span>
        </div>
        <div class="dnp-modal-body">
          <iframe id="dnp-receipt-frame"></iframe>
        </div>
        <div class="dnp-modal-foot">
          <button id="dnp-cancel" class="dnp-btn ghost">ยกเลิก</button>
          <button id="dnp-print" class="dnp-btn primary">🖨️ ปริ้น (Enter)</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#dnp-receipt-frame").srcdoc = html;

    const doPrint = () => {
      const w = overlay.querySelector("#dnp-receipt-frame").contentWindow;
      w.focus();
      w.print();
    };
    overlay.querySelector("#dnp-print").addEventListener("click", doPrint);
    overlay.querySelector("#dnp-cancel").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    const onKey = (e) => {
      if (e.key === "Enter") doPrint();
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    overlay._onKey = onKey;
  }

  function closeModal() {
    const m = document.getElementById(MODAL_ID);
    if (m) {
      if (m._onKey) document.removeEventListener("keydown", m._onKey);
      m.remove();
    }
  }

  function injectStyles() {
    if (document.getElementById("dnp-receipt-style")) return;
    const s = document.createElement("style");
    s.id = "dnp-receipt-style";
    s.textContent = `
      #${BTN_ID} {
        position: fixed; right: 18px; bottom: 18px; z-index: 2147483646;
        background: #1f9d55; color: #fff; border: none; cursor: pointer;
        font-size: 14px; font-family: inherit; font-weight: 600;
        padding: 10px 16px; border-radius: 24px;
        box-shadow: 0 3px 10px rgba(0,0,0,.3);
        display: flex; align-items: center; gap: 6px;
      }
      #${BTN_ID}:hover { background: #168f49; }
      #${TEST_ID} {
        position: fixed; right: 18px; bottom: 60px; z-index: 2147483646;
        background: #fff; color: #555; border: 1px solid #ccc; cursor: pointer;
        font-size: 12px; font-family: inherit;
        padding: 5px 12px; border-radius: 20px;
        box-shadow: 0 2px 6px rgba(0,0,0,.2);
      }
      #${TEST_ID}:hover { background: #f3f4f6; }
      #${MODAL_ID} {
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(0,0,0,.5);
        display: flex; align-items: center; justify-content: center;
        font-family: "Sarabun","Tahoma",sans-serif;
      }
      #${MODAL_ID} .dnp-modal-card {
        background: #fff; border-radius: 12px; width: 380px; max-width: 92vw;
        max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
      }
      #${MODAL_ID} .dnp-modal-head {
        padding: 12px 16px; font-weight: 700; font-size: 15px;
        border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
      }
      #${MODAL_ID} .dnp-modal-count { font-size: 12px; font-weight: 400; color: #1f9d55; }
      #${MODAL_ID} .dnp-modal-body { padding: 12px; background: #f3f4f6; overflow: auto; }
      #dnp-receipt-frame {
        width: 300px; height: 60vh; border: 1px solid #ddd; background: #fff;
        margin: 0 auto; display: block;
      }
      #${MODAL_ID} .dnp-modal-foot {
        padding: 12px 16px; display: flex; gap: 10px; justify-content: flex-end;
        border-top: 1px solid #eee;
      }
      #${MODAL_ID} .dnp-btn {
        padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 14px;
        font-family: inherit; border: none;
      }
      #${MODAL_ID} .dnp-btn.primary { background: #1f9d55; color: #fff; font-weight: 600; }
      #${MODAL_ID} .dnp-btn.ghost { background: #eee; color: #333; }
    `;
    document.documentElement.appendChild(s);
  }

  // เปิดใบปริ้น — ใช้ร่วมกันทั้งปุ่มและปุ่มลัด
  function triggerReceipt() {
    const data = core.collect(document, location);
    if (!data.blocks.length) {
      alert("ยังไม่พบ QR ในหน้านี้\nกรุณาเปิดหน้า 'ข้อมูลการจอง' ที่มี QR ก่อนแล้วลองอีกครั้ง");
      return;
    }
    openPreview(data);
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.innerHTML = "🖨️ ปริ้นบัตรเข้าอุทยาน";
    btn.title = "ปุ่มลัด: Ctrl+Shift+P (Mac: Cmd+Shift+P)";
    btn.addEventListener("click", triggerReceipt);
    document.body.appendChild(btn);
  }

  // ปุ่มทดสอบเครื่องปริ้น — กดตอนเปิดด่านเพื่อเช็คว่าเครื่องพร้อม
  function injectTestButton() {
    if (document.getElementById(TEST_ID)) return;
    const b = document.createElement("button");
    b.id = TEST_ID;
    b.innerHTML = "🧪 ทดสอบปริ้น";
    b.title = "ปริ้นใบทดสอบ 1 ใบ เพื่อเช็คว่าเครื่องปริ้นพร้อม (แนะนำกดตอนเปิดด่าน)";
    b.addEventListener("click", () => printHTML(core.buildTestHTML()));
    document.body.appendChild(b);
  }

  // ปุ่มลัด: Ctrl+Shift+P (Mac: Cmd+Shift+P) — ดักที่หน้าเว็บตรงๆ ทำงานชัวร์
  document.addEventListener(
    "keydown",
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "KeyP") {
        e.preventDefault();
        e.stopPropagation();
        triggerReceipt();
      }
    },
    true // capture: ดักก่อนหน้าเว็บ
  );

  function init() {
    injectStyles();
    injectButton();
    injectTestButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // SPA: คอยฉีดปุ่มกลับถ้าหน้าถูก re-render (injectStyles/Button เป็น idempotent)
  setInterval(init, 1500);
})();
