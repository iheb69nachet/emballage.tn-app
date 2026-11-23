import { useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

/**
 * Background polling: calls `callback` right away, then every `intervalMs`,
 * so changes made from the admin show up without a manual refresh.
 *
 * Inside a navigation screen it only runs while that screen is focused, and
 * fires again as soon as the screen regains focus. It pauses while the app is
 * in the background and refreshes when it comes back to the foreground.
 */
export function usePolling(callback, intervalMs = 30000) {
  const cbRef = useRef(callback);
  // null when used outside a screen (no focus tracking then)
  const navigation = useContext(NavigationContext);

  useEffect(() => { cbRef.current = callback; });

  useEffect(() => {
    let interval = null;
    const tick = () => cbRef.current();
    const start = () => {
      if (interval) return;
      tick();
      interval = setInterval(tick, intervalMs);
    };
    const stop = () => {
      clearInterval(interval);
      interval = null;
    };
    const focused = () => !navigation || navigation.isFocused();

    if (focused()) start();

    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (focused()) start();
      } else {
        stop();
      }
    });
    const unsubFocus = navigation?.addListener('focus', start);
    const unsubBlur = navigation?.addListener('blur', stop);

    return () => {
      stop();
      appSub.remove();
      unsubFocus?.();
      unsubBlur?.();
    };
  }, [intervalMs, navigation]);
}
