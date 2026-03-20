// /assets/commercial-shift-insight.js (v4)
// Commercial Shift Insight — unified light-card commercial design
// ✅ Uses commercial-kpi-data.js shared adapter
// ✅ Resolves active store from URL, session, localStorage, or assigned stores
// ✅ Uses approved baseline + latest approved week + previous week
// ✅ Honest fallback if shift/daypart data is not present
// ✅ Matches commercial light-card system
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";

const $ = (id) => document.getElementById(id);

const LS_COMM_ACTIVE_STORE = "FLQSR_COMM_ACTIVE_STORE_ID";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return String(params.get(name) || "").trim();
}

function getStoreFromUrl() {
  return getUrlParam("store");
}

function getDistrictFromUrl() {
  return getUrlParam("district");
}

function getRegionFromUrl() {
  return getUrlParam("region");
}

function prettyLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normStoreId(v) {
  return String(v || "").trim();
}

function getAssignedStoresFromSession() {
  const s = readSession();
  if (!s) return [];
  const arr = Array.isArray(s.assigned_store_ids) ? s.assigned_store_ids : [];
  return arr.map(normStoreId).filter(Boolean);
}

function getSessionSelectedStore() {
  const s = readSession();
  if (!s) return "";

  return String(
    s.selectedStoreId ||
    s.activeStoreId ||
    s.storeId ||
    ""
  ).trim();
}

