import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';
import { locateWithAddress, mapsUrl } from '../services/geo';
import { TAX_ID_EXAMPLE, TAX_ID_HINT, isTunisianTaxId } from '../constants/taxId';

/** Fallback list — the API (GET /users/payment-modes) is the source of truth. */
const DEFAULT_PAYMENT_MODES = [
  { code: 'especes', label: 'Espèces' },
  { code: 'cheque', label: 'Chèque' },
  { code: 'traite', label: 'Traite' },
  { code: 'virement', label: 'Virement' },
  { code: 'carte_bancaire', label: 'Carte bancaire' },
];
const PAYMENT_MODE_ICONS = { especes: '💵', cheque: '🧾', traite: '📜', virement: '🏦', carte_bancaire: '💳' };

function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 6 }}>{label}</Text>
      {children}
      {hint ? <Text style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 16 }}>{hint}</Text> : null}
    </View>
  );
}

const inputStyle = {
  backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  fontSize: 14, color: T.text, borderWidth: 1.5, borderColor: T.border,
};

export default function AdminUserFormScreen({ route, navigation }) {
  const r = useR();
  const editing = route.params?.user ?? null;

  const [form, setForm] = useState({
    firstName: editing?.firstName ?? '',
    lastName: editing?.lastName ?? '',
    email: editing?.email ?? '',
    password: '',
    phone: editing?.phone ?? '',
    address: editing?.address ?? '',
    city: editing?.city ?? '',
    companyName: editing?.companyName ?? '',
    taxId: editing?.taxId ?? '',
  });
  const [coords, setCoords] = useState(
    editing?.latitude != null && editing?.longitude != null
      ? { latitude: Number(editing.latitude), longitude: Number(editing.longitude), accuracy: null }
      : null
  );
  const [paymentModes, setPaymentModes] = useState(DEFAULT_PAYMENT_MODES);
  const [selectedModes, setSelectedModes] = useState(
    Array.isArray(editing?.paymentModes) && editing.paymentModes.length ? editing.paymentModes : ['especes']
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Modifier le client' : 'Nouveau client' });
    if (!editing) {
      api.admin.users.paymentModes()
        .then(m => { if (Array.isArray(m) && m.length) setPaymentModes(m); })
        .catch(() => {});
    }
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── GPS → full address ──────────────────────────────────────
  const fillFromGps = async () => {
    setLocating(true); setError('');
    try {
      const { coords: c, address } = await locateWithAddress();
      setCoords(c);
      if (address && (address.street || address.city)) {
        setForm(p => ({
          ...p,
          address: address.street || address.full || p.address,
          city: address.city || p.city,
        }));
      } else {
        showAlert('Position enregistrée', "Les coordonnées GPS ont été récupérées mais aucune adresse n'a pu être déduite. Complétez l'adresse manuellement.");
      }
    } catch (e) {
      setError(e?.message || 'Impossible de récupérer la position.');
    } finally {
      setLocating(false);
    }
  };

  const toggleMode = (code) => {
    setSelectedModes(prev => {
      if (prev.includes(code)) {
        if (prev.length === 1) { showAlert('Mode requis', 'Un client doit avoir au moins un mode de règlement.'); return prev; }
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.firstName.trim()) return setError('Le prénom est obligatoire');
    if (!form.lastName.trim()) return setError('Le nom est obligatoire');
    if (form.taxId.trim() && !isTunisianTaxId(form.taxId)) return setError(TAX_ID_HINT);
    if (!editing) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Adresse e-mail invalide');
      if (form.password && form.password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères');
    }
    setError(''); setSaving(true);
    const contact = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      companyName: form.companyName.trim(),
      taxId: form.taxId.trim(),
      latitude: coords ? coords.latitude : null,
      longitude: coords ? coords.longitude : null,
    };
    try {
      if (editing) {
        await api.admin.users.update(editing.id, contact);
      } else {
        await api.admin.users.create({
          ...contact,
          email,
          password: form.password || undefined,
          paymentModes: selectedModes,
        });
      }
      navigation.goBack();
    } catch (e) {
      setError(e.message || "Impossible d'enregistrer");
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.5, marginBottom: 12 }}>IDENTITÉ</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="PRÉNOM *">
              <TextInput style={inputStyle} value={form.firstName} onChangeText={v => set('firstName', v)} placeholder="Ahmed" placeholderTextColor={T.muted} autoCapitalize="words" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="NOM *">
              <TextInput style={inputStyle} value={form.lastName} onChangeText={v => set('lastName', v)} placeholder="Ben Ali" placeholderTextColor={T.muted} autoCapitalize="words" />
            </Field>
          </View>
        </View>

        <Field label="E-MAIL *" hint={editing ? "L'e-mail sert d'identifiant et ne peut pas être modifié ici." : undefined}>
          <TextInput style={[inputStyle, editing && { color: T.muted, backgroundColor: T.bg }]} value={form.email} onChangeText={v => set('email', v)}
            placeholder="client@exemple.tn" placeholderTextColor={T.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!editing} />
        </Field>

        {!editing && (
          <Field label="MOT DE PASSE (OPTIONNEL)"
            hint="Laissez vide : le client définira son mot de passe via « Mot de passe oublié » avec son e-mail.">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput style={[inputStyle, { flex: 1 }]} value={form.password} onChangeText={v => set('password', v)}
                placeholder="8 caractères minimum" placeholderTextColor={T.muted} secureTextEntry={!showPassword} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: '#FFF' }}>
                <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </Field>
        )}

        <Field label="TÉLÉPHONE">
          <TextInput style={inputStyle} value={form.phone} onChangeText={v => set('phone', v)} placeholder="+216 20 000 000" placeholderTextColor={T.muted} keyboardType="phone-pad" />
        </Field>

        <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.5, marginBottom: 12, marginTop: 6 }}>ADRESSE</Text>

        {/* GPS button — fills the full address, the city and the coordinates */}
        <TouchableOpacity onPress={fillFromGps} disabled={locating} activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
            backgroundColor: coords ? T.success + '14' : T.primary + '10',
            borderRadius: 12, paddingVertical: 13, borderWidth: 1.5,
            borderColor: coords ? T.success : T.primary + '40', opacity: locating ? 0.7 : 1,
          }}>
          {locating
            ? <ActivityIndicator size="small" color={T.primary} />
            : <Text style={{ fontSize: 16 }}>{coords ? '✅' : '📡'}</Text>}
          <Text style={{ color: coords ? T.success : T.primary, fontWeight: '700', fontSize: 13 }}>
            {locating ? 'Localisation en cours…' : coords ? 'Position GPS enregistrée — actualiser' : "Remplir l'adresse depuis le GPS"}
          </Text>
        </TouchableOpacity>
        {coords && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -6, marginBottom: 12, paddingHorizontal: 4 }}>
            <TouchableOpacity onPress={() => Linking.openURL(mapsUrl(coords.latitude, coords.longitude)).catch(() => {})} hitSlop={8}>
              <Text style={{ fontSize: 11, color: T.info, fontWeight: '600' }}>
                📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                {coords.accuracy ? ` · ±${Math.round(coords.accuracy)} m` : ''} · Ouvrir dans Maps
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCoords(null)} hitSlop={8}>
              <Text style={{ fontSize: 11, color: T.danger, fontWeight: '700' }}>Effacer</Text>
            </TouchableOpacity>
          </View>
        )}

        <Field label="ADRESSE COMPLÈTE" hint="Rue, numéro, quartier, code postal. Vous pouvez la corriger après le remplissage GPS.">
          <TextInput style={[inputStyle, { minHeight: 76, textAlignVertical: 'top' }]} multiline value={form.address} onChangeText={v => set('address', v)}
            placeholder="12 Avenue Habib Bourguiba, Lafayette, 1002" placeholderTextColor={T.muted} />
        </Field>
        <Field label="VILLE">
          <TextInput style={inputStyle} value={form.city} onChangeText={v => set('city', v)} placeholder="Tunis" placeholderTextColor={T.muted} autoCapitalize="words" />
        </Field>

        <Field label="RAISON SOCIALE" hint="Apparaît comme partie facturée sur les factures et les devis.">
          <TextInput style={inputStyle} value={form.companyName} onChangeText={v => set('companyName', v)}
            placeholder="SARL Emballage Plus" placeholderTextColor={T.muted} autoCapitalize="words" />
        </Field>
        <Field label="MATRICULE FISCAL"
          hint={form.taxId.trim() && !isTunisianTaxId(form.taxId) ? TAX_ID_HINT : 'Numéro fiscal tunisien — laissez vide pour un particulier.'}>
          <TextInput
            style={[inputStyle, form.taxId.trim() && !isTunisianTaxId(form.taxId) ? { borderColor: T.danger } : null]}
            value={form.taxId} onChangeText={v => set('taxId', v)}
            placeholder={TAX_ID_EXAMPLE} placeholderTextColor={T.muted}
            autoCapitalize="characters" autoCorrect={false} />
        </Field>

        {!editing && (
          <>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.5, marginBottom: 12, marginTop: 6 }}>MODES DE RÈGLEMENT AUTORISÉS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {paymentModes.map(m => {
                const active = selectedModes.includes(m.code);
                return (
                  <TouchableOpacity key={m.code} onPress={() => toggleMode(m.code)} activeOpacity={0.7}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, backgroundColor: active ? T.primary : '#FFF', borderColor: active ? T.primary : T.border }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#FFF' : T.text }}>
                      {active ? '✓ ' : ''}{PAYMENT_MODE_ICONS[m.code] || '💳'} {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {error ? (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ color: '#DC2626', fontSize: 13 }}>⚠️ {error}</Text>
          </View>
        ) : null}

        {!editing && (
          <Text style={{ fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 16 }}>
            Le compte est créé actif et vérifié : le client peut se connecter immédiatement.
          </Text>
        )}

        <TouchableOpacity onPress={handleSave} disabled={saving || locating} activeOpacity={0.8}
          style={{ backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: saving || locating ? 0.6 : 1 }}>
          {saving ? <ActivityIndicator color="#FFF" /> :
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>{editing ? '💾 Enregistrer' : '➕ Créer le client'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
