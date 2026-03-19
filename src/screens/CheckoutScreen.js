import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';

const FIELDS = [
  { key: 'fullName',  label: 'Nom complet',        icon: '👤', keyboard: 'default' },
  { key: 'phone',     label: 'Téléphone',           icon: '📞', keyboard: 'phone-pad' },
  { key: 'address',   label: 'Adresse',             icon: '📍', keyboard: 'default' },
  { key: 'city',      label: 'Ville',               icon: '🏙️', keyboard: 'default' },
  { key: 'zip',       label: 'Code postal',         icon: '🔢', keyboard: 'numeric' },
  { key: 'notes',     label: 'Notes (optionnel)',   icon: '📝', keyboard: 'default', optional: true },
];

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const r = useR();
  const { cart, cartTotal, placeOrder } = useApp();
  const [form, setForm] = useState({ fullName: '', phone: '', address: '', city: '', zip: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    const required = FIELDS.filter(f => !f.optional);
    const missing = required.find(f => !form[f.key].trim());
    if (missing) { setError(`Veuillez remplir : ${missing.label}`); return; }
    setError(''); setLoading(true);
    try {
      const address = `${form.fullName}, ${form.address}, ${form.city} ${form.zip}${form.phone ? ' — Tél: ' + form.phone : ''}${form.notes ? ' — Notes: ' + form.notes : ''}`;
      await placeOrder(address);
      navigation.navigate('Main', { screen: 'Orders' });
    } catch (e) {
      setError(e?.message || 'Erreur lors de la commande.');
    } finally {
      setLoading(false);
    }
  };

  const inputRow = {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 14,
    paddingHorizontal: 14, minHeight: 52,
    marginBottom: 10, borderWidth: 1.5, borderColor: T.border, gap: 10,
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{ padding: r.px, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Order summary card */}
        <View style={{
          backgroundColor: T.primary, borderRadius: 20, padding: 20, marginBottom: 24,
          shadowColor: T.primary, shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800',
            letterSpacing: 1.5, marginBottom: 12 }}>RÉCAPITULATIF</Text>
          {cart.map(item => (
            <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between',
              marginBottom: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, flex: 1 }}
                numberOfLines={1}>{item.name} ×{item.qty}</Text>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', marginLeft: 8 }}>
                {(item.qty * Number(item.price)).toFixed(3)}
              </Text>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', marginVertical: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Total TTC</Text>
            <Text style={{ color: T.accent, fontWeight: '900', fontSize: 22 }}>
              {(cartTotal * 1.19).toFixed(3)}
              <Text style={{ fontSize: 13, fontWeight: '700' }}> TND</Text>
            </Text>
          </View>
        </View>

        {/* Delivery address */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted,
          letterSpacing: 1.5, marginBottom: 14 }}>ADRESSE DE LIVRAISON</Text>

        {FIELDS.map(f => (
          <View key={f.key} style={inputRow}>
            <Text style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{f.icon}</Text>
            <View style={{ width: 1, height: 20, backgroundColor: T.border }} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: T.text, paddingVertical: 14 }}
              placeholder={f.label}
              placeholderTextColor={T.muted}
              keyboardType={f.keyboard}
              value={form[f.key]}
              onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
            />
          </View>
        ))}

        {error ? (
          <View style={{
            backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12,
            marginBottom: 12, borderWidth: 1, borderColor: '#FECACA',
            flexDirection: 'row', gap: 8,
          }}>
            <Text style={{ fontSize: 14 }}>⚠️</Text>
            <Text style={{ color: '#DC2626', fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={T.primary} style={{ marginVertical: 16 }} />
        ) : (
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.8}
            style={{
              backgroundColor: T.primary, borderRadius: 16, paddingVertical: 18,
              alignItems: 'center', marginTop: 4,
              shadowColor: T.primary, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
            }}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>
              ✅ Confirmer la commande
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
