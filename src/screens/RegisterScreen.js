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
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#FFF', borderRadius: 14,
      paddingHorizontal: 16, height: 56,
      marginBottom: 12, borderWidth: 1.5, borderColor: T.border, gap: 12,
    }}>
      <Text style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</Text>
      <View style={{ width: 1, height: 20, backgroundColor: T.border }} />
      <TextInput style={{ flex: 1, fontSize: 14, color: T.text }} {...props} />
    </View>
  );
}

function StepDots({ current }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
      {[0, 1].map(i => (
        <View key={i} style={{
          height: 4, borderRadius: 2,
          backgroundColor: i <= current ? T.accent : 'rgba(255,255,255,0.3)',
          flex: i <= current ? 2 : 1,
        }} />
      ))}
    </View>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return <View style={{ height: 14 }} />;
  return (
    <View style={{
      backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12,
      marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
      borderWidth: 1, borderColor: '#FECACA',
    }}>
      <Text style={{ fontSize: 16 }}>⚠️</Text>
      <Text style={{ color: '#DC2626', fontSize: 13, flex: 1 }}>{msg}</Text>
    </View>
  );
}

export default function RegisterScreen({ navigation }) {
  const loginWithToken = useAuthStore(s => s.loginWithToken);
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setError('Veuillez remplir tous les champs.'); return;
    }
    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas.'); return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.'); return;
    }
    setError(''); setLoading(true);
    try {
      await api.auth.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setStep('otp');
    } catch (e) {
      setError(e?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length < 4) { setError('Entrez le code reçu par email.'); return; }
    setError(''); setLoading(true);
    try {
      // verifyOtp returns { accessToken, user } directly
      const { accessToken, user } = await api.auth.verifyOtp(form.email.trim(), otp.trim());
      await loginWithToken(accessToken, user);
    } catch (e) {
      setError(e?.message || 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await api.auth.resendOtp(form.email.trim());
      setError('');
    } catch (e) {
      setError(e?.message || 'Impossible de renvoyer le code.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{
          backgroundColor: T.primary, paddingTop: 64, paddingBottom: 52,
          paddingHorizontal: 28, borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
        }}>
          <View style={{
            width: 68, height: 68, backgroundColor: T.accent, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <Text style={{ fontSize: 36 }}>✉️</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11,
            fontWeight: '700', letterSpacing: 2, marginBottom: 6 }}>ÉTAPE 2/2</Text>
          <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '900', marginBottom: 6 }}>
            Vérification email
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
            Code envoyé à {form.email}
          </Text>
          <StepDots current={1} />
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, paddingTop: 36 }}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 13, color: T.muted, marginBottom: 16, textAlign: 'center' }}>
            Entrez le code à 6 chiffres reçu par email
          </Text>
          <TextInput
            placeholder="• • • • • •"
            placeholderTextColor={T.border}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            style={{
              backgroundColor: '#FFF', borderRadius: 14, padding: 18, fontSize: 28,
              textAlign: 'center', letterSpacing: 12, color: T.primary, fontWeight: '800',
              marginBottom: 6, borderWidth: 2, borderColor: otp.length >= 4 ? T.primary : T.border,
            }} />

          <ErrorBox msg={error} />

          {loading ? (
            <ActivityIndicator color={T.primary} style={{ marginVertical: 8 }} />
          ) : (
            <Btn label="Vérifier le code" bg={T.primary} size="lg" onPress={handleVerify} />
          )}

          <TouchableOpacity onPress={handleResend} disabled={loading}
            style={{ marginTop: 18, paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: T.primary, fontSize: 14, fontWeight: '600' }}>
              🔄  Renvoyer le code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setStep('form'); setOtp(''); setError(''); }}
            style={{ marginTop: 8, paddingVertical: 8 }}>
            <Text style={{ textAlign: 'center', color: T.muted, fontSize: 13 }}>← Retour</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{
        backgroundColor: T.primary, paddingTop: 64, paddingBottom: 52,
        paddingHorizontal: 28, borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
      }}>
        <View style={{
          width: 68, height: 68, backgroundColor: T.accent, borderRadius: 20,
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Text style={{ fontSize: 36 }}>📦</Text>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11,
          fontWeight: '700', letterSpacing: 2, marginBottom: 6 }}>ÉTAPE 1/2</Text>
        <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '900', marginBottom: 6 }}>
          Créer un compte
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
          Rejoignez emballage.tn
        </Text>
        <StepDots current={0} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, paddingTop: 36 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field icon="👤" placeholder="Prénom" placeholderTextColor={T.muted}
              value={form.firstName} onChangeText={v => setField('firstName', v)} />
          </View>
          <View style={{ flex: 1 }}>
            <Field icon="👤" placeholder="Nom" placeholderTextColor={T.muted}
              value={form.lastName} onChangeText={v => setField('lastName', v)} />
          </View>
        </View>

        <Field icon="✉️" placeholder="Email" placeholderTextColor={T.muted}
          keyboardType="email-address" autoCapitalize="none"
          value={form.email} onChangeText={v => setField('email', v)} />

        <Field icon="🔑" placeholder="Mot de passe (8 caractères min.)" placeholderTextColor={T.muted}
          secureTextEntry value={form.password} onChangeText={v => setField('password', v)} />

        <Field icon="🔒" placeholder="Confirmer le mot de passe" placeholderTextColor={T.muted}
          secureTextEntry value={form.confirm} onChangeText={v => setField('confirm', v)} />

        <ErrorBox msg={error} />

        {loading ? (
          <ActivityIndicator color={T.primary} style={{ marginVertical: 8 }} />
        ) : (
          <Btn label="Continuer →" bg={T.primary} size="lg" onPress={handleRegister} />
        )}

        <TouchableOpacity onPress={() => navigation.goBack()}
          style={{ marginTop: 22, paddingVertical: 8 }}>
          <Text style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>
            Déjà un compte ?{' '}
            <Text style={{ color: T.primary, fontWeight: '700' }}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
