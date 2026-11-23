import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// ── Google Cloud Console → APIs & Services → Credentials ──────
// Create ONE "Web application" client ID.
// Under "Authorized redirect URIs" add:
//   https://auth.expo.io/@inachet33-2-2/myApp
const WEB_CLIENT_ID = '352912941219-qkt6qtit33k53ujkud2fcgp5pltq8che.apps.googleusercontent.com';

// For production native builds, create separate Android/iOS client IDs
// and fill them in here. Leave as null if not yet created.
const ANDROID_CLIENT_ID = '352912941219-qkt6qtit33k53ujkud2fcgp5pltq8che.apps.googleusercontent.com';
const IOS_CLIENT_ID = '352912941219-qkt6qtit33k53ujkud2fcgp5pltq8che.apps.googleusercontent.com';

// Expo proxy gives a stable HTTPS redirect URI that Google accepts.
// For production APK/IPA use scheme-based redirect instead.
const redirectUri = makeRedirectUri({ useProxy: true });

export function useGoogleAuth({ onSuccess, onError } = {}) {
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef  = useRef(onError);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current  = onError;  }, [onError]);

  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      webClientId:     WEB_CLIENT_ID,
      androidClientId: ANDROID_CLIENT_ID ?? undefined,
      iosClientId:     IOS_CLIENT_ID ?? undefined,
      redirectUri,
    },
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken =
        response.authentication?.idToken ??
        response.params?.id_token;
      if (idToken) {
        onSuccessRef.current?.(idToken);
      } else {
        onErrorRef.current?.(new Error('No ID token returned — check Google Console scopes'));
      }
    } else if (response.type === 'error') {
      onErrorRef.current?.(response.error ?? new Error('Google sign-in failed'));
    }
  }, [response]);

  return { promptAsync, ready: !!request };
}
