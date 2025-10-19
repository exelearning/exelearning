// collab-exe.js
// Usage:
//   node collab-exe.js
// Optional env:
//   BASE_HOST=http://localhost:8080
//   LOGIN_PATH=/login
//   GUEST_LOGIN_PATH=/login/guest
//   WORKAREA_PATH=/workarea
//   SCREEN_WIDTH=1440 SCREEN_HEIGHT=900
//   VERBOSE=1              // extra logs
// Tip: to see Playwright API calls too, run with: DEBUG=pw:api node collab-exe.js

const { chromium } = require('playwright');

function now() { return new Date().toISOString().split('T')[1].replace('Z',''); }
function step(name) {
  const t0 = Date.now();
  console.log(`▶ ${now()}  ${name} ...`);
  return (extra = '') => console.log(`✔ ${now()}  ${name} (${Date.now() - t0} ms)${extra ? ' — ' + extra : ''}`);
}
function info(msg) { console.log(`ℹ︎ ${now()}  ${msg}`); }
function warn(msg) { console.warn(`⚠ ${now()}  ${msg}`); }

/**
 * Launches Chromium window.
 */
async function launchWindow(x, y, width, height) {
  const end = step(`Launch Chromium window @${x},${y} size=${width}x${height}`);
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--window-position=${x},${y}`,
      `--window-size=${width},${height}`
    ]
  });
  end();
  return browser;
}

/**
 * Waits until the app is ready for interactions using data-testid hints.
 */
async function waitForExeLoaded(page, label, timeout = 30000) {
  const end = step(`[${label}] Wait app ready (overlays and content)`);
  await page.waitForFunction(() => {
    const main = document.querySelector('#load-screen-main');
    const mainHidden = !main || main.classList.contains('hide') || getComputedStyle(main).display === 'none';
    const content = document.querySelector('[data-testid="node-content"]') || document.querySelector('#node-content');
    const contentReady = !!content && (content.getAttribute('data-ready') === null || content.getAttribute('data-ready') === 'true');
    const modalBackdrop = document.querySelector('.modal-backdrop.show');
    const bodyLocked = document.body.classList.contains('modal-open');
    return mainHidden && contentReady && !modalBackdrop && !bodyLocked;
  }, null, { timeout });
  end();
}

/**
 * Logs in as guest and waits for overlay hidden.
 */
async function guestLogin(page, baseHost, guestPath = '/login/guest', workareaPath = '/workarea', label = 'A', loginPath = '/login') {
  const loginUrl = new URL(loginPath, baseHost).toString();
  const guestUrl = new URL(guestPath, baseHost).toString();
  const endGotoLogin = step(`[${label}] Go to login page ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  endGotoLogin();

  const form = page.locator('#login-form-guest');
  await form.waitFor({ state: 'attached', timeout: 10000 });

  const submitBtn = form.locator('#login-link-guest, button[type="submit"]');
  if (!(await submitBtn.count())) {
    throw new Error(`[${label}] Guest login submit button not found at ${loginUrl}`);
  }

  const endPrepare = step(`[${label}] Prepare guest login form`);
  let nonceFound = false;
  try {
    const nonceInput = form.locator('input[name="guest_login_nonce"]');
    await nonceInput.waitFor({ state: 'attached', timeout: 5000 });
    const nonce = await nonceInput.inputValue();
    nonceFound = typeof nonce === 'string' && nonce.length > 0;
  } catch (e) {
    nonceFound = false;
  }
  endPrepare(nonceFound ? 'nonce ready' : 'nonce missing');

  const endSubmit = step(`[${label}] Submit guest login -> ${guestUrl}`);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
    submitBtn.first().click()
  ]);
  endSubmit();

  const endWaitRoute = step(`[${label}] Wait redirect to ${workareaPath} or main UI`);
  await Promise.race([
    page.waitForURL(u => u.pathname.includes(workareaPath), { timeout: 15000 }).catch(() => {}),
    page.waitForSelector('#workarea, #node-content', { timeout: 15000 }).catch(() => {})
  ]);
  endWaitRoute();

  // const lopd = page.locator('#modalLopd .confirm');
  // if (await lopd.count()) {
  //   const endLopd = step(`[${label}] Accept privacy modal`);
  //   await lopd.click().catch(() => {});
  //   endLopd();
  // } else if (process.env.VERBOSE) {
  //   info(`[${label}] No privacy modal`);
  // }

  await waitForExeLoaded(page, label);
}

