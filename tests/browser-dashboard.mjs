import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<select id="dashboardMonthFilter"><option value="">Todos</option><option value="2026-10">Octubre</option></select><section id="graphicDashboardSection"></section>');
 await page.evaluate(()=>{
  window.fetch=async()=>({ok:true,json:async()=>({tasks:[{id:'1',status:'En proceso',createdAt:'2026-10-01',owner:'QA'}],cases:[]})});
  window.Chart=class { constructor(){window.chartCreates=(window.chartCreates||0)+1;} destroy(){} };
 });
 await page.addScriptTag({path:'src/enhancements.js'});
 await page.addScriptTag({path:'src/task-status.js'});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.waitForTimeout(250);
 const initial=await page.evaluate(()=>window.chartCreates);
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>window.chartCreates),initial,'dashboard must settle without a mutation loop');
 await page.locator('[data-dashboard-mode="tasks"]').click();
 assert.equal(await page.locator('[data-dashboard-panel="tasks"] .extended-kpi strong').nth(2).textContent(),'1');
 await page.selectOption('#dashboardMonthFilter','2026-10');
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#taskStatusDashboardChart').count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS: dashboard settles, tabs and month filter respond, task status survives rerender.');
} finally {await browser.close();}
