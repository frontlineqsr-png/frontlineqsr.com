// /assets/commercial-db.js
// Commercial Firestore org-layer DB helpers
// NO PILOT DATA. NO KPI MATH.
// Enterprise-only structure.
// ✅ Store active/inactive support added
// ✅ Archive helper added
// ✅ Active-store list helper added
// ✅ Weekly duplicate guardrail added
// ✅ Super admin reset/delete helpers added
// ✅ Weekly uploads now save as PENDING
// ✅ Sequential week lock added
// ✅ DM-and-above approval function added
// ✅ Store approved/pending pointers separated
// ✅ Rejected week can be resubmitted for the same required week
// 🚫 No KPI math changes

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================================================
   Helpers
========================================================= */

function nowIso() {
  return new Date().toISOString();
}

function normalizeIds(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map(x => x.trim()).filter(Boolean);
  return [];
}

function cleanString(v) {
  return String(v || "").trim();
}

function safeRowsArray(v) {
  return Array.isArray(v) ? v : [];
}

function makeWeekId(weekStart) {
  const ws = cleanString(weekStart);
  if (!ws) throw new Error("Week start is required.");
  return ws;
}

function addDaysIso(dateStr, days) {
  const raw = cleanString(dateStr);
  if (!raw) return "";
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function isValidIsoDateOnly(v) {
  const s = cleanString(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getLatestByFilter(weeks, predicate) {
  const arr = Array.isArray(weeks) ? weeks.filter(predicate) : [];
  return arr.length ? arr[0] : null;
}

async function recomputeWeekPointers(orgId, storeId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  const weeks = await listStoreWeeks(oid, sid);
  const latestAny = weeks.length ? weeks[0] : null;
  const latestApproved = getLatestByFilter(weeks, (w) => w.approved === true || w.status === "approved");
  const latestPending = getLatestByFilter(weeks, (w) => w.status === "pending");

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    latestWeekId: latestApproved ? (latestApproved.id || latestApproved.weekId || null) : null,
    latestWeekStart: latestApproved ? (latestApproved.weekStart || null) : null,
    latestWeekApproved: latestApproved ? !!latestApproved.approved : false,
    latestWeekAtIso: latestApproved ? nowIso() : null,

    pendingWeekId: latestPending ? (latestPending.id || latestPending.weekId || null) : null,
    pendingWeekStart: latestPending ? (latestPending.weekStart || null) : null,
    pendingWeekStatus: latestPending ? (latestPending.status || "pending") : null,
    pendingWeekAtIso: latestPending ? nowIso() : null,

    latestSubmissionWeekId: latestAny ? (latestAny.id || latestAny.weekId || null) : null,
    latestSubmissionWeekStart: latestAny ? (latestAny.weekStart || null) : null,
    latestSubmissionStatus: latestAny ? (latestAny.status || (latestAny.approved ? "approved" : "pending")) : null,

    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  return {
    latestAny: latestAny || null,
    latestApproved: latestApproved || null,
    latestPending: latestPending || null
  };
}

async function assertSequentialWeekAllowed(orgId, storeId, incomingWeekStart) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const incoming = cleanString(incomingWeekStart);

  if (!isValidIsoDateOnly(incoming)) {
    throw new Error("Week start must be in YYYY-MM-DD format.");
  }

  const status = await getStoreWeekStatus(oid, sid);

  if (status.pendingWeek) {
    throw new Error(
      `Previous week is still pending approval (${status.pendingWeek.weekStart}). Approve it before uploading another week.`
    );
  }

  const latestApproved = status.latestApprovedWeek;
  if (!latestApproved?.weekStart) return true;

  const expectedNext = addDaysIso(latestApproved.weekStart, 7);
  if (!expectedNext) return true;

  if (incoming !== expectedNext) {
    throw new Error(
      `Next required week is ${expectedNext}. This store cannot skip weeks or upload out of sequence.`
    );
  }

  return true;
}

/* =========================================================
   ORGS
========================================================= */

export async function createOrg({ name, createdByUid, createdByEmail }) {
  const orgName = String(name || "").trim();
  if (!orgName) throw new Error("Org name required.");
  if (!createdByUid) throw new Error("Missing creator UID.");

  const orgRef = await addDoc(collection(db, "orgs"), {
    name: orgName,
    createdAt: serverTimestamp(),
    createdAtIso: nowIso(),
    createdByUid: String(createdByUid || "").trim(),
    createdByEmail: String(createdByEmail || "").trim(),
    active: true
  });

  return orgRef.id;
}

export async function listOrgs() {
  const snap = await getDocs(
    query(collection(db, "orgs"), orderBy("createdAt", "desc"), limit(100))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================================================
   STORES (org subcollection)
========================================================= */

export async function createStore({ orgId, name, regionId, districtId, active = true }) {
  const oid = String(orgId || "").trim();
  const storeName = String(name || "").trim();

  if (!oid) throw new Error("Org ID required.");
  if (!storeName) throw new Error("Store name required.");

  const storeRef = await addDoc(collection(db, "orgs", oid, "stores"), {
    name: storeName,
    regionId: String(regionId || "").trim() || null,
    districtId: String(districtId || "").trim() || null,
    baselineApproved: false,
    baselineLocked: false,
    activeBaselineId: null,
    activeBaselineLabel: null,

    latestWeekId: null,
    latestWeekStart: null,
    latestWeekApproved: false,
    latestWeekAtIso: null,

    pendingWeekId: null,
    pendingWeekStart: null,
    pendingWeekStatus: null,
    pendingWeekAtIso: null,

    latestSubmissionWeekId: null,
    latestSubmissionWeekStart: null,
    latestSubmissionStatus: null,

    active: !!active,
    archived: false,
    archivedAt: null,
    archivedAtIso: null,
    archivedByUid: null,
    archivedByEmail: null,
    createdAt: serverTimestamp(),
    createdAtIso: nowIso()
  });

  return storeRef.id;
}

export async function listStores(orgId) {
  const oid = String(orgId || "").trim();
  if (!oid) throw new Error("Org ID required.");

  const snap = await getDocs(
    query(collection(db, "orgs", oid, "stores"), orderBy("createdAt", "desc"), limit(200))
  );

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listActiveStores(orgId) {
  const stores = await listStores(orgId);
  return (stores || []).filter(s => s.active !== false && s.archived !== true);
}

export async function setStoreActiveStatus({
  orgId,
  storeId,
  active,
  updatedByUid,
  updatedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (typeof active !== "boolean") throw new Error("Active status must be true or false.");

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    active: !!active,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso(),
    updatedByUid: cleanString(updatedByUid) || null,
    updatedByEmail: cleanString(updatedByEmail) || null
  }, { merge: true });

  return true;
}

export async function archiveStore({
  orgId,
  storeId,
  archivedByUid,
  archivedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    active: false,
    archived: true,
    archivedAt: serverTimestamp(),
    archivedAtIso: nowIso(),
    archivedByUid: cleanString(archivedByUid) || null,
    archivedByEmail: cleanString(archivedByEmail) || null
  }, { merge: true });

  return true;
}

/* =========================================================
   BASELINE GOVERNANCE
========================================================= */

export async function savePendingStoreBaseline({
  orgId,
  storeId,
  label,
  year,
  rows,
  uploadedByUid,
  uploadedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const baselineLabel = cleanString(label) || cleanString(year) || "baseline";
  const safeRows = safeRowsArray(rows);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!safeRows.length) throw new Error("Baseline rows required.");

  const baselineId = "pending_baseline";

  await setDoc(doc(db, "orgs", oid, "stores", sid, "baselines", baselineId), {
    label: baselineLabel,
    year: cleanString(year) || null,
    rows: safeRows,
    rowCount: safeRows.length,
    approved: false,
    active: false,
    locked: false,
    replaced: false,
    uploadedByUid: cleanString(uploadedByUid) || null,
    uploadedByEmail: cleanString(uploadedByEmail) || null,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    baselineApproved: false,
    baselineLocked: false
  }, { merge: true });

  return baselineId;
}

export async function getStoreBaselineStatus(orgId, storeId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const storeSnap = await getDoc(doc(db, "orgs", oid, "stores", sid));
  const pendingSnap = await getDoc(doc(db, "orgs", oid, "stores", sid, "baselines", "pending_baseline"));

  const store = storeSnap.exists() ? (storeSnap.data() || {}) : {};
  const pendingRaw = pendingSnap.exists() ? (pendingSnap.data() || {}) : null;

  let active = null;
  const activeBaselineId = cleanString(store.activeBaselineId);
  if (activeBaselineId) {
    const activeSnap = await getDoc(doc(db, "orgs", oid, "stores", sid, "baselines", activeBaselineId));
    if (activeSnap.exists()) active = { id: activeSnap.id, ...(activeSnap.data() || {}) };
  }

  const pending =
    pendingRaw && !pendingRaw.replaced
      ? { id: "pending_baseline", ...pendingRaw }
      : null;

  return {
    storeId: sid,
    baselineApproved: !!store.baselineApproved,
    baselineLocked: !!store.baselineLocked,
    activeBaselineId: activeBaselineId || null,
    activeBaselineLabel: store.activeBaselineLabel || null,
    pendingBaseline: pending,
    activeBaseline: active,
    storeActive: store.active !== false,
    storeArchived: store.archived === true
  };
}

export async function approvePendingStoreBaseline({
  orgId,
  storeId,
  approvedByUid,
  approvedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const pendingRef = doc(db, "orgs", oid, "stores", sid, "baselines", "pending_baseline");
  const pendingSnap = await getDoc(pendingRef);

  if (!pendingSnap.exists()) {
    throw new Error("No pending baseline found for this store.");
  }

  const pending = pendingSnap.data() || {};
  if (pending.replaced) {
    throw new Error("Pending baseline has already been replaced.");
  }

  const approvedId = `approved_${Date.now()}`;
  const approvedRef = doc(db, "orgs", oid, "stores", sid, "baselines", approvedId);

  await setDoc(approvedRef, {
    ...pending,
    approved: true,
    active: true,
    locked: true,
    replaced: false,
    approvedByUid: cleanString(approvedByUid) || null,
    approvedByEmail: cleanString(approvedByEmail) || null,
    approvedAt: serverTimestamp(),
    approvedAtIso: nowIso()
  }, { merge: true });

  await setDoc(pendingRef, {
    replaced: true,
    approved: false,
    active: false,
    locked: false,
    replacedAt: serverTimestamp(),
    replacedAtIso: nowIso()
  }, { merge: true });

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    baselineApproved: true,
    baselineLocked: true,
    activeBaselineId: approvedId,
    activeBaselineLabel: pending.label || pending.year || "approved baseline",
    baselineApprovedAt: serverTimestamp(),
    baselineApprovedAtIso: nowIso()
  }, { merge: true });

  return approvedId;
}

/* =========================================================
   RESET / DELETE HELPERS
========================================================= */

export async function deleteStoreWeek({
  orgId,
  storeId,
  weekId,
  deletedByUid,
  deletedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const wid = cleanString(weekId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!wid) throw new Error("Week ID required.");

  const weekRef = doc(db, "orgs", oid, "stores", sid, "weeks", wid);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) throw new Error("Week not found.");

  await deleteDoc(weekRef);
  const pointers = await recomputeWeekPointers(oid, sid);

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso(),
    updatedByUid: cleanString(deletedByUid) || null,
    updatedByEmail: cleanString(deletedByEmail) || null,

    latestWeekId: pointers.latestApproved ? (pointers.latestApproved.id || pointers.latestApproved.weekId || null) : null,
    latestWeekStart: pointers.latestApproved ? (pointers.latestApproved.weekStart || null) : null,
    latestWeekApproved: pointers.latestApproved ? !!pointers.latestApproved.approved : false,

    pendingWeekId: pointers.latestPending ? (pointers.latestPending.id || pointers.latestPending.weekId || null) : null,
    pendingWeekStart: pointers.latestPending ? (pointers.latestPending.weekStart || null) : null,
    pendingWeekStatus: pointers.latestPending ? (pointers.latestPending.status || "pending") : null
  }, { merge: true });

  return true;
}

