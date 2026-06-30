import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Trash2, ChevronLeft, Building2, Calendar, IndianRupee, Users,
  ClipboardList, Download, Check, AlertCircle, X, Lock, Delete, RefreshCw,
} from "lucide-react";

const APP_NAME = "AMCRO INDIA WMS";
const APP_SUBTITLE = "Worker Management System";

const SITES = [
  { id: "Grand Omaxe Site", name: "Grand Omaxe Site", location: "Lucknow", passcode: "1828" },
  { id: "Meridian Site", name: "Meridian Site", location: "Lucknow", passcode: "3128" },
];

const ADMIN_PASSCODE = "810128";

const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwdyoaLKPnDvu64okpbbooRDCIBBk_xqKVmAuE6-cD-oAaaXfPyokb2RSGpGGnF3UPRhg/exec";

async function apiPost(body) {
  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Unexpected response: ${text.slice(0, 200)}`); }
  if (!parsed || parsed.ok !== true) throw new Error(parsed?.error || "Unknown error from script");
  return parsed;
}

async function apiGet(params) {
  const url = new URL(SHEETS_WEBHOOK_URL);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Unexpected response: ${text.slice(0, 200)}`); }
  if (!parsed || parsed.ok !== true) throw new Error(parsed?.error || "Unknown error from script");
  return parsed;
}

async function saveEntry(siteName, date, rows) {
  return apiPost({
    action: "saveEntry",
    site: siteName,
    date,
    rows: rows.map((r) => ({
      name: r.name,
      siteName: r.siteName || "",
      workType: r.workType || "",
      wage: Number(r.wage) || 0,
      status: r.status === "paid" ? "Paid" : "Unpaid",
    })),
  });
}

async function loadEntry(siteName, date) {
  const data = await apiGet({ action: "getEntry", site: siteName, date });
  return data.rows && data.rows.length
    ? { rows: data.rows.map((r) => ({ ...r, status: r.status === "Paid" ? "paid" : "unpaid" })) }
    : null;
}

async function listAllEntries() {
  const data = await apiGet({ action: "listAll" });
  return data.entries || [];
}

async function updateRowStatus(siteName, date, rowIndex, status) {
  return apiPost({ action: "setStatus", site: siteName, date, rowIndex, status: status === "paid" ? "Paid" : "Unpaid" });
}

const todayStr = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
};

const fmtDateLong = (isoStr) => {
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const fmtINR = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- Shared UI pieces ---------- */

function Logo({ size = 30 }) {
  return (
    <div className="logo-mark" style={{ width: size, height: size }}>
      <Building2 size={size * 0.58} strokeWidth={2.3} />
    </div>
  );
}

function TopBar({ title, subtitle, onBack, right }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <ChevronLeft size={22} />
          </button>
        )}
        <Logo />
        <div className="topbar-text">
          <div className="topbar-title">{title}</div>
          {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
        </div>
      </div>
      {right && <div className="topbar-right">{right}</div>}
    </div>
  );
}

