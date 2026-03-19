import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { T } from '../constants/theme';
import { useAuthStore } from '../stores/authStore';
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

export default function LoginScreen({ navigation }) {
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
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

        <TouchableOpacity onPress={() => navigation.navigate('Register')}
          style={{ marginTop: 22, paddingVertical: 8 }}>
          <Text style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>
            Pas encore de compte ?{' '}
            <Text style={{ color: T.primary, fontWeight: '700' }}>S'inscrire</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('App')}
          style={{ marginTop: 8, paddingVertical: 8 }}>
          <Text style={{ textAlign: 'center', color: T.muted, fontSize: 13 }}>
            Continuer sans connexion →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
