import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import Btn from '../components/Btn';

export default function CartScreen() {
  const navigation = useNavigation();
  const r = useR();
  const { cart, removeFromCart, updateQty, cartCount, cartTotal, openQuoteWithItems, authToken } = useApp();
  const goLogin = () => navigation.getParent('Root')?.navigate('Login');

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {cart.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: r.px }}>
          <View style={{
            width: 100, height: 100, borderRadius: 30, backgroundColor: T.primary + '12',
            alignItems: 'center', justifyContent: 'center', marginBottom: 8,
          }}>
            <Text style={{ fontSize: 52 }}>🛒</Text>
          </View>
          <Text style={{ fontWeight: '800', color: T.text, fontSize: 20 }}>Panier vide</Text>
          <Text style={{ color: T.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            Ajoutez des produits depuis le catalogue pour commencer votre commande.
          </Text>
          <View style={{ width: '100%', marginTop: 8 }}>
            <Btn label="Parcourir le catalogue" icon="📦"
              bg={T.primary} size="lg"
              onPress={() => navigation.navigate('Main', { screen: 'Catalogue' })} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 12, color: T.muted, marginBottom: 14, fontWeight: '600' }}>
            {cartCount} article{cartCount > 1 ? 's' : ''} dans votre panier
          </Text>

          {cart.map(item => (
            <View key={item.id} style={{
              backgroundColor: '#FFF', borderRadius: 18,
              padding: 14, marginBottom: 10, overflow: 'hidden',
              borderWidth: 1, borderColor: T.border,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 6,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {/* Thumbnail */}
                <View style={{
                  width: 60, height: 60, borderRadius: 14,
                  backgroundColor: T.bg, alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden',
                  borderWidth: 1, borderColor: T.border,
                }}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 60 }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{item.img ?? item.emoji ?? '📦'}</Text>
                  )}
                </View>

                {/* Name + price */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: T.text }}
                    numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                    {Number(item.price).toFixed(3)} TND/{item.unit || 'pièce'}
                  </Text>
                </View>

                {/* Line total */}
                <Text style={{ fontWeight: '800', fontSize: 15, color: T.primary }}>
                  {(item.qty * Number(item.price)).toFixed(3)}
                </Text>
              </View>

              {/* Qty controls + remove */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                  <TouchableOpacity
                    onPress={() => updateQty(item.id, -1)}
                    activeOpacity={0.7}
                    style={{
                      width: 34, height: 34, borderRadius: 10,
                      borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 18, color: T.primary, fontWeight: '700' }}>−</Text>
                  </TouchableOpacity>
                  <View style={{
                    paddingHorizontal: 16, height: 34, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontWeight: '800', fontSize: 15, color: T.text }}>{item.qty}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => updateQty(item.id, 1)}
                    activeOpacity={0.7}
                    style={{
                      width: 34, height: 34, borderRadius: 10,
                      backgroundColor: T.primary,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 18, color: '#FFF', fontWeight: '700' }}>+</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => removeFromCart(item.id)} activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: '#FFF0EE', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 7,
                  }}>
                  <Text style={{ fontSize: 12 }}>🗑</Text>
                  <Text style={{ color: T.danger, fontWeight: '700', fontSize: 12 }}>Retirer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Summary */}
          <View style={{
            backgroundColor: T.primary, borderRadius: 20, padding: 20, marginTop: 8,
            shadowColor: T.primary, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
          }}>
            {[['Sous-total HT', cartTotal], ['TVA (19%)', cartTotal * 0.19]].map(([l, v]) => (
              <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>{l}</Text>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                  {Number(v).toFixed(3)} TND
                </Text>
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', marginVertical: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Total TTC</Text>
              <Text style={{ color: T.accent, fontWeight: '900', fontSize: 26 }}>
                {(cartTotal * 1.19).toFixed(3)}
                <Text style={{ fontSize: 14, fontWeight: '700' }}> TND</Text>
              </Text>
            </View>
          </View>

          <View style={{ gap: 10, marginTop: 16 }}>
            <Btn label="Passer la commande" icon="✅" bg={T.accent} color={T.primary} size="lg"
              onPress={() => {
                if (!authToken) { goLogin(); return; }
                navigation.navigate('Checkout');
              }} />
            <Btn label="Convertir en devis" icon="📋"
              border={T.primary} color={T.primary} size="lg"
              onPress={() => authToken ? openQuoteWithItems(cart) : goLogin()} />
            <Btn label="Continuer mes achats" icon="←"
              border={T.border} color={T.muted}
              onPress={() => navigation.navigate('Main', { screen: 'Catalogue' })} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
