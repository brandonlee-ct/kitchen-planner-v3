// ── auto-design-wizard.js ────────────────────────────────────────────────────
// 4-step Auto-Design modal. Owns spec state + modal DOM only.
// NEVER touches scene / walls / placedItems — it talks to main.js through ctx:
//   ctx = {
//     runAutoDesign(spec, products) -> { walls, cabinets, warnings },
//     products: () => productsArray,
//     trackEvent(name, props),
//     onGenerate(spec, result)        // main.js builds the scene
//   }
// The modal shell lives in index.html (#auto-design-modal); the step bodies are
// rendered here. Element IDs in index.html are the contract.

// Wall count per archetype — mirrors buildArchetypeWalls() in auto-design-rules.js.
const ARCHETYPE_WALLS = { I: 1, II: 2, L: 2, C: 3, G: 4, custom: 0 };

const ARCHETYPES = [
  { id: 'I',  label: 'I — single wall' },
  { id: 'II', label: 'II — galley (2 walls)' },
  { id: 'L',  label: 'L — corner (2 walls)' },
  { id: 'C',  label: 'C / U — 3 walls' },
  { id: 'G',  label: 'G — U + peninsula' },
];

const APPLIANCES = [
  { id: 'sink',       label: '🚰 Sink' },
  { id: 'hob',        label: '🔥 Hob' },
  { id: 'dishwasher', label: '🧼 Dishwasher' },
  { id: 'fridge',     label: '🧊 Fridge' },
];

const MAX_STEP = 4;

let ctx = null;
let spec = null;
let step = 1;
let lastFocused = null;
let generating = false;   // true while a Generate is in flight, so the close that
                          // follows it isn't logged as a cancellation

// ── DOM refs (resolved in init) ────────────────────────────────────────────────
let elModal, elBody, elBack, elNext, elGenerate, elStepLabel, elClose, elBackdrop;

function defaultSpec() {
  const s = { archetype: 'L', widthMm: 3000, depthMm: 1200, wallAssignments: [] };
  rebuildAssignments(s);
  return s;
}

// Rebuild wallAssignments to match the archetype's wall count, preserving any
// existing per-wall data where the index still exists.
function rebuildAssignments(s) {
  const n = ARCHETYPE_WALLS[s.archetype] ?? 0;
  const prev = s.wallAssignments || [];
  s.wallAssignments = [];
  for (let i = 0; i < n; i++) {
    const old = prev[i];
    s.wallAssignments.push({
      wallIndex:  i,
      appliances: old?.appliances ? [...old.appliances] : [],
      hasFridge:  false,
      openings:   old?.openings ? old.openings.map(o => ({ ...o })) : [],
    });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function initAutoDesignWizard(context) {
  ctx = context;
  elModal     = document.getElementById('auto-design-modal');
  if (!elModal) return;   // null-safe: missing markup must not throw
  elBody      = document.getElementById('ad-step-body');
  elBack      = document.getElementById('ad-back');
  elNext      = document.getElementById('ad-next');
  elGenerate  = document.getElementById('ad-generate');
  elStepLabel = document.getElementById('ad-step-label');
  elClose     = document.getElementById('ad-close');
  elBackdrop  = document.getElementById('auto-design-backdrop');

  if (elBack)     elBack.addEventListener('click', goBack);
  if (elNext)     elNext.addEventListener('click', goNext);
  if (elGenerate) elGenerate.addEventListener('click', doGenerate);
  if (elClose)    elClose.addEventListener('click', closeAutoDesignWizard);
  if (elBackdrop) elBackdrop.addEventListener('click', closeAutoDesignWizard);

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeAutoDesignWizard(); }
    if (e.key === 'Tab')    trapFocus(e);
  });
}

export function openAutoDesignWizard(prefillSpec = null, startStep = 1) {
  if (!elModal) return;
  spec = prefillSpec ? normalisePrefill(prefillSpec) : defaultSpec();
  step = Math.min(Math.max(startStep, 1), MAX_STEP);
  lastFocused = document.activeElement;
  elModal.style.display = 'flex';
  document.body.classList.add('ad-modal-open');
  renderStep();
  ctx?.trackEvent?.('wizard_opened', { archetype: spec.archetype });
}

export function closeAutoDesignWizard() {
  if (!elModal) return;
  const wasOpen = isOpen();
  elModal.style.display = 'none';
  document.body.classList.remove('ad-modal-open');
  spec = null;
  step = 1;
  if (wasOpen && !generating) ctx?.trackEvent?.('wizard_cancelled', {});
  generating = false;
  if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (_) {} }
}

function isOpen() { return elModal && elModal.style.display !== 'none'; }

// Accept a partial prefill (e.g. from glide/regenerate) and fill the gaps.
function normalisePrefill(p) {
  const s = {
    archetype: p.archetype || 'L',
    widthMm:   p.widthMm   || 3000,
    depthMm:   p.depthMm   || 1200,
    wallAssignments: Array.isArray(p.wallAssignments) ? p.wallAssignments.map(a => ({
      wallIndex:  a.wallIndex,
      appliances: a.appliances ? [...a.appliances] : [],
      hasFridge:  !!a.hasFridge,
      openings:   a.openings ? a.openings.map(o => ({ ...o })) : [],
    })) : [],
  };
  if (s.wallAssignments.length === 0) rebuildAssignments(s);
  return s;
}

