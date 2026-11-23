import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, Switch, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';

const TEXT_FIELDS = [
  'name', 'tagline', 'taxId', 'rne', 'address', 'city', 'phone', 'email',
  'website', 'invoiceFooter', 'pickupAddress', 'pickupHours',
];

const SECTIONS = [
  {
    title: 'IDENTITÉ',
    fields: [
      { key: 'name', label: 'RAISON SOCIALE *', placeholder: 'STE EMBALLAGE TN SARL' },
      { key: 'tagline', label: 'SLOGAN', placeholder: 'Votre partenaire en emballage B2B' },
      { key: 'taxId', label: 'MATRICULE FISCAL', placeholder: '1234567/A/M/000', autoCapitalize: 'characters' },
      { key: 'rne', label: 'RNE (REGISTRE DE COMMERCE)', placeholder: 'B01234562020', autoCapitalize: 'characters' },
    ],
  },
  {
    title: 'COORDONNÉES',
    fields: [
      { key: 'address', label: 'ADRESSE', placeholder: 'Zone industrielle, rue 12' },
      { key: 'city', label: 'VILLE', placeholder: 'Sfax' },
      { key: 'phone', label: 'TÉLÉPHONE', placeholder: '+216 74 000 000', keyboardType: 'phone-pad' },
      { key: 'email', label: 'E-MAIL', placeholder: 'contact@emballage.tn', keyboardType: 'email-address', autoCapitalize: 'none' },
      { key: 'website', label: 'SITE WEB', placeholder: 'https://emballage.tn', keyboardType: 'url', autoCapitalize: 'none' },
    ],
  },
];

const inputStyle = (extra = {}) => ({
  backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  fontSize: 15, color: T.text, borderWidth: 1.5, borderColor: T.border, ...extra,
});

function Label({ children }) {
  return <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 6, marginTop: 14 }}>{children}</Text>;
}

function SectionTitle({ children }) {
  return <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.5, marginTop: 8 }}>{children}</Text>;
}

const toForm = (c) => ({ ...c, stampDuty: String(c?.stampDuty ?? 1), pickupEnabled: c?.pickupEnabled !== false });

/**
 * Company settings: issuer identity printed on factures / devis, droit de timbre
 * and store pickup. Not polled — a refresh would overwrite what the admin types.
 */
export default function AdminCompanyScreen() {
  const r = useR();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings.company()
      .then(c => setForm(toForm(c)))
      .catch(e => showAlert('Erreur', e.message || 'Impossible de charger les paramètres de la société'));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name?.trim()) { showAlert('Raison sociale manquante', 'Indiquez le nom de la société.'); return; }
    const stampDuty = Number(String(form.stampDuty || '0').replace(',', '.'));
    if (!(stampDuty >= 0)) { showAlert('Erreur', 'Droit de timbre invalide'); return; }

    const payload = { stampDuty, pickupEnabled: !!form.pickupEnabled };
    TEXT_FIELDS.forEach(k => { payload[k] = String(form[k] ?? '').trim(); });

    setSaving(true);
    try {
      const updated = await api.admin.company.update(payload);
      setForm(toForm(updated));
      showAlert('Enregistré', 'Les informations de la société ont été mises à jour.');
    } catch (e) {
      showAlert('Erreur', e.message || "Impossible d'enregistrer");
    }
    setSaving(false);
  };

  if (!form) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}><ActivityIndicator size="large" color={T.primary} /></View>;
  }

  const card = { backgroundColor: '#FFF', borderRadius: 16, padding: 14, paddingTop: 10, borderWidth: 1, borderColor: T.border, marginBottom: 14 };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 110 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 12, color: T.muted, lineHeight: 18, marginBottom: 14 }}>
          Ces informations apparaissent sur les factures et devis (émetteur, pied de page).
        </Text>

        {SECTIONS.map(section => (
          <View key={section.title} style={card}>
            <SectionTitle>{section.title}</SectionTitle>
            {section.fields.map(f => (
              <View key={f.key}>
                <Label>{f.label}</Label>
                <TextInput value={form[f.key] ?? ''} onChangeText={v => set(f.key, v)}
                  placeholder={f.placeholder} placeholderTextColor={T.muted}
                  keyboardType={f.keyboardType || 'default'} autoCapitalize={f.autoCapitalize}
                  autoCorrect={false} style={inputStyle()} />
              </View>
            ))}
          </View>
        ))}

        <View style={card}>
          <SectionTitle>FACTURATION</SectionTitle>
          <Label>DROIT DE TIMBRE (TND)</Label>
          <TextInput value={form.stampDuty} onChangeText={v => set('stampDuty', v)} keyboardType="decimal-pad"
            placeholder="1.000" placeholderTextColor={T.muted} style={inputStyle({ fontWeight: '700' })} />
          <Text style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Ajouté au total TTC de chaque nouvelle commande.</Text>

          <Label>PIED DE FACTURE</Label>
          <TextInput value={form.invoiceFooter ?? ''} onChangeText={v => set('invoiceFooter', v)} multiline textAlignVertical="top"
            placeholder="Mentions légales, conditions de paiement…" placeholderTextColor={T.muted}
            style={inputStyle({ minHeight: 90, lineHeight: 20 })} />
        </View>

        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <SectionTitle>RETRAIT EN MAGASIN</SectionTitle>
              <Text style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 16 }}>
                Proposé au client lors de la commande, sans frais de livraison.
              </Text>
            </View>
            <Switch value={!!form.pickupEnabled} onValueChange={v => set('pickupEnabled', v)}
              trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={form.pickupEnabled ? T.primary : '#fff'} />
          </View>
          {form.pickupEnabled ? (
            <>
              <Label>ADRESSE DE RETRAIT</Label>
              <TextInput value={form.pickupAddress ?? ''} onChangeText={v => set('pickupAddress', v)}
                placeholder="Vide = adresse de la société" placeholderTextColor={T.muted} style={inputStyle()} />
              <Label>HORAIRES</Label>
              <TextInput value={form.pickupHours ?? ''} onChangeText={v => set('pickupHours', v)}
                placeholder="Lun–Sam, 8h–17h" placeholderTextColor={T.muted} style={inputStyle()} />
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: r.px, right: r.px, bottom: insets.bottom + 16 }}>
        <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.85}
          style={{ backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: saving ? 0.7 : 1,
            shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }}>
          {saving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>💾 Enregistrer</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
