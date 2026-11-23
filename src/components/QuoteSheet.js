import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView,
  Platform, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { T } from '../constants/theme';
import * as api from '../services/api';
import Btn from './Btn';

const inputStyle = {
  backgroundColor: '#F8F8FA',
  borderRadius: 14,
  padding: 15,
  fontSize: 14,
  color: '#111',
  marginBottom: 12,
  borderWidth: 1.5,
  borderColor: '#EBEBEB',
};

const EMPTY_FORM = { contactName: '', contactEmail: '', contactPhone: '', needs: '' };
const MAX_PICKER_ROWS = 40;

/** Normalize a catalogue product (or a cart line) into a quote item. */
const toQuoteItem = (p, qty) => ({
  id: p.id,
  name: p.name,
  unit: p.unit || 'pièce',
  price: Number(p.price) || 0,
  minOrder: Math.max(1, Number(p.minOrder ?? p.min ?? 1)),
  qty: Math.max(1, Number(qty) || Number(p.minOrder ?? p.min ?? 1)),
});

export default function QuoteSheet() {
  const { quoteModal, setQuoteModal, quoteItems, submitQuote, currentUser } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [products, setProducts] = useState(null); // null = not loaded yet
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (quoteModal) {
      setForm({
        contactName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '',
        contactEmail: currentUser?.email || '',
        contactPhone: currentUser?.phone || '',
        needs: '',
      });
      setItems((quoteItems || []).map(i => toQuoteItem(i, i.qty)));
      // Open the picker directly when the sheet is opened without a pre-selected product
      setPickerOpen(!quoteItems || quoteItems.length === 0);
      setSearch('');
      setError('');
    }
  }, [quoteModal]);

  // Load the catalogue the first time the picker is shown
  useEffect(() => {
    if (quoteModal && pickerOpen && products === null) {
      api.products.list()
        .then(list => setProducts(Array.isArray(list) ? list : []))
        .catch(() => setProducts([]));
    }
  }, [quoteModal, pickerOpen, products]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    const list = q ? products.filter(p => p.name?.toLowerCase().includes(q) || p.ref?.toLowerCase().includes(q)) : products;
    return list.slice(0, MAX_PICKER_ROWS);
  }, [products, search]);

  const selectedIds = useMemo(() => new Set(items.map(i => i.id)), [items]);

  const addProduct = (p) => {
    setItems(prev => prev.some(i => i.id === p.id) ? prev : [...prev, toQuoteItem(p)]);
    setError('');
  };
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const changeQty = (id, delta) => setItems(prev => prev.map(i =>
    i.id === id ? { ...i, qty: Math.max(i.minOrder, i.qty + delta * i.minOrder) } : i));
  const typeQty = (id, text) => {
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty: Number.isFinite(n) ? n : 0 } : i));
  };
  const fixQty = (id) => setItems(prev => prev.map(i =>
    i.id === id ? { ...i, qty: Math.max(i.minOrder, i.qty || i.minOrder) } : i));

  const close = () => { if (!sending) setQuoteModal(false); };

  const handleSend = async () => {
    if (!form.contactName.trim()) return setError('Indiquez votre nom ou société.');
    if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) return setError('Indiquez un e-mail valide.');
    if (items.length === 0 && !form.needs.trim()) return setError('Sélectionnez au moins un article ou décrivez vos besoins.');
    setError('');
    setSending(true);
    try {
      await submitQuote({
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        needs: form.needs.trim() || undefined,
        items: items.map(i => ({ id: i.id, name: i.name, qty: Math.max(i.minOrder, i.qty || i.minOrder), unit: i.unit, price: i.price })),
      });
      setForm(EMPTY_FORM);
      setItems([]);
    } catch (e) {
      setError(e?.message || "Impossible d'envoyer la demande.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={quoteModal} transparent animationType="slide"
      onRequestClose={close} statusBarTranslucent>
      {/* 'padding' works inside a Modal on both platforms; 'height' misbehaves on Android with a translucent status bar */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1} onPress={close} />

        <View style={{
          backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12, shadowRadius: 16, elevation: 24,
        }}>
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12,
                backgroundColor: T.primary + '15', alignItems: 'center', justifyContent: 'center',
                marginRight: 12 }}>
                <Text style={{ fontSize: 20 }}>📋</Text>
              </View>
              <View>
                <Text style={{ fontWeight: '800', fontSize: 17, color: T.text }}>Demander un devis</Text>
                <Text style={{ color: T.muted, fontSize: 12, marginTop: 1 }}>Réponse sous 24h ouvrables</Text>
              </View>
            </View>

            {/* Selected articles */}
            <View style={{
              backgroundColor: T.primary + '08', borderRadius: 14, padding: 14,
              marginTop: 14, marginBottom: 4, borderWidth: 1, borderColor: T.primary + '20',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary, letterSpacing: 1 }}>
                  ARTICLES ({items.length})
                </Text>
                <TouchableOpacity onPress={() => setPickerOpen(o => !o)} hitSlop={8} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: T.primary }}>
                    {pickerOpen ? 'Fermer la liste' : '+ Ajouter des articles'}
                  </Text>
                </TouchableOpacity>
              </View>

              {items.length === 0 && !pickerOpen && (
                <Text style={{ fontSize: 13, color: T.muted }}>Aucun article sélectionné.</Text>
              )}

              {items.map(item => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: T.text, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: T.muted }}>
                      {item.price > 0 ? `${item.price.toFixed(3)} TND/${item.unit}` : item.unit} · min {item.minOrder}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => changeQty(item.id, -1)} hitSlop={6}
                    style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}>
                    <Text style={{ fontSize: 16, color: T.primary }}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    value={item.qty ? String(item.qty) : ''}
                    onChangeText={v => typeQty(item.id, v)}
                    onBlur={() => fixQty(item.id)}
                    keyboardType="number-pad" maxLength={7} selectTextOnFocus
                    style={{ width: 58, height: 30, borderRadius: 8, borderWidth: 1, borderColor: T.primary + '60',
                      backgroundColor: '#FFF', textAlign: 'center', fontSize: 13, fontWeight: '800', color: T.primary, paddingVertical: 0 }} />
                  <TouchableOpacity onPress={() => changeQty(item.id, 1)} hitSlop={6}
                    style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, color: '#FFF' }}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Text style={{ fontSize: 16, color: T.danger || '#dc2626' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Product picker */}
              {pickerOpen && (
                <View style={{ marginTop: items.length ? 6 : 0 }}>
                  <TextInput placeholder="Rechercher un article…" placeholderTextColor={T.muted}
                    value={search} onChangeText={setSearch} autoCorrect={false}
                    style={{ ...inputStyle, backgroundColor: '#FFF', marginBottom: 8, padding: 11 }} />
                  {products === null ? (
                    <ActivityIndicator color={T.primary} style={{ marginVertical: 12 }} />
                  ) : filtered.length === 0 ? (
                    <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center', paddingVertical: 10 }}>
                      {products.length === 0 ? 'Catalogue indisponible.' : 'Aucun article trouvé.'}
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filtered.map(p => {
                        const added = selectedIds.has(p.id);
                        return (
                          <TouchableOpacity key={p.id} onPress={() => added ? removeItem(p.id) : addProduct(p)} activeOpacity={0.7}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10,
                              borderRadius: 10, marginBottom: 4, backgroundColor: added ? T.primary + '14' : '#FFF',
                              borderWidth: 1, borderColor: added ? T.primary + '50' : '#EBEBEB' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }} numberOfLines={1}>{p.name}</Text>
                              <Text style={{ fontSize: 11, color: T.muted }}>
                                {Number(p.price) > 0 ? `${Number(p.price).toFixed(3)} TND/${p.unit || 'pièce'}` : (p.unit || '')}
                                {p.minOrder ? ` · min ${p.minOrder}` : ''}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: T.primary, marginLeft: 8 }}>
                              {added ? '✓ Ajouté' : '+ Ajouter'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 18 }} />

            <TextInput placeholder="Nom / société" placeholderTextColor={T.muted}
              value={form.contactName} onChangeText={v => setForm(f => ({ ...f, contactName: v }))}
              style={inputStyle} />
            <TextInput placeholder="Email" placeholderTextColor={T.muted}
              keyboardType="email-address" autoCapitalize="none"
              value={form.contactEmail} onChangeText={v => setForm(f => ({ ...f, contactEmail: v }))}
              style={inputStyle} />
            <TextInput placeholder="Téléphone" placeholderTextColor={T.muted}
              keyboardType="phone-pad"
              value={form.contactPhone} onChangeText={v => setForm(f => ({ ...f, contactPhone: v }))}
              style={inputStyle} />
            <TextInput placeholder="Précisions supplémentaires (dimensions, impression, délais…)" multiline numberOfLines={4}
              placeholderTextColor={T.muted}
              value={form.needs} onChangeText={v => setForm(f => ({ ...f, needs: v }))}
              style={{ ...inputStyle, minHeight: 100, textAlignVertical: 'top', marginBottom: 12 }} />

            {!!error && (
              <Text style={{ color: T.danger || '#dc2626', fontSize: 13, marginBottom: 12, fontWeight: '600' }}>{error}</Text>
            )}

            <Btn label={sending ? 'Envoi…' : 'Envoyer la demande'} icon="📤" bg={T.primary} size="lg"
              onPress={sending ? undefined : handleSend} />

            <TouchableOpacity onPress={close} style={{ marginTop: 10, paddingVertical: 10 }}>
              <Text style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
          <SafeAreaView />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
