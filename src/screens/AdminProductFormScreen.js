import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image, Switch, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';
import Badge from '../components/Badge';

const STOCK_OPTIONS = ['Disponible', 'Sur commande', 'Rupture'];
const UNIT_OPTIONS = ['pièce', 'kg', 'rouleau', 'carton', 'pack', 'm', 'lot'];

/** Resize + compress a photo before upload (tablet photos easily exceed the 5 MB API limit). */
async function compressPhoto(uri) {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri).resize({ width: 1200 });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return out.uri;
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

const inputStyle = {
  backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  fontSize: 14, color: T.text, borderWidth: 1.5, borderColor: T.border,
};

function Chips({ options, value, onChange, getKey = (o) => o, getLabel = (o) => o }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const k = getKey(o); const active = k === value;
        return (
          <TouchableOpacity key={String(k)} onPress={() => onChange(k)} activeOpacity={0.7}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
              backgroundColor: active ? T.primary : '#FFF', borderColor: active ? T.primary : T.border,
            }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFF' : T.text }}>{getLabel(o)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AdminProductFormScreen({ route, navigation }) {
  const r = useR();
  const editing = route.params?.product ?? null;

  const [form, setForm] = useState({
    name: editing?.name ?? '',
    ref: editing?.ref ?? '',
    categoryId: editing?.categoryId ?? editing?.category?.id ?? null,
    price: editing ? String(editing.price ?? '') : '',
    unit: editing?.unit ?? 'pièce',
    minOrder: editing ? String(editing.minOrder ?? '') : '1',
    stock: editing?.stock ?? 'Disponible',
    quantity: editing?.quantity == null ? '' : String(editing.quantity),
    description: editing?.description ?? '',
    isActive: editing ? !!editing.isActive : true,
  });
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? null);
  const [extraImages, setExtraImages] = useState(
    editing?.images ? editing.images.split(',').map(s => s.trim()).filter(Boolean) : []
  );
  const [categories, setCategories] = useState([]);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Modifier l\'article' : 'Nouvel article' });
    api.categories.list()
      .then(d => setCategories(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => {})
      .finally(() => setCatsLoaded(true));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // A blank quantity leaves the product untracked (orderable without limit)
  const quantityTracked =
    form.quantity.trim() !== '' && Number.isFinite(Number(form.quantity));

  // Mirror the label the API derives, so the chips never contradict the counter
  useEffect(() => {
    if (!quantityTracked) return;
    const n = Number(form.quantity);
    const label = n <= 0 ? 'Rupture' : n <= 10 ? 'Stock limité' : 'En stock';
    setForm(p => (p.stock === label ? p : { ...p, stock: label }));
  }, [form.quantity, quantityTracked]);

  // ── "Nouvelle catégorie" (created inline, then selected) ─────
  const handleCreateCategory = async () => {
    const name = newCatName.trim();
    if (!name) { showAlert('Nom manquant', 'Donnez un nom à la catégorie.'); return; }
    setCreatingCat(true);
    try {
      const created = await api.admin.categories.create({ name, emoji: newCatEmoji.trim() || undefined, isActive: true });
      setCategories(prev => [...prev, created]);
      set('categoryId', created.id);
      setNewCatOpen(false); setNewCatName(''); setNewCatEmoji('');
    } catch (e) {
      showAlert('Erreur', e.message || 'Impossible de créer la catégorie');
    }
    setCreatingCat(false);
  };

  // ── Photos ────────────────────────────────────────────────
  const uploadFromUri = useCallback(async (uri, asMain) => {
    setUploading(true);
    try {
      const compressed = await compressPhoto(uri);
      const { url } = await api.admin.products.uploadImage({ uri: compressed, name: 'photo.jpg', type: 'image/jpeg' });
      if (asMain) setImageUrl(url);
      else setExtraImages(prev => [...prev, url]);
    } catch (e) {
      showAlert('Erreur', e.message || 'Échec de l\'envoi de la photo');
    }
    setUploading(false);
  }, []);

  const takePhoto = useCallback(async (asMain) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { showAlert('Caméra', 'Autorisez l\'accès à la caméra dans les réglages.'); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) await uploadFromUri(res.assets[0].uri, asMain);
  }, [uploadFromUri]);

  const pickFromGallery = useCallback(async (asMain) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Photos', 'Autorisez l\'accès aux photos dans les réglages.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) await uploadFromUri(res.assets[0].uri, asMain);
  }, [uploadFromUri]);

  const choosePhotoSource = (asMain) => {
    showAlert(asMain ? 'Photo principale' : 'Photo supplémentaire', 'Choisir la source', [
      { text: '📷 Prendre une photo', onPress: () => takePhoto(asMain) },
      { text: '🖼️ Galerie', onPress: () => pickFromGallery(asMain) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    const price = Number(String(form.price).replace(',', '.'));
    const minOrder = Number(form.minOrder);
    if (!form.name.trim()) return setError('Le nom est obligatoire');
    if (!form.ref.trim()) return setError('La référence est obligatoire');
    if (!form.categoryId) return setError('Choisissez une catégorie');
    if (!(price > 0)) return setError('Prix invalide');
    if (!(minOrder >= 1)) return setError('Quantité minimale invalide');
    if (form.quantity.trim() !== '' && !(Number(form.quantity) >= 0))
      return setError('Quantité en stock invalide');
    setError(''); setSaving(true);
    const payload = {
      name: form.name.trim(), ref: form.ref.trim(), categoryId: form.categoryId,
      price, unit: form.unit, minOrder, stock: form.stock,
      // Empty field = untracked product: no ceiling, never decremented
      quantity: quantityTracked ? Number(form.quantity) : null,
      description: form.description.trim() || undefined,
      imageUrl: imageUrl || undefined,
      images: extraImages.length ? extraImages.join(',') : undefined,
      isActive: form.isActive,
    };
    try {
      if (editing) await api.admin.products.update(editing.id, payload);
      else await api.admin.products.create(payload);
      navigation.goBack();
    } catch (e) {
      setError(e.message || 'Impossible d\'enregistrer');
    }
    setSaving(false);
  };

  const photoBox = {
    width: 96, height: 96, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1.5,
    borderColor: T.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        {/* Photos */}
        <Field label="PHOTOS">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => choosePhotoSource(true)} disabled={uploading} activeOpacity={0.8}
              style={[photoBox, { width: 120, height: 120, borderColor: T.primary, borderStyle: imageUrl ? 'solid' : 'dashed' }]}>
              {imageUrl
                ? <Image source={{ uri: imageUrl }} style={{ width: 120, height: 120 }} resizeMode="cover" />
                : <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 28 }}>📷</Text><Text style={{ fontSize: 11, color: T.primary, fontWeight: '700', marginTop: 4 }}>Principale</Text></View>}
            </TouchableOpacity>
            {extraImages.map((u, i) => (
              <View key={u + i} style={photoBox}>
                <Image source={{ uri: u }} style={{ width: 96, height: 96 }} resizeMode="cover" />
                <TouchableOpacity onPress={() => setExtraImages(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 4, right: 4, backgroundColor: T.danger, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => choosePhotoSource(false)} disabled={uploading} activeOpacity={0.8}
              style={[photoBox, { borderStyle: 'dashed' }]}>
              <Text style={{ fontSize: 22, color: T.muted }}>＋</Text>
            </TouchableOpacity>
            {uploading && <ActivityIndicator color={T.primary} />}
          </View>
          {imageUrl ? (
            <TouchableOpacity onPress={() => setImageUrl(null)} style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: T.danger, fontWeight: '600' }}>Retirer la photo principale</Text>
            </TouchableOpacity>
          ) : null}
        </Field>

        <Field label="NOM *">
          <TextInput style={inputStyle} value={form.name} onChangeText={v => set('name', v)} placeholder="Boîte carton simple" placeholderTextColor={T.muted} />
        </Field>
        <Field label="RÉFÉRENCE *">
          <TextInput style={inputStyle} value={form.ref} onChangeText={v => set('ref', v)} placeholder="BCS-100" placeholderTextColor={T.muted} autoCapitalize="characters" />
        </Field>
        <Field label="CATÉGORIE *">
          {!catsLoaded
            ? <Text style={{ fontSize: 13, color: T.muted }}>Chargement…</Text>
            : categories.length === 0
              ? <Text style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>Aucune catégorie — créez-en une ci-dessous.</Text>
              : <Chips options={categories} value={form.categoryId} onChange={v => set('categoryId', v)} getKey={c => c.id} getLabel={c => (c.emoji ? `${c.emoji} ${c.name}` : c.name)} />}

          {!newCatOpen ? (
            <TouchableOpacity onPress={() => setNewCatOpen(true)} activeOpacity={0.7}
              style={{ alignSelf: 'flex-start', marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.primary, backgroundColor: T.primary + '0A' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.primary }}>＋ Nouvelle catégorie</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: T.primary + '60', gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.2 }}>NOUVELLE CATÉGORIE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[inputStyle, { width: 64, textAlign: 'center' }]} value={newCatEmoji} onChangeText={setNewCatEmoji}
                  placeholder="📦" placeholderTextColor={T.muted} maxLength={4} />
                <TextInput style={[inputStyle, { flex: 1 }]} value={newCatName} onChangeText={setNewCatName}
                  placeholder="Nom de la catégorie" placeholderTextColor={T.muted} autoFocus returnKeyType="done" onSubmitEditing={handleCreateCategory} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => { setNewCatOpen(false); setNewCatName(''); setNewCatEmoji(''); }} disabled={creatingCat}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: T.border }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: T.muted }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateCategory} disabled={creatingCat || !newCatName.trim()} activeOpacity={0.8}
                  style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: T.primary, opacity: creatingCat || !newCatName.trim() ? 0.5 : 1, minWidth: 90, alignItems: 'center' }}>
                  {creatingCat ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>Créer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Field>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="PRIX (TND) *">
              <TextInput style={inputStyle} value={form.price} onChangeText={v => set('price', v)} keyboardType="decimal-pad" placeholder="0.450" placeholderTextColor={T.muted} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="QTÉ MINIMALE *">
              <TextInput style={inputStyle} value={form.minOrder} onChangeText={v => set('minOrder', v)} keyboardType="number-pad" placeholder="1" placeholderTextColor={T.muted} />
            </Field>
          </View>
        </View>

        <Field label="UNITÉ">
          <Chips options={UNIT_OPTIONS} value={form.unit} onChange={v => set('unit', v)} />
        </Field>
        <Field label="QUANTITÉ EN STOCK">
          <TextInput style={inputStyle} value={form.quantity} onChangeText={v => set('quantity', v)}
            keyboardType="number-pad" placeholder="Illimité" placeholderTextColor={T.muted} />
          <Text style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 16 }}>
            {quantityTracked
              ? 'Les commandes confirmées déduisent cette quantité ; une annulation la restitue.'
              : 'Laissez vide pour un article non suivi (aucune limite de stock).'}
          </Text>
        </Field>
        <Field label="STOCK">
          {quantityTracked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Badge status={form.stock} />
              <Text style={{ fontSize: 11, color: T.muted, flex: 1 }}>
                Déterminé automatiquement par la quantité.
              </Text>
            </View>
          ) : (
            <Chips options={STOCK_OPTIONS} value={form.stock} onChange={v => set('stock', v)} />
          )}
        </Field>
        <Field label="DESCRIPTION">
          <TextInput style={[inputStyle, { minHeight: 90, textAlignVertical: 'top' }]} multiline value={form.description}
            onChangeText={v => set('description', v)} placeholder="Détails, dimensions, matière…" placeholderTextColor={T.muted} />
        </Field>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: T.border, marginBottom: 18 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>Visible dans le catalogue</Text>
          <Switch value={form.isActive} onValueChange={v => set('isActive', v)} trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={form.isActive ? T.primary : '#fff'} />
        </View>

        {error ? (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ color: '#DC2626', fontSize: 13 }}>⚠️ {error}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={handleSave} disabled={saving || uploading} activeOpacity={0.8}
          style={{ backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: saving || uploading ? 0.6 : 1 }}>
          {saving ? <ActivityIndicator color="#FFF" /> :
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>{editing ? '💾 Enregistrer' : '➕ Créer l\'article'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