// ── Navigation ───────────────────────────────────────────────────────────────
function goNext() {
  if (step >= MAX_STEP) return;
  const from = step;
  step++;
  ctx?.trackEvent?.('wizard_step_advanced', { from, to: step });
  renderStep();
}

function goBack() {
  if (step <= 1) return;
  const from = step;
  step--;
  ctx?.trackEvent?.('wizard_step_back', { from, to: step });
  renderStep();
}

function doGenerate() {
  const products = ctx?.products?.() || [];
  if (products.length === 0) return;             // guarded by disabled button too
  const result = ctx.runAutoDesign(spec, products);
  if (hasBlockingError(result)) return;
  generating = true;   // suppress the cancellation event on the close that follows
  ctx.onGenerate(deepCloneSpec(spec), result);
  // main.js closes the wizard after a successful generate.
}

function deepCloneSpec(s) {
  return {
    archetype: s.archetype, widthMm: s.widthMm, depthMm: s.depthMm,
    wallAssignments: s.wallAssignments.map(a => ({
      wallIndex: a.wallIndex, appliances: [...a.appliances],
      hasFridge: a.hasFridge, openings: a.openings.map(o => ({ ...o })),
    })),
  };
}

function hasBlockingError(result) {
  return !!result?.warnings?.some(w => w.severity === 'error');
}

// ── Rendering ──────────────────────────────────────────────────────────────────
function renderStep() {
  if (!elBody) return;
  elStepLabel.textContent = `Step ${step} of ${MAX_STEP}`;
  elBack.style.visibility    = step === 1 ? 'hidden' : 'visible';
  elNext.style.display       = step < MAX_STEP ? 'inline-block' : 'none';
  elGenerate.style.display   = step === MAX_STEP ? 'inline-block' : 'none';

  if      (step === 1) renderStep1();
  else if (step === 2) renderStep2();
  else if (step === 3) renderStep3();
  else if (step === 4) renderStep4();

  // Move focus into the panel for keyboard users.
  const first = elBody.querySelector('button, input, select');
  if (first && first.focus) { try { first.focus(); } catch (_) {} }
}

function renderStep1() {
  const cards = ARCHETYPES.map(a => `
    <button type="button" class="ad-arch ${spec.archetype === a.id ? 'ad-sel' : ''}"
            data-arch="${a.id}">${a.label}</button>`).join('');
  elBody.innerHTML = `
    <h3 class="ad-h">Room shape &amp; size</h3>
    <div class="ad-arch-grid">${cards}</div>
    <div class="ad-row">
      <label class="ad-lbl">Width (mm)
        <input id="ad-width" class="ad-input" type="number" min="500" max="12000"
               step="50" value="${spec.widthMm}">
      </label>
      <label class="ad-lbl">Depth (mm)
        <input id="ad-depth" class="ad-input" type="number" min="500" max="12000"
               step="50" value="${spec.depthMm}">
      </label>
    </div>
    <p class="ad-hint">Depth is the room's other dimension (used by galley / L / U shapes).</p>
  `;
  elBody.querySelectorAll('.ad-arch').forEach(btn => {
    btn.addEventListener('click', () => {
      spec.archetype = btn.dataset.arch;
      rebuildAssignments(spec);
      ctx?.trackEvent?.('wizard_spec_changed', { field: 'archetype', value: spec.archetype });
      renderStep1();
    });
  });
  const wEl = document.getElementById('ad-width');
  const dEl = document.getElementById('ad-depth');
  wEl.addEventListener('change', () => { spec.widthMm = clampInt(wEl.value, 500, 12000, 3000); });
  dEl.addEventListener('change', () => { spec.depthMm = clampInt(dEl.value, 500, 12000, 1200); });
}

function renderStep2() {
  if (spec.wallAssignments.length === 0) {
    elBody.innerHTML = `<h3 class="ad-h">Doors &amp; windows</h3>
      <p class="ad-hint">This archetype has no walls to place openings on.</p>`;
    return;
  }
  const walls = spec.wallAssignments.map((a, i) => `
    <div class="ad-wall">
      <div class="ad-wall-h">Wall ${i + 1}</div>
      <div class="ad-openings" data-wall="${i}">${renderOpenings(a, i)}</div>
      <div class="ad-add-row">
        <button type="button" class="ad-mini" data-add="window" data-wall="${i}">+ Window</button>
        <button type="button" class="ad-mini" data-add="door" data-wall="${i}">+ Door</button>
      </div>
    </div>`).join('');
  elBody.innerHTML = `<h3 class="ad-h">Doors &amp; windows</h3>
    <p class="ad-hint">Optional. A window lets the solver centre the sink under it.</p>
    ${walls}`;

  elBody.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = spec.wallAssignments[+btn.dataset.wall];
      const type = btn.dataset.add;
      a.openings.push(type === 'window'
        ? { type: 'window', positionMm: 400, widthMm: 900, heightMm: 1000, sillMm: 900 }
        : { type: 'door',   positionMm: 200, widthMm: 820, heightMm: 2040, sillMm: 0 });
      renderStep2();
    });
  });
  elBody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = spec.wallAssignments[+btn.dataset.wall];
      a.openings.splice(+btn.dataset.del, 1);
      renderStep2();
    });
  });
  elBody.querySelectorAll('input[data-field]').forEach(inp => {
    inp.addEventListener('change', () => {
      const a = spec.wallAssignments[+inp.dataset.wall];
      const op = a.openings[+inp.dataset.idx];
      op[inp.dataset.field] = clampInt(inp.value, 0, 12000, op[inp.dataset.field]);
    });
  });
}

