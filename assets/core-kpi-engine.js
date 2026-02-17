// /assets/core-kpi-engine.js
// Shared KPI math + formatting engine (single source of truth)
// KEEP MATH CONSISTENT ACROSS PILOT (flqsr.com) + COMMERCIAL (frontlineqsr.com)

export const BASELINE_WEEKS_EQUIV = 4;

function normKey(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function parseNumber(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[$,%\s,]/g, "");
  return Number(cleaned);
}

export function getVal(row, aliases) {
  if (!row) return null;
  const keys = Object.keys(row);
  const map = {};
  keys.forEach((k) => (map[normKey(k)] = k));

  for (const a of aliases) {
    const k = map[normKey(a)];
    if (k !== undefined) {
      const num = parseNumber(row[k]);
      if (isFinite(num)) return num;
    }
  }
  return null;
}

export function sumMetric(rows, aliases) {
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

  // Preferred: compute from dollars if available
  if (sales > 0 && laborDollars > 0) {
    laborPct = (laborDollars / sales) * 100;
  } else {
    // Fallback: weighted average of labor% by sales
    let weighted = 0;
    let wsum = 0;
    for (const r of rows || []) {
      const s = getVal(r, ["Sales", "Net Sales", "Revenue"]);
      const lp = getVal(r, ["Labor%", "Labor %", "LaborPct", "Labor Pct"]);
      if (isFinite(s) && s > 0 && isFinite(lp)) {
        weighted += s * lp;
        wsum += s;
      }
    }
    if (wsum > 0) laborPct = weighted / wsum;
  }

  const avgTicket = transactions > 0 ? sales / transactions : null;

  return {
    sales,
    transactions,
    laborDollars: laborDollars || null,
    laborPct,
    avgTicket,
  };
}

// Normalize baseline month totals to a weekly average.
// IMPORTANT: Keep as-is (divide by 4) to match your current system direction.
export function normalizeBaselineMonthToWeeklyAvg(baseMonth) {
  return {
    ...baseMonth,
    sales: isFinite(baseMonth.sales) ? baseMonth.sales / BASELINE_WEEKS_EQUIV : baseMonth.sales,
    transactions: isFinite(baseMonth.transactions)
      ? baseMonth.transactions / BASELINE_WEEKS_EQUIV
      : baseMonth.transactions,
    laborDollars: isFinite(baseMonth.laborDollars)
      ? baseMonth.laborDollars / BASELINE_WEEKS_EQUIV
      : baseMonth.laborDollars,
    // laborPct + avgTicket remain as-is
  };
}

// Universal delta color rule (business meaning):
// - favorableDirection="up"   => delta > 0 is good
// - favorableDirection="down" => delta < 0 is good
export function deltaClass(delta, favorableDirection) {
  if (!isFinite(delta) || delta === 0) return "";
  if (favorableDirection === "down") return delta < 0 ? "good" : "bad";
  return delta > 0 ? "good" : "bad";
}

// Formatters (shared output)
export function fmtMoney(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function fmtMoney2(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
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

