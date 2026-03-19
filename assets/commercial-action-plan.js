// /assets/commercial-action-plan.js (v1)
// Commercial Action Plan
// ✅ Aligns to pilot Action Plan hierarchy
// ✅ Uses commercial session + selected scope
// ✅ Reads commercial baseline status
// ✅ Honest pending-state until commercial weekly comparison is wired
// 🚫 No fake math
// 🚫 No invented weekly comparisons

import { getStoreBaselineStatus } from "./commercial-db.js";

const ROOT_ID = "commercialActionPlanRoot";
const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getStoreFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("store") || "").trim();
}

function getDistrictFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("district") || "").trim();
}

function getRegionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("region") || "").trim();
}

function prettyLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function injectStyles() {
  if (document.getElementById("commercialActionPlanStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialActionPlanStyles";
  style.textContent = `
    #${ROOT_ID} .cap-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.04);
    }

    #${ROOT_ID} .cap-grid-3{
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:12px;
    }

    #${ROOT_ID} .cap-grid-2{
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:12px;
    }

    #${ROOT_ID} .cap-metric{
      padding:12px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }

    #${ROOT_ID} .cap-metric-value{
      font-weight:900;
      font-size:22px;
      line-height:1.1;
    }

    #${ROOT_ID} .cap-action-box{
      padding:14px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }

    #${ROOT_ID} .cap-action-text{
      font-weight:700;
      line-height:1.45;
    }

    #${ROOT_ID} .small{
      font-size:12px;
      opacity:.75;
      margin-bottom:6px;
    }

    #${ROOT_ID} .meta{
      font-size:14px;
      line-height:1.45;
      opacity:.9;
    }

    @media (max-width: 720px){
      #${ROOT_ID} .cap-grid-3,
      #${ROOT_ID} .cap-grid-2{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function setHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "sm").toUpperCase();
  const orgId = s.orgId || "N/A";

  const selectedStore = getStoreFromUrl();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  setText("apContext", `Org: ${orgId} | Role: ${role} | Commercial Action Plan`);

  let scopeText = "Scope: Assigned commercial access";
  if (selectedStore) {
    scopeText = `Scope: Store — ${prettyLabel(selectedStore)}`;
  } else if (selectedDistrict) {
    scopeText = `Scope: District — ${prettyLabel(selectedDistrict)}`;
  } else if (selectedRegion) {
    scopeText = `Scope: Region — ${prettyLabel(selectedRegion)}`;
  } else {
    scopeText = "Scope: Organization / assigned commercial access";
  }

  setText("apScope", scopeText);
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const selectedStore = getStoreFromUrl();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      window.location.href = "./commercial-vp.html";
      return;
    }

    if (view === "rm") {
      if (selectedRegion) {
        window.location.href = `./commercial-rm.html?region=${encodeURIComponent(selectedRegion)}`;
      } else {
        window.location.href = "./commercial-rm.html";
      }
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      window.location.href = next.toString();
      return;
    }

    if (view === "sm") {
      const next = new URL("./commercial-action-plan.html", window.location.href);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      window.location.href = next.toString();
    }
  });
}

function setupLogout() {
  $("logoutBtn")?.addEventListener("click", () => {
    try {
      localStorage.removeItem("FLQSR_COMM_SESSION");
    } catch {}
    window.location.href = "./commercial-login.html";
  });
}

function resolveScopeLabel() {
  const store = getStoreFromUrl();
  const district = getDistrictFromUrl();
  const region = getRegionFromUrl();

  if (store) return `Store — ${prettyLabel(store)}`;
  if (district) return `District — ${prettyLabel(district)}`;
  if (region) return `Region — ${prettyLabel(region)}`;
  return "Selected Commercial Scope";
}

function renderScopePending(scopeLabel) {
  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Execution alignment summary</div>
          <h2 style="margin:4px 0 8px 0;">Awaiting Commercial Weekly Comparison</h2>
          <div class="meta">Scope: <b>${scopeLabel}</b></div>
        </div>
        <div class="cap-badge">Alignment Plan</div>
      </div>

      <div class="cap-grid-3" style="margin-top:14px;">
        <div class="cap-metric">
          <div class="small">Sales Movement</div>
          <div class="cap-metric-value">—</div>
        </div>
        <div class="cap-metric">
          <div class="small">Transactions</div>
          <div class="cap-metric-value">—</div>
        </div>
        <div class="cap-metric">
          <div class="small">Labor Guardrail</div>
          <div class="cap-metric-value">—</div>
        </div>
      </div>

      <div class="hr"></div>

      <div style="font-weight:800;margin-bottom:6px;">Why this is pending</div>
      <div class="meta">
        Commercial Action Plan is structured and ready, but a live alignment narrative requires approved commercial weekly comparison logic across the selected scope.
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Top Corrections to Hold</h3>
      <div class="cap-grid-2" style="margin-top:12px;">
        <div class="cap-action-box">
          <div class="small">Primary correction</div>
          <div class="cap-action-text">Establish approved weekly comparison across the selected commercial scope so the system can identify the primary alignment gap first.</div>
        </div>
        <div class="cap-action-box">
          <div class="small">Secondary correction</div>
          <div class="cap-action-text">Keep shift-level and store-level naming consistent so future action plans remain clean, assignable, and trustworthy.</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Operational Discipline This Week</h3>
      <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px;">
        <div>• Keep commercial baseline governance clean before layering weekly comparison.</div>
        <div>• Maintain one source of truth by scope (store, district, region, org).</div>
        <div>• Avoid broad corrections until approved weekly comparison is live.</div>
        <div>• Translate pilot logic carefully — polish matters as much as speed.</div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px 0;">Supporting Context</h3>
      <div class="meta" style="margin-bottom:10px;opacity:.86;">
        This commercial page is intentionally built now so the system language is ready before the live multi-unit comparison layer is connected.
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        <div>• Pilot proved the correction hierarchy.</div>
        <div>• Commercial is now shaping the same logic into an aligned multi-unit experience.</div>
        <div>• Weekly comparison wiring is the next data step — not a redesign step.</div>
      </div>
    </div>
  `);
}

function renderStoreReady(storeLabel, baselineLabel, rowCount) {
  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Execution alignment summary</div>
          <h2 style="margin:4px 0 8px 0;">Commercial Store Baseline Approved</h2>
          <div class="meta">Scope: <b>${storeLabel}</b></div>
          <div class="meta" style="margin-top:6px;">Reference: <b>${baselineLabel}</b></div>
        </div>
        <div class="cap-badge">Store Scope Ready</div>
      </div>

      <div class="cap-grid-3" style="margin-top:14px;">
        <div class="cap-metric">
          <div class="small">Baseline Status</div>
          <div class="cap-metric-value">Approved</div>
        </div>
        <div class="cap-metric">
          <div class="small">Row Count</div>
          <div class="cap-metric-value">${rowCount || 0}</div>
        </div>
        <div class="cap-metric">
          <div class="small">Weekly Comparison</div>
          <div class="cap-metric-value">Pending</div>
        </div>
      </div>

      <div class="hr"></div>

      <div style="font-weight:800;margin-bottom:6px;">Why this matters</div>
      <div class="meta">
        The commercial store baseline is approved and locked. The next layer is weekly comparison so this page can move from readiness to live correction planning.
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Top Corrections to Hold</h3>
      <div class="cap-grid-2" style="margin-top:12px;">
        <div class="cap-action-box">
          <div class="small">Primary correction</div>
          <div class="cap-action-text">Connect the latest approved commercial weekly upload so the plan can identify the primary alignment gap against this baseline.</div>
        </div>
        <div class="cap-action-box">
          <div class="small">Secondary correction</div>
          <div class="cap-action-text">Keep this store isolated from all other scopes so future commercial plans remain clean and non-blended.</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Operational Discipline This Week</h3>
      <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px;">
        <div>• Preserve this approved baseline as the commercial truth source.</div>
        <div>• Add weekly comparison only after approval status is clean.</div>
        <div>• Keep correction language tight: one primary issue first, then supporting issues.</div>
        <div>• Protect store-level isolation before layering district or region roll-ups.</div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px 0;">Supporting Context</h3>
      <div class="meta" style="margin-bottom:10px;opacity:.86;">
        This store is ready for the next live data layer. Once weekly comparison is wired, the page can move into a true commercial action plan.
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        <div>• Approved baseline is present.</div>
        <div>• Store scope is identified.</div>
        <div>• Weekly alignment comparison is the next active build step.</div>
      </div>
    </div>
  `);
}

function renderStorePending(storeLabel, baselineLabel, rowCount) {
  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Execution alignment summary</div>
          <h2 style="margin:4px 0 8px 0;">Commercial Store Baseline Pending Approval</h2>
          <div class="meta">Scope: <b>${storeLabel}</b></div>
          <div class="meta" style="margin-top:6px;">Pending reference: <b>${baselineLabel}</b></div>
        </div>
        <div class="cap-badge">Pending Approval</div>
      </div>

      <div class="cap-grid-3" style="margin-top:14px;">
        <div class="cap-metric">
          <div class="small">Baseline Status</div>
          <div class="cap-metric-value">Pending</div>
        </div>
        <div class="cap-metric">
          <div class="small">Row Count</div>
          <div class="cap-metric-value">${rowCount || 0}</div>
        </div>
        <div class="cap-metric">
          <div class="small">Weekly Comparison</div>
          <div class="cap-metric-value">Blocked</div>
        </div>
      </div>

      <div class="hr"></div>

      <div style="font-weight:800;margin-bottom:6px;">Why this needs attention</div>
      <div class="meta">
        A pending baseline exists, but commercial action planning should not move forward until the baseline is formally approved and locked.
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Top Corrections to Hold</h3>
      <div class="cap-grid-2" style="margin-top:12px;">
        <div class="cap-action-box">
          <div class="small">Primary correction</div>
          <div class="cap-action-text">Approve the pending commercial baseline so the store has one locked truth source before weekly correction logic is layered.</div>
        </div>
        <div class="cap-action-box">
          <div class="small">Secondary correction</div>
          <div class="cap-action-text">Avoid interpreting store drift until baseline governance is complete and stable.</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Operational Discipline This Week</h3>
      <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px;">
        <div>• Finish baseline governance before opening correction planning.</div>
        <div>• Keep pending baseline separate from approved commercial truth.</div>
        <div>• Prevent weekly uploads from being interpreted against an unlocked reference.</div>
        <div>• Protect trust by making approval status explicit.</div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px 0;">Supporting Context</h3>
      <div class="meta" style="margin-bottom:10px;opacity:.86;">
        Commercial action plans should never outrun governance. Approval comes first, then correction planning.
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        <div>• Pending baseline is present.</div>
        <div>• Store scope is identified.</div>
        <div>• Approval is the gating step before live action planning.</div>
      </div>
    </div>
  `);
}

async function loadCommercialActionPlan() {
  const session = readSession();
  const orgId = String(session?.orgId || "").trim();

  const store = getStoreFromUrl();
  const district = getDistrictFromUrl();
  const region = getRegionFromUrl();

  const scopeLabel = resolveScopeLabel();

  if (!orgId) {
    renderScopePending(scopeLabel);
    return;
  }

  if (!store) {
    renderScopePending(scopeLabel);
    return;
  }

  try {
    const status = await getStoreBaselineStatus(orgId, store);

    if (status?.activeBaseline) {
      const label = status.activeBaseline.label || status.activeBaseline.year || "Approved baseline";
      const rows = Number(status.activeBaseline.rowCount || 0);
      renderStoreReady(prettyLabel(store), label, rows);
      return;
    }

    if (status?.pendingBaseline) {
      const label = status.pendingBaseline.label || status.pendingBaseline.year || "Pending baseline";
      const rows = Number(status.pendingBaseline.rowCount || 0);
      renderStorePending(prettyLabel(store), label, rows);
      return;
    }

    renderScopePending(scopeLabel);
  } catch (e) {
    console.error("[commercial-action-plan] load failed:", e);
    renderScopePending(scopeLabel);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  setHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialActionPlan();
});