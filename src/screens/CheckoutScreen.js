import { useState, useEffect } from 'react';
import { usePolling } from '../hooks/usePolling';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Linking,
  KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { locateWithAddress } from '../services/geo';

const TAX_RATE = 0.19;

const FIELDS = [
  { key: 'fullName',  label: 'Nom complet',        icon: '👤', keyboard: 'default' },
  { key: 'phone',     label: 'Téléphone',           icon: '📞', keyboard: 'phone-pad' },
  { key: 'address',   label: 'Adresse',             icon: '📍', keyboard: 'default', deliveryOnly: true },
  { key: 'city',      label: 'Ville',               icon: '🏙️', keyboard: 'default', deliveryOnly: true },
  { key: 'notes',     label: 'Notes (optionnel)',   icon: '📝', keyboard: 'default', optional: true },
];

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const r = useR();
  const { cart, cartTotal, placeOrder, currentUser } = useApp();
  const [form, setForm] = useState({
    fullName: [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim(),
    phone: currentUser?.phone || '', address: currentUser?.address || '', city: currentUser?.city || '', notes: '',
  });

  // Keep the name in sync if the profile loads after the screen mounted (field left empty)
  useEffect(() => {
    const name = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim();
    if (name) setForm(p => (p.fullName.trim() ? p : { ...p, fullName: name }));
  }, [currentUser?.firstName, currentUser?.lastName]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState(null);           // null = loading
  const [paymentMethod, setPaymentMethod] = useState(null); // selected method code
  const [coords, setCoords] = useState(null);             // { latitude, longitude, accuracy } | null
  const [locating, setLocating] = useState(false);
  const [deliveryChoice, setDeliveryChoice] = useState('livraison'); // 'livraison' | 'retrait'
  const [company, setCompany] = useState(null);           // stamp duty + pickup options (admin → Société)

  /** "Récupérer les coordonnées GPS" — geolocate the delivery point and fill the address from it. */
  const fetchGps = async () => {
    setLocating(true); setError('');
    try {
      const { coords: c, address: place } = await locateWithAddress();
      setCoords(c);
      if (place && (place.street || place.city)) {
        // Full street-level address (number, street, district, postal code) — the user can still edit it.
        setForm(p => ({
          ...p,
          address: place.street || place.full || p.address,
          city: place.city || p.city,
        }));
      }
    } catch (e) {
      setError(e?.message || 'Impossible de récupérer la position.');
    } finally {
      setLocating(false);
    }
  };

  // Polled: payment methods, stamp duty or pickup changes made in the admin apply right away
  usePolling(() => {
    api.settings.paymentMethods()
      .then(list => {
        const arr = Array.isArray(list) ? list : [];
        setMethods(arr);
        setPaymentMethod(prev => (arr.some(m => m.code === prev) ? prev : (arr[0]?.code ?? null)));
      })
      .catch(() => setMethods(prev => prev ?? []));
    api.settings.company().then(setCompany).catch(() => {});
  }, 30000);

  const pickupAvailable = !!company && company.pickupEnabled !== false;
  const isPickup = deliveryChoice === 'retrait' && pickupAvailable;
  const pickupAddress = company
    ? (company.pickupAddress?.trim() || [company.address, company.city].filter(Boolean).join(', '))
    : '';

  const selected = (methods || []).find(m => m.code === paymentMethod) || null;
  // A store pickup carries no delivery fee (the API applies the same rule)
  const deliveryFee = isPickup ? 0 : Number(selected?.fee) || 0;
  const feeLabel = selected?.code === 'a_la_livraison' ? 'Frais de livraison' : 'Frais';
  // Until the settings load, show the API default (1 DT)
  const stampDuty = company ? Number(company.stampDuty) || 0 : 1;
  // Same computation as the API: HT + TVA 19% + frais + droit de timbre
  const taxAmount = cartTotal * TAX_RATE;
  const grandTotal = cartTotal + taxAmount + deliveryFee + stampDuty;

  const methodSub = (m) => {
    const parts = [];
    if (Number(m.fee) > 0) parts.push(isPickup ? 'sans frais en retrait magasin' : `+ ${Number(m.fee).toFixed(3)} TND de frais`);
    if (m.requiresValidation) parts.push('validation par nos équipes');
    parts.push(m.type === 'online' ? 'paiement en ligne' : 'paiement hors ligne');
    return parts.join(' · ');
  };

  const handleConfirm = async () => {
    const required = FIELDS.filter(f => !f.optional && !(isPickup && f.deliveryOnly));
    const missing = required.find(f => !form[f.key].trim());
    if (missing) { setError(`Veuillez remplir : ${missing.label}`); return; }
    if (!selected) { setError('Aucun mode de règlement disponible pour le moment.'); return; }
    setError(''); setLoading(true);
    try {
      const where = isPickup ? 'Retrait en magasin' : `${form.address.trim()}, ${form.city.trim()}`;
      const address = `${form.fullName.trim()}, ${where}${form.phone ? ' — Tél: ' + form.phone.trim() : ''}${form.notes.trim() ? ' — Notes: ' + form.notes.trim() : ''}`;
      const gps = !isPickup && coords ? { latitude: coords.latitude, longitude: coords.longitude } : null;
      await placeOrder(address, selected.code, gps, isPickup ? 'retrait' : 'livraison');
      if (selected.type === 'online' && selected.url) {
        Linking.openURL(selected.url).catch(() => {});
      }
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Sous-total HT</Text>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{cartTotal.toFixed(3)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>TVA (19%)</Text>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{taxAmount.toFixed(3)}</Text>
          </View>
          {deliveryFee > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{feeLabel}</Text>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{deliveryFee.toFixed(3)}</Text>
            </View>
          )}
          {stampDuty > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Droit de timbre</Text>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{stampDuty.toFixed(3)}</Text>
            </View>
          )}
          <View style={{ height: 4 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Total TTC</Text>
            <Text style={{ color: T.accent, fontWeight: '900', fontSize: 22 }}>
              {grandTotal.toFixed(3)}
              <Text style={{ fontSize: 13, fontWeight: '700' }}> TND</Text>
            </Text>
          </View>
        </View>

        {/* Delivery mode */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted,
          letterSpacing: 1.5, marginBottom: 14 }}>MODE DE LIVRAISON</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          {[
            { key: 'livraison', icon: '🚚', label: 'Livraison', sub: 'À votre adresse' },
            ...(pickupAvailable ? [{ key: 'retrait', icon: '🏪', label: 'Retrait en magasin', sub: 'Sans frais de livraison' }] : []),
          ].map(o => {
            const active = (isPickup ? 'retrait' : 'livraison') === o.key;
            return (
              <TouchableOpacity key={o.key} onPress={() => setDeliveryChoice(o.key)} activeOpacity={0.8}
                style={{
                  flex: 1, backgroundColor: active ? T.primary + '0D' : '#FFF', borderRadius: 14,
                  padding: 14, borderWidth: 1.5, borderColor: active ? T.primary : T.border,
                }}>
                <Text style={{ fontSize: 22 }}>{o.icon}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: active ? T.primary : T.text, marginTop: 6 }}>{o.label}</Text>
                <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{o.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {isPickup && (
          <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: T.border }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.2, marginBottom: 6 }}>ADRESSE DU MAGASIN</Text>
            <Text selectable style={{ fontSize: 13, color: T.text, lineHeight: 20 }}>
              {pickupAddress || 'Nous vous contacterons pour convenir du retrait.'}
            </Text>
            {company?.pickupHours ? (
              <Text style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>🕒 {company.pickupHours}</Text>
            ) : null}
          </View>
        )}
        <View style={{ height: 14 }} />

        {/* Payment method */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted,
          letterSpacing: 1.5, marginBottom: 14 }}>MODE DE RÈGLEMENT</Text>
        {methods === null && <ActivityIndicator color={T.primary} style={{ marginVertical: 12 }} />}
        {methods !== null && methods.length === 0 && (
          <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: T.border }}>
            <Text style={{ fontSize: 13, color: T.muted }}>Aucun mode de règlement disponible pour le moment.</Text>
          </View>
        )}
        {(methods || []).map(m => {
          const active = paymentMethod === m.code;
          return (
            <TouchableOpacity key={m.id} onPress={() => setPaymentMethod(m.code)} activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: active ? T.primary + '0D' : '#FFF', borderRadius: 14,
                padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: active ? T.primary : T.border,
              }}>
              {m.imageUrl
                ? <Image source={{ uri: m.imageUrl }} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: T.bg }} resizeMode="contain" />
                : <Text style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{m.icon || '💳'}</Text>}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>{m.name}</Text>
                <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{methodSub(m)}</Text>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? T.primary : T.border,
                alignItems: 'center', justifyContent: 'center' }}>
                {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary }} />}
              </View>
            </TouchableOpacity>
          );
        })}
        {selected && (selected.description || selected.imageUrl || selected.url) && (
          <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: T.border }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.2, marginBottom: 8 }}>
              {selected.name.toUpperCase()}
            </Text>
            {selected.imageUrl ? (
              <Image source={{ uri: selected.imageUrl }} resizeMode="contain"
                style={{ width: '100%', height: 180, borderRadius: 10, backgroundColor: T.bg, marginBottom: selected.description || selected.url ? 10 : 0 }} />
            ) : null}
            {selected.description ? (
              <Text selectable style={{ fontSize: 13, color: T.text, lineHeight: 20 }}>{selected.description}</Text>
            ) : null}
            {selected.url ? (
              <TouchableOpacity onPress={() => Linking.openURL(selected.url).catch(() => {})} activeOpacity={0.8}
                style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: T.primary + '14', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: T.primary, fontWeight: '700', fontSize: 13 }}>🔗 Ouvrir le lien de paiement</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        <View style={{ height: 14 }} />

        {/* Delivery address */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted,
          letterSpacing: 1.5, marginBottom: 14 }}>{isPickup ? 'VOS COORDONNÉES' : 'ADRESSE DE LIVRAISON'}</Text>

        {FIELDS.filter(f => !(isPickup && f.deliveryOnly)).map(f => (
          <View key={f.key}>
            <View style={inputRow}>
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
            {f.key === 'address' && (
              <View style={{ marginBottom: 10, marginTop: -2 }}>
                <TouchableOpacity onPress={fetchGps} disabled={locating} activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    backgroundColor: coords ? T.success + '14' : T.primary + '10',
                    borderRadius: 12, paddingVertical: 12, borderWidth: 1.5,
                    borderColor: coords ? T.success : T.primary + '40', opacity: locating ? 0.7 : 1,
                  }}>
                  {locating
                    ? <ActivityIndicator size="small" color={T.primary} />
                    : <Text style={{ fontSize: 16 }}>{coords ? '✅' : '📡'}</Text>}
                  <Text style={{ color: coords ? T.success : T.primary, fontWeight: '700', fontSize: 13 }}>
                    {locating ? 'Localisation en cours…' : coords ? 'Coordonnées GPS récupérées' : 'Récupérer les coordonnées GPS'}
                  </Text>
                </TouchableOpacity>
                {coords && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 11, color: T.muted }}>
                      📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                      {coords.accuracy ? ` · ±${Math.round(coords.accuracy)} m` : ''}
                    </Text>
                    <TouchableOpacity onPress={() => setCoords(null)} hitSlop={8}>
                      <Text style={{ fontSize: 11, color: T.danger, fontWeight: '700' }}>Effacer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
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