export async function deleteStoreBaseline({
  orgId,
  storeId,
  deletedByUid,
  deletedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const status = await getStoreBaselineStatus(oid, sid);

  if (status.activeBaselineId) {
    await deleteDoc(doc(db, "orgs", oid, "stores", sid, "baselines", status.activeBaselineId));
  }

  if (status.pendingBaseline?.id) {
    await deleteDoc(doc(db, "orgs", oid, "stores", sid, "baselines", status.pendingBaseline.id));
  }

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    baselineApproved: false,
    baselineLocked: false,
    activeBaselineId: null,
    activeBaselineLabel: null,
    baselineApprovedAt: null,
    baselineApprovedAtIso: null,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso(),
    updatedByUid: cleanString(deletedByUid) || null,
    updatedByEmail: cleanString(deletedByEmail) || null
  }, { merge: true });

  return true;
}

export async function resetStoreData({
  orgId,
  storeId,
  resetByUid,
  resetByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const weeks = await listStoreWeeks(oid, sid);
  for (const w of weeks) {
    await deleteDoc(doc(db, "orgs", oid, "stores", sid, "weeks", w.id || w.weekId));
  }

  const baselineStatus = await getStoreBaselineStatus(oid, sid);

  if (baselineStatus.activeBaselineId) {
    await deleteDoc(doc(db, "orgs", oid, "stores", sid, "baselines", baselineStatus.activeBaselineId));
  }

  if (baselineStatus.pendingBaseline?.id) {
    await deleteDoc(doc(db, "orgs", oid, "stores", sid, "baselines", baselineStatus.pendingBaseline.id));
  }

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    baselineApproved: false,
    baselineLocked: false,
    activeBaselineId: null,
    activeBaselineLabel: null,

    latestWeekId: null,
    latestWeekStart: null,
    latestWeekApproved: false,
    latestWeekAtIso: null,

    pendingWeekId: null,
    pendingWeekStart: null,
    pendingWeekStatus: null,
    pendingWeekAtIso: null,

    latestSubmissionWeekId: null,
    latestSubmissionWeekStart: null,
    latestSubmissionStatus: null,

    baselineApprovedAt: null,
    baselineApprovedAtIso: null,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso(),
    updatedByUid: cleanString(resetByUid) || null,
    updatedByEmail: cleanString(resetByEmail) || null
  }, { merge: true });

  return true;
}

