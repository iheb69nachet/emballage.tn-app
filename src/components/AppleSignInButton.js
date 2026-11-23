import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

// Native "Sign in with Apple" button — required by App Store Guideline 4.8
// alongside any third-party login. Renders nothing on Android or when the
// device doesn't support it (iOS < 13).
export default function AppleSignInButton({ onSuccess, onError, disabled, type = 'signIn' }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    if (disabled) return;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        onSuccess?.(credential.identityToken, credential.fullName);
      } else {
        onError?.(new Error('No identity token returned by Apple'));
      }
    } catch (e) {
      if (e.code === 'ERR_REQUEST_CANCELED') return; // user dismissed the sheet
      onError?.(e);
    }
  };

  return (
    <View style={{ marginTop: 12, opacity: disabled ? 0.5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          type === 'signUp'
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={14}
        style={{ width: '100%', height: 52 }}
        onPress={handlePress}
      />
    </View>
  );
}