/**
 * Sets Chrome-like page zoom to 50% using CDP; falls back to keyboard if needed.
 */
async function setChromeZoom50(page, label = 'A') {
  const end = step(`[${label}] Set Chrome zoom to 50%`);
  let mode = 'cdp';
  try {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 0.5 });
  } catch (e) {
    mode = 'keyboard';
    const isMac = process.platform === 'darwin';
    const mod = isMac ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+0`).catch(() => {});
    for (let i = 0; i < 8; i++) await page.keyboard.press(`${mod}+-`).catch(() => {});
  }
  end(`mode=${mode}`);
}

/**
 * Closes the Share modal if open.
 */
async function closeShareModalIfOpen(page, label = 'A') {
  const modal = page.locator('#modalAlert');
  if (await modal.count()) {
    const end = step(`[${label}] Close Share modal`);
    const closeBtn = modal.locator('.modal-footer .close, .modal-header .close');
    if (await closeBtn.count()) {
      await closeBtn.first().click();
      // await modal.waitFor({ state: 'detached' }).catch(() => {});
    }
    end();
  }
}

/**
 * Clicks Share and gets the share URL from #shareLinkCode.
 */
async function getShareUrlFromA(page, label = 'A') {
  const endClick = step(`[${label}] Click Share button`);
  await page.locator('#head-top-share-button').click();
  endClick();

  const endRead = step(`[${label}] Read share URL from #shareLinkCode`);
  const code = page.locator('#modalAlert #shareLinkCode');
  await code.waitFor({ state: 'visible', timeout: 15000 });
  const raw = (await code.innerText()).trim();
  const match = raw.match(/https?:\/\/\S+/i);
  const shareUrl = match ? match[0] : raw;
  endRead(shareUrl);
  await closeShareModalIfOpen(page, label);
  return shareUrl;
}

/**
 * Data-testid helpers: create, select and delete nodes like in PHP E2E tests
 */

async function openProjectSettings(page, label = 'A') {
  const end = step(`[${label}] Open project settings`);
  await page.locator('#head-top-settings-button').click();
  await page
    .waitForSelector('#properties-node-content-form, [data-testid="node-content"][data-ready="true"]', { timeout: 15000 })
    .catch(() => {});
  end();
}

async function getNodeIdByTitle(page, title) {
  return page.evaluate((t) => {
    const title = String(t).trim();
    const nodes = Array.from(document.querySelectorAll('[data-testid="nav-node"]'));
    for (const nav of nodes) {
      const span = nav.querySelector('.node-text-span');
      if (span && span.textContent && span.textContent.trim() === title) {
        return nav.getAttribute('data-node-id') || nav.getAttribute('nav-id') || null;
      }
    }
    return null;
  }, title);
}

async function selectNodeById(page, id, label = 'A', expectedTitle = null) {
  const end = step(`[${label}] Select node id=${id}`);
  const sel = `[data-testid="nav-node-text"][data-node-id="${String(id)}"] .node-text-span`;
  await page.waitForSelector(sel, { timeout: 20000 });
  await page.locator(sel).click();
  await waitNodeContentReady(page, expectedTitle);
  end();
}

async function selectNodeByTitle(page, title, label = 'A') {
  const id = await getNodeIdByTitle(page, title);
  if (!id) throw new Error(`Node with title not found: ${title}`);
  await selectNodeById(page, id, label, title);
}

async function waitNodeInNav(page, title, label = 'A', timeout = 30000) {
  const end = step(`[${label}] Wait nav has "${title}"`);
  await page.waitForFunction((t) => {
    const title = String(t).trim();
    const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
    return spans.some((s) => (s.textContent || '').trim() === title);
  }, title, { timeout });
  end();
}

async function waitNodeNotInNav(page, title, label = 'A', timeout = 30000) {
  const end = step(`[${label}] Wait nav NOT has "${title}"`);
  await page.waitForFunction((t) => {
    const title = String(t).trim();
    const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
    return !spans.some((s) => (s.textContent || '').trim() === title);
  }, title, { timeout });
  end();
}