function renderOpenings(a, wallIdx) {
  if (!a.openings.length) return '<div class="ad-hint">No openings.</div>';
  return a.openings.map((op, idx) => `
    <div class="ad-opening">
      <span class="ad-tag">${op.type}</span>
      <label>pos<input class="ad-input ad-sm" type="number" data-wall="${wallIdx}"
        data-idx="${idx}" data-field="positionMm" value="${op.positionMm}"></label>
      <label>w<input class="ad-input ad-sm" type="number" data-wall="${wallIdx}"
        data-idx="${idx}" data-field="widthMm" value="${op.widthMm}"></label>
      <button type="button" class="ad-mini ad-del" data-del="${idx}" data-wall="${wallIdx}">✕</button>
    </div>`).join('');
}

function renderStep3() {
  if (spec.wallAssignments.length === 0) {
    elBody.innerHTML = `<h3 class="ad-h">Appliances</h3>
      <p class="ad-hint">This archetype has no walls to assign appliances to.</p>`;
    return;
  }
  const walls = spec.wallAssignments.map((a, i) => {
    const chips = APPLIANCES.map(ap => `
      <button type="button" class="ad-chip ${a.appliances.includes(ap.id) ? 'ad-sel' : ''}"
              data-wall="${i}" data-app="${ap.id}">${ap.label}</button>`).join('');
    return `<div class="ad-wall">
      <div class="ad-wall-h">Wall ${i + 1}</div>
      <div class="ad-chip-row">${chips}</div>
    </div>`;
  }).join('');
  elBody.innerHTML = `<h3 class="ad-h">Appliances per wall</h3>
    <p class="ad-hint">Tap to toggle. The solver places these, then fills gaps with drawers.</p>
    ${walls}`;
  elBody.querySelectorAll('.ad-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = spec.wallAssignments[+btn.dataset.wall];
      const id = btn.dataset.app;
      const at = a.appliances.indexOf(id);
      if (at >= 0) a.appliances.splice(at, 1); else a.appliances.push(id);
      ctx?.trackEvent?.('wizard_spec_changed', { field: 'appliances', value: id });
      renderStep3();
    });
  });
}

function renderStep4() {
  const products = ctx?.products?.() || [];
  if (products.length === 0) {
    elBody.innerHTML = `<h3 class="ad-h">Preview</h3>
      <p class="ad-hint">Catalogue loading… please wait a moment, then reopen this step.</p>`;
    elGenerate.disabled = true;
    elGenerate.title = 'Product catalogue still loading';
    return;
  }
  let result;
  try {
    result = ctx.runAutoDesign(spec, products);
  } catch (err) {
    elBody.innerHTML = `<h3 class="ad-h">Preview</h3>
      <p class="ad-hint" style="color:#e74c3c">Solver error: ${escapeHtml(err.message || String(err))}</p>`;
    elGenerate.disabled = true;
    return;
  }

  const blocking = hasBlockingError(result);
  elGenerate.disabled = blocking;
  elGenerate.title = blocking ? 'Fix the errors before generating' : '';

  const warnHtml = (result.warnings || []).length
    ? result.warnings.map(w => `
        <li class="ad-warn ad-${w.severity}">
          <span class="ad-sev">${w.severity}</span> ${escapeHtml(w.message)}
        </li>`).join('')
    : '<li class="ad-hint">No warnings.</li>';

  elBody.innerHTML = `
    <h3 class="ad-h">Preview</h3>
    <div class="ad-summary">
      <div><b>${result.walls.length}</b> walls</div>
      <div><b>${result.cabinets.length}</b> cabinets</div>
      <div><b>${(result.warnings || []).length}</b> notes</div>
    </div>
    <ul class="ad-warn-list">${warnHtml}</ul>
    <p class="ad-hint">Generating replaces the current scene. You can undo it.</p>
  `;

  ctx?.trackEvent?.('wizard_preview', {
    archetype: spec.archetype, cabinetCount: result.cabinets.length,
    warningCount: (result.warnings || []).length,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function trapFocus(e) {
  const focusables = elModal.querySelectorAll(
    'button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])');
  const visible = Array.from(focusables).filter(el => el.offsetParent !== null);
  if (!visible.length) return;
  const first = visible[0];
  const last  = visible[visible.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
