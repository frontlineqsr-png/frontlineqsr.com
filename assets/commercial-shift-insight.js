// /assets/commercial-shift-insight.js (v5)
// Commercial Shift Insight — shared premium commercial design
// ✅ Uses commercial-kpi-data.js shared adapter
// ✅ Resolves active store from URL, session, localStorage, or assigned stores
// ✅ Uses approved baseline + latest approved week + previous week
// ✅ Honest fallback if shift/daypart data is not present
// ✅ Uses shared styles.css card/panel system
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

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
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
    "Throughput control: speed with accuracy, not re-makes",
    "Break discipline: stagger breaks to protect the rush"
  ],
  PM: [
    "Dinner pacing: keep the line moving and prevent late ticket times",
    "Handoff quality: mid-to-PM transition must be clean",
    "Coverage during peak: do not leave one position unsupported"
  ],
  Close: [
    "Close overlap: protect late throughput while cleaning",
    "Position lock: avoid early shutdown of stations",
    "Last-hour standards: speed and quality under thin staffing"
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
    return "Latest approved week loaded. Previous approved week is not available yet for direct shift comparison.";
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
    : "No major breakdown detected. Focus on tightening execution discipline.";
}

function buildContextBullets(ctx, latestWeekLabel, prevWeekLabel) {
  if (!ctx) return [];

  const weekPart = `Week: ${latestWeekLabel}${prevWeekLabel ? ` vs ${prevWeekLabel}` : " (no previous-week comparison yet)"}`;
  const driverPart = `Driver: ${buildShortDriverText(ctx)}`;
  const rulePart = "Rule: isolate the shift first. Do not over-correct the whole day.";

  return [weekPart, driverPart, rulePart];
}

function analyzeCommercialShift(latestRows, previousRows) {
  const currentAgg = computeShiftKpis(latestRows || []);
  const previousAgg = previousRows && previousRows.length ? computeShiftKpis(previousRows) : null;

  const hasShiftData = ["AM", "Midday", "PM", "Close"].some(
    (k) => Number(currentAgg?.[k]?.rowCount || 0) > 0
  );

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
  return `<span class="status-pill csi-pill csi-${p.tone}">${p.label}</span>`;
}

function liveBadge() {
  return `<span class="status-pill csi-pill">Live</span>`;
}

function primaryAction(shiftKey) {
  const points = FOCUS_POINTS[shiftKey] || [];
  return points[0] || "Protect execution discipline in the selected shift.";
}

function secondaryAction(shiftKey) {
  const points = FOCUS_POINTS[shiftKey] || [];
  return points[1] || "Support the shift with tighter role ownership.";
}