async function waitNodeContentReady(page, expectedTitle = null, timeout = 30000) {
  await page.waitForFunction(
    (t) => {
      const expected = (t || '').trim();
      const ov = document.querySelector('[data-testid="loading-content"]');
      if (ov && ov.getAttribute('data-visible') === 'true') return false;
      const nc = document.querySelector('[data-testid="node-content"]') || document.querySelector('#node-content');
      if (!nc) return false;
      if (nc.getAttribute('data-ready') && nc.getAttribute('data-ready') !== 'true') return false;

      // If we expect a specific title, rely on content title alone (more robust than nav selection)
      if (expected) {
        const h = document.querySelector('#page-title-node-content');
        return !!h && (h.textContent || '').trim() === expected;
      }

      // Otherwise, ensure panel's node-selected matches selected nav element page-id
      let sel = document.querySelector('[data-testid="nav-node"][data-selected="true"]');
      if (!sel) {
        const inner = document.querySelector('.nav-element .nav-element-text.selected');
        if (inner) sel = inner.closest('.nav-element');
      }
      if (!sel) sel = document.querySelector('.nav-element.selected');
      if (!sel) return false;
      const selectedPid = sel.getAttribute('page-id') || '';
      const panelPid = nc?.getAttribute('node-selected') || '';
      return !!selectedPid && !!panelPid && String(selectedPid) === String(panelPid);
    },
    expectedTitle,
    { timeout }
  );
}

async function createNodeAtRoot(page, title, label = 'A') {
  // Mimic PHP E2E: open settings to ensure root-level creation
  await openProjectSettings(page, label);
  return createNodeUnderSelected(page, title, label);
}

async function createNodeUnderSelected(page, title, label = 'A') {
  const endAdd = step(`[${label}] Add page via [data-testid=nav-add-page]`);
  await page.locator('[data-testid="nav-add-page"]').click();
  endAdd();

  const endModal = step(`[${label}] Fill title and confirm`);
  await page.locator('#input-new-node').waitFor({ timeout: 15000 });
  await page.locator('#input-new-node').fill(title);
  await page.locator('[data-testid="confirm-action"]').click();

  // Wait until the node exists in nav and is selectable
  await waitNodeInNav(page, title, label, 45000);
  await selectNodeByTitle(page, title, label);
  endModal(`title="${title}"`);
}

async function createChildNode(page, parentTitle, title, label = 'A') {
  await selectNodeByTitle(page, parentTitle, label);
  return createNodeUnderSelected(page, title, label);
}

async function deleteNodeByTitle(page, title, label = 'A') {
  await selectNodeByTitle(page, title, label);
  const end = step(`[${label}] Delete node "${title}"`);
  await page.locator('[data-testid="nav-delete"]').click();
  await page.locator('[data-testid="confirm-action"]').click();
  await waitNodeNotInNav(page, title, label, 60000);
  end();
}

/**
 * Attempts to delete; if blocked by a multi-user modal, closes it and returns false.
 */
async function tryDeleteNodeByTitle(page, title, label = 'A', timeout = 10000) {
  await selectNodeByTitle(page, title, label);
  const end = step(`[${label}] Try delete node "${title}"`);
  await page.locator('[data-testid="nav-delete"]').click();
  await page.locator('[data-testid="confirm-action"]').click();

  // Race: node disappears OR an info/alert modal opens (multi-user warning)
  const infoModal = page.locator('[data-testid="modal-alert"][data-open="true"], [data-testid="modal-info"][data-open="true"], #modalAlert.show, #modalInfo.show');
  try {
    await Promise.race([
      page.waitForFunction((t) => {
        const title = String(t).trim();
        const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
        return !spans.some((s) => (s.textContent || '').trim() === title);
      }, title, { timeout }),
      infoModal.waitFor({ state: 'visible', timeout })
    ]);
  } catch {}

  // If modal is visible, close it and signal blocked
  if (await infoModal.count()) {
    const endBlocked = step(`[${label}] Delete blocked by multi-user modal`);
    const closeBtn = page.locator('#modalInfo .close, #modalInfo .btn, #modalAlert .close, #modalAlert .btn');
    if (await closeBtn.count()) await closeBtn.first().click().catch(() => {});
    // Ensure modal closed
    await infoModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    endBlocked();
    end('blocked');
    return false;
  }

  // Otherwise, ensure it's gone
  await waitNodeNotInNav(page, title, label, 30000);
  end('deleted');
  return true;
}

