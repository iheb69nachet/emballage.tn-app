import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { usePolling } from '../hooks/usePolling';
import AdBanner from '../components/AdBanner';
import ProdCard from '../components/ProdCard';
import Btn from '../components/Btn';

/** Discount % of a bundle — stored on the API, derived from prices as a fallback. */
const bundlePct = (b) => {
  const d = Number(b.discount);
  if (d > 0) return Math.round(d);
  const orig = Number(b.originalPrice), price = Number(b.price);
  return orig > 0 && price >= 0 ? Math.round((1 - price / orig) * 100) : 0;
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const r = useR();
  const { openQuoteWithItems, showToast, addToCart, authToken } = useApp();
  const openQuote = () => authToken ? openQuoteWithItems([]) : navigation.getParent('Root')?.navigate('Login');
  const [products, setProducts] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Polled so product / pack changes made in the admin show up without a restart.
  // Only the first load reports errors — background refreshes stay silent.
  const loaded = useRef(false);
  usePolling(() => {
    Promise.all([api.products.list(), api.bundles.list()])
      .then(([p, b]) => { setProducts(p); setBundles(b); loaded.current = true; })
      .catch((err) => { if (!loaded.current) showToast(err?.response?.data?.message || err?.message || 'Erreur de chargement'); })
      .finally(() => setLoading(false));
  }, 30000);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={{ backgroundColor: T.primary, padding: r.px, paddingTop: 28, paddingBottom: 36 }}>
          <Text style={{ color: T.accent + '88', fontSize: 10, fontWeight: '700',
            letterSpacing: 2, marginBottom: 8 }}>BIENVENUE SUR</Text>
          <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '800', marginBottom: 10 }}>
            emballage<Text style={{ color: T.accent }}>.tn</Text>
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 24, lineHeight: 22 }}>
            Solutions d'emballage professionnelles{'\n'}pour entreprises et particuliers.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Catalogue')} activeOpacity={0.8}
              style={{ backgroundColor: T.accent, borderRadius: 14,
                paddingHorizontal: 20, paddingVertical: 13, flex: 1, alignItems: 'center' }}>
              <Text style={{ color: T.primary, fontWeight: '800', fontSize: 14 }}>📦  Catalogue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openQuote} activeOpacity={0.8}
              style={{ borderWidth: 2, borderColor: T.accent, borderRadius: 14,
                paddingHorizontal: 20, paddingVertical: 13, flex: 1, alignItems: 'center' }}>
              <Text style={{ color: T.accent, fontWeight: '800', fontSize: 14 }}>📋  Devis gratuit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <AdBanner />

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: r.px, marginTop: 16 }}>
          {[['500+', 'Produits', '📦'], ['2 000+', 'Clients', '🤝'], ['24h', 'Livraison', '🚀']].map(([v, l, ic]) => (
            <View key={l} style={{ flex: 1, backgroundColor: '#FFF', borderRadius: 14,
              padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>{ic}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.primary }}>{v}</Text>
              <Text style={{ fontSize: 10, color: T.muted, fontWeight: '600', marginTop: 1 }}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Quick access */}
        <View style={{ paddingHorizontal: r.px, marginTop: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 12 }}>Accès rapide</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { icon: '📦', label: 'Catalogue', screen: 'Catalogue', color: '#E8F5E9' },
              { icon: '🛒', label: 'Panier', screen: 'Cart', color: '#FFF3E0' },
              { icon: '📋', label: 'Devis', screen: 'Quotes', color: '#EDE7F6' },
              { icon: '🚚', label: 'Commandes', screen: 'Orders', color: '#E3F2FD' },
            ].map(a => (
              <TouchableOpacity key={a.label} onPress={() => navigation.navigate(a.screen)}
                activeOpacity={0.8}
                style={{ flex: 1, backgroundColor: a.color, borderRadius: 16,
                  paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                <Text style={{ fontSize: 26, marginBottom: 6 }}>{a.icon}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.text }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bundles */}
        <View style={{ paddingHorizontal: r.px, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.text }}>🎁 Packs & Bundles</Text>
            <View style={{ backgroundColor: '#FFF3CD', borderWidth: 1.5, borderColor: T.accent,
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: '#856404', fontSize: 10, fontWeight: '800' }}>🔥 Jusqu'à -30%</Text>
            </View>
          </View>
          {bundles.map(b => (
            <View key={b.id} style={{ backgroundColor: '#FFF', borderRadius: 18,
              marginBottom: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: b.badgeColor + '50',
              shadowColor: b.badgeColor, shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.12, shadowRadius: 8 }}>
              <View style={{ backgroundColor: b.badgeColor, flexDirection: 'row',
                justifyContent: 'space-between', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>{b.badge}</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8,
                  paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>-{bundlePct(b)}%</Text>
                </View>
              </View>
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <View style={{ width: 50, height: 50, backgroundColor: T.bg, borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {b.imageUrl ? (
                      <Image source={{ uri: b.imageUrl }} style={{ width: 50, height: 50 }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 28 }}>{b.emoji ?? b.icon}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: T.text, flex: 1 }}>{b.name}</Text>
                </View>
                <View style={{ backgroundColor: T.bg, borderRadius: 12, padding: 12, marginBottom: 14 }}>
                  {b.items.map((it, i) => (
                    <Text key={i} style={{ fontSize: 12, color: T.muted,
                      marginBottom: i < b.items.length - 1 ? 5 : 0 }}>✓  {it}</Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 14 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: T.muted, textDecorationLine: 'line-through' }}>
                      {Number(b.originalPrice).toFixed(3)} TND
                    </Text>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: b.badgeColor, lineHeight: 32 }}>
                      {Number(b.price).toFixed(3)}<Text style={{ fontSize: 14 }}> TND</Text>
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#EAFAF1', borderRadius: 12,
                    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: T.success, fontWeight: '700' }}>Économisez</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: T.success }}>
                      -{Number(b.saving).toFixed(0)} TND
                    </Text>
                  </View>
                </View>
                <Btn label="Ajouter le pack" icon="🛒" bg={b.badgeColor} size="lg"
                  onPress={() => {
                    addToCart({ id: b.id * 100, name: b.name, img: b.emoji, imageUrl: b.imageUrl, price: b.price, unit: 'pack' }, 1);
                    showToast('Pack ajouté ! 🎁');
                  }} />
              </View>
            </View>
          ))}
        </View>

        {/* Popular products */}
        <View style={{ paddingHorizontal: r.px, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.text }}>Produits populaires</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Catalogue')} activeOpacity={0.7}>
              <Text style={{ color: T.primary, fontWeight: '700', fontSize: 13 }}>Voir tout ›</Text>
            </TouchableOpacity>
          </View>
          {products.slice(0, 4).map(p => (
            <ProdCard key={p.id} p={p}
              onPress={() => navigation.navigate('Product', { product: p })} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