function metricCard(label, value, sub = "") {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : `<div class="kpi-sub">&nbsp;</div>`}
    </div>
  `;
}

function insightCallout(title, body) {
  return `
    <div class="info-box">
      <h3>${title}</h3>
      <p>${body}</p>
    </div>
  `;
}

function shiftSupportCard(shiftKey, cur, prev, isPrimary, score) {
  const header = SHIFT_LABELS[shiftKey] || shiftKey;

  let badgeHtml = "";
  if (isPrimary) {
    const tone = Number(score || 0) >= 9 ? "high" : "watch";
    badgeHtml = priorityBadge({ label: "Primary", tone });
  } else {
    badgeHtml = priorityBadge(buildPriority(score || 0));
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
    <div class="card">
      <div class="csi-card-head">
        <div>
          <h3 class="csi-card-title">${header}</h3>
          <p class="section-sub csi-tight">${status}</p>
        </div>
        <div>${badgeHtml}</div>
      </div>

      <div class="csi-mini-metrics">
        <div>
          <div class="small">Sales</div>
          <div class="csi-mini-value">${fmtMoney(cur.sales)}</div>
        </div>
        <div>
          <div class="small">Tx</div>
          <div class="csi-mini-value">${fmtNum(cur.transactions)}</div>
        </div>
        <div>
          <div class="small">Labor %</div>
          <div class="csi-mini-value">${fmtPct(cur.laborPct)}</div>
        </div>
      </div>
    </div>
  `;
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
    <section class="csi-stack">
      <div class="card">
        <div class="csi-card-head">
          <div>
            <div class="small">Primary shift opportunity</div>
            <h2 class="section-title csi-primary-title">Awaiting Shift Data</h2>
            <p class="section-sub csi-tight">${prettyStore}</p>
          </div>
          <div>${liveBadge()}</div>
        </div>

        <div class="kpi-grid csi-kpi-grid">
          ${metricCard("Sales", "—")}
          ${metricCard("Transactions", "—")}
          ${metricCard("Labor %", "—")}
        </div>

        <hr class="hr" />

        <h3 class="section-title csi-subtitle">Why this is pending</h3>
        <p class="section-sub">
          The selected weekly data does not include enough shift or daypart detail yet to isolate one primary coaching shift.
        </p>

        <div class="meta-grid">
          ${insightCallout("Current baseline status", baselineText)}
          ${insightCallout("Next wiring step", "Use weekly uploads that include Shift, Daypart, or time-based rows so the system can surface one primary shift first, then supporting shifts below.")}
        </div>
      </div>

      <div class="card">
        <h3 class="section-title csi-subtitle">Coaching Context</h3>
        <div class="csi-bullet-stack">
          <div>• Week lens: latest approved week is loaded when available</div>
          <div>• Driver: weekly rows do not contain enough shift or daypart detail, or no store scope resolved</div>
          <div>• Rule: once shift detail is present, isolate one shift first — do not coach the whole day</div>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title csi-subtitle">Full Day View</h3>
        <p class="section-sub">
          Supporting shifts stay available here once weekly rows contain usable shift or daypart detail.
        </p>

        <div class="csi-support-grid">
          <div class="card">
            <h3 class="csi-card-title">AM</h3>
            <p class="section-sub csi-tight">Awaiting usable data</p>
          </div>
          <div class="card">
            <h3 class="csi-card-title">Midday</h3>
            <p class="section-sub csi-tight">Awaiting usable data</p>
          </div>
          <div class="card">
            <h3 class="csi-card-title">PM</h3>
            <p class="section-sub csi-tight">Awaiting usable data</p>
          </div>
          <div class="card">
            <h3 class="csi-card-title">Close</h3>
            <p class="section-sub csi-tight">Awaiting usable data</p>
          </div>
        </div>
      </div>
    </section>
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
    return shiftSupportCard(
      shiftKey,
      cur,
      prev,
      shiftKey === best.sh,
      scoreMap?.[shiftKey] || 0
    );
  }).filter(Boolean).join("");

  setHtml("shiftInsightRoot", `
    <section class="csi-stack">
      <div class="card">
        <div class="csi-card-head">
          <div>
            <div class="small">Primary shift opportunity</div>
            <h2 class="section-title csi-primary-title">${SHIFT_LABELS[best.sh] || best.sh}</h2>
            <p class="section-sub csi-tight">${prettyLabel(truth.storeId)} • ${latestWeekLabel}</p>
          </div>
          <div class="csi-badge-row">
            ${priorityBadge(priority)}
            ${liveBadge()}
          </div>
        </div>

        <div class="kpi-grid csi-kpi-grid">
          ${metricCard("Sales", fmtMoney(best.cur.sales))}
          ${metricCard("Transactions", fmtNum(best.cur.transactions))}
          ${metricCard("Labor %", fmtPct(best.cur.laborPct))}
        </div>

        <hr class="hr" />

        <h3 class="section-title csi-subtitle">Why this shift was surfaced</h3>
        <p class="section-sub">${buildShortDriverText(best)}</p>

        <div class="meta-grid">
          ${insightCallout("Primary action", primaryAction(best.sh))}
          ${insightCallout("Secondary action", secondaryAction(best.sh))}
        </div>
      </div>

      <div class="card">
        <h3 class="section-title csi-subtitle">Coaching Context</h3>
        <div class="csi-bullet-stack">
          ${bullets.map(x => `<div>• ${x}</div>`).join("")}
        </div>
      </div>

      <div class="card">
        <h3 class="section-title csi-subtitle">Full Day View</h3>
        <p class="section-sub">
          Supporting shifts stay visible, but coaching should begin with the primary shift opportunity above.
        </p>

        <div class="csi-support-grid">
          ${secondaryCards}
        </div>
      </div>
    </section>
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

    const analysis = analyzeCommercialShift(
      truth.latestWeekRows || [],
      truth.previousWeekRows || []
    );

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
  setSMHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialShiftInsight();
});