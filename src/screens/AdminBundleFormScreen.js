import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image, Switch, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';

const BADGE_COLORS = ['#1A3D2B', '#C8A84B', '#E74C3C', '#2980B9', '#8E44AD', '#F39C12', '#27AE60', '#1C1C1C'];
const EMOJIS = ['📦', '🎁', '⚡', '🔥', '⭐', '🚀', '💎', '🏷️'];

const toNum = (v) => Number(String(v ?? '').replace(',', '.'));
const fmt3 = (n) => (Number.isFinite(n) ? n.toFixed(3) : '');

/** Resize + compress a photo before upload (tablet photos easily exceed the 5 MB API limit). */
async function compressPhoto(uri) {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri).resize({ width: 1200 });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return out.uri;
}

function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 6 }}>{label}</Text>
      {children}
      {hint ? <Text style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{hint}</Text> : null}
    </View>
  );
}

const inputStyle = {
  backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  fontSize: 14, color: T.text, borderWidth: 1.5, borderColor: T.border,
};

export default function AdminBundleFormScreen({ route, navigation }) {
  const r = useR();
  const editing = route.params?.bundle ?? null;

  const [form, setForm] = useState({
    name: editing?.name ?? '',
    emoji: editing?.emoji ?? '📦',
    badge: editing?.badge ?? '',
    badgeColor: editing?.badgeColor ?? '#1A3D2B',
    originalPrice: editing ? String(editing.originalPrice ?? '') : '',
    price: editing ? String(editing.price ?? '') : '',
    isActive: editing ? !!editing.isActive : true,
  });
  const [items, setItems] = useState(Array.isArray(editing?.items) ? editing.items : []);
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? null);
  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState('1');
  const [customItem, setCustomItem] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Modifier le pack' : 'Nouveau pack' });
    api.admin.products.list()
      .then(d => setProducts(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => {})
      .finally(() => setProductsLoaded(true));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Derived prices: saving & discount follow the two prices (same fields as the web form) ──
  const original = toNum(form.originalPrice);
  const price = toNum(form.price);
  const saving = Number.isFinite(original) && Number.isFinite(price) && original > 0 && price > 0 ? original - price : NaN;
  const discount = Number.isFinite(saving) && original > 0 ? Math.round((saving / original) * 100) : NaN;

  // ── Items ──────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = q ? products.filter(p => p.name?.toLowerCase().includes(q) || p.ref?.toLowerCase().includes(q)) : products;
    return list.slice(0, 8);
  }, [products, productSearch]);

  const addItem = (label) => {
    const clean = label.trim();
    if (!clean) return;
    if (items.includes(clean)) { showAlert('Déjà ajouté', 'Cet article figure déjà dans le pack.'); return; }
    setItems(prev => [...prev, clean]);
  };

  const addProductItem = () => {
    if (!selectedProduct) return;
    const n = Math.max(1, Math.floor(toNum(qty) || 1));
    addItem(`${n}× ${selectedProduct.name}`);
    setSelectedProduct(null); setQty('1'); setProductSearch('');
  };

  const addCustomItem = () => {
    addItem(customItem);
    setCustomItem('');
  };

  const removeItem = (i) => setItems(prev => prev.filter((_, j) => j !== i));

  /** Sum of the selected products' unit price × qty — handy to fill "Prix original". */
  const suggestedOriginal = useMemo(() => {
    let total = 0; let matched = 0;
    for (const label of items) {
      const m = /^(\d+)\s*×\s*(.+)$/.exec(label);
      if (!m) continue;
      const p = products.find(x => x.name === m[2].trim());
      if (!p) continue;
      total += Number(m[1]) * Number(p.price || 0); matched++;
    }
    return matched ? total : null;
  }, [items, products]);

  // ── Photo ──────────────────────────────────────────────────
  const uploadFromUri = useCallback(async (uri) => {
    setUploading(true);
    try {
      const compressed = await compressPhoto(uri);
      const { url } = await api.admin.bundles.uploadImage({ uri: compressed, name: 'photo.jpg', type: 'image/jpeg' });
      setImageUrl(url);
    } catch (e) {
      showAlert('Erreur', e.message || "Échec de l'envoi de la photo");
    }
    setUploading(false);
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { showAlert('Caméra', "Autorisez l'accès à la caméra dans les réglages."); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) await uploadFromUri(res.assets[0].uri);
  }, [uploadFromUri]);

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Photos', "Autorisez l'accès aux photos dans les réglages."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) await uploadFromUri(res.assets[0].uri);
  }, [uploadFromUri]);

  const choosePhotoSource = () => {
    showAlert('Image du pack', 'Choisir la source', [
      { text: '📷 Prendre une photo', onPress: takePhoto },
      { text: '🖼️ Galerie', onPress: pickFromGallery },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) return setError('Le nom est obligatoire');
    if (!form.badge.trim()) return setError('Le badge est obligatoire (ex. "Best-seller")');
    if (!items.length) return setError('Ajoutez au moins un article au pack');
    if (!(original > 0)) return setError('Prix original invalide');
    if (!(price > 0)) return setError('Prix du pack invalide');
    if (!(price < original)) return setError('Le prix du pack doit être inférieur au prix original');
    setError(''); setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      emoji: form.emoji.trim() || undefined,
      badge: form.badge.trim(),
      badgeColor: form.badgeColor,
      items,
      originalPrice: Number(original.toFixed(3)),
      price: Number(price.toFixed(3)),
      saving: Number(saving.toFixed(3)),
      discount,
      imageUrl: imageUrl || undefined,
      isActive: form.isActive,
    };
    try {
      if (editing) await api.admin.bundles.update(editing.id, payload);
      else await api.admin.bundles.create(payload);
      navigation.goBack();
    } catch (e) {
      setError(e.message || "Impossible d'enregistrer");
    }
    setSubmitting(false);
  };

  const handleDelete = () => {
    if (!editing) return;
    showAlert('Supprimer ce pack ?', `"${editing.name}" ne sera plus proposé aux clients.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try { await api.admin.bundles.remove(editing.id); navigation.goBack(); }
          catch (e) { showAlert('Erreur', e.message || 'Suppression impossible'); setSubmitting(false); }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        {/* Preview card — what the client sees on the home screen */}
        <View style={{
          backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1.5, borderColor: T.border,
          flexDirection: 'row', gap: 12, alignItems: 'center',
        }}>
          <TouchableOpacity onPress={choosePhotoSource} disabled={uploading} activeOpacity={0.8}
            style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: imageUrl ? T.border : T.primary, borderStyle: imageUrl ? 'solid' : 'dashed' }}>
            {uploading ? <ActivityIndicator color={T.primary} />
              : imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: 84, height: 84 }} resizeMode="cover" />
              : <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 26 }}>{form.emoji || '📦'}</Text><Text style={{ fontSize: 10, color: T.primary, fontWeight: '700', marginTop: 2 }}>Photo</Text></View>}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            {form.badge.trim() ? (
              <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: form.badgeColor, marginBottom: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF' }}>{form.badge.trim()}</Text>
              </View>
            ) : null}
            <Text style={{ fontSize: 15, fontWeight: '800', color: T.text }} numberOfLines={1}>
              {form.emoji ? `${form.emoji} ` : ''}{form.name.trim() || 'Nom du pack'}
            </Text>
            <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }} numberOfLines={1}>
              {items.length ? items.join(' · ') : 'Articles du pack'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: T.primary }}>{price > 0 ? `${fmt3(price)} TND` : '—'}</Text>
              {original > 0 && <Text style={{ fontSize: 12, color: T.muted, textDecorationLine: 'line-through' }}>{fmt3(original)}</Text>}
              {Number.isFinite(discount) && discount > 0 && (
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: T.success + '20' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: T.success }}>-{discount}%</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {imageUrl ? (
          <TouchableOpacity onPress={() => setImageUrl(null)} style={{ marginTop: -10, marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: T.danger, fontWeight: '600' }}>Retirer la photo</Text>
          </TouchableOpacity>
        ) : null}

        <Field label="NOM DU PACK *">
          <TextInput style={inputStyle} value={form.name} onChangeText={v => set('name', v)} placeholder="Pack Expédition Starter" placeholderTextColor={T.muted} />
        </Field>

        <Field label="EMOJI">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput style={[inputStyle, { width: 64, textAlign: 'center' }]} value={form.emoji} onChangeText={v => set('emoji', v)} placeholder="📦" placeholderTextColor={T.muted} maxLength={4} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => set('emoji', e)} activeOpacity={0.7}
                  style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: form.emoji === e ? T.primary + '18' : '#FFF', borderWidth: 1, borderColor: form.emoji === e ? T.primary : T.border }}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Field>

        <Field label="BADGE *" hint="Court texte affiché sur la carte du pack.">
          <TextInput style={inputStyle} value={form.badge} onChangeText={v => set('badge', v)} placeholder="⚡ Best-seller" placeholderTextColor={T.muted} />
        </Field>

        <Field label="COULEUR DU BADGE">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {BADGE_COLORS.map(c => {
              const active = form.badgeColor.toLowerCase() === c.toLowerCase();
              return (
                <TouchableOpacity key={c} onPress={() => set('badgeColor', c)} activeOpacity={0.7}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: active ? 3 : 1, borderColor: active ? T.accent : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  {active && <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TextInput style={[inputStyle, { flex: 1, minWidth: 110, paddingVertical: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
              value={form.badgeColor} onChangeText={v => set('badgeColor', v)} placeholder="#1A3D2B" placeholderTextColor={T.muted} autoCapitalize="characters" maxLength={7} />
          </View>
        </Field>

        {/* Items */}
        <Field label={`ARTICLES DU PACK * (${items.length})`}>
          {items.length > 0 && (
            <View style={{ backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1.5, borderColor: T.border, marginBottom: 10, overflow: 'hidden' }}>
              {items.map((it, i) => (
                <View key={it + i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: T.border }}>
                  <Text style={{ flex: 1, fontSize: 13, color: T.text }}>{it}</Text>
                  <TouchableOpacity onPress={() => removeItem(i)} hitSlop={8}
                    style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: T.danger + '14', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: T.danger, fontWeight: '800', fontSize: 14 }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Pick a catalogue product */}
          <View style={{ backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1.5, borderColor: T.primary + '50', padding: 12, gap: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1.2 }}>AJOUTER UN PRODUIT DU CATALOGUE</Text>
            {selectedProduct ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: T.primary + '10', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }} numberOfLines={1}>{selectedProduct.name}</Text>
                  <Text style={{ fontSize: 11, color: T.muted }}>{fmt3(Number(selectedProduct.price))} TND / {selectedProduct.unit || 'pièce'}</Text>
                </View>
                <TextInput style={[inputStyle, { width: 64, textAlign: 'center' }]} value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="Qté" placeholderTextColor={T.muted} />
                <TouchableOpacity onPress={addProductItem} activeOpacity={0.8}
                  style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: T.primary }}>
                  <Text style={{ color: '#FFF', fontWeight: '800' }}>＋</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedProduct(null)} hitSlop={8}>
                  <Text style={{ color: T.muted, fontWeight: '700', fontSize: 16 }}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput style={inputStyle} value={productSearch} onChangeText={setProductSearch}
                  placeholder={productsLoaded ? 'Rechercher un produit…' : 'Chargement des produits…'} placeholderTextColor={T.muted} editable={productsLoaded} />
                {productsLoaded && products.length === 0 && (
                  <Text style={{ fontSize: 12, color: T.muted }}>Aucun produit dans le catalogue.</Text>
                )}
                {filteredProducts.length > 0 && (productSearch.trim() || products.length <= 8) && (
                  <View style={{ borderRadius: 10, borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
                    {filteredProducts.map((p, i) => (
                      <TouchableOpacity key={p.id} onPress={() => setSelectedProduct(p)} activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: T.border, backgroundColor: p.isActive === false ? T.bg : '#FFF' }}>
                        {p.imageUrl
                          ? <Image source={{ uri: p.imageUrl }} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: T.bg }} />
                          : <Text style={{ fontSize: 18, width: 32, textAlign: 'center' }}>{p.emoji || '📦'}</Text>}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }} numberOfLines={1}>{p.name}</Text>
                          <Text style={{ fontSize: 11, color: T.muted }}>{p.ref ? `${p.ref} · ` : ''}{fmt3(Number(p.price))} TND</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {productsLoaded && products.length > 8 && !productSearch.trim() && (
                  <Text style={{ fontSize: 11, color: T.muted }}>Tapez pour rechercher parmi {products.length} produits.</Text>
                )}
              </>
            )}
          </View>

          {/* Free-text item */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TextInput style={[inputStyle, { flex: 1 }]} value={customItem} onChangeText={setCustomItem}
              placeholder="Ou article libre : 5× Ruban adhésif" placeholderTextColor={T.muted} returnKeyType="done" onSubmitEditing={addCustomItem} />
            <TouchableOpacity onPress={addCustomItem} disabled={!customItem.trim()} activeOpacity={0.8}
              style={{ paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: T.primary, opacity: customItem.trim() ? 1 : 0.4 }}>
              <Text style={{ color: T.primary, fontWeight: '800' }}>＋</Text>
            </TouchableOpacity>
          </View>
        </Field>

        {/* Prices */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="PRIX ORIGINAL (TND) *">
              <TextInput style={inputStyle} value={form.originalPrice} onChangeText={v => set('originalPrice', v)} keyboardType="decimal-pad" placeholder="248.500" placeholderTextColor={T.muted} />
              {suggestedOriginal != null && Math.abs(suggestedOriginal - original) > 0.0005 && (
                <TouchableOpacity onPress={() => set('originalPrice', fmt3(suggestedOriginal))} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 11, color: T.primary, fontWeight: '700' }}>↺ Somme des produits : {fmt3(suggestedOriginal)}</Text>
                </TouchableOpacity>
              )}
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="PRIX DU PACK (TND) *">
              <TextInput style={inputStyle} value={form.price} onChangeText={v => set('price', v)} keyboardType="decimal-pad" placeholder="179.000" placeholderTextColor={T.muted} />
            </Field>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: T.border, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2 }}>ÉCONOMIE</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Number.isFinite(saving) && saving > 0 ? T.success : T.muted, marginTop: 4 }}>
              {Number.isFinite(saving) ? `${fmt3(saving)} TND` : '—'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2 }}>REMISE</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Number.isFinite(discount) && discount > 0 ? T.success : T.muted, marginTop: 4 }}>
              {Number.isFinite(discount) ? `${discount} %` : '—'}
            </Text>
          </View>
          <Text style={{ fontSize: 10, color: T.muted, alignSelf: 'flex-end', maxWidth: 110 }}>Calculées à partir des deux prix</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: T.border, marginBottom: 18 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>Visible pour les clients</Text>
          <Switch value={form.isActive} onValueChange={v => set('isActive', v)} trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={form.isActive ? T.primary : '#fff'} />
        </View>

        {error ? (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ color: '#DC2626', fontSize: 13 }}>⚠️ {error}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={handleSave} disabled={submitting || uploading} activeOpacity={0.8}
          style={{ backgroundColor: T.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: submitting || uploading ? 0.6 : 1 }}>
          {submitting ? <ActivityIndicator color="#FFF" /> :
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>{editing ? '💾 Enregistrer' : '➕ Créer le pack'}</Text>}
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity onPress={handleDelete} disabled={submitting} activeOpacity={0.8}
            style={{ marginTop: 12, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: T.danger, backgroundColor: T.danger + '0A' }}>
            <Text style={{ color: T.danger, fontWeight: '700', fontSize: 14 }}>🗑️ Supprimer le pack</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
