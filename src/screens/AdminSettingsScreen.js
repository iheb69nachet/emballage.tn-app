import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Switch, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Image, RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';
import AppDialog from '../components/AppDialog';
import { usePolling } from '../hooks/usePolling';

const EMPTY_FORM = {
  name: '', type: 'offline', icon: '', imageUrl: '', description: '', url: '',
  fee: '0', requiresValidation: false, enabled: true,
};

const TYPES = [
  { key: 'offline', label: '🏪 Hors ligne', hint: 'Espèces, virement, chèque…' },
  { key: 'online',  label: '🌐 En ligne',   hint: 'Lien / application de paiement' },
];

/** Resize + compress before upload (API limit is 5 MB). */
async function compressPhoto(uri) {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri).resize({ width: 1200 });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return out.uri;
}

const inputStyle = (extra = {}) => ({
  backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  fontSize: 15, color: T.text, borderWidth: 1.5, borderColor: T.border, ...extra,
});

function Label({ children }) {
  return <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 6, marginTop: 14 }}>{children}</Text>;
}

function Pill({ text, color }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color }}>{text}</Text>
    </View>
  );
}

const toForm = (m) => ({
  name: m.name ?? '', type: m.type ?? 'offline', icon: m.icon ?? '', imageUrl: m.imageUrl ?? '',
  description: m.description ?? '', url: m.url ?? '', fee: String(m.fee ?? 0),
  requiresValidation: !!m.requiresValidation, enabled: m.enabled !== false,
});

