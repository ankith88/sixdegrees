'use client';

import React, { useEffect, useState } from 'react';
import {
  Download,
  CheckCircle2,
  X,
  Share,
  PlusSquare,
  Monitor,
  Smartphone,
  Bookmark,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaInstallButtonProps {
  variant?: 'topbar' | 'sidebar';
}

export function PwaInstallButton({
  variant = 'topbar',
}: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [platformType, setPlatformType] = useState<'ios' | 'macos-safari' | 'chromium'>('chromium');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Register Service Worker for PWA installability & offline shell caching
    if ('serviceWorker' in navigator) {
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        // In local development, unregister any existing service workers and clear cache
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (const name of names) {
              caches.delete(name);
            }
          });
        }
      } else {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .catch(() => {
            // Non-blocking in restricted environments
          });
      }
    }

    // 2. Detect if already running in standalone mode
    const checkStandalone = () => {
      const standaloneMatch = window.matchMedia(
        '(display-mode: standalone)'
      ).matches;
      const iosStandalone =
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true;
      setIsInstalled(standaloneMatch || iosStandalone);
    };
    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    mediaQuery.addEventListener?.('change', handleDisplayChange);

    // 3. Detect browser/OS for fallback instructions if native prompt isn't fired
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari =
      /safari/.test(ua) && !/chrome|chromium|crios|edg|opr/.test(ua);

    if (isIos) {
      setPlatformType('ios');
    } else if (isSafari) {
      setPlatformType('macos-safari');
    } else {
      setPlatformType('chromium');
    }

    // 4. Listen for beforeinstallprompt & appinstalled
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) {
      setShowModal(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      } catch {
        setShowModal(true);
      }
      return;
    }

    setShowModal(true);
  };

  return (
    <>
      {variant === 'topbar' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`group inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8292F] ${
            isInstalled
              ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
              : deferredPrompt
                ? 'bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border-[#8C1D22] shadow-archival-sm'
                : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border-[#C8BEAA]'
          }`}
          title={
            isInstalled
              ? 'SixDegrees PWA is installed'
              : 'Download & install SixDegrees as a desktop or mobile PWA app'
          }
          aria-label={isInstalled ? 'App Installed' : 'Install App'}
        >
          {isInstalled ? (
            <>
              <CheckCircle2
                className="w-3.5 h-3.5 text-[#2A6B53] shrink-0"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">App Active</span>
            </>
          ) : (
            <>
              <Download
                className={`w-3.5 h-3.5 shrink-0 ${
                  deferredPrompt
                    ? 'text-[#FBF8F2]'
                    : 'text-[#B8292F] group-hover:translate-y-0.5 transition-transform'
                }`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Install App</span>
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
            isInstalled
              ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
              : 'bg-[#FBF8F2] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border-[#C8BEAA] hover:border-[#8C1D22] group'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isInstalled ? (
              <CheckCircle2
                className="w-3.5 h-3.5 text-[#2A6B53] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Download
                className="w-3.5 h-3.5 text-[#B8292F] group-hover:text-[#FBF8F2] shrink-0"
                aria-hidden="true"
              />
            )}
            <span className="truncate">
              {isInstalled
                ? 'SixDegrees App Installed'
                : 'Download SixDegrees App (PWA)'}
            </span>
          </div>
          <span
            className={`text-[10px] font-tabular px-1.5 py-0.5 rounded ${
              isInstalled
                ? 'bg-[#2A6B53]/15 text-[#1E563F]'
                : 'bg-[#EFE8DA] text-[#52483E] group-hover:bg-[#8C1D22] group-hover:text-[#FBF8F2]'
            }`}
          >
            {isInstalled ? 'Standalone' : 'Free'}
          </span>
        </button>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="motion-backdrop fixed inset-0 bg-[#171412]/45"
            onClick={() => setShowModal(false)}
            aria-hidden="true"
          />

          <div className="motion-modal relative w-full max-w-md rounded-xl bg-[#FBF8F2] border border-[#B5A892] shadow-archival p-5 z-10 text-[#171412] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/icon-192.png"
                  alt="SixDegrees App Icon"
                  className="w-11 h-11 rounded-xl border border-[#C8BEAA] shadow-archival-sm shrink-0"
                />
                <div>
                  <h2
                    id="pwa-install-title"
                    className="text-sm font-bold text-[#171412] flex items-center gap-1.5"
                  >
                    <span>Install SixDegrees App</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F5E4E4] text-[#8C1D22]">
                      PWA
                    </span>
                  </h2>
                  <p className="text-xs text-[#52483E]">
                    Curated Film &amp; Series Lineage Atlas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#EFE8DA]/70 border border-[#D5CCB9] space-y-2 text-xs text-[#52483E]">
              <div className="flex items-center gap-2 font-semibold text-[#171412]">
                <Bookmark
                  className="w-3.5 h-3.5 text-[#B8292F] shrink-0"
                  aria-hidden="true"
                />
                <span>Standalone App Experience</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-[11px] text-[#52483E]">
                <li>
                  Launches in its own dedicated window without browser toolbars
                </li>
                <li>
                  Instant access from your macOS Dock, Windows Taskbar, or Home
                  Screen
                </li>
                <li>
                  Caches your expanded film &amp; series constellation for fast
                  loading
                </li>
              </ul>
            </div>

            {isInstalled ? (
              <div className="p-3 rounded-lg bg-[#E4F0EA] border border-[#B3D4C5] flex items-center gap-2.5 text-xs text-[#1E563F]">
                <CheckCircle2
                  className="w-4 h-4 text-[#2A6B53] shrink-0"
                  aria-hidden="true"
                />
                <span>
                  SixDegrees is already running as an installed application on
                  this device.
                </span>
              </div>
            ) : deferredPrompt ? (
              <button
                type="button"
                onClick={async () => {
                  await deferredPrompt.prompt();
                  const choice = await deferredPrompt.userChoice;
                  if (choice.outcome === 'accepted') {
                    setIsInstalled(true);
                    setDeferredPrompt(null);
                    setShowModal(false);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] text-xs font-bold flex items-center justify-center gap-2 shadow-archival-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Install SixDegrees Now
              </button>
            ) : (
              <div className="space-y-2.5 text-xs">
                {platformType === 'ios' && (
                  <div className="p-3 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#171412]">
                      <Smartphone
                        className="w-3.5 h-3.5 text-[#B8292F]"
                        aria-hidden="true"
                      />
                      <span>Install on iPhone or iPad (Safari)</span>
                    </div>
                    <ol className="space-y-1.5 text-[11px] text-[#52483E] list-decimal pl-4">
                      <li>
                        Tap the{' '}
                        <span className="inline-flex items-center gap-0.5 font-semibold text-[#171412]">
                          <Share className="w-3 h-3 inline" /> Share
                        </span>{' '}
                        button in Safari&apos;s toolbar.
                      </li>
                      <li>
                        Scroll down and tap{' '}
                        <span className="inline-flex items-center gap-0.5 font-semibold text-[#171412]">
                          <PlusSquare className="w-3 h-3 inline" /> Add to Home
                          Screen
                        </span>
                        .
                      </li>
                      <li>
                        Tap <strong className="text-[#171412]">Add</strong> in
                        the top-right corner.
                      </li>
                    </ol>
                  </div>
                )}

                {platformType === 'macos-safari' && (
                  <div className="p-3 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#171412]">
                      <Monitor
                        className="w-3.5 h-3.5 text-[#B8292F]"
                        aria-hidden="true"
                      />
                      <span>Install on Mac (Safari)</span>
                    </div>
                    <ol className="space-y-1.5 text-[11px] text-[#52483E] list-decimal pl-4">
                      <li>
                        Click <strong className="text-[#171412]">File</strong>{' '}
                        in the top macOS menu bar (or the{' '}
                        <strong className="text-[#171412]">Share</strong> icon
                        in the toolbar).
                      </li>
                      <li>
                        Select{' '}
                        <strong className="text-[#171412]">
                          Add to Dock…
                        </strong>
                      </li>
                      <li>
                        Click <strong className="text-[#171412]">Add</strong> to
                        launch SixDegrees as a standalone Mac app.
                      </li>
                    </ol>
                  </div>
                )}

                {platformType === 'chromium' && (
                  <div className="p-3 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#171412]">
                      <Monitor
                        className="w-3.5 h-3.5 text-[#B8292F]"
                        aria-hidden="true"
                      />
                      <span>Install on Desktop or Mobile</span>
                    </div>
                    <ol className="space-y-1.5 text-[11px] text-[#52483E] list-decimal pl-4">
                      <li>
                        Click the{' '}
                        <strong className="text-[#171412]">
                          Install SixDegrees
                        </strong>{' '}
                        icon in the right side of your browser&apos;s address
                        bar, or open the browser menu (⋮).
                      </li>
                      <li>
                        Choose{' '}
                        <strong className="text-[#171412]">
                          Install SixDegrees…
                        </strong>{' '}
                        (or{' '}
                        <strong className="text-[#171412]">
                          Cast, save, and share → Install page as app
                        </strong>
                        ).
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#EFE8DA] hover:bg-[#E5DEC9] text-[#171412] border border-[#C8BEAA] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
