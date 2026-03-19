import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import * as api from '../services/api';
import ProdCard from '../components/ProdCard';

export default function CatalogueScreen() {
  const navigation = useNavigation();
  const r = useR();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Tous');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Tous']);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    api.products.list(cat, search)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [cat, search]);

  useEffect(() => {
    api.products.categories().then(cats => setCategories(['Tous', ...cats]));
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [cat, search]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ backgroundColor: '#FFF', paddingHorizontal: r.px,
        paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: T.border }}>
        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg,
          borderRadius: 14, paddingHorizontal: 14, borderWidth: 1.5, borderColor: T.border, height: 48 }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput style={{ flex: 1, fontSize: 14, color: T.text }}
            placeholder="Rechercher un produit..."
            value={search} onChangeText={setSearch}
            placeholderTextColor={T.muted} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: T.muted,
                alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, color: '#FFF', fontWeight: '800' }}>✕</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {categories.map(c => (
            <TouchableOpacity key={c} onPress={() => setCat(c)} activeOpacity={0.75}
              style={{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
                backgroundColor: cat === c ? T.primary : '#FFF',
                borderWidth: 1.5, borderColor: cat === c ? T.primary : T.border }}>
              <Text style={{ fontSize: 12, fontWeight: '700',
                color: cat === c ? '#FFF' : T.muted }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.primary} />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: r.px, paddingVertical: 10 }}>
            <Text style={{ fontSize: 12, color: T.muted }}>
              {products.length} produit{products.length > 1 ? 's' : ''} trouvé{products.length > 1 ? 's' : ''}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: r.px, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}>
            {products.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Text style={{ fontSize: 50, marginBottom: 12 }}>🔍</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.muted }}>Aucun résultat</Text>
                <TouchableOpacity onPress={() => { setSearch(''); setCat('Tous'); }} style={{ marginTop: 16 }}>
                  <Text style={{ color: T.primary, fontWeight: '700' }}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              </View>
            ) : (
              products.map(p => (
                <ProdCard key={p.id} p={{ ...p, img: p.emoji, min: p.minOrder }} r={r}
                  onPress={() => navigation.navigate('Product', { product: p })} />
              ))
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}