/* =========================================================
   WEEKLY UPLOADS
========================================================= */

export async function saveStoreWeek({
  orgId,
  storeId,
  weekStart,
  rows,
  uploadedByUid,
  uploadedByEmail,
  note
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const ws = cleanString(weekStart);
  const weekId = makeWeekId(ws);
  const safeRows = safeRowsArray(rows);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!ws) throw new Error("Week start required.");
  if (!safeRows.length) throw new Error("Weekly rows required.");

  await assertSequentialWeekAllowed(oid, sid, ws);

  const weekRef = doc(db, "orgs", oid, "stores", sid, "weeks", weekId);
  const existingWeekSnap = await getDoc(weekRef);

  if (existingWeekSnap.exists()) {
    const existingWeek = existingWeekSnap.data() || {};

    if (existingWeek.status === "approved" || existingWeek.approved === true) {
      throw new Error(
        `This week is already approved for this store (${ws}). Approved weeks cannot be overwritten.`
      );
    }

    if (existingWeek.status === "pending") {
      throw new Error(
        `This week is already pending approval for this store (${ws}). Wait for approval before submitting again.`
      );
    }

    if (existingWeek.status === "rejected") {
      await deleteDoc(weekRef);
    } else {
      throw new Error(
        `This week already exists for this store (${ws}). Admin must remove or unlock it before resubmission.`
      );
    }
  }

  await setDoc(weekRef, {
    weekId,
    weekStart: ws,
    rows: safeRows,
    rowCount: safeRows.length,

    approved: false,
    pendingApproval: true,
    status: "pending",

    active: true,
    locked: true,
    note: cleanString(note) || null,

    uploadedByUid: cleanString(uploadedByUid) || null,
    uploadedByEmail: cleanString(uploadedByEmail) || null,

    approvedByUid: null,
    approvedByEmail: null,
    approvedAt: null,
    approvedAtIso: null,

    rejectedByUid: null,
    rejectedByEmail: null,
    rejectedAt: null,
    rejectedAtIso: null,
    rejectedReason: null,

    createdAt: serverTimestamp(),
    createdAtIso: nowIso(),
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    pendingWeekId: weekId,
    pendingWeekStart: ws,
    pendingWeekStatus: "pending",
    pendingWeekAtIso: nowIso(),

    latestSubmissionWeekId: weekId,
    latestSubmissionWeekStart: ws,
    latestSubmissionStatus: "pending",

    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  return weekId;
}

export async function approveStoreWeek({
  orgId,
  storeId,
  weekId,
  approvedByUid,
  approvedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const wid = cleanString(weekId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!wid) throw new Error("Week ID required.");

  const weekRef = doc(db, "orgs", oid, "stores", sid, "weeks", wid);
  const weekSnap = await getDoc(weekRef);

  if (!weekSnap.exists()) {
    throw new Error("Week not found.");
  }

  const week = weekSnap.data() || {};
  if (week.status === "approved" || week.approved === true) {
    return wid;
  }

  await setDoc(weekRef, {
    approved: true,
    pendingApproval: false,
    status: "approved",
    approvedByUid: cleanString(approvedByUid) || null,
    approvedByEmail: cleanString(approvedByEmail) || null,
    approvedAt: serverTimestamp(),
    approvedAtIso: nowIso(),
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  const pointers = await recomputeWeekPointers(oid, sid);

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    latestWeekId: pointers.latestApproved ? (pointers.latestApproved.id || pointers.latestApproved.weekId || null) : null,
    latestWeekStart: pointers.latestApproved ? (pointers.latestApproved.weekStart || null) : null,
    latestWeekApproved: pointers.latestApproved ? !!pointers.latestApproved.approved : false,
    latestWeekAtIso: pointers.latestApproved ? nowIso() : null,

    pendingWeekId: pointers.latestPending ? (pointers.latestPending.id || pointers.latestPending.weekId || null) : null,
    pendingWeekStart: pointers.latestPending ? (pointers.latestPending.weekStart || null) : null,
    pendingWeekStatus: pointers.latestPending ? (pointers.latestPending.status || "pending") : null,
    pendingWeekAtIso: pointers.latestPending ? nowIso() : null,

    latestSubmissionWeekId: pointers.latestAny ? (pointers.latestAny.id || pointers.latestAny.weekId || null) : null,
    latestSubmissionWeekStart: pointers.latestAny ? (pointers.latestAny.weekStart || null) : null,
    latestSubmissionStatus: pointers.latestAny ? (pointers.latestAny.status || (pointers.latestAny.approved ? "approved" : "pending")) : null,

    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  return wid;
}

export async function rejectStoreWeek({
  orgId,
  storeId,
  weekId,
  rejectedByUid,
  rejectedByEmail,
  reason
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const wid = cleanString(weekId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!wid) throw new Error("Week ID required.");

  const weekRef = doc(db, "orgs", oid, "stores", sid, "weeks", wid);
  const weekSnap = await getDoc(weekRef);

  if (!weekSnap.exists()) {
    throw new Error("Week not found.");
  }

  await setDoc(weekRef, {
    approved: false,
    pendingApproval: false,
    status: "rejected",
    rejectedByUid: cleanString(rejectedByUid) || null,
    rejectedByEmail: cleanString(rejectedByEmail) || null,
    rejectedReason: cleanString(reason) || null,
    rejectedAt: serverTimestamp(),
    rejectedAtIso: nowIso(),
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  const pointers = await recomputeWeekPointers(oid, sid);

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    pendingWeekId: pointers.latestPending ? (pointers.latestPending.id || pointers.latestPending.weekId || null) : null,
    pendingWeekStart: pointers.latestPending ? (pointers.latestPending.weekStart || null) : null,
    pendingWeekStatus: pointers.latestPending ? (pointers.latestPending.status || "pending") : null,

    latestSubmissionWeekId: pointers.latestAny ? (pointers.latestAny.id || pointers.latestAny.weekId || null) : null,
    latestSubmissionWeekStart: pointers.latestAny ? (pointers.latestAny.weekStart || null) : null,
    latestSubmissionStatus: pointers.latestAny ? (pointers.latestAny.status || (pointers.latestAny.approved ? "approved" : "pending")) : null,

    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  return wid;
}

export async function getStoreWeek(orgId, storeId, weekId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const wid = cleanString(weekId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!wid) throw new Error("Week ID required.");

  const snap = await getDoc(doc(db, "orgs", oid, "stores", sid, "weeks", wid));
  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() || {}) };
}

export async function listStoreWeeks(orgId, storeId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const snap = await getDocs(
    query(
      collection(db, "orgs", oid, "stores", sid, "weeks"),
      orderBy("weekStart", "desc"),
      limit(104)
    )
  );

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLatestStoreWeek(orgId, storeId) {
  const weeks = await listStoreWeeks(orgId, storeId);
  return weeks.length ? weeks[0] : null;
}

export async function getLatestApprovedStoreWeek(orgId, storeId) {
  const weeks = await listStoreWeeks(orgId, storeId);
  return getLatestByFilter(weeks, (w) => w.approved === true || w.status === "approved");
}

export async function getLatestPendingStoreWeek(orgId, storeId) {
  const weeks = await listStoreWeeks(orgId, storeId);
  return getLatestByFilter(weeks, (w) => w.status === "pending");
}

export async function getStoreWeekStatus(orgId, storeId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const weeks = await listStoreWeeks(oid, sid);
  const latestWeek = weeks.length ? weeks[0] : null;
  const latestApprovedWeek = getLatestByFilter(weeks, (w) => w.approved === true || w.status === "approved");
  const pendingWeek = getLatestByFilter(weeks, (w) => w.status === "pending");

  return {
    storeId: sid,
    latestWeek: latestWeek || null,
    latestApprovedWeek: latestApprovedWeek || null,
    pendingWeek: pendingWeek || null,
    hasWeeks: weeks.length > 0,
    hasApprovedWeeks: !!latestApprovedWeek,
    hasPendingWeek: !!pendingWeek
  };
}

/* =========================================================
   USER ACCESS
========================================================= */

export async function upsertUserAccess({
  uid,
  email,
  orgId,
  role,
  commercialAccess,
  active,
  assignedStoreIds,
  assignedDistrictIds,
  assignedRegionIds,
  isSuperAdmin
}) {
  const _uid = String(uid || "").trim();
  const _email = String(email || "").trim().toLowerCase();
  const _orgId = String(orgId || "").trim();

  if (!_uid) throw new Error("UID required.");
  if (!_email) throw new Error("Email required.");

  await setDoc(doc(db, "commercial_users", _uid), {
    uid: _uid,
    email: _email,
    orgId: _orgId || null,
    role: String(role || "SM").trim().toUpperCase(),
    commercialAccess: !!commercialAccess,
    isSuperAdmin: !!isSuperAdmin,
    active: !!active,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  if (_orgId) {
    await setDoc(doc(db, "orgs", _orgId, "users", _uid), {
      uid: _uid,
      email: _email,
      role: String(role || "SM").trim().toUpperCase(),
      commercialAccess: !!commercialAccess,
      isSuperAdmin: !!isSuperAdmin,
      assignedStoreIds: normalizeIds(assignedStoreIds),
      assignedDistrictIds: normalizeIds(assignedDistrictIds),
      assignedRegionIds: normalizeIds(assignedRegionIds),
      active: !!active,
      updatedAt: serverTimestamp(),
      updatedAtIso: nowIso()
    }, { merge: true });
  }

  return true;
}