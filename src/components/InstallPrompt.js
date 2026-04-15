import React, { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (window.navigator.standalone === true) return;
    if (sessionStorage.getItem("pwa-prompt-dismissed")) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (isIOS && isSafari) {
      setPlatform("ios-safari");
      setTimeout(() => setShow(true), 2500);
      return;
    }
    if (isIOS && !isSafari) {
      setPlatform("ios-other");
      setTimeout(() => setShow(true), 2500);
      return;
    }
    if (isAndroid) {
      const handler = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setPlatform("android");
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setShow(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  const overlay = {
    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9998,
    padding: "16px", paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
    background: "linear-gradient(135deg, #0f3460 0%, #16213e 100%)",
    borderTop: "3px solid #4CAF50",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
    animation: "slideUp 0.35s ease",
  };
  const row = { display: "flex", alignItems: "center", gap: "12px" };
  const iconBox = {
    width: 52, height: 52, borderRadius: 12,
    background: "linear-gradient(135deg, #0f3460, #16213e)",
    border: "2px solid #4CAF50",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, fontSize: 22,
  };
  const titleStyle = { color: "white", fontWeight: 700, fontSize: 16, margin: 0 };
  const subtitleStyle = { color: "rgba(255,255,255,0.75)", fontSize: 13, margin: "3px 0 0 0" };
  const installBtn = {
    marginTop: 14, width: "100%", padding: "13px", fontSize: 16, fontWeight: 700,
    background: "linear-gradient(90deg, #4CAF50, #22c55e)",
    color: "white", border: "none", borderRadius: 10, cursor: "pointer",
  };
  const dismissBtn = {
    position: "absolute", top: 12, right: 14, background: "none", border: "none",
    color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4,
  };
  const stepRow = { display: "flex", alignItems: "center", gap: 10, marginTop: 10 };
  const stepNum = {
    width: 26, height: 26, borderRadius: "50%", background: "#4CAF50",
    color: "white", fontWeight: 700, fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  };
  const stepText = { color: "rgba(255,255,255,0.9)", fontSize: 14, margin: 0 };

  if (platform === "android") {
    return (
      <div style={overlay}>
        <style>{"@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }"}</style>
        <button style={dismissBtn} onClick={handleDismiss} aria-label="Dismiss">&#x00D7;</button>
        <div style={row}>
          <div style={iconBox}>&#x1F4AA;</div>
          <div>
            <p style={titleStyle}>Add to Home Screen</p>
            <p style={subtitleStyle}>Quick access like a real app &mdash; no browser needed</p>
          </div>
        </div>
        <button style={installBtn} onClick={handleAndroidInstall}>&#x2795; Install App</button>
      </div>
    );
  }

  if (platform === "ios-safari") {
    return (
      <div style={overlay}>
        <style>{"@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }"}</style>
        <button style={dismissBtn} onClick={handleDismiss} aria-label="Dismiss">&#x00D7;</button>
        <div style={row}>
          <div style={iconBox}>&#x1F4F2;</div>
          <div>
            <p style={titleStyle}>Add to Your Home Screen</p>
            <p style={subtitleStyle}>3 quick taps &mdash; opens like a real app!</p>
          </div>
        </div>
        <div style={stepRow}>
          <div style={stepNum}>1</div>
          <p style={stepText}>Tap the <strong style={{color:"#4CAF50"}}>Share</strong> button at the bottom of Safari &#x238B;</p>
        </div>
        <div style={stepRow}>
          <div style={stepNum}>2</div>
          <p style={stepText}>Scroll and tap <strong style={{color:"#4CAF50"}}>"Add to Home Screen"</strong></p>
        </div>
        <div style={stepRow}>
          <div style={stepNum}>3</div>
          <p style={stepText}>Tap <strong style={{color:"#4CAF50"}}>Add</strong> in the top-right &mdash; done! &#x2705;</p>
        </div>
        <button style={{...installBtn, background:"rgba(255,255,255,0.12)"}} onClick={handleDismiss}>Got it, I&apos;ll do it later</button>
      </div>
    );
  }

  if (platform === "ios-other") {
    return (
      <div style={overlay}>
        <style>{"@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }"}</style>
        <button style={dismissBtn} onClick={handleDismiss} aria-label="Dismiss">&#x00D7;</button>
        <div style={row}>
          <div style={iconBox}>&#x1F9ED;</div>
          <div>
            <p style={titleStyle}>Open in Safari to Install</p>
            <p style={subtitleStyle}>iPhone only supports adding apps via Safari</p>
          </div>
        </div>
        <div style={stepRow}>
          <div style={stepNum}>1</div>
          <p style={stepText}>Open this page in <strong style={{color:"#4CAF50"}}>Safari</strong></p>
        </div>
        <div style={stepRow}>
          <div style={stepNum}>2</div>
          <p style={stepText}>Tap Share &#x238B; &rarr; <strong style={{color:"#4CAF50"}}>Add to Home Screen</strong></p>
        </div>
        <button style={{...installBtn, background:"rgba(255,255,255,0.12)"}} onClick={handleDismiss}>Got it</button>
      </div>
    );
  }

  return null;
}
