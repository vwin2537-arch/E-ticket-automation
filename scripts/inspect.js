// inspect.js — ส่องโครงสร้างฟอร์มจริง เพื่อเก็บ selector + ค่า dropdown
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FORM_URL = 'https://e-ticket.dnp.go.th/homePage/ticketDetail/493';
const STATE_PATH = path.join(__dirname, '..', 'auth', 'storageState.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  await page.goto(FORM_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // เช็คว่ายัง login อยู่ไหม
  const stillLoggedIn = await page.getByText('ออกจากระบบ').count().catch(() => 0);
  console.log('LOGIN_STATUS:', stillLoggedIn > 0 ? 'OK ยัง login อยู่' : '❌ หลุด login แล้ว');

  const data = await page.evaluate(() => {
    const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ');

    const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
      tag: 'input', type: el.type, placeholder: el.placeholder,
      name: el.name, id: el.id, class: el.className,
    }));

    const selects = Array.from(document.querySelectorAll('select')).map((el) => ({
      tag: 'select', name: el.name, id: el.id, class: el.className,
      options: Array.from(el.options).map((o) => ({ value: o.value, text: o.text.trim() })),
    }));

    // dropdown แบบ custom (combobox / ant / element-ui ฯลฯ)
    const combos = Array.from(document.querySelectorAll(
      '[role=combobox], [class*=select]:not(select), [class*=dropdown], [class*=Select]'
    )).slice(0, 30).map((el) => ({
      tag: el.tagName.toLowerCase(), role: el.getAttribute('role'),
      class: el.className, text: txt(el).slice(0, 60),
    }));

    const buttons = Array.from(document.querySelectorAll('button, [role=button]'))
      .map((el) => txt(el)).filter(Boolean);

    return { inputs, selects, combos, buttons };
  });

  console.log('\n===== INPUTS =====');
  console.log(JSON.stringify(data.inputs, null, 2));
  console.log('\n===== NATIVE SELECTS =====');
  console.log(JSON.stringify(data.selects, null, 2));
  console.log('\n===== CUSTOM DROPDOWNS (combobox/select-like) =====');
  console.log(JSON.stringify(data.combos, null, 2));
  console.log('\n===== BUTTONS =====');
  console.log(JSON.stringify(data.buttons, null, 2));

  // เก็บ HTML เต็มไว้เผื่อดูเอง
  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, '..', 'auth', 'form-snapshot.html'), html);
  console.log('\n💾 เก็บ HTML เต็มไว้ที่ auth/form-snapshot.html');

  await browser.close();
})();
