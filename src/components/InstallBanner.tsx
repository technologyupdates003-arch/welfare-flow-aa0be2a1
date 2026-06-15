import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Detect Lovable preview iframe once on mount (avoids rendering banner there)
  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }
  }, []);

  // While the fixed banner is visible, offset page content so nothing is hidden behind it
  const bannerVisible = !isInstalled && !dismissed && !inIframe;
  useLayoutEffect(() => {
    if (!bannerVisible) {
      document.body.style.paddingTop = "";
      return;
    }
    const apply = () => {
      const h = bannerRef.current?.offsetHeight ?? 0;
      document.body.style.paddingTop = h ? `${h}px` : "";
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (ro && bannerRef.current) ro.observe(bannerRef.current);
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      ro?.disconnect();
      document.body.style.paddingTop = "";
    };
  }, [bannerVisible, showIOSGuide]);



  useEffect(() => {
    // Check if running in standalone mode (already installed)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    // Listen for the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detect when app is installed
    const installedHandler = () => {
      setIsInstalled(true);
      localStorage.setItem("app-installed", "true");
    };
    window.addEventListener("appinstalled", installedHandler);

    // Listen for display mode changes (covers uninstall + revisit)
    const mql = window.matchMedia("(display-mode: standalone)");
    const mqlHandler = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
      else {
        // App was uninstalled or opened in browser
        setIsInstalled(false);
        localStorage.removeItem("app-installed");
        setDismissed(false);
      }
    };
    mql.addEventListener("change", mqlHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      mql.removeEventListener("change", mqlHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        localStorage.setItem("app-installed", "true");
      }
    } else if (isIOS) {
      setShowIOSGuide(!showIOSGuide);
    }
  };

  // Don't show if installed, dismissed, or inside the Lovable preview iframe
  if (!bannerVisible) return null;

  return (
    <div ref={bannerRef} className="fixed top-0 left-0 right-0 z-[100] gradient-brand text-primary-foreground shadow-brand">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img src="/favicon.png" alt="Welfare" className="h-8 w-8 rounded-lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Install KIRINYAGA HCWW</p>
            <p className="text-xs text-primary-foreground/80 truncate">Get the app for quick access</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleInstall}
            size="sm"
            className="bg-white text-primary hover:bg-white/90 font-semibold shadow-neu-sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Install
          </Button>
          <button onClick={() => setDismissed(true)} className="text-primary-foreground/70 hover:text-primary-foreground text-lg px-1">✕</button>
        </div>
      </div>

      {showIOSGuide && isIOS && (
        <div className="px-4 pb-3 text-sm space-y-1 border-t border-white/20 pt-2">
          <p className="font-semibold">To install on iPhone/iPad:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-white/90 text-xs">
            <li>Tap the <strong>Share</strong> button (square with arrow) in Safari</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong> in the top right</li>
          </ol>
          <button onClick={() => setShowIOSGuide(false)} className="text-xs underline text-white/70 mt-1">
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
