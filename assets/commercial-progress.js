// /assets/commercial-progress.js (v1)
// Commercial Progress
// ✅ Aligns to pilot Progress hierarchy
// ✅ Uses commercial session + selected scope
// ✅ Reads commercial baseline status
// ✅ Honest pending/readiness states
// 🚫 No fake weekly math
// 🚫 No invented shift results

import { getStoreBaselineStatus } from "./commercial-db.js";

const ROOT_ID = "commercialProgressRoot";
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
  if (document.getElementById("commercialProgressStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialProgressStyles";
  style.textContent = `
    #${ROOT_ID} .progCard{
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      border-radius:14px;
      padding:14px;
    }

    #${ROOT_ID} .progSection{
      margin-top:14px;
    }

    #${ROOT_ID} .progGrid3{
      display:grid;
      grid-template-columns:repeat(3, minmax(0,1fr));
      gap:12px;
    }

    #${ROOT_ID} .progMetric{
      padding:12px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
    }

    #${ROOT_ID} .progMetricCompact{
      padding:10px 12px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
    }

    #${ROOT_ID} .progMetricLabel{
      font-size:12px;
      opacity:.72;
      margin-bottom:6px;
    }

    #${ROOT_ID} .progMetricValue{
      font-size:24px;
      font-weight:900;
      line-height:1.15;
    }

    #${ROOT_ID} .progMetricSub{
      margin-top:8px;
      font-size:13px;
      opacity:.82;
    }

    #${ROOT_ID} .progGood{ color: rgba(46,204,113,.95); }
    #${ROOT_ID} .progBad{ color: rgba(239,68,68,.95); }
    #${ROOT_ID} .progNeutral{ color: inherit; }

    #${ROOT_ID} .pill {
      display:inline-flex;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(0,0,0,.16);
      font-size:12px;
      opacity:.9;
      font-weight:800;
    }

    #${ROOT_ID} .progStatus{
      display:inline-flex;
      align-items:center;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(0,0,0,.16);
      font-size:12px;
      font-weight:900;
    }

    #${ROOT_ID} .progLegend{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
      margin-top:10px;
      font-size:12px;
      opacity:.82;
    }

    #${ROOT_ID} .progLegendItem{
      display:inline-flex;
      align-items:center;
      gap:6px;
    }

    #${ROOT_ID} .progDot{
      width:12px;
      height:12px;
      border-radius:4px;
      display:inline-block;
    }

    #${ROOT_ID} .progHeatWrap{
      margin-top:12px;
      overflow:auto;
      border:1px solid rgba(255,255,255,.08);
      border-radius:14px;
    }

    #${ROOT_ID} .progHeatTable{
      width:100%;
      min-width:640px;
      border-collapse:collapse;
    }

    #${ROOT_ID} .progHeatTable th,
    #${ROOT_ID} .progHeatTable td{
      padding:10px 12px;
      border-bottom:1px solid rgba(255,255,255,.06);
      text-align:left;
      font-size:13px;
    }

    #${ROOT_ID} .progHeatTable th{
      font-weight:900;
      background:rgba(0,0,0,.12);
    }

    #${ROOT_ID} .progHeatCell{
      width:46px;
      height:28px;
      border-radius:8px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-size:12px;
      font-weight:900;
      border:1px solid rgba(255,255,255,.08);
    }

    #${ROOT_ID} .heat-good{
      background:rgba(46,204,113,.18);
      color:rgba(46,204,113,.98);
    }

    #${ROOT_ID} .heat-watch{
      background:rgba(245,158,11,.18);
      color:rgba(245,158,11,.98);
    }

    #${ROOT_ID} .heat-bad{
      background:rgba(239,68,68,.18);
      color:rgba(239,68,68,.98);
    }

    #${ROOT_ID} .progBulletList{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    #${ROOT_ID} .miniNote{
      font-size:12px;
      opacity:.72;
      line-height:1.5;
      margin-top:10px;
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

    @media (max-width: 900px){
      #${ROOT_ID} .progGrid3{
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

  setText("progContext", `Org: ${orgId} | Role: ${role} | Commercial Progress`);

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

  setText("progScope", scopeText);
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
      const next = new URL("./commercial-progress.html", window.location.href);
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
  const heatRows = `
    <tr>
      <td><span class="pill">Week 1</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
    </tr>
    <tr>
      <td><span class="pill">Week 2</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
    </tr>
  `;

  setHtml(ROOT_ID, `
    <div class="progCard progSection">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Weekly Outcome</div>
          <h2 style="margin:4px 0 8px 0;">Awaiting Commercial Weekly Trend Data</h2>
          <div class="small" style="opacity:.78;"><b>${scopeLabel}</b></div>
        </div>
        <div class="progStatus">Progress Signal</div>
      </div>

      <div class="progGrid3" style="margin-top:14px;">
        <div class="progMetric">
          <div class="progMetricLabel">Sales</div>
          <div class="progMetricValue">—</div>
          <div class="progMetricSub">vs baseline week</div>
        </div>
        <div class="progMetric">
          <div class="progMetricLabel">Transactions</div>
          <div class="progMetricValue">—</div>
          <div class="progMetricSub">vs baseline week</div>
        </div>
        <div class="progMetric">
          <div class="progMetricLabel">Labor %</div>
          <div class="progMetricValue">—</div>
          <div class="progMetricSub">vs baseline month rate</div>
        </div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Weekly Pattern Heat Map</h3>
      <div class="progLegend">
        <span class="progLegendItem"><span class="progDot heat-good"></span> Outperforming baseline</span>
        <span class="progLegendItem"><span class="progDot heat-watch"></span> Within range</span>
        <span class="progLegendItem"><span class="progDot heat-bad"></span> Underperforming baseline</span>
      </div>

      <div class="progHeatWrap">
        <table class="progHeatTable">
          <thead>
            <tr>
              <th>Week</th>
              <th>AM</th>
              <th>Midday</th>
              <th>PM</th>
              <th>Close</th>
            </tr>
          </thead>
          <tbody>
            ${heatRows}
          </tbody>
        </table>
      </div>

      <div class="miniNote">
        Commercial Progress is now structured for heat-map visibility, but live weekly patterning requires approved commercial weekly comparison data.
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Shift Performance Summary</h3>
      <div class="progGrid3" style="margin-top:12px;">
        <div class="progMetricCompact">
          <div class="progMetricLabel">Improving Shifts</div>
          <div class="progBulletList">
            <div>• Awaiting commercial weekly comparison</div>
          </div>
        </div>

        <div class="progMetricCompact">
          <div class="progMetricLabel">Stable Shifts</div>
          <div class="progBulletList">
            <div>• Awaiting commercial weekly comparison</div>
          </div>
        </div>

        <div class="progMetricCompact">
          <div class="progMetricLabel">At Risk Shifts</div>
          <div class="progBulletList">
            <div>• Awaiting commercial weekly comparison</div>
          </div>
        </div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Pattern Recognition</h3>
      <div class="progBulletList" style="margin-top:10px;">
        <div>• Commercial pattern recognition activates after approved weekly trend data is connected.</div>
        <div>• Heat map structure is in place so future trend signals remain clear and consistent.</div>
        <div>• This page is intentionally built now to preserve product hierarchy before the data layer is wired.</div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Weekly Detail</h3>
      <div class="progHeatWrap">
        <table class="progHeatTable">
          <thead>
            <tr>
              <th>Week Start</th>
              <th>Sales</th>
              <th>Transactions</th>
              <th>Avg Ticket</th>
              <th>Labor %</th>
              <th>WoW Sales</th>
              <th>WoW Trans</th>
              <th>WoW Labor %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="pill">Pending</span></td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="miniNote">
        Weekly detail will become active after approved commercial weekly uploads are connected to the selected scope.
      </div>
    </div>
  `);
}

function renderStoreReady(storeLabel, baselineLabel, rowCount) {
  const heatRows = `
    <tr>
      <td><span class="pill">Week 1</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
      <td><span class="progHeatCell heat-watch">—</span></td>
    </tr>
  `;

  setHtml(ROOT_ID, `
    <div class="progCard progSection">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Weekly Outcome</div>
          <h2 style="margin:4px 0 8px 0;">Commercial Store Baseline Ready</h2>
          <div class="small" style="opacity:.78;"><b>${storeLabel}</b> • Reference: <b>${baselineLabel}</b></div>
        </div>
        <div class="progStatus">Readiness Signal</div>
      </div>

      <div class="progGrid3" style="margin-top:14px;">
        <div class="progMetric">
          <div class="progMetricLabel">Baseline Status</div>
          <div class="progMetricValue progGood">Approved</div>
          <div class="progMetricSub">store truth source</div>
        </div>
        <div class="progMetric">
          <div class="progMetricLabel">Row Count</div>
          <div class="progMetricValue">${rowCount || 0}</div>
          <div class="progMetricSub">approved baseline rows</div>
        </div>
        <div class="progMetric">
          <div class="progMetricLabel">Weekly Trend Layer</div>
          <div class="progMetricValue progNeutral">Pending</div>
          <div class="progMetricSub">awaiting weekly uploads</div>
        </div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Weekly Pattern Heat Map</h3>
      <div class="progLegend">
        <span class="progLegendItem"><span class="progDot heat-good"></span> Outperforming baseline</span>
        <span class="progLegendItem"><span class="progDot heat-watch"></span> Within range</span>
        <span class="progLegendItem"><span class="progDot heat-bad"></span> Underperforming baseline</span>
      </div>

      <div class="progHeatWrap">
        <table class="progHeatTable">
          <thead>
            <tr>
              <th>Week</th>
              <th>AM</th>
              <th>Midday</th>
              <th>PM</th>
              <th>Close</th>
            </tr>
          </thead>
          <tbody>
            ${heatRows}
          </tbody>
        </table>
      </div>

      <div class="miniNote">
        Heat-map structure is ready. Once approved weekly uploads are connected, this page can surface repeating shift patterns visually.
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Shift Performance Summary</h3>
      <div class="progGrid3" style="margin-top:12px;">
        <div class="progMetricCompact">
          <div class="progMetricLabel">Improving Shifts</div>
          <div class="progBulletList">
            <div>• Awaiting weekly comparison</div>
          </div>
        </div>

        <div class="progMetricCompact">
          <div class="progMetricLabel">Stable Shifts</div>
          <div class="progBulletList">
            <div>• Baseline governance is complete</div>
          </div>
        </div>

        <div class="progMetricCompact">
          <div class="progMetricLabel">At Risk Shifts</div>
          <div class="progBulletList">
            <div>• No at-risk shift can surface until weekly comparison is live</div>
          </div>
        </div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Pattern Recognition</h3>
      <div class="progBulletList" style="margin-top:10px;">
        <div>• Approved store baseline is now locked and usable.</div>
        <div>• Weekly pattern recognition is the next active build layer.</div>
        <div>• Once connected, this page will validate whether corrections are actually working over time.</div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Weekly Detail</h3>
      <div class="progHeatWrap">
        <table class="progHeatTable">
          <thead>
            <tr>
              <th>Week Start</th>
              <th>Sales</th>
              <th>Transactions</th>
              <th>Avg Ticket</th>
              <th>Labor %</th>
              <th>WoW Sales</th>
              <th>WoW Trans</th>
              <th>WoW Labor %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="pill">Pending</span></td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="miniNote">
        Weekly detail becomes active after approved weekly uploads are layered against this baseline.
      </div>
    </div>
  `);
}

function renderStorePending(storeLabel, baselineLabel, rowCount) {
  setHtml(ROOT_ID, `
    <div class="progCard progSection">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Weekly Outcome</div>
          <h2 style="margin:4px 0 8px 0;">Commercial Store Baseline Pending Approval</h2>
          <div class="small" style="opacity:.78;"><b>${storeLabel}</b> • Pending reference: <b>${baselineLabel}</b></div>
        </div>
        <div class="progStatus">Pending Approval</div>
      </div>

      <div class="progGrid3" style="margin-top:14px;">
        <div class="progMetric">
          <div class="progMetricLabel">Baseline Status</div>
          <div class="progMetricValue progBad">Pending</div>
          <div class="progMetricSub">not yet locked</div>
        </div>
        <div class="progMetric">
          <div class="progMetricLabel">Row Count</div>
          <div class="progMetricValue">${rowCount || 0}</div>
          <div class="progMetricSub">pending baseline rows</div>
        </div>
        <div class="progMetric">
          <div class="progMetricLabel">Trend Layer</div>
          <div class="progMetricValue progNeutral">Blocked</div>
          <div class="progMetricSub">awaiting approval</div>
        </div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Shift Performance Summary</h3>
      <div class="progGrid3" style="margin-top:12px;">
        <div class="progMetricCompact">
          <div class="progMetricLabel">Improving Shifts</div>
          <div class="progBulletList">
            <div>• Not available before approval</div>
          </div>
        </div>

        <div class="progMetricCompact">
          <div class="progMetricLabel">Stable Shifts</div>
          <div class="progBulletList">
            <div>• Governance must complete first</div>
          </div>
        </div>

        <div class="progMetricCompact">
          <div class="progMetricLabel">At Risk Shifts</div>
          <div class="progBulletList">
            <div>• Risk signaling is blocked until baseline is approved</div>
          </div>
        </div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3 style="margin:0 0 8px 0;">Pattern Recognition</h3>
      <div class="progBulletList" style="margin-top:10px;">
        <div>• Commercial Progress should not interpret weekly drift against an unlocked baseline.</div>
        <div>• Approval is the gating step before live trend validation can begin.</div>
        <div>• This page is intentionally protecting trust before surfacing performance signals.</div>
      </div>
    </div>
  `);
}

async function loadCommercialProgress() {
  const session = readSession();
  const orgId = String(session?.orgId || "").trim();

  const store = getStoreFromUrl();
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
    console.error("[commercial-progress] load failed:", e);
    renderScopePending(scopeLabel);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  setHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialProgress();
});