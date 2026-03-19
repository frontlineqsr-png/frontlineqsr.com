// /assets/commercial-kpis.js (v2)
// Commercial KPIs — live store-level wiring
// ✅ Uses commercial-kpi-data.js shared adapter
// ✅ Uses approved baseline + latest approved week + previous week
// ✅ Falls back to session org/store when URL context is incomplete
// ✅ Aligns to pilot KPI hierarchy
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";
import {
  fmtMoney,
  fmtMoney2,
  fmtNumber,
  fmtPct,
  deltaClass
} from "./core-kpi-engine.js";

const ROOT_ID = "commercialKpisRoot";
const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orgId: String(params.get("org") || "").trim(),
    storeId: String(params.get("store") || "").trim(),
    districtId: String(params.get("district") || "").trim(),
    regionId: String(params.get("region") || "").trim()
  };
}

function getResolvedContext() {
  const s = readSession() || {};
  const p = getParams();

  const sessionOrgId = String(s.orgId || "").trim();
  const sessionStores = Array.isArray(s.assigned_store_ids) ? s.assigned_store_ids : [];
  const sessionStoreId = String(sessionStores[0] || "").trim();

  return {
    orgId: p.orgId || sessionOrgId,
    storeId: p.storeId || sessionStoreId,
    districtId: p.districtId,
    regionId: p.regionId
  };
}

function getStoreFromUrl() {
  return getResolvedContext().storeId;
}

function getDistrictFromUrl() {
  return getResolvedContext().districtId;
}

function getRegionFromUrl() {
  return getResolvedContext().regionId;
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
  if (document.getElementById("commercialKpiStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialKpiStyles";
  style.textContent = `
    #${ROOT_ID} .ckpi-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:14px;
      margin-bottom:18px;
    }

    #${ROOT_ID} .small{
      font-size:12px;
      opacity:.8;
      margin-bottom:6px;
    }

    #${ROOT_ID} .ckpi-value{
      font-size:28px;
      font-weight:700;
      margin-top:8px;
    }

    #${ROOT_ID} .ckpi-delta{
      margin-top:8px;
      opacity:.9;
    }

    #${ROOT_ID} .good{
      color: rgba(46,204,113,.95);
    }

    #${ROOT_ID} .bad{
      color: rgba(239,68,68,.95);
    }
  `;
  document.head.appendChild(style);
}

function setHeaderContext() {
  const s = readSession() || {};
  const ctx = getResolvedContext();

  const role = String(s.role || "sm").toUpperCase();
  const orgId = ctx.orgId || s.orgId || "N/A";
  const selectedStore = ctx.storeId;
  const selectedDistrict = ctx.districtId;
  const selectedRegion = ctx.regionId;

  setText("kpiContext", `Org: ${orgId} | Role: ${role} | Commercial KPIs`);

  let scopeText = "Scope: Assigned commercial access";
  if (selectedStore) {
    scopeText = `Scope: Store — ${prettyLabel(selectedStore)}`;
  } else if (selectedDistrict) {
    scopeText = `Scope: District — ${prettyLabel(selectedDistrict)}`;
  } else if (selectedRegion) {
    scopeText = `Scope: Region — ${prettyLabel(selectedRegion)}`;
  }