export default function AdminSettingsScreen() {
  const r = useR();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [methods, setMethods] = useState([]);
  const [busyId, setBusyId] = useState(null);

  // Editor modal state: null | { id: string|null, form }
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.admin.paymentMethods.list();
      setMethods(Array.isArray(list) ? list : []);
    } catch (e) {
      showAlert('Erreur', e.message || 'Impossible de charger les modes de paiement');
    }
  }, []);

  // The first load reports errors; background refreshes (every 30s, on focus) stay silent
  const loadedOnce = useRef(false);
  usePolling(() => {
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      load().finally(() => setLoading(false));
      return;
    }
    api.admin.paymentMethods.list()
      .then(list => { if (Array.isArray(list)) setMethods(list); })
      .catch(() => {});
  }, 30000);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── List actions ──────────────────────────────────────────
  const toggleEnabled = async (m) => {
    setBusyId(m.id);
    try {
      const updated = await api.admin.paymentMethods.update(m.id, { enabled: !m.enabled });
      setMethods(prev => prev.map(x => x.id === m.id ? { ...x, ...updated } : x));
    } catch (e) {
      showAlert('Erreur', e.message || 'Impossible de mettre à jour');
    }
    setBusyId(null);
  };

  const remove = (m) => {
    showAlert('Supprimer', `Supprimer le mode « ${m.name} » ?\nLes commandes existantes conservent leur libellé.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setBusyId(m.id);
          try {
            await api.admin.paymentMethods.remove(m.id);
            setMethods(prev => prev.filter(x => x.id !== m.id));
          } catch (e) {
            showAlert('Erreur', e.message || 'Impossible de supprimer');
          }
          setBusyId(null);
        },
      },
    ]);
  };

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= methods.length) return;
    const a = methods[index], b = methods[target];
    const next = [...methods];
    next[index] = b; next[target] = a;
    setMethods(next);
    try {
      await Promise.all(next.map((m, i) => (m.sortOrder !== i ? api.admin.paymentMethods.update(m.id, { sortOrder: i }) : null)));
      setMethods(next.map((m, i) => ({ ...m, sortOrder: i })));
    } catch (e) {
      showAlert('Erreur', e.message || 'Impossible de réordonner');
      load();
    }
  };

  // ── Editor ───────────────────────────────────────────────
  const openCreate = () => setEditor({ id: null, form: { ...EMPTY_FORM } });
  const openEdit = (m) => setEditor({ id: m.id, form: toForm(m) });
  const closeEditor = () => { if (!saving && !uploading) setEditor(null); };
  const setField = (k, v) => setEditor(e => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const uploadFromUri = async (uri) => {
    setUploading(true);
    try {
      const compressed = await compressPhoto(uri);
      const { url } = await api.admin.paymentMethods.uploadImage({ uri: compressed, name: 'photo.jpg', type: 'image/jpeg' });
      setField('imageUrl', url);
    } catch (e) {
      showAlert('Erreur', e.message || "Échec de l'envoi de l'image");
    }
    setUploading(false);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { showAlert('Caméra', "Autorisez l'accès à la caméra dans les réglages."); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) await uploadFromUri(res.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Photos', "Autorisez l'accès aux photos dans les réglages."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) await uploadFromUri(res.assets[0].uri);
  };

  const chooseImageSource = () => {
    showAlert('Image du mode de paiement', 'Logo, QR code, capture d\'écran…', [
      { text: '📷 Prendre une photo', onPress: takePhoto },
      { text: '🖼️ Galerie', onPress: pickFromGallery },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!editor) return;
    const f = editor.form;
    const name = f.name.trim();
    if (!name) { showAlert('Nom manquant', 'Donnez un nom au mode de paiement.'); return; }
    const fee = Number(String(f.fee || '0').replace(',', '.'));
    if (!(fee >= 0)) { showAlert('Erreur', 'Montant des frais invalide'); return; }
    const url = f.url.trim();
    if (url && !/^https?:\/\//i.test(url)) { showAlert('Lien invalide', 'Le lien doit commencer par http:// ou https://'); return; }

    const payload = {
      name, type: f.type, icon: f.icon.trim(), imageUrl: f.imageUrl || '',
      description: f.description.trim(), url, fee,
      requiresValidation: f.requiresValidation, enabled: f.enabled,
    };
    setSaving(true);
    try {
      if (editor.id) {
        const updated = await api.admin.paymentMethods.update(editor.id, payload);
        setMethods(prev => prev.map(x => x.id === editor.id ? { ...x, ...updated } : x));
      } else {
        const created = await api.admin.paymentMethods.create(payload);
        setMethods(prev => [...prev, created]);
      }
      setEditor(null);
    } catch (e) {
      showAlert('Erreur', e.message || "Impossible d'enregistrer");
    }
    setSaving(false);
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}><ActivityIndicator size="large" color={T.primary} /></View>;
  }

  const card = { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 12 };
  const f = editor?.form;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: r.px, paddingBottom: 110 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.5 }}>MODES DE RÈGLEMENT</Text>
          <Text style={{ fontSize: 11, color: T.muted }}>{methods.filter(m => m.enabled).length}/{methods.length} actif{methods.length > 1 ? 's' : ''}</Text>
        </View>

        {methods.length === 0 && (
          <View style={[card, { alignItems: 'center', paddingVertical: 28 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>💳</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>Aucun mode de paiement</Text>
            <Text style={{ fontSize: 12, color: T.muted, marginTop: 4, textAlign: 'center' }}>
              Les clients ne pourront pas commander tant qu'aucun mode n'est actif.
            </Text>
          </View>
        )}

        {methods.map((m, index) => {
          const busy = busyId === m.id;
          return (
            <View key={m.id} style={[card, { opacity: m.enabled ? 1 : 0.65 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {m.imageUrl
                  ? <Image source={{ uri: m.imageUrl }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: T.bg }} resizeMode="contain" />
                  : <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 22 }}>{m.icon || '💳'}</Text>
                    </View>}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }} numberOfLines={1}>{m.name}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                    <Pill text={m.type === 'online' ? 'EN LIGNE' : 'HORS LIGNE'} color={m.type === 'online' ? T.info : T.primary} />
                    {Number(m.fee) > 0 && <Pill text={`+ ${Number(m.fee).toFixed(3)} TND`} color={T.accent} />}
                    {m.requiresValidation && <Pill text="VALIDATION ADMIN" color={T.warning} />}
                    {!m.enabled && <Pill text="INACTIF" color={T.muted} />}
                  </View>
                </View>
                {busy
                  ? <ActivityIndicator color={T.primary} />
                  : <Switch value={!!m.enabled} onValueChange={() => toggleEnabled(m)}
                      trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={m.enabled ? T.primary : '#fff'} />}
              </View>

              {m.description ? (
                <Text style={{ fontSize: 12, color: T.muted, marginTop: 10, lineHeight: 18 }} numberOfLines={3}>{m.description}</Text>
              ) : null}
              {m.url ? (
                <Text style={{ fontSize: 12, color: T.info, marginTop: 6 }} numberOfLines={1}>🔗 {m.url}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 10 }}>
                <TouchableOpacity onPress={() => move(index, -1)} disabled={index === 0} style={{ padding: 6, opacity: index === 0 ? 0.3 : 1 }}>
                  <Text style={{ fontSize: 16, color: T.text }}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => move(index, 1)} disabled={index === methods.length - 1} style={{ padding: 6, opacity: index === methods.length - 1 ? 0.3 : 1 }}>
                  <Text style={{ fontSize: 16, color: T.text }}>↓</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => openEdit(m)} activeOpacity={0.8}
                  style={{ backgroundColor: T.primary + '14', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: T.primary, fontWeight: '700', fontSize: 13 }}>✏️ Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(m)} activeOpacity={0.8} disabled={busy}
                  style={{ backgroundColor: T.danger + '14', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: T.danger, fontWeight: '700', fontSize: 13 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add button */}
      <View style={{ position: 'absolute', left: r.px, right: r.px, bottom: insets.bottom + 16 }}>
        <TouchableOpacity onPress={openCreate} activeOpacity={0.85}
          style={{ backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
            shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }}>
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>＋ Ajouter un mode de paiement</Text>
        </TouchableOpacity>
      </View>

      {/* Editor modal */}
      <Modal visible={!!editor} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEditor}>
        {f && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: r.px, paddingTop: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: '#FFF' }}>
              <TouchableOpacity onPress={closeEditor} disabled={saving || uploading} style={{ paddingVertical: 6, paddingRight: 12 }}>
                <Text style={{ color: T.muted, fontWeight: '700', fontSize: 15 }}>Annuler</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.text }}>{editor.id ? 'Modifier le mode' : 'Nouveau mode'}</Text>
              <TouchableOpacity onPress={save} disabled={saving || uploading} style={{ paddingVertical: 6, paddingLeft: 12, opacity: saving || uploading ? 0.5 : 1 }}>
                {saving ? <ActivityIndicator color={T.primary} /> : <Text style={{ color: T.primary, fontWeight: '800', fontSize: 15 }}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              <Label>NOM *</Label>
              <TextInput value={f.name} onChangeText={v => setField('name', v)} placeholder="Ex. Flouci, Chèque, D17…" placeholderTextColor={T.muted} style={inputStyle({ fontWeight: '700' })} />

              <Label>TYPE</Label>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TYPES.map(t => {
                  const active = f.type === t.key;
                  return (
                    <TouchableOpacity key={t.key} onPress={() => setField('type', t.key)} activeOpacity={0.8}
                      style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: active ? T.primary : T.border,
                        backgroundColor: active ? T.primary + '0D' : '#FFF', padding: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: active ? T.primary : T.text }}>{t.label}</Text>
                      <Text style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{t.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 96 }}>
                  <Label>ICÔNE</Label>
                  <TextInput value={f.icon} onChangeText={v => setField('icon', v)} placeholder="💳" placeholderTextColor={T.muted}
                    maxLength={4} style={inputStyle({ textAlign: 'center', fontSize: 22 })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>FRAIS SUPPLÉMENTAIRES (TND)</Label>
                  <TextInput value={f.fee} onChangeText={v => setField('fee', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.muted}
                    style={inputStyle({ fontWeight: '700' })} />
                </View>
              </View>

              <Label>IMAGE (LOGO, QR CODE, CAPTURE…)</Label>
              {f.imageUrl ? (
                <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: T.border, backgroundColor: '#FFF' }}>
                  <Image source={{ uri: f.imageUrl }} style={{ width: '100%', height: 180, backgroundColor: T.bg }} resizeMode="contain" />
                  <View style={{ flexDirection: 'row', gap: 8, padding: 10 }}>
                    <TouchableOpacity onPress={chooseImageSource} disabled={uploading} activeOpacity={0.8}
                      style={{ flex: 1, backgroundColor: T.primary + '14', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ color: T.primary, fontWeight: '700', fontSize: 13 }}>🔄 Changer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setField('imageUrl', '')} disabled={uploading} activeOpacity={0.8}
                      style={{ flex: 1, backgroundColor: T.danger + '14', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ color: T.danger, fontWeight: '700', fontSize: 13 }}>🗑️ Retirer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={chooseImageSource} disabled={uploading} activeOpacity={0.8}
                  style={{ borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.border, backgroundColor: '#FFF', paddingVertical: 22, alignItems: 'center' }}>
                  {uploading
                    ? <ActivityIndicator color={T.primary} />
                    : <>
                        <Text style={{ fontSize: 26 }}>🖼️</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.primary, marginTop: 6 }}>Ajouter une image</Text>
                        <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Optionnel · JPG, PNG, WebP (5 Mo max)</Text>
                      </>}
                </TouchableOpacity>
              )}
              {uploading && f.imageUrl ? <Text style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>Envoi de l'image…</Text> : null}

              <Label>DESCRIPTION / ÉTAPES</Label>
              <TextInput value={f.description} onChangeText={v => setField('description', v)} multiline textAlignVertical="top"
                placeholder={"Ex.\n1. Ouvrez l'application\n2. Scannez le QR code\n3. Indiquez votre numéro de commande"}
                placeholderTextColor={T.muted} style={inputStyle({ minHeight: 130, lineHeight: 20 })} />
              <Text style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Affiché au client lors de la commande et sur la facture.</Text>

              <Label>{f.type === 'online' ? 'LIEN DE PAIEMENT' : 'LIEN (OPTIONNEL)'}</Label>
              <TextInput value={f.url} onChangeText={v => setField('url', v)} placeholder="https://…" placeholderTextColor={T.muted}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" style={inputStyle()} />
              {f.type === 'online' ? (
                <Text style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Ouvert automatiquement après confirmation de la commande.</Text>
              ) : null}

              <View style={[{ backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: T.border, marginTop: 18 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.border }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>Validation par un admin</Text>
                    <Text style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 16 }}>La commande attend votre approbation avant traitement.</Text>
                  </View>
                  <Switch value={f.requiresValidation} onValueChange={v => setField('requiresValidation', v)}
                    trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={f.requiresValidation ? T.primary : '#fff'} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>Actif</Text>
                    <Text style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 16 }}>Visible par les clients au moment de commander.</Text>
                  </View>
                  <Switch value={f.enabled} onValueChange={v => setField('enabled', v)}
                    trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={f.enabled ? T.primary : '#fff'} />
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
        <AppDialog nested />
      </Modal>
    </View>
  );
}
