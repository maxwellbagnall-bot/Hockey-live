"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallHockeyLive() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    if (standalone) {
      setVisible(false);
      return;
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    const dismissedAt = Number(
      localStorage.getItem("hockey_live_install_dismissed_at") || "0"
    );
    const dismissedRecently =
      dismissedAt > 0 && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;

    if (ios && !dismissedRecently && pathname.startsWith("/live")) {
      const timer = window.setTimeout(() => setVisible(true), 900);
      return () => window.clearTimeout(timer);
    }

    function handleInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      if (!dismissedRecently && pathname.startsWith("/live")) {
        setVisible(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleInstall);
  }, [pathname]);

  if (!visible || !pathname.startsWith("/live")) return null;

  function dismiss() {
    localStorage.setItem(
      "hockey_live_install_dismissed_at",
      String(Date.now())
    );
    setVisible(false);
  }

  async function install() {
    if (isIOS || !installPrompt) {
      if (showIOSHelp) {
        dismiss();
      } else {
        setShowIOSHelp(true);
      }
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setVisible(false);
      setInstallPrompt(null);
    }
  }

  return (
    <aside className="installHockeyLive" aria-label="Install Hockey Live">
      <button
        className="installDismiss"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
      >
        ×
      </button>

      <div className="installAppIcon">HL</div>

      <div className="installCopy">
        <b>Put Hockey Live on your phone</b>
        {!showIOSHelp ? (
          <span>Open it from your Home Screen just like an app.</span>
        ) : (
          <span>
            In Safari tap <strong>Share</strong>, then{" "}
            <strong>Add to Home Screen</strong>.
          </span>
        )}
      </div>

      <button className="installAction" onClick={() => void install()}>
        {isIOS ? (showIOSHelp ? "Got it" : "How?") : "Install"}
      </button>
    </aside>
  );
}
