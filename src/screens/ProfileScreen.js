import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import { useAuthStore } from '../stores/authStore';

const INFO_ROWS = [
  { icon: '✉️', label: 'EMAIL',  key: 'email' },
  { icon: '👤', label: 'PRÉNOM', key: 'firstName' },
  { icon: '👤', label: 'NOM',    key: 'lastName' },
  { icon: '🔑', label: 'RÔLE',   key: 'role' },
];

function EditModal({ visible, user, onClose, onSave }) {
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName]   = useState(user?.lastName  || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Prénom et nom requis.'); return;
    }
    setError(''); setLoading(true);
    try {
      await onSave({ firstName: firstName.trim(), lastName: lastName.trim() });
      onClose();
    } catch (e) {
      setError(e?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setLoading(false);
    }
  };

  const inputRow = {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.bg, borderRadius: 14,
    paddingHorizontal: 14, height: 52,
    marginBottom: 12, borderWidth: 1.5, borderColor: T.border, gap: 10,
  };

  return (
    <Modal visible={visible} transparent animationType="slide"
      onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1} onPress={onClose} />
        <View style={{
          backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: 28, paddingBottom: 36,
          shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12, shadowRadius: 16, elevation: 24,
        }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2 }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 20 }}>
            Modifier le profil
          </Text>

          <View style={inputRow}>
            <Text style={{ fontSize: 18, width: 22, textAlign: 'center' }}>👤</Text>
            <View style={{ width: 1, height: 20, backgroundColor: T.border }} />
            <TextInput style={{ flex: 1, fontSize: 14, color: T.text }}
              placeholder="Prénom" placeholderTextColor={T.muted}
              value={firstName} onChangeText={setFirstName} />
          </View>

          <View style={inputRow}>
            <Text style={{ fontSize: 18, width: 22, textAlign: 'center' }}>👤</Text>
            <View style={{ width: 1, height: 20, backgroundColor: T.border }} />
            <TextInput style={{ flex: 1, fontSize: 14, color: T.text }}
              placeholder="Nom" placeholderTextColor={T.muted}
              value={lastName} onChangeText={setLastName} />
          </View>

          {error ? (
            <View style={{
              backgroundColor: '#FEF2F2', borderRadius: 12, padding: 10,
              marginBottom: 12, flexDirection: 'row', gap: 8,
              borderWidth: 1, borderColor: '#FECACA',
            }}>
              <Text style={{ fontSize: 14 }}>⚠️</Text>
              <Text style={{ color: '#DC2626', fontSize: 13, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={T.primary} style={{ marginVertical: 12 }} />
          ) : (
            <TouchableOpacity onPress={handleSave} activeOpacity={0.8}
              style={{
                backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16,
                alignItems: 'center', marginBottom: 10,
                shadowColor: T.primary, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
              }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Enregistrer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10 }}>
            <Text style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const r = useR();
  const { showToast } = useApp();
  const { user, logout, updateUser } = useAuthStore();
  const [editVisible, setEditVisible] = useState(false);

  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : 'Invité';
  const initials = user?.firstName ? user.firstName.charAt(0).toUpperCase() : '👤';

  const getRoleLabel = () => {
    if (!user?.roles?.length) return 'client';
    return user.roles.map(r => (typeof r === 'string' ? r : r.name)).join(', ');
  };

  const getValue = (key) => {
    if (key === 'role') return getRoleLabel();
    return user?.[key] || '—';
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>

        {/* Curved header */}
        <View style={{
          backgroundColor: T.primary,
          paddingTop: 36, paddingBottom: 56, paddingHorizontal: r.px,
          alignItems: 'center',
          borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
        }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: T.accent,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 4, borderColor: 'rgba(255,255,255,0.25)',
            marginBottom: 14,
          }}>
            <Text style={{ fontSize: 40, fontWeight: '800', color: T.primary }}>
              {initials}
            </Text>
          </View>
          <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 3 }}>
            {displayName}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 14 }}>
            {user?.email || 'Non connecté'}
          </Text>
          {user && (
            <View style={{
              backgroundColor: T.accent, borderRadius: 20,
              paddingHorizontal: 16, paddingVertical: 6,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
              <Text style={{ fontSize: 12 }}>⭐</Text>
              <Text style={{ color: T.primary, fontWeight: '800', fontSize: 12 }}>Client B2B</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: r.px, marginTop: 24 }}>
          {user ? (
            <>
              <Text style={{
                fontSize: 11, fontWeight: '800', color: T.muted,
                letterSpacing: 1.5, marginBottom: 12,
              }}>INFORMATIONS DU COMPTE</Text>

              {INFO_ROWS.map(({ icon, label, key }) => (
                <View key={key} style={{
                  backgroundColor: '#FFF', borderRadius: 16, padding: 16,
                  marginBottom: 8, flexDirection: 'row', gap: 14, alignItems: 'center',
                  borderWidth: 1, borderColor: T.border,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04, shadowRadius: 4,
                }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 13,
                    backgroundColor: T.primary + '10',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 22 }}>{icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: T.muted, fontWeight: '700',
                      letterSpacing: 0.5, marginBottom: 3 }}>{label}</Text>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: T.text }}>
                      {getValue(key)}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={{ gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => setEditVisible(true)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    borderWidth: 1.5, borderColor: T.primary + '30',
                  }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 13,
                    backgroundColor: T.primary + '10',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 20 }}>✏️</Text>
                  </View>
                  <Text style={{ flex: 1, fontWeight: '700', fontSize: 14, color: T.primary }}>
                    Modifier mon profil
                  </Text>
                  <Text style={{ color: T.primary, fontSize: 16 }}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={logout}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    borderWidth: 1.5, borderColor: T.danger + '30',
                  }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 13,
                    backgroundColor: T.danger + '10',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 20 }}>🚪</Text>
                  </View>
                  <Text style={{ flex: 1, fontWeight: '700', fontSize: 14, color: T.danger }}>
                    Se déconnecter
                  </Text>
                  <Text style={{ color: T.danger + '60', fontSize: 16 }}>›</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
              <View style={{
                width: 90, height: 90, borderRadius: 28,
                backgroundColor: T.primary + '10',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 44 }}>🔒</Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Non connecté</Text>
              <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>
                Connectez-vous pour accéder à votre profil et gérer votre compte
              </Text>
              <TouchableOpacity
                onPress={() => navigation.getParent('Root')?.navigate('Login')}
                activeOpacity={0.8}
                style={{
                  backgroundColor: T.primary, borderRadius: 16,
                  paddingHorizontal: 32, paddingVertical: 14,
                  shadowColor: T.primary, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
                }}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <EditModal
        visible={editVisible}
        user={user}
        onClose={() => setEditVisible(false)}
        onSave={async (data) => {
          await updateUser(data);
          showToast('Profil mis à jour ✓');
        }}
      />
    </View>
  );
}
