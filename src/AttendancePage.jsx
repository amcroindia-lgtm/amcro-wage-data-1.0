import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera, CheckCircle, LogOut, Loader, AlertCircle, X,
  Clock, User, Building2, ChevronLeft, RotateCcw, Check,
} from "lucide-react";

const ATTENDANCE_URL = "https://script.google.com/macros/s/AKfycbxa167TOiGXreZIBtSqUPrIY-gq7FznD0RnH_-NksfH2Yoe1THcpRPO27hn1TaV4jy5/exec";

const VALID_IDS = [
  "ASUP01","ASUP02","ASUP03","ASUP04","ASUP05",
  "ASUP06","ASUP07","ASUP08","ASUP09","ASUP10",
  "ASUP11","ASUP12","ASUP13","ASUP14","ASUP15",
  "ASUP16","ASUP17","ASUP18","ASUP19","ASUP20",
];

/* ── helpers ── */
const todayStr = () => {
  const d = new Date(), tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
};

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

/* ── localStorage: track on/off duty per ID per day ── */
const LS_KEY = "amcro_att_v2";

function lsGet() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function lsSet(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
// Returns "none" | "on" | "both"
function lsStatus(id, date) {
  const s = lsGet();
  const k = id.toUpperCase() + "_" + date;
  return s[k] || "none";
}
function lsMark(id, date, state) {          // state = "on" | "both"
  const s = lsGet();
  s[id.toUpperCase() + "_" + date] = state;
  lsSet(s);
}

/* ── API ── */
async function apiGet(params) {
  const url = new URL(ATTENDANCE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  const json = JSON.parse(await res.text());
  if (!json.ok) throw new Error(json.error || "Server error");
  return json;
}

async function apiPost(body) {
  const res = await fetch(ATTENDANCE_URL, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const json = JSON.parse(await res.text());
  if (!json.ok) throw new Error(json.error || "Server error");
  return json;
}

/* ══════════════ CAMERA ══════════════ */
function Camera2({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [facing, setFacing] = useState("environment");
  const [err, setErr] = useState(null);

  const start = useCallback(async (mode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setReady(true); };
      }
    } catch { setErr("Camera access denied. Allow camera permission and try again."); }
  }, []);

  useEffect(() => { start(facing); return () => streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const flip = () => {
    const m = facing === "environment" ? "user" : "environment";
    setFacing(m); setReady(false); setCaptured(null); start(m);
  };

  const shoot = () => {
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    setCaptured(c.toDataURL("image/jpeg", 0.85));
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const retake = () => { setCaptured(null); setReady(false); start(facing); };

  return (
    <div className="cam-overlay">
      <div className="cam-box">
        <div className="cam-hdr">
          <span className="cam-title">Take Site Photo</span>
          <button className="cam-icon-btn" onClick={onClose}><X size={20}/></button>
        </div>
        {err ? (
          <div className="cam-err"><AlertCircle size={28}/><p>{err}</p></div>
        ) : (
          <>
            <div className="cam-view">
              {!captured
                ? <video ref={videoRef} className="cam-video" playsInline muted autoPlay/>
                : <img src={captured} className="cam-video" alt="preview"/>}
              {!ready && !captured && <div className="cam-spin"><Loader size={28} className="spin"/></div>}
            </div>
            <canvas ref={canvasRef} style={{display:"none"}}/>
            <div className="cam-ctrl">
              {!captured ? (
                <>
                  <button className="cam-flip" onClick={flip}><RotateCcw size={20}/></button>
                  <button className="cam-shutter" onClick={shoot} disabled={!ready}>
                    <span className="cam-shutter-inner"/>
                  </button>
                  <div style={{width:44}}/>
                </>
              ) : (
                <>
                  <button className="att-btn secondary" onClick={retake}>Retake</button>
                  <button className="att-btn primary" onClick={() => { onCapture(captured); onClose(); }}>
                    <Check size={18}/> Use Photo
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════ PHOTO WIDGET ══════════════ */
function PhotoWidget({ photo, setPhoto, label }) {
  const [cam, setCam] = useState(false);
  return (
    <div className="photo-section">
      <label className="att-label">{label} <span className="att-optional">(recommended)</span></label>
      {!photo ? (
        <button className="photo-btn" onClick={() => setCam(true)}>
          <Camera size={24}/><span>Click Photo</span>
        </button>
      ) : (
        <div className="photo-wrap">
          <img src={photo} className="photo-preview" alt="site"/>
          <button className="photo-retake" onClick={() => setCam(true)}>
            <RotateCcw size={14}/> Retake
          </button>
        </div>
      )}
      {cam && <Camera2 onCapture={setPhoto} onClose={() => setCam(false)}/>}
    </div>
  );
}

/* ══════════════ MAIN PAGE ══════════════ */
export default function AttendancePage({ onBack }) {
  const today = todayStr();

  // SCREENS: form | checking | onDuty | offDuty | done
  const [screen, setScreen] = useState("form");
  const [supId, setSupId]   = useState("");
  const [name, setName]     = useState("");
  const [site, setSite]     = useState("");
  const [photo, setPhoto]   = useState(null);
  const [err, setErr]       = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  /* ── Step 1: supervisor submits form ── */
  const handleContinue = async () => {
    const id = supId.trim().toUpperCase();
    if (!id)              { setErr("Enter your Supervisor ID."); return; }
    if (!VALID_IDS.includes(id)) { setErr("Invalid Supervisor ID."); return; }
    if (!name.trim())     { setErr("Enter your name."); return; }
    if (!site.trim())     { setErr("Enter your site name."); return; }
    setErr("");

    // 1. Check localStorage first (fast, works offline, blocks duplicates)
    const local = lsStatus(id, today);
    if (local === "both")  { setScreen("done"); return; }
    if (local === "on")    { setScreen("offDuty"); return; }

    // 2. Not in local — check the Sheet (handles cross-device case)
    setScreen("checking");
    try {
      const res = await apiGet({ action: "checkStatus", supId: id, date: today });
      if (res.found && res.hasOffDuty) {
        lsMark(id, today, "both");
        setScreen("done");
      } else if (res.found && !res.hasOffDuty) {
        lsMark(id, today, "on");   // sync local
        setScreen("offDuty");
      } else {
        setScreen("onDuty");       // fresh — no record today
      }
    } catch (e) {
      setErr(e.message || "Connection failed. Check internet.");
      setScreen("form");
    }
  };

  /* ── Step 2a: Mark On Duty ── */
  const handleOnDuty = async () => {
    const id = supId.trim().toUpperCase();
    // Hard block — if local says "on" already, skip straight to offDuty
    if (lsStatus(id, today) !== "none") { setScreen("offDuty"); return; }

    setSaveErr(""); setSaving(true);
    try {
      await apiPost({ action: "onDuty", supId: id, name: name.trim(), siteName: site.trim(), date: today, photoBase64: photo || "" });
      lsMark(id, today, "on");   // lock it locally
      setPhoto(null);
      setScreen("offDuty");      // immediately show Off Duty screen
    } catch (e) {
      setSaveErr(e.message || "Could not save. Try again.");
    } finally { setSaving(false); }
  };

  /* ── Step 2b: Mark Off Duty ── */
  const handleOffDuty = async () => {
    const id = supId.trim().toUpperCase();
    setSaveErr(""); setSaving(true);
    try {
      await apiPost({ action: "offDuty", supId: id, date: today, photoBase64: photo || "" });
      lsMark(id, today, "both"); // fully done
      setPhoto(null);
      setScreen("done");
    } catch (e) {
      setSaveErr(e.message || "Could not save. Try again.");
    } finally { setSaving(false); }
  };

  const reset = () => {
    setScreen("form"); setSupId(""); setName(""); setSite("");
    setPhoto(null); setErr(""); setSaveErr("");
  };

  return (
    <div className="att-page">
      {/* ── Top bar ── */}
      <div className="att-topbar">
        <button className="att-back" onClick={onBack}><ChevronLeft size={22}/></button>
        <div className="att-logo"><Building2 size={18}/></div>
        <div className="att-topbar-text">
          <div className="att-topbar-title">Supervisor Attendance</div>
          <div className="att-topbar-sub">AMCRO INDIA WMS</div>
        </div>
      </div>

      <div className="att-body">
        <div className="att-date">{fmtDate(today)}</div>

        {/* ────── FORM ────── */}
        {screen === "form" && (
          <div className="att-card">
            <h2 className="att-h2">Mark Your Attendance</h2>
            <p className="att-p">Enter your details to continue</p>

            <div className="att-fields">
              <Field label="Supervisor ID" icon={<User size={15}/>}>
                <input className="att-input" placeholder="e.g. ASUP01" maxLength={6}
                  value={supId} onChange={e => { setSupId(e.target.value.toUpperCase()); setErr(""); }}/>
              </Field>
              <Field label="Your Name" icon={<User size={15}/>}>
                <input className="att-input" placeholder="Full name"
                  value={name} onChange={e => { setName(e.target.value); setErr(""); }}/>
              </Field>
              <Field label="Site Name" icon={<Building2 size={15}/>}>
                <input className="att-input" placeholder="Current site"
                  value={site} onChange={e => { setSite(e.target.value); setErr(""); }}/>
              </Field>
            </div>

            {err && <ErrBox msg={err}/>}
            <button className="att-btn primary full" onClick={handleContinue}>Continue</button>
          </div>
        )}

        {/* ────── CHECKING ────── */}
        {screen === "checking" && (
          <div className="att-card center">
            <Loader size={36} className="spin" style={{color:"#1456D6", marginBottom:14}}/>
            <p style={{color:"#51637A", fontWeight:600}}>Checking your attendance status…</p>
          </div>
        )}

        {/* ────── ON DUTY ────── */}
        {screen === "onDuty" && (
          <div className="att-card">
            <div className="att-badge on"><Clock size={16}/> Mark On Duty</div>
            <h2 className="att-h2">Good Morning!</h2>
            <p className="att-p"><strong>{name}</strong> · {supId.toUpperCase()}<br/>{site}</p>

            <PhotoWidget photo={photo} setPhoto={setPhoto} label="Photo of Work Site"/>

            {saveErr && <ErrBox msg={saveErr}/>}
            <button className="att-btn on-duty full" onClick={handleOnDuty} disabled={saving}>
              {saving ? <><Loader size={17} className="spin"/> Saving…</> : <><CheckCircle size={17}/> Mark On Duty</>}
            </button>
            <button className="att-link" onClick={reset}>← Back</button>
          </div>
        )}

        {/* ────── OFF DUTY ────── */}
        {screen === "offDuty" && (
          <div className="att-card">
            <div className="att-success-strip"><CheckCircle size={15}/> On Duty marked ✓ — now mark Off Duty below</div>
            <div className="att-badge off"><LogOut size={16}/> Mark Off Duty</div>
            <h2 className="att-h2">End of Day</h2>
            <p className="att-p"><strong>{name}</strong> · {supId.toUpperCase()}<br/>{site}</p>

            <PhotoWidget photo={photo} setPhoto={setPhoto} label="Photo of Work Done"/>

            {saveErr && <ErrBox msg={saveErr}/>}
            <button className="att-btn off-duty full" onClick={handleOffDuty} disabled={saving}>
              {saving ? <><Loader size={17} className="spin"/> Saving…</> : <><LogOut size={17}/> Mark Off Duty</>}
            </button>
          </div>
        )}

        {/* ────── DONE ────── */}
        {screen === "done" && (
          <div className="att-card center">
            <CheckCircle size={52} style={{color:"#0E8A4B", marginBottom:14}}/>
            <h2 className="att-h2">All Done for Today!</h2>
            <p className="att-p">{supId.toUpperCase()} — attendance fully recorded.</p>
            <div className="att-done-tags">
              <span className="att-done-tag on">✓ On Duty</span>
              <span className="att-done-tag off">✓ Off Duty</span>
            </div>
            <button className="att-btn primary" onClick={reset} style={{marginTop:24}}>Done</button>
          </div>
        )}
      </div>

      <style>{CSS}</style>
    </div>
  );
}

/* ── tiny helper components ── */
function Field({ label, icon, children }) {
  return (
    <div className="att-field">
      <label className="att-label">{label}</label>
      <div className="att-input-wrap">{icon && <span className="att-input-icon">{icon}</span>}{children}</div>
    </div>
  );
}
function ErrBox({ msg }) {
  return (
    <div className="att-err-box"><AlertCircle size={15}/><span>{msg}</span></div>
  );
}

/* ══════════════ CSS ══════════════ */
const CSS = `
.att-page { display:flex; flex-direction:column; min-height:100vh; background:#F4F8FC; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; -webkit-font-smoothing:antialiased; }

.att-topbar { display:flex; align-items:center; gap:11px; padding:14px 18px; background:#0B2545; color:#fff; position:sticky; top:0; z-index:20; }
.att-back { background:rgba(255,255,255,.1); border:none; color:#fff; border-radius:8px; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.att-back:hover { background:rgba(255,255,255,.2); }
.att-logo { width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg,#38BDF8,#1456D6); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.att-topbar-title { font-size:15px; font-weight:800; line-height:1.2; }
.att-topbar-sub { font-size:11px; color:#9FB6D9; }

.att-body { flex:1; padding:20px 18px 40px; max-width:560px; width:100%; margin:0 auto; }
@media(min-width:860px){ .att-body { max-width:720px; } }

.att-date { display:inline-flex; background:#1456D6; color:#fff; border-radius:999px; padding:7px 16px; font-size:13px; font-weight:700; margin-bottom:18px; }

.att-card { background:#fff; border:1px solid #DCE6F0; border-radius:16px; padding:24px 20px; box-shadow:0 2px 12px rgba(11,37,69,.07); }
.att-card.center { display:flex; flex-direction:column; align-items:center; text-align:center; padding:40px 20px; }

.att-h2 { font-size:20px; font-weight:900; color:#0B2545; margin:0 0 4px; }
.att-p { font-size:14px; color:#51637A; margin:0 0 20px; line-height:1.5; }

.att-fields { display:flex; flex-direction:column; gap:14px; margin-bottom:20px; }
.att-field { display:flex; flex-direction:column; gap:5px; }
.att-label { font-size:12px; font-weight:800; color:#0B2545; text-transform:uppercase; letter-spacing:.04em; }
.att-optional { font-weight:500; color:#51637A; text-transform:none; }
.att-input-wrap { position:relative; display:flex; align-items:center; }
.att-input-icon { position:absolute; left:11px; color:#51637A; pointer-events:none; display:flex; }
.att-input { width:100%; padding:12px 12px 12px 36px; border:1.5px solid #DCE6F0; border-radius:10px; font-size:15px; font-family:inherit; color:#0B1320; background:#F4F8FC; }
.att-input:focus { outline:none; border-color:#38BDF8; background:#fff; }

.att-err-box { display:flex; align-items:flex-start; gap:8px; background:#FDEAEC; border:1px solid #F4C2C8; border-radius:10px; padding:11px 14px; color:#D6263B; font-size:13px; font-weight:700; margin-bottom:14px; line-height:1.4; }

.att-badge { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:800; padding:6px 14px; border-radius:999px; margin-bottom:12px; }
.att-badge.on { background:#E7F7EE; color:#0E8A4B; border:1px solid #B9E5CB; }
.att-badge.off { background:#E6F7FF; color:#1456D6; border:1px solid #B3DFFF; }

.att-success-strip { display:flex; align-items:center; gap:7px; background:#E7F7EE; border:1px solid #B9E5CB; color:#0E8A4B; font-size:13px; font-weight:800; padding:10px 14px; border-radius:10px; margin-bottom:14px; }

.photo-section { margin-bottom:18px; display:flex; flex-direction:column; gap:7px; }
.photo-btn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; width:100%; padding:28px 20px; border:2px dashed #38BDF8; border-radius:12px; background:#E6F7FF; color:#1456D6; font-size:15px; font-weight:800; cursor:pointer; }
.photo-btn:hover { background:#D0EFFF; }
.photo-wrap { position:relative; border-radius:12px; overflow:hidden; }
.photo-preview { width:100%; height:200px; object-fit:cover; display:block; }
.photo-retake { position:absolute; bottom:10px; right:10px; display:flex; align-items:center; gap:5px; background:rgba(11,37,69,.75); color:#fff; border:none; border-radius:999px; padding:7px 14px; font-size:13px; font-weight:700; cursor:pointer; }

.att-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:14px 22px; border-radius:12px; border:none; font-size:15px; font-weight:800; cursor:pointer; font-family:inherit; }
.att-btn.full { width:100%; }
.att-btn.primary { background:linear-gradient(135deg,#1456D6,#0B2545); color:#fff; }
.att-btn.primary:hover { filter:brightness(1.1); }
.att-btn.secondary { background:#F4F8FC; color:#0B2545; border:1.5px solid #DCE6F0; }
.att-btn.on-duty { background:linear-gradient(135deg,#0E8A4B,#065F35); color:#fff; }
.att-btn.on-duty:hover { filter:brightness(1.08); }
.att-btn.off-duty { background:linear-gradient(135deg,#1456D6,#0B2545); color:#fff; }
.att-btn.off-duty:hover { filter:brightness(1.08); }
.att-btn:disabled { opacity:.65; cursor:default; }

.att-link { display:block; width:100%; background:none; border:none; color:#51637A; font-size:14px; font-weight:700; cursor:pointer; padding:12px; margin-top:8px; text-align:center; font-family:inherit; }
.att-link:hover { color:#1456D6; }

.att-done-tags { display:flex; gap:10px; margin-top:14px; }
.att-done-tag { padding:6px 16px; border-radius:999px; font-size:13px; font-weight:800; }
.att-done-tag.on { background:#E7F7EE; color:#0E8A4B; border:1px solid #B9E5CB; }
.att-done-tag.off { background:#E6F7FF; color:#1456D6; border:1px solid #B3DFFF; }

/* Camera */
.cam-overlay { position:fixed; inset:0; background:rgba(0,0,0,.9); display:flex; align-items:flex-end; justify-content:center; z-index:100; }
@media(min-width:640px){ .cam-overlay { align-items:center; } }
.cam-box { background:#0B1320; width:100%; max-width:560px; border-radius:20px 20px 0 0; overflow:hidden; display:flex; flex-direction:column; }
@media(min-width:640px){ .cam-box { border-radius:20px; } }
.cam-hdr { display:flex; justify-content:space-between; align-items:center; padding:13px 16px; border-bottom:1px solid rgba(255,255,255,.1); }
.cam-title { color:#fff; font-size:15px; font-weight:800; }
.cam-icon-btn { background:rgba(255,255,255,.1); border:none; color:#fff; border-radius:8px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.cam-icon-btn:hover { background:rgba(255,255,255,.2); }
.cam-view { position:relative; background:#000; min-height:280px; }
.cam-video { width:100%; max-height:52vh; object-fit:cover; display:block; }
.cam-spin { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#38BDF8; }
.cam-err { display:flex; flex-direction:column; align-items:center; gap:10px; padding:40px 24px; color:#F4C2C8; text-align:center; font-size:14px; }
.cam-ctrl { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; gap:12px; }
.cam-flip { width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.15); border:none; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.cam-flip:hover { background:rgba(255,255,255,.25); }
.cam-shutter { width:70px; height:70px; border-radius:50%; background:#fff; border:4px solid rgba(255,255,255,.4); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.cam-shutter:disabled { opacity:.4; cursor:default; }
.cam-shutter-inner { width:56px; height:56px; border-radius:50%; background:#fff; border:2px solid #0B2545; display:block; }
.cam-shutter:hover .cam-shutter-inner { background:#E6F7FF; }

@keyframes spin { to { transform:rotate(360deg); } }
.spin { animation:spin .9s linear infinite; }
`;
