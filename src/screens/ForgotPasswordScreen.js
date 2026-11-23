import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { T } from '../constants/theme';
import { useAuthStore } from '../stores/authStore';
import * as api from '../services/api';
import Btn from '../components/Btn';

function Field({ icon, ...props }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14,
      paddingHorizontal: 16, height: 56, marginBottom: 12, borderWidth: 1.5, borderColor: T.border, gap: 12,
    }}>
      <Text style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</Text>
      <View style={{ width: 1, height: 20, backgroundColor: T.border }} />
      <TextInput style={{ flex: 1, fontSize: 14, color: T.text }} {...props} />
    </View>
  );
}

export default function ForgotPasswordScreen({ navigation, route }) {
  const loginWithToken = useAuthStore(s => s.loginWithToken);
  const [step, setStep] = useState(1); // 1 = email, 2 = code + new password
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { setError('Adresse e-mail invalide.'); return; }
    setError(''); setLoading(true);
    try {
      await api.auth.forgotPassword(e);
      setEmail(e);
      setInfo(`Si un compte existe pour ${e}, un code à 6 chiffres vient d'être envoyé.`);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Envoi impossible. Réessayez.');
    } finally { setLoading(false); }
  };

  const reset = async () => {
    if (otp.trim().length !== 6) { setError('Saisissez le code à 6 chiffres reçu par e-mail.'); return; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setError(''); setLoading(true);
    try {
      const { accessToken, user } = await api.auth.resetPassword(email, otp.trim(), password);
      await loginWithToken(accessToken, user);
      navigation.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (err) {
      setError(err.message === 'Code invalide' || err.message === 'Code expiré' ? err.message + '.' : (err.message || 'Réinitialisation impossible.'));
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ backgroundColor: T.primary, paddingTop: 64, paddingBottom: 32, paddingHorizontal: 28 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '900', marginBottom: 6 }}>Mot de passe oublié</Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
          {step === 1 ? 'Nous vous enverrons un code par e-mail' : 'Saisissez le code reçu et votre nouveau mot de passe'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, paddingTop: 36 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <Field icon="✉️" placeholder="Email" placeholderTextColor={T.muted} keyboardType="email-address"
            autoCapitalize="none" autoFocus value={email} onChangeText={setEmail} />
        ) : (
          <>
            {info ? (
              <View style={{ backgroundColor: T.primary + '10', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: T.primary + '30' }}>
                <Text style={{ color: T.primary, fontSize: 13 }}>📬 {info}</Text>
              </View>
            ) : null}
            <Field icon="🔢" placeholder="Code à 6 chiffres" placeholderTextColor={T.muted} keyboardType="number-pad"
              maxLength={6} autoFocus value={otp} onChangeText={setOtp} />
            <Field icon="🔑" placeholder="Nouveau mot de passe" placeholderTextColor={T.muted} secureTextEntry
              value={password} onChangeText={setPassword} />
            <Field icon="🔑" placeholder="Confirmer le mot de passe" placeholderTextColor={T.muted} secureTextEntry
              value={confirm} onChangeText={setConfirm} />
          </>
        )}

        {error ? (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={{ color: '#DC2626', fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        ) : <View style={{ height: 14 }} />}

        {loading ? (
          <ActivityIndicator color={T.primary} style={{ marginVertical: 8 }} />
        ) : (
          <Btn label={step === 1 ? 'Envoyer le code' : 'Réinitialiser le mot de passe'} bg={T.primary} size="lg"
            onPress={step === 1 ? sendCode : reset} />
        )}

        {step === 2 && !loading && (
          <TouchableOpacity onPress={sendCode} style={{ marginTop: 18, paddingVertical: 8 }}>
            <Text style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>
              Code non reçu ? <Text style={{ color: T.primary, fontWeight: '700' }}>Renvoyer</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