function PinPad({ length, value, onChange, onSubmit }) {
  const handleKey = (k) => {
    if (k === "back") { onChange(value.slice(0, -1)); return; }
    if (value.length >= length) return;
    const next = value + k;
    onChange(next);
    if (next.length === length) setTimeout(() => onSubmit(next), 80);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if (e.key === "Backspace") handleKey("back");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [value]);

  return (
    <div className="pinpad">
      <div className="pin-dots">
        {Array.from({ length }).map((_, i) => (
          <span key={i} className={`pin-dot ${i < value.length ? "filled" : ""}`} />
        ))}
      </div>
      <div className="pin-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) =>
          k === "" ? (
            <div key={i} className="pin-key-spacer" />
          ) : (
            <button key={i} type="button" className="pin-key" onClick={() => handleKey(k)} aria-label={k === "back" ? "Backspace" : k}>
              {k === "back" ? <Delete size={20} /> : k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function PasscodeGate({ title, subtitle, length, expected, onSuccess, onBack }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (entered) => {
    if (entered === expected) {
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => { setValue(""); setShake(false); }, 420);
    }
  };

  return (
    <div className="screen">
      <TopBar title={title} subtitle={APP_NAME} onBack={onBack} />
      <div className="content pin-content">
        <div className={`pin-lock-icon ${shake ? "shake" : ""}`}>
          <Lock size={26} />
        </div>
        <p className="pin-instruction">{subtitle}</p>
        <PinPad length={length} value={value} onChange={(v) => { setValue(v); setError(false); }} onSubmit={handleSubmit} />
        {error && (
          <p className="pin-error">
            <AlertCircle size={14} /> Incorrect passcode. Try again.
          </p>
        )}
      </div>
    </div>
  );
}

function RoleGate({ onPickRole }) {
  return (
    <div className="screen gate-screen">
      <div className="gate-top">
        <Logo size={48} />
        <h1 className="gate-company">{APP_NAME}</h1>
        <p className="gate-sub">{APP_SUBTITLE}</p>
      </div>

      <div className="gate-cards">
        <button className="gate-card" onClick={() => onPickRole("supervisor")}>
          <div className="gate-card-icon sup">
            <ClipboardList size={26} />
          </div>
          <div className="gate-card-text">
            <div className="gate-card-title">I'm a Supervisor</div>
            <div className="gate-card-desc">Mark today's workers &amp; wages for my site</div>
          </div>
        </button>

        <button className="gate-card" onClick={() => onPickRole("owner")}>
          <div className="gate-card-icon own">
            <Building2 size={26} />
          </div>
          <div className="gate-card-text">
            <div className="gate-card-title">I'm the Owner / Admin</div>
            <div className="gate-card-desc">View &amp; export records across all sites</div>
          </div>
        </button>
      </div>

      <p className="gate-footnote">Records save directly to Google Sheets and sync across every device.</p>
    </div>
  );
}

function SitePicker({ onPick, onBack }) {
  return (
    <div className="screen">
      <TopBar title={APP_NAME} subtitle="Select your site" onBack={onBack} />
      <div className="content">
        <div className="site-list">
          {SITES.map((s) => (
            <button key={s.id} className="site-row" onClick={() => onPick(s)}>
              <div className="site-row-icon"><Building2 size={20} /></div>
              <div className="site-row-text">
                <span className="site-row-name">{s.name}</span>
                <span className="site-row-loc">{s.location}</span>
              </div>
              <ChevronLeft size={18} className="site-row-arrow" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkerRow({ row, onChange, onRemove }) {
  const isPaid = row.status === "paid";
  return (
    <div className="worker-row">
      <div className="worker-row-num">{row.idx}</div>
      <div className="worker-row-main">
        <div className="worker-row-fields">
          <input
            className="field-input name-input"
            type="text"
            placeholder="Worker name"
            value={row.name}
            onChange={(e) => onChange({ ...row, name: e.target.value })}
          />
          <div className="wage-input-wrap">
            <IndianRupee size={15} className="wage-prefix-icon" />
            <input
              className="field-input wage-input"
              type="number"
              inputMode="decimal"
              placeholder="Wage"
              min="0"
              value={row.wage}
              onChange={(e) => onChange({ ...row, wage: e.target.value })}
            />
          </div>
          <button className="row-remove" onClick={onRemove} aria-label="Remove worker">
            <Trash2 size={17} />
          </button>
        </div>
        <div className="worker-row-fields secondary">
          <input
            className="field-input sitename-input"
            type="text"
            placeholder="Site name"
            value={row.siteName || ""}
            onChange={(e) => onChange({ ...row, siteName: e.target.value })}
          />
          <input
            className="field-input worktype-input"
            type="text"
            placeholder="Work type (e.g. Mason)"
            value={row.workType || ""}
            onChange={(e) => onChange({ ...row, workType: e.target.value })}
          />
        </div>
        <div className="status-toggle" role="group" aria-label="Payment status">
          <button type="button" className={`status-pill unpaid ${!isPaid ? "active" : ""}`} onClick={() => onChange({ ...row, status: "unpaid" })}>
            Unpaid
          </button>
          <button type="button" className={`status-pill paid ${isPaid ? "active" : ""}`} onClick={() => onChange({ ...row, status: "paid" })}>
            Paid
          </button>
        </div>
      </div>
    </div>
  );
}

function SupervisorEntry({ site, onBack }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([{ id: uid(), idx: 1, name: "", wage: "", siteName: "", workType: "", status: "unpaid" }]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadEntry(site.name, date)
      .then((entry) => {
        if (!active) return;
        if (entry && entry.rows && entry.rows.length > 0) {
          setRows(entry.rows.map((r, i) => ({ id: uid(), ...r, idx: i + 1 })));
        } else {
          setRows([{ id: uid(), idx: 1, name: "", wage: "", siteName: "", workType: "", status: "unpaid" }]);
        }
      })
      .catch(() => {
        setRows([{ id: uid(), idx: 1, name: "", wage: "", siteName: "", workType: "", status: "unpaid" }]);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [site.name, date]);

  const renumber = (list) => list.map((r, i) => ({ ...r, idx: i + 1 }));

  const updateRow = (updated) => setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const addRow = () =>
    setRows((prev) => renumber([...prev, { id: uid(), name: "", wage: "", siteName: "", workType: "", status: "unpaid" }]));

  const removeRow = (id) =>
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return renumber(next.length ? next : [{ id: uid(), name: "", wage: "", siteName: "", workType: "", status: "unpaid" }]);
    });

  const total = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.wage) || 0), 0), [rows]);
  const filledCount = useMemo(() => rows.filter((r) => r.name.trim()).length, [rows]);

  const handleSave = async () => {
    const cleanRows = rows.filter((r) => r.name.trim());
    if (cleanRows.length === 0) {
      setToast({ type: "error", msg: "Add at least one worker before saving." });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setSaveState("saving");
    try {
      await saveEntry(site.name, date, cleanRows);
      setSaveState("saved");
      setToast({ type: "success", msg: `Saved ${cleanRows.length} worker${cleanRows.length > 1 ? "s" : ""} for ${fmtDateLong(date)} · synced to Sheet` });
      setTimeout(() => { setToast(null); setSaveState("idle"); }, 2600);
    } catch (e) {
      setSaveState("error");
      setToast({ type: "error", msg: `Could not save: ${e.message || "unknown error"}` });
      setTimeout(() => { setToast(null); setSaveState("idle"); }, 6000);
    }
  };

  return (
    <div className="screen">
      <TopBar title={site.name} subtitle={site.location} onBack={onBack} />

      <div className="content with-bottom-bar">
        <div className="date-row">
          <Calendar size={18} className="date-icon" />
          <input type="date" className="date-input" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
          <span className="date-label">{fmtDateLong(date)}</span>
        </div>

        {loading ? (
          <div className="loading-block">Loading entry…</div>
        ) : (
          <>
            <div className="rows-header"><span>Workers ({filledCount})</span></div>
            <div className="rows-list">
              {rows.map((row) => (
                <WorkerRow key={row.id} row={row} onChange={updateRow} onRemove={() => removeRow(row.id)} />
              ))}
            </div>
            <button className="add-row-btn" onClick={addRow}>
              <Plus size={18} /> Add worker
            </button>
          </>
        )}
      </div>

      {!loading && (
        <div className="bottom-bar">
          <div className="bottom-bar-total">
            <span className="bottom-bar-label">Day total</span>
            <span className="bottom-bar-amount"><IndianRupee size={16} />{fmtINR(total)}</span>
          </div>
          <button className={`save-btn ${saveState}`} onClick={handleSave} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? (<><Check size={18} /> Saved</>) : "Save day's record"}
          </button>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

function OwnerDashboard({ onBack }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [siteFilter, setSiteFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(todayStr().slice(0, 7));
  const [detail, setDetail] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    listAllEntries()
      .then((data) => setEntries(data))
      .catch((e) => setLoadError(e.message || "Could not load records"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.slice(0, 7)));
    set.add(todayStr().slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (siteFilter === "all" ? true : e.site === siteFilter))
      .filter((e) => (monthFilter ? e.date.slice(0, 7) === monthFilter : true))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries, siteFilter, monthFilter]);

  const grandTotal = useMemo(() => filtered.reduce((sum, e) => sum + e.rows.reduce((s, r) => s + (Number(r.wage) || 0), 0), 0), [filtered]);
  const totalWorkerDays = useMemo(() => filtered.reduce((sum, e) => sum + e.rows.length, 0), [filtered]);
  const pendingTotal = useMemo(
    () => filtered.reduce((sum, e) => sum + e.rows.filter((r) => r.status !== "paid" && r.status !== "Paid").reduce((s, r) => s + (Number(r.wage) || 0), 0), 0),
    [filtered]
  );

  const perWorkerTotals = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      e.rows.forEach((r) => {
        const key = r.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: r.name.trim(), days: 0, total: 0, pending: 0 });
        const v = map.get(key);
        v.days += 1;
        v.total += Number(r.wage) || 0;
        if (r.status !== "paid" && r.status !== "Paid") v.pending += Number(r.wage) || 0;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const setRowStatus = async (entry, rowIndex, status) => {
    const updatedRows = entry.rows.map((r, i) => (i === rowIndex ? { ...r, status } : r));
    setEntries((prev) => prev.map((e) => (e.site === entry.site && e.date === entry.date ? { ...e, rows: updatedRows } : e)));
    setDetail((d) => (d && d.site === entry.site && d.date === entry.date ? { ...d, rows: updatedRows } : d));
    try {
      await updateRowStatus(entry.site, entry.date, rowIndex, status);
    } catch {
      refresh();
    }
  };

  const exportCSV = () => {
    const lines = [["Site", "Date", "Worker Name", "Site Name", "Work Type", "Wage", "Payment Status"].join(",")];
    filtered.forEach((e) => {
      e.rows.forEach((r) => {
        lines.push([
          e.site,
          e.date,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${(r.siteName || "").replace(/"/g, '""')}"`,
          `"${(r.workType || "").replace(/"/g, '""')}"`,
          Number(r.wage) || 0,
          r.status === "paid" || r.status === "Paid" ? "Paid" : "Unpaid",
        ].join(","));
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wage-records-${monthFilter}-${siteFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen">
      <TopBar
        title="Owner Dashboard"
        subtitle={APP_NAME}
        onBack={onBack}
        right={
          <button className="icon-btn" onClick={exportCSV} aria-label="Export CSV" title="Export CSV">
            <Download size={20} />
          </button>
        }
      />

      <div className="content">
        <div className="filter-row">
          <select className="filter-select" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="all">All sites</option>
            {SITES.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}
          </select>
          <select className="filter-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>
            ))}
          </select>
          <button className="icon-btn refresh-btn" onClick={refresh} title="Refresh"><RefreshCw size={16} /></button>
        </div>

        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-label">Total paid out</span>
            <span className="stat-value"><IndianRupee size={18} />{fmtINR(grandTotal)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Worker-days</span>
            <span className="stat-value">{totalWorkerDays}</span>
          </div>
          <div className="stat-card pending">
            <span className="stat-label">Pending payment</span>
            <span className="stat-value pending-value"><IndianRupee size={18} />{fmtINR(pendingTotal)}</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-block">Loading records…</div>
        ) : loadError ? (
          <div className="empty-block">
            <AlertCircle size={28} />
            <p>Could not load records.</p>
            <span>{loadError}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-block">
            <Users size={28} />
            <p>No records yet for this filter.</p>
            <span>Once supervisors submit entries, they'll show up here.</span>
          </div>
        ) : (
          <>
            <div className="section-label">By worker (this month)</div>
            <div className="worker-summary-list">
              {perWorkerTotals.map((w) => (
                <div className="worker-summary-row" key={w.name}>
                  <span className="worker-summary-name">{w.name}</span>
                  <span className="worker-summary-days">{w.days} day{w.days > 1 ? "s" : ""}</span>
                  {w.pending > 0 && (
                    <span className="worker-summary-pending"><IndianRupee size={11} />{fmtINR(w.pending)} due</span>
                  )}
                  <span className="worker-summary-total"><IndianRupee size={13} />{fmtINR(w.total)}</span>
                </div>
              ))}
            </div>

            <div className="section-label">Daily entries</div>
            <div className="entry-list">
              {filtered.map((e) => {
                const dayTotal = e.rows.reduce((s, r) => s + (Number(r.wage) || 0), 0);
                const pendingCount = e.rows.filter((r) => r.status !== "paid" && r.status !== "Paid").length;
                return (
                  <button className="entry-card" key={e.site + e.date} onClick={() => setDetail(e)}>
                    <div className="entry-card-left">
                      <span className="entry-card-date">{fmtDateLong(e.date)}</span>
                      <span className="entry-card-site">{e.site}</span>
                    </div>
                    <div className="entry-card-right">
                      <span className="entry-card-count">
                        {e.rows.length} worker{e.rows.length > 1 ? "s" : ""}
                        {pendingCount > 0 && <span className="entry-card-pending-dot" title={`${pendingCount} unpaid`} />}
                      </span>
                      <span className="entry-card-total"><IndianRupee size={14} />{fmtINR(dayTotal)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{detail.site}</div>
                <div className="modal-subtitle">{fmtDateLong(detail.date)}</div>
              </div>
              <button className="icon-btn dark" onClick={() => setDetail(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {detail.rows.map((r, i) => (
                <div className="modal-row" key={i}>
                  <span className="modal-row-text">
                    <span className="modal-row-name">{r.name}</span>
                    {(r.siteName || r.workType) && (
                      <span className="modal-row-meta">{[r.siteName, r.workType].filter(Boolean).join(" · ")}</span>
                    )}
                  </span>
                  <span className="modal-row-right">
                    <span className="modal-row-wage"><IndianRupee size={13} />{fmtINR(r.wage)}</span>
                    <button
                      type="button"
                      className={`status-pill small ${r.status === "paid" || r.status === "Paid" ? "paid active" : "unpaid active"}`}
                      onClick={() => setRowStatus(detail, i, r.status === "paid" || r.status === "Paid" ? "unpaid" : "paid")}
                    >
                      {r.status === "paid" || r.status === "Paid" ? "Paid" : "Unpaid"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <span>Total</span>
              <span><IndianRupee size={15} />{fmtINR(detail.rows.reduce((s, r) => s + (Number(r.wage) || 0), 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(null);
  const [site, setSite] = useState(null);
  const [unlockedSiteId, setUnlockedSiteId] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const reset = () => { setRole(null); setSite(null); setUnlockedSiteId(null); setAdminUnlocked(false); };

  let screen;
  if (!role) {
    screen = <RoleGate onPickRole={setRole} />;
  } else if (role === "supervisor" && !site) {
    screen = <SitePicker onPick={setSite} onBack={reset} />;
  } else if (role === "supervisor" && site && unlockedSiteId !== site.id) {
    screen = (
      <PasscodeGate
        title={site.name}
        subtitle={`Enter the 4-digit passcode for ${site.name}`}
        length={4}
        expected={site.passcode}
        onSuccess={() => setUnlockedSiteId(site.id)}
        onBack={() => setSite(null)}
      />
    );
  } else if (role === "supervisor" && site && unlockedSiteId === site.id) {
    screen = <SupervisorEntry site={site} onBack={() => { setSite(null); setUnlockedSiteId(null); }} />;
  } else if (role === "owner" && !adminUnlocked) {
    screen = (
      <PasscodeGate
        title="Admin access"
        subtitle="Enter the 6-digit admin passcode"
        length={6}
        expected={ADMIN_PASSCODE}
        onSuccess={() => setAdminUnlocked(true)}
        onBack={reset}
      />
    );
  } else if (role === "owner" && adminUnlocked) {
    screen = <OwnerDashboard onBack={reset} />;
  }

  return (
    <div className="app-root">
      <style>{CSS}</style>
      {screen}
    </div>
  );
}

const CSS = `
:root {
  --navy: #0B2545;
  --blue: #1456D6;
  --sky: #38BDF8;
  --sky-soft: #E6F7FF;
  --white: #FFFFFF;
  --bg: #F4F8FC;
  --ink: #0B1320;
  --ink-soft: #51637A;
  --line: #DCE6F0;
  --success: #0E8A4B;
  --success-soft: #E7F7EE;
  --danger: #D6263B;
  --danger-soft: #FDEAEC;
  --radius: 12px;
}

* { box-sizing: border-box; }

html, body { background: var(--bg); }

.app-root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  width: 100%;
  -webkit-font-smoothing: antialiased;
}

.screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 560px;
  margin: 0 auto;
  background: var(--bg);
  position: relative;
}

@media (min-width: 860px) {
  .screen { max-width: 720px; box-shadow: 0 0 0 1px var(--line); min-height: 100vh; }
  .app-root { display: flex; justify-content: center; }
}

.logo-mark {
  border-radius: 8px;
  background: linear-gradient(135deg, var(--sky), var(--blue));
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(20,86,214,0.35);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: var(--navy);
  color: var(--white);
  position: sticky;
  top: 0;
  z-index: 20;
}
.topbar-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
.topbar-text { min-width: 0; }
.topbar-title { font-size: 16px; font-weight: 800; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.01em; }
.topbar-subtitle { font-size: 12px; color: #9FB6D9; line-height: 1.3; }
.icon-btn {
  background: rgba(255,255,255,0.10);
  border: none; color: #fff; border-radius: 8px;
  width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
}
.icon-btn:hover { background: rgba(255,255,255,0.2); }
.icon-btn.dark { background: var(--sky-soft); color: var(--navy); }
.icon-btn.dark:hover { background: #CFEFFF; }
.icon-btn:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }

.content { flex: 1; padding: 20px 18px 28px; overflow-y: auto; }
.content.with-bottom-bar { padding-bottom: 112px; }

.gate-screen { justify-content: space-between; padding: 30px 22px; min-height: 100vh; background: linear-gradient(180deg, var(--bg) 0%, var(--white) 60%); }
.gate-top { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 10vh; gap: 8px; }
.gate-company { font-size: 23px; font-weight: 900; margin: 16px 0 0; letter-spacing: 0.01em; color: var(--navy); }
.gate-sub { color: var(--ink-soft); font-size: 14px; margin: 0; font-weight: 600; }
.gate-cards { display: flex; flex-direction: column; gap: 13px; margin: 34px 0; }
.gate-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--white); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 17px; text-align: left; cursor: pointer; box-shadow: 0 2px 8px rgba(11,37,69,0.06);
}
.gate-card:hover { border-color: var(--sky); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(20,86,214,0.12); }
.gate-card:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }
.gate-card-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.gate-card-icon.sup { background: var(--sky-soft); color: var(--blue); }
.gate-card-icon.own { background: var(--navy); color: var(--sky); }
.gate-card-title { font-weight: 800; font-size: 15px; margin-bottom: 2px; color: var(--ink); }
.gate-card-desc { font-size: 13px; color: var(--ink-soft); line-height: 1.4; }
.gate-footnote { text-align: center; font-size: 12px; color: var(--ink-soft); margin: 0; }

.site-list { display: flex; flex-direction: column; gap: 11px; }
.site-row {
  display: flex; align-items: center; gap: 12px;
  background: var(--white); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 15px; cursor: pointer; color: var(--ink); text-align: left;
}
.site-row:hover { border-color: var(--sky); box-shadow: 0 2px 10px rgba(20,86,214,0.08); }
.site-row:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }
.site-row-icon { width: 42px; height: 42px; border-radius: 10px; background: var(--sky-soft); color: var(--blue); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.site-row-text { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.site-row-name { font-weight: 800; font-size: 15px; }
.site-row-loc { font-size: 12.5px; color: var(--ink-soft); }
.site-row-arrow { color: var(--line); transform: rotate(180deg); flex-shrink: 0; }

.pin-content { display: flex; flex-direction: column; align-items: center; padding-top: 44px; }
.pin-lock-icon {
  width: 58px; height: 58px; border-radius: 50%; background: var(--sky-soft); color: var(--blue);
  display: flex; align-items: center; justify-content: center; margin-bottom: 18px;
}
.pin-lock-icon.shake { animation: pin-shake 0.4s; }
@keyframes pin-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
.pin-instruction { font-size: 14px; color: var(--ink-soft); text-align: center; margin: 0 0 30px; max-width: 270px; }
.pinpad { display: flex; flex-direction: column; align-items: center; gap: 30px; }
.pin-dots { display: flex; gap: 14px; }
.pin-dot { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--line); background: transparent; transition: background 0.15s, border-color 0.15s; }
.pin-dot.filled { background: var(--blue); border-color: var(--blue); }
.pin-keys { display: grid; grid-template-columns: repeat(3, 64px); gap: 14px; }
.pin-key {
  width: 64px; height: 64px; border-radius: 50%; border: 1px solid var(--line); background: var(--white);
  font-size: 20px; font-weight: 700; color: var(--ink); cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.pin-key:hover { background: var(--sky-soft); border-color: var(--sky); }
.pin-key:active { transform: scale(0.95); }
.pin-key:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }
.pin-key-spacer { width: 64px; height: 64px; }
.pin-error { display: flex; align-items: center; gap: 6px; color: var(--danger); font-size: 13px; font-weight: 700; margin-top: 24px; }

.date-row { display: flex; align-items: center; gap: 10px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); padding: 11px 14px; margin-bottom: 18px; }
.date-icon { color: var(--blue); flex-shrink: 0; }
.date-input { border: none; font-size: 14px; font-weight: 700; color: var(--ink); background: transparent; font-family: inherit; }
.date-input:focus-visible { outline: 2px solid var(--sky); border-radius: 4px; }
.date-label { margin-left: auto; font-size: 12px; color: var(--ink-soft); }

.rows-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; font-size: 13px; font-weight: 800; color: var(--blue); text-transform: uppercase; letter-spacing: 0.04em; }

.rows-list { display: flex; flex-direction: column; gap: 11px; margin-bottom: 14px; }
.worker-row { display: flex; align-items: flex-start; gap: 9px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); padding: 11px; }
.worker-row-num { width: 26px; height: 26px; border-radius: 50%; background: var(--sky-soft); color: var(--blue); font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
.worker-row-main { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.worker-row-fields { display: flex; gap: 8px; min-width: 0; align-items: center; flex-wrap: wrap; }
.worker-row-fields.secondary { gap: 8px; }
.field-input { border: 1px solid var(--line); border-radius: 8px; padding: 10px 10px; font-size: 15px; font-family: inherit; color: var(--ink); background: var(--bg); width: 100%; }
.field-input:focus-visible { outline: 2px solid var(--sky); border-color: var(--sky); }
.name-input { flex: 1.4; min-width: 120px; }
.sitename-input, .worktype-input { flex: 1 1 0; min-width: 120px; font-size: 13.5px; padding: 9px 10px; }
.wage-input-wrap { position: relative; flex: 1; min-width: 100px; display: flex; align-items: center; }
.wage-prefix-icon { position: absolute; left: 8px; color: var(--ink-soft); pointer-events: none; }
.wage-input { padding-left: 26px; }
.wage-input::-webkit-outer-spin-button, .wage-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.row-remove { background: none; border: none; color: var(--ink-soft); cursor: pointer; padding: 6px; border-radius: 6px; flex-shrink: 0; }
.row-remove:hover { color: var(--danger); background: var(--danger-soft); }
.row-remove:focus-visible { outline: 2px solid var(--sky); }

.status-toggle { display: flex; gap: 6px; }
.status-pill {
  flex: 1; border: 1px solid var(--line); background: var(--bg); color: var(--ink-soft);
  font-size: 12.5px; font-weight: 800; padding: 7px 10px; border-radius: 999px; cursor: pointer; text-align: center;
}
.status-pill.small { flex: none; padding: 5px 12px; font-size: 12px; }
.status-pill.unpaid.active { background: var(--danger-soft); color: var(--danger); border-color: #F4C2C8; }
.status-pill.paid.active { background: var(--success-soft); color: var(--success); border-color: #B9E5CB; }
.status-pill:focus-visible { outline: 2px solid var(--sky); outline-offset: 1px; }

.add-row-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 14px; border: 1.5px dashed var(--blue); border-radius: var(--radius);
  background: var(--sky-soft); color: var(--blue); font-weight: 800; font-size: 14px; cursor: pointer;
}
.add-row-btn:hover { background: #D7F0FF; }
.add-row-btn:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }

.bottom-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 560px;
  background: var(--white); border-top: 1px solid var(--line);
  display: flex; align-items: center; gap: 12px; padding: 13px 18px;
  padding-bottom: calc(13px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 16px rgba(11,37,69,0.08);
  z-index: 30;
}
@media (min-width: 860px) { .bottom-bar { max-width: 720px; } }
.bottom-bar-total { display: flex; flex-direction: column; line-height: 1.2; min-width: 96px; }
.bottom-bar-label { font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 700; }
.bottom-bar-amount { font-size: 20px; font-weight: 900; display: flex; align-items: center; gap: 1px; color: var(--navy); }
.save-btn {
  flex: 1; background: linear-gradient(135deg, var(--blue), var(--navy)); color: #fff; border: none; border-radius: var(--radius);
  padding: 15px; font-size: 15px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
}
.save-btn:hover { filter: brightness(1.08); }
.save-btn.saved { background: var(--success); }
.save-btn:disabled { opacity: 0.7; cursor: default; }
.save-btn:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }

.toast {
  position: fixed; bottom: 92px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: flex-start; gap: 8px;
  padding: 12px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 700;
  box-shadow: 0 4px 16px rgba(11,37,69,0.18); z-index: 40; max-width: 90%; line-height: 1.4;
}
.toast svg { flex-shrink: 0; margin-top: 1px; }
.toast.success { background: var(--success-soft); color: var(--success); border: 1px solid #B9E5CB; }
.toast.error { background: var(--danger-soft); color: var(--danger); border: 1px solid #F4C2C8; }

.loading-block, .empty-block { text-align: center; color: var(--ink-soft); padding: 54px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-block svg { color: var(--line); margin-bottom: 4px; }
.empty-block p { font-weight: 800; color: var(--ink); margin: 0; }
.empty-block span { font-size: 13px; }

.filter-row { display: flex; gap: 8px; margin-bottom: 16px; }
.filter-select { flex: 1; border: 1px solid var(--line); border-radius: 8px; padding: 10px; font-size: 13.5px; font-family: inherit; background: var(--white); color: var(--ink); font-weight: 600; }
.filter-select:focus-visible { outline: 2px solid var(--sky); }
.refresh-btn { background: var(--white); color: var(--blue); border: 1px solid var(--line); flex-shrink: 0; }
.refresh-btn:hover { background: var(--sky-soft); }

.stat-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-bottom: 24px; }
.stat-card { background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); padding: 13px 11px; display: flex; flex-direction: column; gap: 4px; }
.stat-card.pending { background: var(--danger-soft); border-color: #F4C2C8; }
.stat-label { font-size: 10.5px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.02em; font-weight: 700; }
.stat-value { font-size: 17px; font-weight: 900; display: flex; align-items: center; gap: 1px; color: var(--navy); }
.stat-value.pending-value { color: var(--danger); }

.section-label { font-size: 12.5px; font-weight: 900; color: var(--blue); text-transform: uppercase; letter-spacing: 0.04em; margin: 24px 0 10px; }

.worker-summary-list { display: flex; flex-direction: column; gap: 7px; }
.worker-summary-row { display: flex; align-items: center; gap: 8px; background: var(--white); border: 1px solid var(--line); border-radius: 9px; padding: 11px 13px; font-size: 13.5px; }
.worker-summary-name { flex: 1; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.worker-summary-days { color: var(--ink-soft); font-size: 12px; flex-shrink: 0; }
.worker-summary-pending { color: var(--danger); font-size: 11.5px; font-weight: 800; display: flex; align-items: center; gap: 1px; flex-shrink: 0; }
.worker-summary-total { font-weight: 900; display: flex; align-items: center; gap: 1px; flex-shrink: 0; min-width: 70px; justify-content: flex-end; color: var(--navy); }

.entry-list { display: flex; flex-direction: column; gap: 9px; }
.entry-card { display: flex; align-items: center; justify-content: space-between; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 15px; cursor: pointer; text-align: left; }
.entry-card:hover { border-color: var(--sky); box-shadow: 0 2px 10px rgba(20,86,214,0.08); }
.entry-card:focus-visible { outline: 2px solid var(--sky); }
.entry-card-left { display: flex; flex-direction: column; gap: 2px; }
.entry-card-date { font-weight: 800; font-size: 14px; }
.entry-card-site { font-size: 12.5px; color: var(--blue); font-weight: 700; }
.entry-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.entry-card-count { font-size: 12px; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 5px; }
.entry-card-pending-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--danger); display: inline-block; }
.entry-card-total { font-weight: 900; display: flex; align-items: center; gap: 1px; color: var(--navy); }

.modal-overlay { position: fixed; inset: 0; background: rgba(11,37,69,0.55); display: flex; align-items: flex-end; justify-content: center; z-index: 50; }
@media (min-width: 640px) { .modal-overlay { align-items: center; } }
.modal-card { background: var(--white); width: 100%; max-width: 560px; border-radius: 16px 16px 0 0; max-height: 80vh; display: flex; flex-direction: column; }
@media (min-width: 640px) { .modal-card { border-radius: 16px; max-height: 70vh; } }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 17px; border-bottom: 1px solid var(--line); }
.modal-title { font-weight: 900; font-size: 15px; color: var(--navy); }
.modal-subtitle { font-size: 12.5px; color: var(--ink-soft); }
.modal-body { flex: 1; overflow-y: auto; padding: 6px 17px; }
.modal-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 14px; gap: 10px; }
.modal-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.modal-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.modal-row-meta { font-size: 11.5px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.modal-row-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.modal-row-wage { display: flex; align-items: center; gap: 1px; font-weight: 800; min-width: 64px; justify-content: flex-end; }
.modal-row:last-child { border-bottom: none; }
.modal-footer { display: flex; justify-content: space-between; padding: 15px 17px; border-top: 1px solid var(--line); font-weight: 900; font-size: 16px; }
.modal-footer span:last-child { display: flex; align-items: center; gap: 1px; color: var(--blue); }

@media (max-width: 380px) {
  .stat-cards { grid-template-columns: 1fr 1fr; }
  .stat-card:last-child { grid-column: span 2; }
}
`;
