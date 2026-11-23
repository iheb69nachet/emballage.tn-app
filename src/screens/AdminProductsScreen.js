import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { usePolling } from '../hooks/usePolling';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Switch, Image,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';

const fmt = (n) => Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Green when there is room, amber when running low, red at zero. */
const stockColor = (p) =>
  p.quantity == null ? T.muted
    : p.quantity <= 0 ? T.danger
      : p.quantity <= 10 ? T.warning
        : T.success;
const PAGE_SIZE = 20;

function PageButton({ label, onPress, disabled, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7}
      style={{
        minWidth: 36, height: 36, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? T.primary : '#FFF', borderWidth: 1, borderColor: active ? T.primary : T.border,
        opacity: disabled ? 0.35 : 1,
      }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#FFF' : T.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Page numbers to display: first, last, and a window around the current page (null = ellipsis). */
function pageWindow(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1].filter(p => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => { if (i > 0 && p - sorted[i - 1] > 1) out.push(null); out.push(p); });
  return out;
}

export default function AdminProductsScreen() {
  const r = useR();
  const navigation = useNavigation();
  const { authToken } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [togglingId, setTogglingId] = useState(null);
  const [page, setPage] = useState(1);
  const listRef = useRef(null);

  // Back to the first page whenever the search or the filter changes
  useEffect(() => { setPage(1); }, [searchQuery, activeFilter]);

  const goToPage = (p) => {
    setPage(p);
    listRef.current?.scrollTo({ y: 0, animated: true });
  };

  const fetchProducts = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const data = await api.admin.products.list();
      setProducts(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [authToken]);

  // On focus (e.g. back from the product form), then every 30s while visible
  usePolling(fetchProducts, 30000);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  const handleToggleActive = useCallback(async (product) => {
    const newValue = !product.isActive;
    showAlert(
      newValue ? 'Activer le produit' : 'Désactiver le produit',
      `${newValue ? 'Activer' : 'Désactiver'} "${product.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setTogglingId(product.id);
            try {
              await api.admin.products.update(product.id, { isActive: newValue });
              setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: newValue } : p));
            } catch (e) {
              showAlert('Erreur', e.message || 'Impossible de mettre à jour');
            }
            setTogglingId(null);
          },
        },
      ]
    );
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (!authToken) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: r.px, gap: 16, backgroundColor: T.bg }}>
        <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Accès administrateur</Text>
        <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>Cette section est réservée aux administrateurs</Text>
      </View>
    );
  }

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'all' || (activeFilter === 'active' ? p.isActive : !p.isActive);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => a.name?.localeCompare(b.name));

  const activeCount = products.filter(p => p.isActive).length;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filteredProducts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredProducts.length);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Summary bar */}
      <View style={{ paddingHorizontal: r.px, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border, flexDirection: 'row', gap: 16 }}>
        <Text style={{ fontSize: 13, color: T.muted, flex: 1, alignSelf: 'center' }}>
          <Text style={{ fontWeight: '700', color: T.success }}>{activeCount}</Text> actifs ·{' '}
          <Text style={{ fontWeight: '700', color: T.muted }}>{products.length - activeCount}</Text> inactifs
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminProductForm')} activeOpacity={0.8}
          style={{ backgroundColor: T.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>＋ Nouvel article</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: r.px, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        <TextInput
          placeholder="Rechercher un produit..."
          placeholderTextColor={T.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 16,
            paddingVertical: 12, fontSize: 14, color: T.text, borderWidth: 1, borderColor: T.border,
          }}
        />
      </View>

      {/* Filter tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        {[{ key: 'all', label: 'Tous' }, { key: 'active', label: 'Actifs' }, { key: 'inactive', label: 'Inactifs' }].map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            activeOpacity={0.7}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center',
              borderBottomWidth: 2, borderBottomColor: activeFilter === f.key ? T.primary : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: activeFilter === f.key ? T.primary : T.muted }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Products */}
      <ScrollView
        ref={listRef}
        contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {filteredProducts.length > 0 && (
          <Text style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
            {rangeStart}–{rangeEnd} sur {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
            {totalPages > 1 ? ` · page ${currentPage}/${totalPages}` : ''}
          </Text>
        )}
        {filteredProducts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <Text style={{ fontSize: 44, marginBottom: 16 }}>📦</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 6 }}>Aucun produit</Text>
            <Text style={{ fontSize: 13, color: T.muted }}>Aucun résultat pour votre recherche</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {pageProducts.map(p => (
              <TouchableOpacity key={p.id} activeOpacity={0.85}
                onPress={() => navigation.navigate('AdminProductForm', { product: p })}
                style={{
                backgroundColor: '#FFF', borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: p.isActive ? T.border : T.border,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
                opacity: p.isActive ? 1 : 0.6,
              }}>
                {/* Thumbnail */}
                {
                  p.imageUrl? (
                  <Image
                    source={{ uri: p.imageUrl }}
                    style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: T.bg }}
                    resizeMode="cover"
                  />
                ):(typeof p.images === 'string' && p.images.split(',')[0].trim()) ?
                  (
                  <Image
                    source={{ uri: p.images.split(',')[0].trim() }}
                    style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: T.bg }}
                    resizeMode="cover"
                  />
                ):
                (
                  <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>📦</Text>
                  </View>
                )
                }
                

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }} numberOfLines={1}>{p.name}</Text>
                  {p.category && (
                    <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{p.category?.name || p.category}</Text>
                  )}
                  <Text style={{ fontSize: 14, fontWeight: '800', color: T.primary, marginTop: 4 }}>
                    {fmt(Number(p.price) || 0)} TND
                  </Text>
                  <Text style={{ fontSize: 11, color: stockColor(p), fontWeight: '700', marginTop: 3 }}>
                    {p.quantity == null
                      ? '∞ stock non suivi'
                      : `${p.quantity} en stock · ${p.stock}`}
                  </Text>
                </View>

                {/* Toggle */}
                {togglingId === p.id ? (
                  <ActivityIndicator size="small" color={T.primary} />
                ) : (
                  <Switch
                    value={!!p.isActive}
                    onValueChange={() => handleToggleActive(p)}
                    trackColor={{ false: T.border, true: T.primary + '80' }}
                    thumbColor={p.isActive ? T.primary : '#fff'}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 }}>
            <PageButton label="‹" onPress={() => goToPage(currentPage - 1)} disabled={currentPage === 1} />
            {pageWindow(currentPage, totalPages).map((p, i) =>
              p === null
                ? <Text key={`gap-${i}`} style={{ color: T.muted, paddingHorizontal: 2 }}>…</Text>
                : <PageButton key={p} label={String(p)} active={p === currentPage} onPress={() => goToPage(p)} />
            )}
            <PageButton label="›" onPress={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
