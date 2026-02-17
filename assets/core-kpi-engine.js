// assets/core-kpi-engine.js (v1.1) — Shared KPI Engine (Pilot + Commercial)
// NON-NEGOTIABLE: NO KPI MATH CHANGES

export const BASELINE_WEEKS_EQUIV = 4; // KEEP AS-IS (pilot direction)

function normKey(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function parseNumber(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[$,%\s,]/g, "");
  return Number(cleaned);
}

function getVal(row, aliases) {
  if (!row) return null;
  const keys = Object.keys(row);
  const map = {};
  keys.forEach(k => map[normKey(k)] = k);

  for (const a of aliases) {
    const k = map[normKey(a)];
    if (k !== undefined) {
      const num = parseNumber(row[k]);
      if (isFinite(num)) return num;
    }
  }
  return null;
}

function sumMetric(rows, aliases) {
  if (!Array.isArray(rows)) return 0;
  let sum = 0;
  for (const r of rows) {
    const v = getVal(r, aliases);
    if (isFinite(v)) sum += v;
  }
  return sum;
}

export function computeKpisFromRows(rows) {
  const sales = sumMetric(rows, ["Sales", "Net Sales", "Revenue"]);
  const transactions = sumMetric(rows, ["Transactions", "Trans", "Tickets"]);
  const laborDollars = sumMetric(rows, ["Labor", "Labor$", "Labor $", "Labor Dollars"]);

  let laborPct = null;

  // If dollars available, compute % from dollars/sales
  if (sales > 0 && laborDollars > 0) {
    laborPct = (laborDollars / sales) * 100;
  } else {
    // Weighted labor% by sales if provided in rows
    let weighted = 0;
    let wsum = 0;
    for (const r of (rows || [])) {
      const s = getVal(r, ["Sales", "Net Sales", "Revenue"]);
      const lp = getVal(r, ["Labor%", "Labor %", "LaborPct", "Labor Pct"]);
      if (isFinite(s) && s > 0 && isFinite(lp)) {
        weighted += s * lp;
        wsum += s;
      }
    }
    if (wsum > 0) laborPct = weighted / wsum;
  }

  const avgTicket = (transactions > 0) ? (sales / transactions) : null;

  return { sales, transactions, laborDollars: laborDollars || null, laborPct, avgTicket };
}

// Baseline month totals → normalized weekly average (NO math change)
export function normalizeBaselineMonthToWeeklyAvg(baseMonthKpis) {
  const b = baseMonthKpis || {};
  return {
    ...b,
    sales: isFinite(b.sales) ? (b.sales / BASELINE_WEEKS_EQUIV) : b.sales,
    transactions: isFinite(b.transactions) ? (b.transactions / BASELINE_WEEKS_EQUIV) : b.transactions,
    laborDollars: isFinite(b.laborDollars) ? (b.laborDollars / BASELINE_WEEKS_EQUIV) : b.laborDollars
    // laborPct + avgTicket remain as-is
  };
}

// Universal business meaning colors
// - favorableDirection="up"   => delta>0 good
// - favorableDirection="down" => delta<0 good
export function deltaClass(delta, favorableDirection) {
  if (!isFinite(delta) || delta === 0) return "";
  if (favorableDirection === "down") return (delta < 0) ? "good" : "bad";
  return (delta > 0) ? "good" : "bad";
}

export function fmtMoney(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
export function fmtMoney2(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
export function fmtNumber(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
export function fmtPct(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  return n.toFixed(2) + "%";
}