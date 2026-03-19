import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import Badge from '../components/Badge';
import Btn from '../components/Btn';

export default function ProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const r = useR();
  const { addToCart, openQuoteWithItems, authToken } = useApp();
  const openQuote = () => authToken
    ? openQuoteWithItems([{ ...p, qty }])
    : navigation.getParent('Root')?.navigate('Login');
  const p = route.params?.product;
  const min = Number(p?.minOrder ?? p?.min ?? 1);
  const price = Number(p?.price ?? 0);
  const [qty, setQty] = useState(min);

  if (!p) return null;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}>
        {/* Product image hero */}
        <View style={{ backgroundColor: '#FFF', padding: 40, alignItems: 'center',
          borderBottomWidth: 1, borderBottomColor: T.border }}>
          <View style={{ width: 120, height: 120, backgroundColor: T.bg, borderRadius: 24,
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
            {p.imageUrl ? (
              <Image source={{ uri: p.imageUrl }} style={{ width: 120, height: 120 }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 70 }}>{p.img ?? p.emoji}</Text>
            )}
          </View>
          <Badge status={p.stock} />
          <Text style={{ fontSize: 11, color: T.muted, marginTop: 8, fontWeight: '600' }}>
            Réf: {p.ref}
          </Text>
        </View>

        <View style={{ padding: r.px, gap: 14 }}>
          {/* Info card */}
          <View style={{ backgroundColor: '#FFF', borderRadius: 18, padding: 18,
            borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: T.text, marginBottom: 4 }}>
              {p.name}
            </Text>
            <Text style={{ color: T.muted, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
              {p.desc ?? p.description}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: T.bg, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontSize: 10, color: T.muted, fontWeight: '700', marginBottom: 4 }}>
                  PRIX UNITAIRE
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: T.primary }}>
                  {price.toFixed(3)}
                </Text>
                <Text style={{ fontSize: 12, color: T.muted }}>TND/{p.unit}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: T.bg, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontSize: 10, color: T.muted, fontWeight: '700', marginBottom: 4 }}>
                  COMMANDE MIN.
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: T.primary }}>
                  {min}
                </Text>
                <Text style={{ fontSize: 12, color: T.muted }}>{p.unit}s</Text>
              </View>
            </View>
          </View>

          {/* Quantity selector */}
          <View style={{ backgroundColor: '#FFF', borderRadius: 18, padding: 18,
            borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: T.muted,
              letterSpacing: 1, marginBottom: 16 }}>QUANTITÉ</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setQty(q => Math.max(min, q - min))}
                activeOpacity={0.7}
                style={{ width: 52, height: 52, borderRadius: 16,
                  borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg,
                  alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: T.primary }}>−</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, height: 52, borderRadius: 16,
                borderWidth: 1.5, borderColor: T.primary,
                backgroundColor: T.primary + '08',
                alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '800', fontSize: 20, color: T.primary }}>{qty}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setQty(q => q + min)}
                activeOpacity={0.7}
                style={{ width: 52, height: 52, borderRadius: 16,
                  borderWidth: 1.5, borderColor: T.primary, backgroundColor: T.primary,
                  alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: '#FFF' }}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Price preview */}
            <View style={{ backgroundColor: T.accentL, borderRadius: 14, padding: 16,
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 11, color: '#8B6914', fontWeight: '600' }}>Total estimé HT</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: T.primary, marginTop: 2 }}>
                  {(price * qty).toFixed(3)} TND
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: '#8B6914', fontWeight: '600' }}>Avec TVA 19%</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.primary, marginTop: 2 }}>
                  {(price * qty * 1.19).toFixed(3)} TND
                </Text>
              </View>
            </View>

            <Btn label="Ajouter au panier" icon="🛒" bg={T.primary} size="lg"
              onPress={() => { addToCart(p, qty); navigation.goBack(); }} />
            <View style={{ height: 10 }} />
            <Btn label="Demander un devis" icon="📋"
              border={T.primary} color={T.primary} size="lg"
              onPress={openQuote} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