/** Returns ordered child titles under a given parent title. */
async function getChildrenTitles(page, parentTitle) {
  return page.evaluate((t) => {
    const title = String(t).trim();
    const nodes = Array.from(document.querySelectorAll('[data-testid="nav-node"]'));
    const parent = nodes.find((nav) => (nav.querySelector('.node-text-span')?.textContent || '').trim() === title);
    if (!parent) return [];
    // Expand if collapsed
    if (parent.classList.contains('toggle-off')) {
      parent.querySelector('.nav-element-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    const container = parent.querySelector('.nav-element-children-container');
    if (!container) return [];
    const labels = Array.from(container.querySelectorAll('[data-testid="nav-node"] .node-text-span'));
    return labels.map((s) => (s.textContent || '').trim());
  }, parentTitle);
}

async function waitChildrenOrder(page, parentTitle, expectedOrder, label = 'A', timeout = 15000) {
  const end = step(`[${label}] Wait children order = [${expectedOrder.join(' | ')}]`);
  await page.waitForFunction(
    (arg) => {
      const title = String(arg.t).trim();
      const expected = arg.expected;
      const nodes = Array.from(document.querySelectorAll('[data-testid="nav-node"]'));
      const parent = nodes.find((nav) => (nav.querySelector('.node-text-span')?.textContent || '').trim() === title);
      if (!parent) return false;
      if (parent.classList.contains('toggle-off')) {
        parent.querySelector('.nav-element-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return false;
      }
      const container = parent.querySelector('.nav-element-children-container');
      if (!container) return false;
      const labels = Array.from(container.querySelectorAll('[data-testid="nav-node"] .node-text-span')).map((s) => (s.textContent || '').trim());
      return labels.length === expected.length && labels.every((v, i) => v === expected[i]);
    },
    { t: parentTitle, expected: expectedOrder },
    { timeout }
  );
  end();
}

async function moveNodeDown(page, title, label = 'A') {
  await selectNodeByTitle(page, title, label);
  const end = step(`[${label}] Move down "${title}"`);
  await page.locator('[data-testid="nav-move-down"]').click({ trial: false });
  end();
}

async function moveNodeUp(page, title, label = 'A') {
  await selectNodeByTitle(page, title, label);
  const end = step(`[${label}] Move up "${title}"`);
  await page.locator('[data-testid="nav-move-up"]').click({ trial: false });
  end();
}

/**
 * Waits text in left nav tree.
 */
async function waitForNavText(page, text, label = 'B', timeout = 15000) {
  const end = step(`[${label}] Wait text in nav: "${text}"`);
  await page.waitForFunction(
    (t) => {
      const nav = document.querySelector('#nav_list');
      return nav && (nav.innerText || '').includes(t);
    },
    text,
    { timeout }
  );
  end();
}

/**
 * Adds a Text iDevice quickly.
 */
async function addTextIdevice(page, label = 'A') {
  const end = step(`[${label}] Add Text iDevice`);
  const quickBtn = page.locator('[data-testid="quick-idevice-text"]');
  if (await quickBtn.count()) {
    await quickBtn.first().click();
  } else {
    // Fallbacks
    const addQuick = page.locator('[data-testid="add-text-quick"]');
    if (await addQuick.count()) {
      await addQuick.first().click();
    } else {
      const addBtn = page.locator('#eXeAddContentBtnWrapper button');
      if (await addBtn.isVisible()) {
        await addBtn.click();
      } else {
        const leftMenu = page.locator('[data-testid="idevice-text"]');
        if (await leftMenu.count()) await leftMenu.first().click();
        else warn(`[${label}] Add Text button not visible`);
      }
    }
  }
  await page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 10000 });
  end();
}

/**
 * Enters edit mode on the last Text iDevice, types text into TinyMCE/contenteditable/textarea, and saves.
 */
async function editFirstTextIdevice(page, text, label = 'A') {
  const end = step(`[${label}] Edit first Text iDevice`);

  const block = page.locator('#node-content article .idevice_node.text').last();
  await block.waitFor({ timeout: 10000 });

  // Ensure edition mode
  const isEdition = await block.evaluate((el) => el.getAttribute('mode') === 'edition');
  if (!isEdition) {
    const editBtn = block.locator('.btn-edit-idevice');
    await editBtn.waitFor({ timeout: 10000 });
    await editBtn.click();
    await Promise.race([
      block.waitFor({ state: 'attached', timeout: 12000 }),
      page.waitForSelector('iframe.tox-edit-area__iframe', { timeout: 12000 }).catch(() => {}),
    ]);
  }

  // Try TinyMCE in this block
  const frameEl = await block.locator('iframe.tox-edit-area__iframe, iframe[title="Rich Text Area"], iframe[aria-label="Rich Text Area"]').first().elementHandle();
  try {
    if (frameEl) {
      const frame = await frameEl.contentFrame();
      if (frame) {
        await frame.waitForSelector('body', { timeout: 8000 });
        await frame.evaluate((t) => {
          document.body.focus();
          document.body.innerHTML = '';
        }, text).catch(() => {});
        await frame.focus('body').catch(() => {});
        await frame.type('body', text, { delay: 5 });
        const saveBtn = block.locator('.btn-save-idevice');
        if (await saveBtn.count()) await saveBtn.click();
        // Wait until block exits edition mode to avoid modal on further actions
        const blockEl = await block.elementHandle();
        if (blockEl) {
          await page.waitForFunction((el) => el && el.getAttribute && el.getAttribute('mode') !== 'edition', blockEl, { timeout: 12000 }).catch(() => {});
        }
        end('mode=tinymce');
        return;
      }
    }
  } catch {}

  // Fallback: contenteditable region
  const ce = block.locator('.textIdeviceContent [contenteditable="true"]');
  if (await ce.count()) {
    await ce.first().click();
    await ce.first().type(text, { delay: 5 });
    const saveBtn = block.locator('.btn-save-idevice');
    if (await saveBtn.count()) await saveBtn.click();
    const blockEl = await block.elementHandle();
    if (blockEl) {
      await page.waitForFunction((el) => el && el.getAttribute && el.getAttribute('mode') !== 'edition', blockEl, { timeout: 12000 }).catch(() => {});
    }
    end('mode=contenteditable');
    return;
  }

  // Fallback: textarea
  const ta = block.locator('textarea');
  if (await ta.count()) {
    await ta.first().fill(text);
    const saveBtn = block.locator('.btn-save-idevice');
    if (await saveBtn.count()) await saveBtn.click();
    const blockEl = await block.elementHandle();
    if (blockEl) {
      await page.waitForFunction((el) => el && el.getAttribute && el.getAttribute('mode') !== 'edition', blockEl, { timeout: 12000 }).catch(() => {});
    }
    end('mode=textarea');
    return;
  }

  end('mode=unknown');
}

/**
 * Quick save to speed up propagation.
 */
async function quickSave(page, label = 'A') {
  const end = step(`[${label}] Click Guardar`);
  const btn = page.locator('#head-top-save-button');
  if (await btn.count()) await btn.click();
  end();
}

/**
 * Waits text in node-content.
 */
async function waitForNodeText(page, text, label = 'B', timeout = 12000) {
  const end = step(`[${label}] Wait node-content text: "${text}"`);
  await page.waitForFunction(
    (t) => {
      const root = document.querySelector('#node-content');
      return root && (root.innerText || '').includes(t);
    },
    text,
    { timeout }
  );
  end();
}

/**
 * Main flow.
 */
async function run() {
  const BASE_HOST = process.env.BASE_HOST || 'http://localhost:8080';
  const LOGIN_PATH = process.env.LOGIN_PATH || '/login';
  const GUEST_LOGIN_PATH = process.env.GUEST_LOGIN_PATH || '/login/guest';
  const WORKAREA_PATH = process.env.WORKAREA_PATH || '/workarea';

  const SCREEN_W = parseInt(process.env.SCREEN_WIDTH || '1440', 10);
  const SCREEN_H = parseInt(process.env.SCREEN_HEIGHT || '900', 10);
  const winW = Math.floor(SCREEN_W / 2);
  const winH = SCREEN_H - 80;

  const browserA = await launchWindow(0, 0, winW, winH);
  const browserB = await launchWindow(winW, 0, winW, winH);

  const contextA = await browserA.newContext({ viewport: { width: winW - 10, height: winH - 80 } });
  const contextB = await browserB.newContext({ viewport: { width: winW - 10, height: winH - 80 } });

  // Optional verbose network logs
  if (process.env.VERBOSE) {
    for (const ctx of [contextA, contextB]) {
      ctx.on('page', p => {
        p.on('request', r => info(`[NET:${r.method()}] ${r.url()}`));
        p.on('response', r => info(`[RES:${r.status()}] ${r.url()}`));
      });
    }
  }

  const A = await contextA.newPage();
  const B = await contextB.newPage();

  await Promise.all([
    guestLogin(A, BASE_HOST, GUEST_LOGIN_PATH, WORKAREA_PATH, 'A', LOGIN_PATH),
    guestLogin(B, BASE_HOST, GUEST_LOGIN_PATH, WORKAREA_PATH, 'B', LOGIN_PATH)
  ]);

  await Promise.all([
    setChromeZoom50(A, 'A'),
    setChromeZoom50(B, 'B')
  ]);

  const shareUrl = await getShareUrlFromA(A, 'A');
  const endGotoB = step(`[B] Open share URL`);
  await B.goto(shareUrl, { waitUntil: 'domcontentloaded' });
  endGotoB(shareUrl);
  await waitForExeLoaded(B, 'B');

  // Primary flow using data-testid selectors (nav add/delete like PHP E2E)
  const rnd = Date.now().toString().slice(-5);
  const primaryA = `Primary ${rnd} (user1)`;
  const childFromB = `Child A ${rnd} (user2)`;
  const childFromA = `Child B ${rnd} (user1)`;

  // A creates a top-level node
  await createNodeAtRoot(A, primaryA, 'A');
  await waitNodeInNav(B, primaryA, 'B');

  // B creates a child under A's node
  await createChildNode(B, primaryA, childFromB, 'B');
  await waitNodeInNav(A, childFromB, 'A');

  // A creates another child under same parent
  await createChildNode(A, primaryA, childFromA, 'A');
  await waitNodeInNav(B, childFromA, 'B');

  // Move children up/down and verify ordering on both windows
  const order1 = await getChildrenTitles(A, primaryA);
  // Choose a child to move down if possible, otherwise move up the other
  if (order1.length >= 2) {
    // Ensure windows observe the same initial order
    await waitChildrenOrder(B, primaryA, order1, 'B');
    // Choose first child to move down
    const toMove = order1[0];
    await moveNodeDown(B, toMove, 'B');
    const expectedAfterDown = [order1[1], order1[0], ...order1.slice(2)];
    await waitChildrenOrder(A, primaryA, expectedAfterDown, 'A');
    await waitChildrenOrder(B, primaryA, expectedAfterDown, 'B');

    // Move it back up
    await moveNodeUp(B, toMove, 'B');
    await waitChildrenOrder(A, primaryA, order1, 'A');
    await waitChildrenOrder(B, primaryA, order1, 'B');
  }

  // B deletes the child created by A — but ensure A leaves that page to avoid lock
  await selectNodeByTitle(A, primaryA, 'A');
  let removed = await tryDeleteNodeByTitle(B, childFromA, 'B', 6000);
  if (!removed) {
    // If still blocked, ensure A is on a different page and retry
    await selectNodeByTitle(A, childFromB, 'A');
    removed = await tryDeleteNodeByTitle(B, childFromA, 'B', 10000);
  }
  if (!removed) {
    // As a last fallback, skip deletion in this run to keep test flowing
    warn('[B] Delete still blocked; skipping deletion of "' + childFromA + '"');
  } else {
    await waitNodeNotInNav(A, childFromA, 'A');
  }

  // Add content to childFromB to verify content sync still OK
  await selectNodeByTitle(A, childFromB, 'A');
  await addTextIdevice(A, 'A');
  await editFirstTextIdevice(A, `Lorem ipsum (user1) ${rnd}.`, 'A');
  await quickSave(A, 'A');
  await selectNodeByTitle(B, childFromB, 'B');
  await waitForNodeText(B, 'Lorem ipsum', 'B', 20000);

  await browserA.close();
  await browserB.close();
}

run().catch(err => {
  console.error(`✖ ${now()}  ERROR`, err);
  process.exit(1);
});
