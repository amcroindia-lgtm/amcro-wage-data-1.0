import React, { useState, useRef, useCallback } from "react";
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

const todayStr = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
};

const fmtDate = (isoStr) => {
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

async function attGet(params) {
  const url = new URL(ATTENDANCE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("Unexpected response from server"); }
  if (!parsed.ok) throw new Error(parsed.error || "Server error");
  return parsed;
}

async function attPost(body) {
  const res = await fetch(ATTENDANCE_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("Unexpected response from server"); }
  if (!parsed.ok) throw new Error(parsed.error || "Server error");
  return parsed;
}

/* ---------- Camera Component ---------- */
function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [error, setError] = useState(null);

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setReady(true);
        };
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions and try again.");
    }
  }, []);

  React.useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const flipCamera = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    setReady(false);
    setCaptured(null);
    startCamera(newMode);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  };

  const retake = () => {
    setCaptured(null);
    setReady(false);
    startCamera(facingMode);
  };

  const confirm = () => {
    onCapture(captured);
    onClose();
  };

  return (
    <div className="att-camera-overlay">
      <div className="att-camera-box">
        <div className="att-camera-header">
          <span className="att-camera-title">Take Site Photo</span>
          <button className="att-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {error ? (
          <div className="att-camera-error">
            <AlertCircle size={32} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="att-camera-view">
              {!captured ? (
                <video ref={videoRef} className="att-camera-video" playsInline muted autoPlay />
              ) : (
                <img src={captured} className="att-camera-preview" alt="Captured" />
              )}
              {!ready && !captured && (
                <div className="att-camera-loading"><Loader size={28} className="spin" /></div>
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div className="att-camera-controls">
              {!captured ? (
                <>
                  <button className="att-camera-flip" onClick={flipCamera} title="Flip camera">
                    <RotateCcw size={20} />
                  </button>
                  <button className="att-shutter" onClick={takePhoto} disabled={!ready}>
                    <span className="att-shutter-inner" />
                  </button>
                  <div style={{ width: 44 }} />
                </>
              ) : (
                <>
                  <button className="att-btn secondary" onClick={retake}>Retake</button>
                  <button className="att-btn primary" onClick={confirm}>
                    <Check size={18} /> Use Photo
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

/* ---------- Main Attendance Page ---------- */
export default function AttendancePage({ onBack }) {
  // Screens: "form" | "checking" | "onDuty" | "offDuty" | "done"
  const [screen, setScreen] = useState("form");
  const [supId, setSupId] = useState("");
  const [name, setName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [idError, setIdError] = useState("");
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState(null); // result from checkStatus
  const [photo, setPhoto] = useState(null); // base64
  const [showCamera, setShowCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const today = todayStr();

  const handleIdBlur = () => {
    const val = supId.trim().toUpperCase();
    if (val && !VALID_IDS.includes(val)) {
      setIdError("Invalid Supervisor ID. Please check and try again.");
    } else {
      setIdError("");
    }
  };

  const handleCheck = async () => {
    const val = supId.trim().toUpperCase();
    if (!val) { setFormError("Please enter your Supervisor ID."); return; }
    if (!VALID_IDS.includes(val)) { setFormError("Invalid Supervisor ID."); return; }
    if (!name.trim()) { setFormError("Please enter your name."); return; }
    if (!siteName.trim()) { setFormError("Please enter your site name."); return; }
    setFormError("");
    setScreen("checking");
    try {
      const result = await attGet({ action: "checkStatus", supId: val, date: today });
      setStatus(result);
      if (!result.found) {
        setScreen("onDuty");
      } else if (!result.hasOffDuty) {
        setScreen("offDuty");
      } else {
        setScreen("done");
      }
    } catch (e) {
      setFormError(e.message || "Could not connect. Check internet and try again.");
      setScreen("form");
    }
  };

  const handleOnDuty = async () => {
    setSaveError("");
    setSaving(true);
    try {
      await attPost({
        action: "onDuty",
        supId: supId.trim().toUpperCase(),
        name: name.trim(),
        siteName: siteName.trim(),
        date: today,
        photoBase64: photo || "",
      });
      setScreen("done");
      setPhoto(null);
    } catch (e) {
      setSaveError(e.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleOffDuty = async () => {
    setSaveError("");
    setSaving(true);
    try {
      await attPost({
        action: "offDuty",
        supId: supId.trim().toUpperCase(),
        date: today,
        photoBase64: photo || "",
      });
      setScreen("done");
      setPhoto(null);
    } catch (e) {
      setSaveError(e.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setScreen("form");
    setSupId("");
    setName("");
    setSiteName("");
    setPhoto(null);
    setSaveError("");
    setFormError("");
    setIdError("");
    setStatus(null);
  };

  return (
    <div className="att-page">
      {/* Top bar */}
      <div className="att-topbar">
        <button className="att-back-btn" onClick={onBack}><ChevronLeft size={22} /></button>
        <div className="att-topbar-logo">
          <Building2 size={20} />
        </div>
        <div className="att-topbar-text">
          <div className="att-topbar-title">Supervisor Attendance</div>
          <div className="att-topbar-sub">AMCRO INDIA WMS</div>
        </div>
      </div>

      <div className="att-content">
        <div className="att-date-badge">{fmtDate(today)}</div>

        {/* ---- FORM SCREEN ---- */}
        {screen === "form" && (
          <div className="att-card">
            <h2 className="att-card-title">Mark Your Attendance</h2>
            <p className="att-card-sub">Enter your details to continue</p>

            <div className="att-fields">
              <div className="att-field-group">
                <label className="att-label">Supervisor ID</label>
                <div className="att-input-wrap">
                  <User size={16} className="att-input-icon" />
                  <input
                    className={`att-input ${idError ? "error" : ""}`}
                    type="text"
                    placeholder="e.g. ASUP01"
                    value={supId}
                    onChange={(e) => { setSupId(e.target.value.toUpperCase()); setIdError(""); }}
                    onBlur={handleIdBlur}
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                </div>
                {idError && <p className="att-field-error">{idError}</p>}
              </div>

              <div className="att-field-group">
                <label className="att-label">Your Name</label>
                <div className="att-input-wrap">
                  <User size={16} className="att-input-icon" />
                  <input
                    className="att-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="att-field-group">
                <label className="att-label">Site Name</label>
                <div className="att-input-wrap">
                  <Building2 size={16} className="att-input-icon" />
                  <input
                    className="att-input"
                    type="text"
                    placeholder="Enter your current site"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="att-error-box">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <button className="att-btn primary full" onClick={handleCheck}>
              Continue
            </button>
          </div>
        )}

        {/* ---- CHECKING ---- */}
        {screen === "checking" && (
          <div className="att-card center">
            <Loader size={38} className="spin att-checking-icon" />
            <p className="att-checking-text">Checking your attendance status…</p>
          </div>
        )}

        {/* ---- ON DUTY SCREEN ---- */}
        {screen === "onDuty" && (
          <div className="att-card">
            <div className="att-status-badge on"><Clock size={18} /> On Duty</div>
            <h2 className="att-card-title">Good Morning!</h2>
            <p className="att-card-sub">
              <strong>{name}</strong> · {supId.toUpperCase()}<br />
              {siteName}
            </p>

            <div className="att-photo-section">
              <label className="att-label">Photo of Work Site <span className="att-optional">(recommended)</span></label>
              {!photo ? (
                <button className="att-photo-btn" onClick={() => setShowCamera(true)}>
                  <Camera size={24} />
                  <span>Click Photo of Site</span>
                </button>
              ) : (
                <div className="att-photo-preview-wrap">
                  <img src={photo} className="att-photo-preview" alt="Site photo" />
                  <button className="att-photo-retake" onClick={() => setShowCamera(true)}>
                    <RotateCcw size={14} /> Retake
                  </button>
                </div>
              )}
            </div>

            {saveError && (
              <div className="att-error-box">
                <AlertCircle size={16} /> {saveError}
              </div>
            )}

            <button className="att-btn on-duty full" onClick={handleOnDuty} disabled={saving}>
              {saving ? <><Loader size={18} className="spin" /> Saving…</> : <><CheckCircle size={18} /> Mark On Duty</>}
            </button>
            <button className="att-link-btn" onClick={resetAll}>← Back</button>
          </div>
        )}

        {/* ---- OFF DUTY SCREEN ---- */}
        {screen === "offDuty" && (
          <div className="att-card">
            <div className="att-status-badge off"><LogOut size={18} /> Off Duty</div>
            <h2 className="att-card-title">End of Day</h2>
            <p className="att-card-sub">
              <strong>{name}</strong> · {supId.toUpperCase()}<br />
              {siteName}
            </p>

            <div className="att-photo-section">
              <label className="att-label">Photo of Work Done <span className="att-optional">(recommended)</span></label>
              {!photo ? (
                <button className="att-photo-btn" onClick={() => setShowCamera(true)}>
                  <Camera size={24} />
                  <span>Click Photo of Work Done</span>
                </button>
              ) : (
                <div className="att-photo-preview-wrap">
                  <img src={photo} className="att-photo-preview" alt="Work done" />
                  <button className="att-photo-retake" onClick={() => setShowCamera(true)}>
                    <RotateCcw size={14} /> Retake
                  </button>
                </div>
              )}
            </div>

            {saveError && (
              <div className="att-error-box">
                <AlertCircle size={16} /> {saveError}
              </div>
            )}

            <button className="att-btn off-duty full" onClick={handleOffDuty} disabled={saving}>
              {saving ? <><Loader size={18} className="spin" /> Saving…</> : <><LogOut size={18} /> Mark Off Duty</>}
            </button>
            <button className="att-link-btn" onClick={resetAll}>← Back</button>
          </div>
        )}

        {/* ---- DONE SCREEN ---- */}
        {screen === "done" && (
          <div className="att-card center">
            <div className="att-done-icon">
              <CheckCircle size={48} />
            </div>
            <h2 className="att-done-title">
              {status && status.found && status.hasOffDuty
                ? "Already Marked for Today"
                : "Attendance Saved!"}
            </h2>
            <p className="att-done-sub">
              {status && status.found && status.hasOffDuty
                ? `${supId.toUpperCase()} — both On Duty and Off Duty are marked for today.`
                : `${supId.toUpperCase()} — your attendance has been recorded and synced to the Sheet.`}
            </p>
            <button className="att-btn primary" onClick={resetAll} style={{ marginTop: 24 }}>
              Done
            </button>
          </div>
        )}
      </div>

      {/* Camera modal */}
      {showCamera && (
        <CameraCapture
          onCapture={(dataUrl) => setPhoto(dataUrl)}
          onClose={() => setShowCamera(false)}
        />
      )}

      <style>{ATT_CSS}</style>
    </div>
  );
}

const ATT_CSS = `
.att-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F4F8FC;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.att-topbar {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px 18px;
  background: #0B2545;
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 20;
}
.att-back-btn {
  background: rgba(255,255,255,0.10);
  border: none; color: #fff; border-radius: 8px;
  width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
}
.att-back-btn:hover { background: rgba(255,255,255,0.2); }
.att-topbar-logo {
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #38BDF8, #1456D6);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; box-shadow: 0 2px 6px rgba(20,86,214,0.35);
}
.att-topbar-text { min-width: 0; }
.att-topbar-title { font-size: 16px; font-weight: 800; line-height: 1.2; }
.att-topbar-sub { font-size: 12px; color: #9FB6D9; }

.att-content {
  flex: 1;
  padding: 20px 18px 40px;
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
}

@media (min-width: 860px) {
  .att-content { max-width: 720px; }
}

.att-date-badge {
  background: #1456D6;
  color: #fff;
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
}

.att-card {
  background: #fff;
  border: 1px solid #DCE6F0;
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 2px 12px rgba(11,37,69,0.07);
}
.att-card.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 20px;
}

.att-card-title { font-size: 20px; font-weight: 900; color: #0B2545; margin: 0 0 4px; }
.att-card-sub { font-size: 14px; color: #51637A; margin: 0 0 22px; line-height: 1.5; }

.att-fields { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; }

.att-field-group { display: flex; flex-direction: column; gap: 5px; }
.att-label { font-size: 12.5px; font-weight: 800; color: #0B2545; text-transform: uppercase; letter-spacing: 0.03em; }
.att-optional { font-weight: 500; color: #51637A; text-transform: none; letter-spacing: 0; }

.att-input-wrap { position: relative; display: flex; align-items: center; }
.att-input-icon { position: absolute; left: 12px; color: #51637A; pointer-events: none; }
.att-input {
  width: 100%; padding: 12px 12px 12px 38px;
  border: 1.5px solid #DCE6F0; border-radius: 10px;
  font-size: 15px; font-family: inherit; color: #0B1320;
  background: #F4F8FC;
}
.att-input:focus-visible { outline: none; border-color: #38BDF8; background: #fff; }
.att-input.error { border-color: #D6263B; }

.att-field-error { font-size: 12px; color: #D6263B; font-weight: 600; margin: 2px 0 0; }

.att-error-box {
  display: flex; align-items: flex-start; gap: 8px;
  background: #FDEAEC; border: 1px solid #F4C2C8; border-radius: 10px;
  padding: 11px 14px; color: #D6263B; font-size: 13.5px; font-weight: 700;
  margin-bottom: 16px; line-height: 1.4;
}

.att-status-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; font-weight: 800; padding: 6px 14px;
  border-radius: 999px; margin-bottom: 14px;
}
.att-status-badge.on { background: #E7F7EE; color: #0E8A4B; border: 1px solid #B9E5CB; }
.att-status-badge.off { background: #E6F7FF; color: #1456D6; border: 1px solid #B3DFFF; }

.att-photo-section { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }

.att-photo-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 28px 20px;
  border: 2px dashed #38BDF8; border-radius: 12px;
  background: #E6F7FF; color: #1456D6;
  font-size: 15px; font-weight: 800; cursor: pointer;
}
.att-photo-btn:hover { background: #D0EFFF; }

.att-photo-preview-wrap { position: relative; border-radius: 12px; overflow: hidden; }
.att-photo-preview { width: 100%; height: 220px; object-fit: cover; display: block; border-radius: 12px; }
.att-photo-retake {
  position: absolute; bottom: 10px; right: 10px;
  display: flex; align-items: center; gap: 5px;
  background: rgba(11,37,69,0.75); color: #fff;
  border: none; border-radius: 999px; padding: 7px 14px;
  font-size: 13px; font-weight: 700; cursor: pointer;
}

.att-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px 22px; border-radius: 12px; border: none;
  font-size: 15px; font-weight: 800; cursor: pointer;
  font-family: inherit;
}
.att-btn.full { width: 100%; }
.att-btn.primary { background: linear-gradient(135deg, #1456D6, #0B2545); color: #fff; }
.att-btn.primary:hover { filter: brightness(1.1); }
.att-btn.secondary { background: #F4F8FC; color: #0B2545; border: 1.5px solid #DCE6F0; }
.att-btn.secondary:hover { background: #E6F7FF; }
.att-btn.on-duty { background: linear-gradient(135deg, #0E8A4B, #065F35); color: #fff; }
.att-btn.on-duty:hover { filter: brightness(1.08); }
.att-btn.off-duty { background: linear-gradient(135deg, #1456D6, #0B2545); color: #fff; }
.att-btn.off-duty:hover { filter: brightness(1.08); }
.att-btn:disabled { opacity: 0.65; cursor: default; }

.att-link-btn {
  display: block; width: 100%; background: none; border: none;
  color: #51637A; font-size: 14px; font-weight: 700;
  cursor: pointer; padding: 12px; margin-top: 8px; text-align: center;
  font-family: inherit;
}
.att-link-btn:hover { color: #1456D6; }

.att-checking-icon { color: #1456D6; margin-bottom: 16px; }
.att-checking-text { color: #51637A; font-size: 15px; font-weight: 600; }

.att-done-icon { color: #0E8A4B; margin-bottom: 16px; }
.att-done-title { font-size: 20px; font-weight: 900; color: #0B2545; margin: 0 0 8px; }
.att-done-sub { font-size: 14px; color: #51637A; line-height: 1.5; margin: 0; max-width: 300px; }

/* Camera overlay */
.att-camera-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.88);
  display: flex; align-items: flex-end; justify-content: center; z-index: 100;
}
@media (min-width: 640px) {
  .att-camera-overlay { align-items: center; }
}
.att-camera-box {
  background: #0B1320; width: 100%; max-width: 560px;
  border-radius: 20px 20px 0 0; overflow: hidden;
  display: flex; flex-direction: column;
}
@media (min-width: 640px) {
  .att-camera-box { border-radius: 20px; max-height: 90vh; }
}
.att-camera-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);
}
.att-camera-title { color: #fff; font-size: 15px; font-weight: 800; }
.att-icon-btn {
  background: rgba(255,255,255,0.10); border: none; color: #fff;
  border-radius: 8px; width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.att-icon-btn:hover { background: rgba(255,255,255,0.2); }
.att-camera-view { position: relative; background: #000; min-height: 300px; }
.att-camera-video, .att-camera-preview { width: 100%; max-height: 55vh; object-fit: cover; display: block; }
.att-camera-loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #38BDF8;
}
.att-camera-error {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 40px 24px; color: #F4C2C8; text-align: center; font-size: 14px;
}
.att-camera-controls {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; gap: 12px;
}
.att-camera-flip {
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255,255,255,0.15); border: none; color: #fff;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.att-camera-flip:hover { background: rgba(255,255,255,0.25); }
.att-shutter {
  width: 70px; height: 70px; border-radius: 50%;
  background: #fff; border: 4px solid rgba(255,255,255,0.4);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.att-shutter:disabled { opacity: 0.4; cursor: default; }
.att-shutter-inner {
  width: 56px; height: 56px; border-radius: 50%; background: #fff;
  border: 2px solid #0B2545; display: block;
}
.att-shutter:hover .att-shutter-inner { background: #E6F7FF; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.9s linear infinite; }
`;
