import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';

const BG_COLORS = ['#1A3D2B', '#1C1C1C', '#B91C1C', '#1D4ED8', '#6D28D9', '#B45309', '#0F766E', '#831843'];
const ACCENT_COLORS = ['#C8A84B', '#FFFFFF', '#FCD34D', '#93C5FD', '#F9A8D4', '#86EFAC', '#FDBA74', '#E8D5A3'];
const TAG_SUGGESTIONS = ['🔥 OFFRE', '⚡ NOUVEAU', '🎁 PROMO', '📦 DESTOCKAGE', '⭐ EXCLUSIF'];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** yyyy-mm-dd typed by the admin → ISO, or null when the field is empty. */
function parseExpiry(text) {
  const t = text.trim();
  if (!t) return { iso: null, error: '' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return { iso: null, error: 'Format de date attendu : AAAA-MM-JJ' };
  const d = new Date(`${t}T23:59:59`);
  if (Number.isNaN(d.getTime())) return { iso: null, error: 'Date invalide' };
  return { iso: d.toISOString(), error: '' };
}

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

function Swatches({ colors, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {colors.map(c => {
        const active = String(value).toLowerCase() === c.toLowerCase();
        return (
          <TouchableOpacity key={c} onPress={() => onChange(c)} activeOpacity={0.7}
            style={{
              width: 34, height: 34, borderRadius: 17, backgroundColor: c,
              borderWidth: active ? 3 : 1, borderColor: active ? T.accent : T.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
            {active && <Text style={{ color: c === '#FFFFFF' ? '#000' : '#FFF', fontWeight: '800', fontSize: 14 }}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AdminAdFormScreen({ route, navigation }) {
  const r = useR();
  const editing = route.params?.ad ?? null;

  const [form, setForm] = useState({
    tag: editing?.tag ?? '',
    title: editing?.title ?? '',
    subtitle: editing?.subtitle ?? '',
    backgroundColor: editing?.backgroundColor ?? '#1A3D2B',
    accentColor: editing?.accentColor ?? '#C8A84B',
    sortOrder: editing ? String(editing.sortOrder ?? 0) : '0',
    expiresAt: editing?.expiresAt ? String(editing.expiresAt).slice(0, 10) : '',
    isActive: editing ? !!editing.isActive : true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Modifier la publicité' : 'Nouvelle publicité' });
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.tag.trim()) return setError('Le tag est obligatoire');
    if (!form.title.trim()) return setError('Le titre est obligatoire');
    if (!HEX_RE.test(form.backgroundColor.trim())) return setError('Couleur de fond invalide (ex. #1A3D2B)');
    if (!HEX_RE.test(form.accentColor.trim())) return setError('Couleur d\'accent invalide (ex. #C8A84B)');
    const { iso, error: dateError } = parseExpiry(form.expiresAt);
    if (dateError) return setError(dateError);

    setError(''); setSubmitting(true);
    const payload = {
      tag: form.tag.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      backgroundColor: form.backgroundColor.trim(),
      accentColor: form.accentColor.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      expiresAt: iso,
    };
    try {
      if (editing) await api.admin.ads.update(editing.id, payload);
      else await api.admin.ads.create(payload);
      navigation.goBack();
    } catch (e) {
      setError(e.message || "Impossible d'enregistrer");
    }
    setSubmitting(false);
  };

  const handleDelete = () => {
    if (!editing) return;
    showAlert('Supprimer cette publicité ?', `"${editing.title}" ne sera plus affichée aux clients.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try { await api.admin.ads.remove(editing.id); navigation.goBack(); }
          catch (e) { showAlert('Erreur', e.message || 'Suppression impossible'); setSubmitting(false); }
        },
      },
    ]);
  };

  const bg = HEX_RE.test(form.backgroundColor.trim()) ? form.backgroundColor.trim() : '#1A3D2B';
  const accent = HEX_RE.test(form.accentColor.trim()) ? form.accentColor.trim() : '#C8A84B';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        {/* Live preview — identical layout to the client banner */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 8 }}>APERÇU CLIENT</Text>
        <View style={{
          borderRadius: 20, padding: 20, minHeight: 120, backgroundColor: bg, marginBottom: 18,
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
        }}>
          <View style={{
            borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3,
            alignSelf: 'flex-start', marginBottom: 8,
            borderColor: accent + '80', backgroundColor: accent + '30',
          }}>
            <Text style={{ color: accent, fontSize: 11, fontWeight: '700' }}>{form.tag.trim() || 'TAG'}</Text>
          </View>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
            {form.title.trim() || 'Titre de la publicité'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
            {form.subtitle.trim() || 'Sous-titre'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14 }}>
            <View style={{ width: 20, height: 5, borderRadius: 3, backgroundColor: accent }} />
            <View style={{ width: 6, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' }} />
            <View style={{ width: 6, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          </View>
        </View>

        <Field label="TAG *" hint="Petit libellé affiché au-dessus du titre.">
          <TextInput style={inputStyle} value={form.tag} onChangeText={v => set('tag', v)}
            placeholder="🔥 OFFRE" placeholderTextColor={T.muted} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
            {TAG_SUGGESTIONS.map(tg => (
              <TouchableOpacity key={tg} onPress={() => set('tag', tg)} activeOpacity={0.7}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1,
                  backgroundColor: form.tag === tg ? T.primary : '#FFF', borderColor: form.tag === tg ? T.primary : T.border,
                }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: form.tag === tg ? '#FFF' : T.text }}>{tg}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Field>

        <Field label="TITRE *">
          <TextInput style={inputStyle} value={form.title} onChangeText={v => set('title', v)}
            placeholder="-30% sur les cartons" placeholderTextColor={T.muted} />
        </Field>

        <Field label="SOUS-TITRE">
          <TextInput style={inputStyle} value={form.subtitle} onChangeText={v => set('subtitle', v)}
            placeholder="Code : CARTON30" placeholderTextColor={T.muted} />
        </Field>

        <Field label="COULEUR DE FOND">
          <Swatches colors={BG_COLORS} value={form.backgroundColor} onChange={v => set('backgroundColor', v)} />
          <TextInput style={[inputStyle, { marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
            value={form.backgroundColor} onChangeText={v => set('backgroundColor', v)}
            placeholder="#1A3D2B" placeholderTextColor={T.muted} autoCapitalize="characters" maxLength={7} />
        </Field>

        <Field label="COULEUR D'ACCENT" hint="Utilisée pour le tag et l'indicateur de position.">
          <Swatches colors={ACCENT_COLORS} value={form.accentColor} onChange={v => set('accentColor', v)} />
          <TextInput style={[inputStyle, { marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
            value={form.accentColor} onChangeText={v => set('accentColor', v)}
            placeholder="#C8A84B" placeholderTextColor={T.muted} autoCapitalize="characters" maxLength={7} />
        </Field>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="ORDRE D'AFFICHAGE" hint="0 en premier.">
              <TextInput style={inputStyle} value={form.sortOrder} onChangeText={v => set('sortOrder', v)}
                keyboardType="number-pad" placeholder="0" placeholderTextColor={T.muted} />
            </Field>
          </View>
          <View style={{ flex: 1.3 }}>
            <Field label="EXPIRE LE" hint="Laisser vide = sans expiration.">
              <TextInput style={inputStyle} value={form.expiresAt} onChangeText={v => set('expiresAt', v)}
                placeholder="2026-12-31" placeholderTextColor={T.muted} keyboardType="numbers-and-punctuation" maxLength={10} />
            </Field>
          </View>
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#FFF', borderRadius: 12, padding: 14,
          borderWidth: 1.5, borderColor: T.border, marginBottom: 18,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>Visible pour les clients</Text>
          <Switch value={form.isActive} onValueChange={v => set('isActive', v)}
            trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={form.isActive ? T.primary : '#fff'} />
        </View>

        {error ? (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ color: '#DC2626', fontSize: 13 }}>⚠️ {error}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={handleSave} disabled={submitting} activeOpacity={0.8}
          style={{ backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? <ActivityIndicator color="#FFF" />
            : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>{editing ? '💾 Enregistrer' : '➕ Créer la publicité'}</Text>}
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity onPress={handleDelete} disabled={submitting} activeOpacity={0.8}
            style={{
              marginTop: 12, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
              borderWidth: 1.5, borderColor: T.danger, backgroundColor: T.danger + '0A',
            }}>
            <Text style={{ color: T.danger, fontWeight: '700', fontSize: 14 }}>🗑️ Supprimer la publicité</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