function getStoredActiveStore() {
  try {
    return String(
      localStorage.getItem(LS_COMM_ACTIVE_STORE) ||
      localStorage.getItem("FLQSR_ACTIVE_STORE_ID") ||
      localStorage.getItem("flqsr_active_store_id") ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

function setStoredActiveStore(storeId) {
  const v = String(storeId || "").trim();
  if (!v) return;
  try { localStorage.setItem(LS_COMM_ACTIVE_STORE, v); } catch {}
}

function resolveSelectedStore() {
  const fromUrl = getStoreFromUrl();
  if (fromUrl) return fromUrl;

  const fromSession = getSessionSelectedStore();
  if (fromSession) return fromSession;

  const fromLs = getStoredActiveStore();
  if (fromLs) return fromLs;

  const assigned = getAssignedStoresFromSession();
  if (assigned.length) return assigned[0];

  return "";
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
  const stores = getAssignedStoresFromSession();

  const selectedStore = resolveSelectedStore();
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

  const selectedStore = resolveSelectedStore();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();
  const orgId = String(readSession()?.orgId || "").trim();

  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      const next = new URL("./commercial-vp.html", window.location.href);
      if (orgId) next.searchParams.set("org", orgId);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    if (view === "rm") {
      const next = new URL("./commercial-rm.html", window.location.href);
      if (orgId) next.searchParams.set("org", orgId);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (orgId) next.searchParams.set("org", orgId);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    const next = new URL("./commercial-shift-insight.html", window.location.href);
    if (orgId) next.searchParams.set("org", orgId);
    if (selectedStore) next.searchParams.set("store", selectedStore);
    if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
    if (selectedRegion) next.searchParams.set("region", selectedRegion);
    window.location.href = next.toString();
  });
}

function setupLogout() {
  $("logoutBtn")?.addEventListener("click", () => {
    try {
      localStorage.removeItem("FLQSR_COMM_SESSION");
      localStorage.removeItem(LS_COMM_ACTIVE_STORE);
    } catch {}
    window.location.href = "./commercial-login.html";
  });
}

function injectShiftInsightStyles() {
  if (document.getElementById("commercialShiftInsightStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialShiftInsightStyles";
  style.textContent = `
    #shiftInsightRoot{
      color:#0f172a;
    }

    #shiftInsightRoot .small{
      font-size:12px;
      line-height:1.4;
      color:rgba(15,23,42,.62);
      margin-bottom:6px;
      font-weight:700;
    }

    #shiftInsightRoot .meta{
      font-size:14px;
      line-height:1.5;
      color:rgba(15,23,42,.74);
    }

    #shiftInsightRoot .csi-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      border:1px solid rgba(15,23,42,.10);
      background:rgba(15,23,42,.05);
      color:#0f172a;
    }

    #shiftInsightRoot .csi-high{
      background:rgba(185,28,28,.08);
      color:#991b1b;
      border-color:rgba(185,28,28,.14);
    }

    #shiftInsightRoot .csi-watch{
      background:rgba(180,83,9,.08);
      color:#92400e;
      border-color:rgba(180,83,9,.16);
    }

    #shiftInsightRoot .csi-stable{
      background:rgba(22,101,52,.08);
      color:#166534;
      border-color:rgba(22,101,52,.14);
    }

    #shiftInsightRoot .csi-metric-grid{
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:12px;
      margin:14px 0;
    }

    #shiftInsightRoot .csi-metric{
      padding:14px;
      border-radius:12px;
      background:#f8fafc;
      border:1px solid rgba(15,23,42,.08);
      box-shadow:0 8px 24px rgba(15,23,42,.05);
    }

    #shiftInsightRoot .csi-metric-value{
      font-weight:900;
      font-size:22px;
      line-height:1.1;
      color:#0f172a;
    }

    #shiftInsightRoot .csi-coach-grid{
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:12px;
      margin-top:12px;
    }

    #shiftInsightRoot .csi-coach-box{
      padding:14px;
      border-radius:12px;
      background:#f8fafc;
      border:1px solid rgba(15,23,42,.08);
      box-shadow:0 8px 24px rgba(15,23,42,.05);
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
      padding:14px;
      border-radius:12px;
      background:#f8fafc;
      border:1px solid rgba(15,23,42,.08);
      box-shadow:0 8px 24px rgba(15,23,42,.05);
    }

    #shiftInsightRoot .csi-note{
      font-size:13px;
      line-height:1.5;
      color:rgba(15,23,42,.76);
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

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtPct(n) {
  const x = Number(n || 0);
  return `${x.toFixed(2)}%`;
}

function fmtNum(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? x.toLocaleString() : "0";
}

function parseNumber(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[$,%\s,]/g, "");
  return Number(cleaned);
}

function normKey(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function getVal(row, aliases) {
  if (!row) return null;
  const keys = Object.keys(row);
  const map = {};
  keys.forEach((k) => { map[normKey(k)] = k; });

  for (const a of aliases) {
    const k = map[normKey(a)];
    if (k !== undefined) {
      const num = parseNumber(row[k]);
      if (isFinite(num)) return num;
    }
  }
  return null;
}

function normalizeShiftName(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";

  if (s === "am" || s.includes("open") || s.includes("breakfast")) return "AM";
  if (s.includes("midday") || s.includes("lunch") || s === "mid") return "Midday";
  if (s === "pm" || s.includes("dinner") || s.includes("evening")) return "PM";
  if (s.includes("close") || s.includes("late") || s.includes("night")) return "Close";
  return "";
}

function extractHour(row) {
  const h1 = row.Hour ?? row.hour ?? "";
  if (String(h1).trim() !== "") {
    const n = Number(h1);
    if (Number.isFinite(n) && n >= 0 && n <= 23) return n;
  }

  const d = row.Date ?? row.date ?? row.DateTime ?? row.datetime ?? "";
  const s = String(d);
  const m = s.match(/(\b\d{1,2}):(\d{2})/);
  if (m) {
    const hh = Number(m[1]);
    if (Number.isFinite(hh) && hh >= 0 && hh <= 23) return hh;
  }

  return null;
}

function hourToShift(h) {
  if (h >= 5 && h <= 10) return "AM";
  if (h >= 11 && h <= 15) return "Midday";
  if (h >= 16 && h <= 21) return "PM";
  return "Close";
}

function splitRowsByShift(rows) {
  const out = {
    AM: [],
    Midday: [],
    PM: [],
    Close: []
  };

  for (const row of (rows || [])) {
    const explicit = normalizeShiftName(
      row.Shift ?? row.shift ?? row.Daypart ?? row.daypart ?? ""
    );

    if (explicit) {
      out[explicit].push(row);
      continue;
    }

    const h = extractHour(row);
    if (h !== null) {
      out[hourToShift(h)].push(row);
    }
  }

  return out;
}

function computeShiftKpis(rows) {
  const grouped = splitRowsByShift(rows || []);
  const out = {};

  for (const shiftKey of ["AM", "Midday", "PM", "Close"]) {
    const shiftRows = grouped[shiftKey] || [];

    let sales = 0;
    let transactions = 0;
    let laborDollars = 0;

    for (const r of shiftRows) {
      const s = getVal(r, ["Sales", "Net Sales", "Revenue"]);
      const t = getVal(r, ["Transactions", "Trans", "Tickets"]);
      const l = getVal(r, ["Labor", "Labor$", "Labor $", "Labor Dollars"]);

      if (isFinite(s)) sales += s;
      if (isFinite(t)) transactions += t;
      if (isFinite(l)) laborDollars += l;
    }

    const laborPct = sales > 0 && laborDollars > 0 ? (laborDollars / sales) * 100 : 0;

    out[shiftKey] = {
      sales,
      transactions,
      laborDollars,
      laborPct,
      rowCount: shiftRows.length
    };
  }

  return out;
}

function pctDelta(cur, prev) {
  const p = Number(prev || 0);
  const c = Number(cur || 0);
  if (!p) return 0;
  return ((c - p) / p) * 100;
}

function delta(cur, prev) {
  return Number(cur || 0) - Number(prev || 0);
}

const SHIFT_LABELS = {
  AM: "AM (Open → 11:00)",
  Midday: "Midday (11:00 → 15:00)",
  PM: "PM (15:00 → Close)",
  Close: "Close (Last Hour → Lock)"
};

const FOCUS_POINTS = {
  AM: [
    "Opener readiness: stations set before first rush",
    "Prep pacing: protect peak by finishing prep early",
    "Early staffing alignment: right roles on the floor, not floating"
  ],
  Midday: [
    "Rush coverage: assign clear positions (line/expo/cash)",
    "Throughput control: speed with accuracy (no re-makes)",
    "Break discipline: stagger breaks to protect the rush"
  ],
  PM: [
    "Dinner pacing: keep the line moving, avoid late ticket times",
    "Handoff quality: mid → PM transition must be clean",
    "Coverage during peak: don’t leave one position unsupported"
  ],
  Close: [
    "Close overlap: protect late throughput while cleaning",
    "Position lock: avoid early shutdown of stations",
    "Last-hour standards: speed + quality under thin staffing"
  ]
};

function buildPriority(score) {
  if (score >= 9) return { label: "High Attention", tone: "high" };
  if (score >= 4) return { label: "Watch", tone: "watch" };
  return { label: "Stable", tone: "stable" };
}

function buildShortDriverText(ctx) {
  if (!ctx) return "No dominant coaching opportunity detected.";
  if (!ctx.prev) {
    return "Latest approved week loaded — previous approved week not available yet for direct shift comparison.";
  }

  const salesPct = pctDelta(ctx.cur.sales, ctx.prev.sales);
  const txPct = pctDelta(ctx.cur.transactions, ctx.prev.transactions);
  const laborUp = delta(ctx.cur.laborPct, ctx.prev.laborPct);

  const parts = [];
  if (salesPct < -1) parts.push(`sales ${salesPct.toFixed(1)}% below comparison`);
  if (txPct < -1) parts.push(`transactions ${txPct.toFixed(1)}% below comparison`);
  if (laborUp > 0.5) parts.push(`labor up ${laborUp.toFixed(2)} pts`);

  return parts.length
    ? parts.join(" • ")
    : "No major breakdown detected — focus on tightening execution discipline.";
}

function buildContextBullets(ctx, latestWeekLabel, prevWeekLabel) {
  if (!ctx) return [];

  const weekPart = `Week: ${latestWeekLabel}${prevWeekLabel ? ` vs ${prevWeekLabel}` : " (no previous-week comparison yet)"}`;
  const driverPart = `Driver: ${buildShortDriverText(ctx)}`;
  const rulePart = "Rule: isolate the shift — do not over-correct the whole day.";

  return [weekPart, driverPart, rulePart];
}

function analyzeCommercialShift(latestRows, previousRows) {
  const currentAgg = computeShiftKpis(latestRows || []);
  const previousAgg = previousRows && previousRows.length ? computeShiftKpis(previousRows) : null;

  const hasShiftData = ["AM", "Midday", "PM", "Close"].some((k) => Number(currentAgg?.[k]?.rowCount || 0) > 0);
  if (!hasShiftData) {
    return { ok: false, reason: "missing_shift_data" };
  }

  let best = null;
  const scored = [];

  for (const shiftKey of ["AM", "Midday", "PM", "Close"]) {
    const c = currentAgg[shiftKey] || { sales: 0, transactions: 0, laborPct: 0, rowCount: 0 };
    const p = previousAgg?.[shiftKey] || { sales: 0, transactions: 0, laborPct: 0, rowCount: 0 };

    const score = previousAgg
      ? (pctDelta(c.sales, p.sales) < -1 ? Math.abs(pctDelta(c.sales, p.sales)) : 0) * 1.0
        + (pctDelta(c.transactions, p.transactions) < -1 ? Math.abs(pctDelta(c.transactions, p.transactions)) : 0) * 0.9
        + (delta(c.laborPct, p.laborPct) > 0.5 ? delta(c.laborPct, p.laborPct) : 0) * 1.2
      : (c.laborPct * 0.7) + (c.transactions > 0 ? (1 / c.transactions) : 0) + (c.sales > 0 ? (1 / c.sales) : 0);

    const entry = { sh: shiftKey, score, cur: c, prev: previousAgg ? p : null };
    scored.push(entry);

    if (!best || score > best.score) {
      best = entry;
    }
  }

  return {
    ok: true,
    best,
    scored,
    currentAgg,
    previousAgg
  };
}

function priorityBadge(priority) {
  const p = priority || { label: "Stable", tone: "stable" };
  return `<span class="csi-badge csi-${p.tone}">${p.label}</span>`;
}

function primaryAction(shiftKey) {
  const points = FOCUS_POINTS[shiftKey] || [];
  return points[0] || "Protect execution discipline in the selected shift.";
}

function secondaryAction(shiftKey) {
  const points = FOCUS_POINTS[shiftKey] || [];
  return points[1] || "Support the shift with tighter role ownership.";
}

function renderFallbackFromTruth(truth) {
  const selectedStore = truth?.storeId || resolveSelectedStore() || "selected store";
  const baseline = truth?.baselineStatus?.activeBaseline;
  const baselineLabel = baseline?.label || baseline?.year || "";
  const baselineRows = Number(baseline?.rowCount || 0);

  const prettyStore = prettyLabel(selectedStore);
  const baselineText = baselineLabel
    ? `Approved baseline on file: ${baselineLabel}${baselineRows ? ` • Rows: ${baselineRows}` : ""}.`
    : "No approved baseline on file yet.";

  setHtml("shiftInsightRoot", `
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Primary shift opportunity</div>
          <h3 style="margin:4px 0 4px 0;">Awaiting Shift Data</h3>
          <div class="meta">${prettyStore}</div>
        </div>
        <div class="csi-badge">Live</div>
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

      <div style="font-weight:800;margin-bottom:6px;color:#0f172a;">Why this is pending</div>
      <div class="csi-note">
        The selected weekly data does not include enough shift or daypart detail yet to isolate one primary coaching shift.
      </div>

      <div class="csi-coach-grid">
        <div class="csi-coach-box">
          <div class="small">Current baseline status</div>
          <div class="csi-note">${baselineText}</div>
        </div>
        <div class="csi-coach-box">
          <div class="small">Next wiring step</div>
          <div class="csi-note">Use weekly uploads that include Shift, Daypart, or time-based rows so the system can surface one primary shift first, then supporting shifts below.</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h3 style="margin:0 0 8px 0;">Coaching Context</h3>
      <div style="display:flex;flex-direction:column;gap:7px;color:rgba(15,23,42,.78);">
        <div>• Week lens: latest approved week is loaded when available</div>
        <div>• Driver: weekly rows do not contain enough shift or daypart detail, or no store scope resolved</div>
        <div>• Rule: once shift detail is present, isolate one shift first — do not coach the whole day</div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px 0;">Full Day View</h3>
      <div class="meta" style="margin-bottom:12px;">
        Supporting shifts stay available here once weekly rows contain usable shift or daypart detail.
      </div>

      <div class="csi-secondary-grid">
        <div class="csi-secondary-card">
          <div style="font-weight:900;color:#0f172a;">AM</div>
          <div class="meta" style="margin-top:6px;">Awaiting usable data</div>
        </div>
        <div class="csi-secondary-card">
          <div style="font-weight:900;color:#0f172a;">Midday</div>
          <div class="meta" style="margin-top:6px;">Awaiting usable data</div>
        </div>
        <div class="csi-secondary-card">
          <div style="font-weight:900;color:#0f172a;">PM</div>
          <div class="meta" style="margin-top:6px;">Awaiting usable data</div>
        </div>
        <div class="csi-secondary-card">
          <div style="font-weight:900;color:#0f172a;">Close</div>
          <div class="meta" style="margin-top:6px;">Awaiting usable data</div>
        </div>
      </div>
    </div>
  `);
}

function renderLiveShiftInsight(truth, analysis) {
  const best = analysis.best;
  const latestWeekLabel = truth?.latestWeek?.weekStart || "Approved week";
  const prevWeekLabel = truth?.previousWeek?.weekStart || "";
  const priority = buildPriority(best?.score || 0);
  const bullets = buildContextBullets(best, latestWeekLabel, prevWeekLabel);

  const scoreMap = {};
  (analysis.scored || []).forEach((x) => { scoreMap[x.sh] = x.score; });

  const secondaryCards = ["AM", "Midday", "PM", "Close"].map((shiftKey) => {
    const cur = analysis.currentAgg?.[shiftKey];
    if (!cur || !cur.rowCount) return "";

    const prev = analysis.previousAgg?.[shiftKey] || null;
    const header = SHIFT_LABELS[shiftKey] || shiftKey;

    let badgeHtml = "";
    if (shiftKey === best.sh) {
      const tone = (scoreMap?.[shiftKey] || 0) >= 9 ? "high" : "watch";
      badgeHtml = priorityBadge({ label: "Primary", tone });
    } else {
      badgeHtml = priorityBadge(buildPriority(scoreMap?.[shiftKey] || 0));
    }

    let status = "Latest approved week";
    if (prev) {
      const s = pctDelta(cur.sales, prev.sales);
      const t = pctDelta(cur.transactions, prev.transactions);
      const lp = delta(cur.laborPct, prev.laborPct);
      const bits = [];
      if (Math.abs(s) >= 1) bits.push(`Sales ${s >= 0 ? "+" : ""}${s.toFixed(1)}%`);
      if (Math.abs(t) >= 1) bits.push(`Tx ${t >= 0 ? "+" : ""}${t.toFixed(1)}%`);
      if (Math.abs(lp) >= 0.25) bits.push(`Labor ${lp >= 0 ? "+" : ""}${lp.toFixed(2)} pts`);
      status = bits.length ? bits.join(" • ") : "Stable vs comparison";
    }

    return `
      <div class="csi-secondary-card" style="opacity:${shiftKey === best.sh ? "1" : ".98"};">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
          <div style="font-weight:900;color:#0f172a;">${header}</div>
          ${badgeHtml}
        </div>

        <div class="meta" style="margin:6px 0 10px 0;">${status}</div>

        <div style="display:flex;gap:14px;flex-wrap:wrap;color:#0f172a;">
          <div>
            <div class="small">Sales</div>
            <div style="font-weight:800;">${fmtMoney(cur.sales)}</div>
          </div>
          <div>
            <div class="small">Tx</div>
            <div style="font-weight:800;">${fmtNum(cur.transactions)}</div>
          </div>
          <div>
            <div class="small">Labor %</div>
            <div style="font-weight:800;">${fmtPct(cur.laborPct)}</div>
          </div>
        </div>
      </div>
    `;
  }).filter(Boolean).join("");

  setHtml("shiftInsightRoot", `
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Primary shift opportunity</div>
          <h3 style="margin:4px 0 4px 0;">${SHIFT_LABELS[best.sh] || best.sh}</h3>
          <div class="meta">${prettyLabel(truth.storeId)} • ${latestWeekLabel}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${priorityBadge(priority)}
          <span class="csi-badge">Live</span>
        </div>
      </div>

      <div class="csi-metric-grid">
        <div class="csi-metric">
          <div class="small">Sales</div>
          <div class="csi-metric-value">${fmtMoney(best.cur.sales)}</div>
        </div>
        <div class="csi-metric">
          <div class="small">Transactions</div>
          <div class="csi-metric-value">${fmtNum(best.cur.transactions)}</div>
        </div>
        <div class="csi-metric">
          <div class="small">Labor %</div>
          <div class="csi-metric-value">${fmtPct(best.cur.laborPct)}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div style="font-weight:800;margin-bottom:6px;color:#0f172a;">Why this shift was surfaced</div>
      <div class="csi-note">${buildShortDriverText(best)}</div>

      <div class="csi-coach-grid">
        <div class="csi-coach-box">
          <div class="small">Primary action</div>
          <div class="csi-note">${primaryAction(best.sh)}</div>
        </div>
        <div class="csi-coach-box">
          <div class="small">Secondary action</div>
          <div class="csi-note">${secondaryAction(best.sh)}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <h3 style="margin:0 0 8px 0;">Coaching Context</h3>
      <div style="display:flex;flex-direction:column;gap:7px;color:rgba(15,23,42,.78);">
        ${bullets.map(x => `<div>• ${x}</div>`).join("")}
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px 0;">Full Day View</h3>
      <div class="meta" style="margin-bottom:12px;">
        Supporting shifts stay visible, but coaching should begin with the primary shift opportunity above.
      </div>

      <div class="csi-secondary-grid">
        ${secondaryCards}
      </div>
    </div>
  `);
}

async function loadCommercialShiftInsight() {
  const resolvedStore = resolveSelectedStore();
  if (resolvedStore) setStoredActiveStore(resolvedStore);

  try {
    const truth = await loadCommercialStoreTruth({
      storeId: resolvedStore
    });

    if (truth?.storeId) setStoredActiveStore(truth.storeId);

    if (truth.state === "missing_context") {
      renderFallbackFromTruth(truth);
      return;
    }

    if (truth.state === "pending_baseline") {
      renderFallbackFromTruth(truth);
      return;
    }

    if (truth.state === "missing_baseline") {
      renderFallbackFromTruth(truth);
      return;
    }

    if (truth.state === "baseline_only") {
      renderFallbackFromTruth(truth);
      return;
    }

    const analysis = analyzeCommercialShift(truth.latestWeekRows || [], truth.previousWeekRows || []);

    if (!analysis.ok) {
      renderFallbackFromTruth(truth);
      return;
    }

    renderLiveShiftInsight(truth, analysis);
  } catch (e) {
    console.error("[commercial-shift-insight] load failed:", e);
    renderFallbackFromTruth({ storeId: resolveSelectedStore() || "selected store" });
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  injectShiftInsightStyles();
  setSMHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialShiftInsight();
});