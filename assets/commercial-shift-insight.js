// /assets/commercial-shift-insight.js (v1)
// Commercial Shift Insight
// ✅ Uses commercial session + page shell
// ✅ Matches pilot Shift Insight decision hierarchy
// ✅ Honest pending state until commercial weekly/daypart wiring exists
// 🚫 No fake KPI math

import { getStoreBaselineStatus } from "./commercial-db.js";

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

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function setSMHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "sm").toUpperCase();
  const orgId = s.orgId || "N/A";
  const stores = Array.isArray(s.assigned_store_ids) ? s.assigned_store_ids : [];

  const selectedStore = getStoreFromUrl();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  const extra = $("smContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | Store Scope: ${
        selectedStore
          ? prettyLabel(selectedStore)
          : (stores.length ? stores.join(", ") : "Assigned store access")
      }`;
  }

  const activeStore = $("activeStore");
  if (activeStore) {
    const districtText = selectedDistrict ? ` | District: ${prettyLabel(selectedDistrict)}` : "";
    const regionText = selectedRegion ? ` | Region: ${prettyLabel(selectedRegion)}` : "";

    activeStore.textContent = selectedStore
      ? `Selected Store: ${prettyLabel(selectedStore)}${districtText}${regionText}`
      : `Selected Store: All assigned stores${districtText}${regionText}`;
  }
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
      const next = new URL("./commercial-shift-insight.html", window.location.href);
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

function injectShiftInsightStyles() {
  if (document.getElementById("commercialShiftInsightStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialShiftInsightStyles";
  style.textContent = `
    #shiftInsightRoot .small{
      font-size:12px;
      opacity:.75;
      margin-bottom:6px;
    }

    #shiftInsightRoot .meta{
      font-size:14px;
      line-height:1.45;
    }

    #shiftInsightRoot .csi-badge{
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

    #shiftInsightRoot .csi-metric-grid{
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:12px;
      margin:14px 0;
    }

    #shiftInsightRoot .csi-metric{
      padding:12px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }

    #shiftInsightRoot .csi-metric-value{
      font-weight:900;
      font-size:22px;
      line-height:1.1;
    }

    #shiftInsightRoot .csi-coach-grid{
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:12px;
      margin-top:12px;
    }

    #shiftInsightRoot .csi-coach-box{
      padding:12px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }

    #shiftInsightRoot .csi-secondary-grid{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:12px;
    }

    #shiftInsightRoot .csi-secondary-card{
      flex:1;
      min-width:220px;
      padding:12px;
      border-radius:12px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }

    #shiftInsightRoot .csi-note{
      font-size:13px;
      line-height:1.45;
      opacity:.86;
    }

    @media (max-width: 720px){
      #shiftInsightRoot .csi-metric-grid,
      #shiftInsightRoot .csi-coach-grid{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderAwaitingShiftData(storeName, baselineLabel, baselineRows) {
  const prettyStore = prettyLabel(storeName || "selected store");
  const baselineText = baselineLabel
    ? `Approved baseline on file: ${baselineLabel}${baselineRows ? ` • Rows: ${baselineRows}` : ""}.`
    : "No approved baseline on file yet.";

  setHtml("shiftInsightRoot", `
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Primary shift opportunity</div>
          <h3 style="margin:4px 0 4px 0;">Awaiting Commercial Shift Data</h3>
          <div class="meta" style="opacity:.88;">${prettyStore}</div>
        </div>
        <div class="csi-badge">Commercial V1</div>
      </div>

      <div class="csi-metric-grid">
        <div class="csi-metric">
          <div class="small">Sales</div>
          <div class="csi-metric-value">—</div>
        </div>
        <div class="csi-metric">
          <div class="small">Transactions</div>
          <div class="csi-metric-value">—</div>
        </div>
        <div class="csi-metric">
          <div class="small">Labor %</div>
          <div class="csi-metric-value">—</div>
        </div>
      </div>

      <div class="hr"></div>

      <div style="font-weight:800;margin-bottom:6px;">Why this is pending</div>
      <div class="csi-note">
        Commercial Shift Insight now matches the pilot coaching lens, but live shift coaching requires approved commercial weekly uploads with shift or daypart-level data.
      </div>

      <div class="csi-coach-grid">
        <div class="csi-coach-box">
          <div class="small">Current baseline status</div>
          <div class="csi-note">${baselineText}</div>
        </div>
        <div class="csi-coach-box">
          <div class="small">Next wiring step</div>
          <div class="csi-note">Connect approved commercial weekly upload data so the system can surface one primary coaching shift first, then supporting shifts below.</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h3 style="margin:0 0 8px 0;">Coaching Context</h3>
      <div style="display:flex;flex-direction:column;gap:7px;">
        <div style="opacity:.92;">• Week lens: commercial weekly shift comparison not wired yet</div>
        <div style="opacity:.92;">• Driver: awaiting approved weekly shift/daypart data</div>
        <div style="opacity:.92;">• Rule: once live, isolate one shift first — do not coach the whole day</div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px 0;">Full Day View</h3>
      <div class="meta" style="margin-bottom:12px;opacity:.86;">
        Supporting shifts will appear here after commercial weekly/daypart data is connected.
      </div>

      <div class="csi-secondary-grid">
        <div class="csi-secondary-card">
          <div style="font-weight:900;">AM</div>
          <div class="meta" style="opacity:.82;margin:6px 0 10px 0;">Awaiting data</div>
        </div>
        <div class="csi-secondary-card">
          <div style="font-weight:900;">Midday</div>
          <div class="meta" style="opacity:.82;margin:6px 0 10px 0;">Awaiting data</div>
        </div>
        <div class="csi-secondary-card">
          <div style="font-weight:900;">PM</div>
          <div class="meta" style="opacity:.82;margin:6px 0 10px 0;">Awaiting data</div>
        </div>
        <div class="csi-secondary-card">
          <div style="font-weight:900;">Close</div>
          <div class="meta" style="opacity:.82;margin:6px 0 10px 0;">Awaiting data</div>
        </div>
      </div>
    </div>
  `);
}

async function loadCommercialShiftInsight() {
  const session = readSession();
  const orgId = String(session?.orgId || "").trim();
  const selectedStore = getStoreFromUrl();

  if (!orgId || !selectedStore) {
    renderAwaitingShiftData(selectedStore || "selected store", "", 0);
    return;
  }

  try {
    const status = await getStoreBaselineStatus(orgId, selectedStore);

    if (status?.activeBaseline) {
      const label = status.activeBaseline.label || status.activeBaseline.year || "Approved baseline";
      const rows = Number(status.activeBaseline.rowCount || 0);
      renderAwaitingShiftData(selectedStore, label, rows);
      return;
    }

    if (status?.pendingBaseline) {
      const label = status.pendingBaseline.label || status.pendingBaseline.year || "Pending baseline";
      const rows = Number(status.pendingBaseline.rowCount || 0);
      renderAwaitingShiftData(selectedStore, `${label} (pending approval)`, rows);
      return;
    }

    renderAwaitingShiftData(selectedStore, "", 0);
  } catch (e) {
    console.error("[commercial-shift-insight] load failed:", e);
    renderAwaitingShiftData(selectedStore, "", 0);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  injectShiftInsightStyles();
  setSMHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialShiftInsight();
});