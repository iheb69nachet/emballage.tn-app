import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/** Minimum delay between two background checks (foreground events can be frequent). */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Over-the-air updates (EAS Update).
 *
 * - Checks silently on launch and every time the app comes back to the foreground.
 * - When a new bundle is available, `status` becomes 'available' so the UI can prompt.
 * - `download()` fetches it; `progress` (0→1) mirrors the native download.
 * - Once downloaded the app is reloaded (`status` → 'ready' just before).
 *
 * Disabled in dev / Expo Go, where expo-updates is not active.
 */
export function useOtaUpdates() {
  const enabled = Updates.isEnabled && !__DEV__;
  const {
    isChecking, isDownloading, isUpdateAvailable, isUpdatePending,
    availableUpdate, downloadProgress, downloadError, checkError,
  } = Updates.useUpdates();

  // 'idle' | 'available' | 'downloading' | 'pending' | 'ready' | 'error'
  // pending = a new bundle is already downloaded (e.g. silently by the native layer) and waits for a restart
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);
  const reloading = useRef(false);

  const check = useCallback(async (force = false) => {
    if (!enabled) return;
    if (!force && Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
    lastCheck.current = Date.now();
    try {
      await Updates.checkForUpdateAsync();
    } catch {
      // Offline or server unreachable — stay silent, retry on next foreground.
    }
  }, [enabled]);

  // Launch + foreground checks
  useEffect(() => {
    if (!enabled) return undefined;
    check(true);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [enabled, check]);

  const reload = useCallback(async () => {
    if (reloading.current) return;
    reloading.current = true;
    setStatus('ready');
    try {
      await Updates.reloadAsync();
    } catch (e) {
      reloading.current = false;
      setError(e?.message || 'Impossible de redémarrer');
      setStatus('error');
    }
  }, []);

  // Derive UI status from the native state machine
  useEffect(() => {
    if (!enabled) return;
    if (isDownloading) { setStatus('downloading'); return; }
    if (isUpdatePending) {
      // Downloaded (by us, or silently by the native layer at launch) → apply.
      if (status === 'downloading') reload();
      else if (status !== 'ready' && !dismissed) setStatus('pending');
      return;
    }
    if (isUpdateAvailable && !dismissed) { setStatus('available'); return; }
    if (status === 'available' && !isUpdateAvailable) setStatus('idle');
  }, [enabled, isDownloading, isUpdatePending, isUpdateAvailable, dismissed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (downloadError) { setError(downloadError.message || 'Échec du téléchargement'); setStatus('error'); }
  }, [downloadError]);

  const download = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    setStatus('downloading');
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew || result.isRollBackToEmbedded) await reload();
      else setStatus('idle');
    } catch (e) {
      setError(e?.message || 'Échec du téléchargement');
      setStatus('error');
    }
  }, [enabled, reload]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setStatus('idle');
  }, []);

  return {
    enabled,
    status,
    progress: isDownloading ? (downloadProgress ?? 0) : (status === 'ready' || status === 'pending') ? 1 : 0,
    error: error ?? checkError?.message ?? null,
    isChecking,
    update: availableUpdate ?? null,
    currentUpdateId: Updates.updateId,
    check: () => check(true),
    download,
    restart: reload,
    dismiss,
  };
}
