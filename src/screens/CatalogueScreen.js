import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import { usePolling } from '../hooks/usePolling';
import ProdCard from '../components/ProdCard';

const PAGE_SIZE = 10;

export default function CatalogueScreen() {
  const navigation = useNavigation();
  const r = useR();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Tous');
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState(['Tous']);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Slice the full filtered list — FlatList only renders what's visible
  const displayed = useMemo(
    () => allProducts.slice(0, page * PAGE_SIZE),
    [allProducts, page]
  );
  const hasMore = displayed.length < allProducts.length;

  // Categories are polled; products are refreshed silently (no spinner) —
  // the search effect below does the first product load.
  const firstPoll = useRef(true);
  usePolling(() => {
    api.categories.list().then(cats => {
      const names = cats.map(c => (typeof c === 'string' ? c : c.name));
      setCategories(['Tous', ...names]);
    }).catch(() => {});
    if (firstPoll.current) { firstPoll.current = false; return; }
    api.products.list(cat, search).then(data => setAllProducts(data || [])).catch(() => {});
  }, 30000);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setPage(1);
      api.products.list(cat, search)
        .then(data => setAllProducts(data || []))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [cat, search]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) setPage(p => p + 1);
  }, [hasMore, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>

      {/* Search + category filter */}
      <View style={{
        backgroundColor: '#FFF', paddingHorizontal: r.px,
        paddingVertical: 12, gap: 10,
        borderBottomWidth: 1, borderBottomColor: T.border,
      }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg,
          borderRadius: 14, paddingHorizontal: 14,
          borderWidth: 1.5, borderColor: T.border, height: 48,
        }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, fontSize: 14, color: T.text }}
            placeholder="Rechercher un produit..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={T.muted}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: T.muted, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 13, color: '#FFF', fontWeight: '800' }}>✕</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          horizontal
          data={categories}
          keyExtractor={c => c}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              onPress={() => setCat(c)}
              activeOpacity={0.75}
              style={{
                borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
                backgroundColor: cat === c ? T.primary : '#FFF',
                borderWidth: 1.5, borderColor: cat === c ? T.primary : T.border,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: cat === c ? '#FFF' : T.muted }}>
                {c}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.primary} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={{ paddingHorizontal: r.px, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ fontSize: 12, color: T.muted }}>
                {allProducts.length} produit{allProducts.length > 1 ? 's' : ''} trouvé{allProducts.length > 1 ? 's' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 50, marginBottom: 12 }}>🔍</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.muted }}>Aucun résultat</Text>
              <TouchableOpacity
                onPress={() => { setSearch(''); setCat('Tous'); }}
                style={{ marginTop: 16 }}>
                <Text style={{ color: T.primary, fontWeight: '700' }}>Réinitialiser les filtres</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            hasMore
              ? <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator color={T.primary} />
                </View>
              : null
          }
          renderItem={({ item: p }) => (
            <ProdCard
              p={{ ...p, img: p.emoji, min: p.minOrder }}
              r={r}
              onPress={() => navigation.navigate('Product', { product: p })}
            />
          )}
        />
      )}
    </View>
  );
}
