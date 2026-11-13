import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

const MAX_STRIKES = 3;
const COOLDOWN_MS = 5000; // 5 detik jeda antar pelanggaran

/**
 * Hook anti-cheat untuk mode ujian.
 *
 * @param {{ onForceSubmit: () => void }} options
 * @returns {{ strikeLevel: number, isExamActive: boolean, requestFullscreen: () => void, deactivate: () => void }}
 */
export function useExamAntiCheat({ onForceSubmit }) {
  const [strikeLevel, setStrikeLevel] = useState(0);
  const [isExamActive, setIsExamActive] = useState(false);

  // Ref supaya event listener selalu baca nilai terbaru tanpa closure-stale
  const strikeLevelRef = useRef(0);
  const isExamActiveRef = useRef(false);
  const cooldownActiveRef = useRef(false);
  const onForceSubmitRef = useRef(onForceSubmit);

  // Sinkronkan ref ke prop terbaru setiap render
  useEffect(() => {
    onForceSubmitRef.current = onForceSubmit;
  }, [onForceSubmit]);

  // Sinkronkan isExamActiveRef ke state
  useEffect(() => {
    isExamActiveRef.current = isExamActive;
  }, [isExamActive]);

  // ── Fungsi internal: tambah 1 strike dengan cooldown 5 detik ──────────────
  const addStrike = useCallback(() => {
    if (!isExamActiveRef.current) return;
    if (cooldownActiveRef.current) return; // masih cooldown, abaikan

    cooldownActiveRef.current = true;
    setTimeout(() => {
      cooldownActiveRef.current = false;
    }, COOLDOWN_MS);

    const next = Math.min(strikeLevelRef.current + 1, MAX_STRIKES);
    strikeLevelRef.current = next;
    setStrikeLevel(next);

    if (next >= MAX_STRIKES) {
      onForceSubmitRef.current?.();
    }
  }, []);

  // ── Event: fullscreen berubah ──────────────────────────────────────────────
  useEffect(() => {
    if (!isExamActive) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addStrike();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isExamActive, addStrike]);

  // ── Event: pindah tab (visibilitychange) atau window blur ─────────────────
  useEffect(() => {
    if (!isExamActive) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') addStrike();
    };
    const handleBlur = () => addStrike();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isExamActive, addStrike]);

  // ── Fungsi publik: aktifkan mode ujian + minta fullscreen ─────────────────
  const requestFullscreen = useCallback(() => {
    // Reset state
    strikeLevelRef.current = 0;
    setStrikeLevel(0);
    cooldownActiveRef.current = false;
    setIsExamActive(true);

    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Browser bisa blokir autoplay-style fullscreen; ujian tetap jalan
        console.warn('[AntiCheat] Fullscreen request was denied by browser.');
      });
    }
  }, []);

  // ── Fungsi publik: nonaktifkan ujian + keluar fullscreen ──────────────────
  const deactivate = useCallback(() => {
    setIsExamActive(false);
    strikeLevelRef.current = 0;
    setStrikeLevel(0);
    cooldownActiveRef.current = false;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return { strikeLevel, isExamActive, requestFullscreen, deactivate };
}
