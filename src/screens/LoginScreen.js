import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { T } from '../constants/theme';
import { useAuthStore } from '../stores/authStore';
import * as api from '../services/api';
import Btn from '../components/Btn';
import AppleSignInButton from '../components/AppleSignInButton';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

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

export default function LoginScreen({ navigation }) {
  const login = useAuthStore(s => s.login);
  const loginWithToken = useAuthStore(s => s.loginWithToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (idToken) => {
    setLoading(true);
    setError('');
    try {
      const { accessToken, user } = await api.auth.googleLogin(idToken);
      await loginWithToken(accessToken, user);
      navigation.navigate('App');
    } catch (e) {
      setError('Connexion Google échouée. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const { promptAsync: googlePrompt, ready: googleReady } = useGoogleAuth({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Connexion Google échouée. Réessayez.'),
  });

  const handleAppleSuccess = async (identityToken, fullName) => {
    setLoading(true);
    setError('');
    try {
      const { accessToken, user } = await api.auth.appleLogin(identityToken, fullName);
      await loginWithToken(accessToken, user);
      navigation.navigate('App');
    } catch (e) {
      setError(e.message || 'Connexion Apple échouée. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigation.navigate('App');
    } catch (e) {
      console.log(e.message);
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: T.bg }}>

      {/* Brand header */}
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
          fontWeight: '700', letterSpacing: 2, marginBottom: 6 }}>BIENVENUE SUR</Text>
        <Text style={{ color: '#FFF', fontSize: 30, fontWeight: '900', marginBottom: 6 }}>
          emballage<Text style={{ color: T.accent }}>.tn</Text>
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
          Connectez-vous à votre compte
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, paddingTop: 36 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Field icon="✉️" placeholder="Email" placeholderTextColor={T.muted}
          keyboardType="email-address" autoCapitalize="none"
          value={email} onChangeText={setEmail} />

        <Field icon="🔑" placeholder="Mot de passe" placeholderTextColor={T.muted}
          secureTextEntry value={password} onChangeText={setPassword} />

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword', { email })}
          style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 8, paddingVertical: 4 }}>
          <Text style={{ color: T.primary, fontSize: 13, fontWeight: '700' }}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        {error ? (
          <View style={{
            backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12,
            marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
            borderWidth: 1, borderColor: '#FECACA',
          }}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={{ color: '#DC2626', fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        ) : <View style={{ height: 14 }} />}

        {loading ? (
          <ActivityIndicator color={T.primary} style={{ marginVertical: 8 }} />
        ) : (
          <Btn label="Se connecter" bg={T.primary} size="lg" onPress={handleLogin} />
        )}

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
          <Text style={{ color: T.muted, fontSize: 12 }}>ou</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
        </View>

        {/* Google sign-in */}
        <TouchableOpacity
          onPress={() => googlePrompt()}
          disabled={!googleReady || loading}
          activeOpacity={0.8}
          style={{
            marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#FFF', borderRadius: 14, height: 52, gap: 10,
            borderWidth: 1.5, borderColor: T.border,
            opacity: !googleReady || loading ? 0.5 : 1,
          }}>
          <Text style={{ fontSize: 20 }}>G</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>
            Continuer avec Google
          </Text>
        </TouchableOpacity>

        {/* Sign in with Apple (iOS only) */}
        <AppleSignInButton
          disabled={loading}
          onSuccess={handleAppleSuccess}
          onError={() => setError('Connexion Apple échouée. Réessayez.')}
        />

        <TouchableOpacity onPress={() => navigation.navigate('Register')}
          style={{ marginTop: 22, paddingVertical: 8 }}>
          <Text style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>
            Pas encore de compte ?{' '}
            <Text style={{ color: T.primary, fontWeight: '700' }}>S'inscrire</Text>
          </Text>
        </TouchableOpacity>


      </ScrollView>
    </KeyboardAvoidingView>
  );
}
