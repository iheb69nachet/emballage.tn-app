import React, { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput,
  Image, Modal, Dimensions, StatusBar, SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import Badge from '../components/Badge';
import Btn from '../components/Btn';

const { width: W, height: H } = Dimensions.get('window');

function getImageList(p) {
  const extra = p.images
    ? p.images.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  return [p.imageUrl, ...extra].filter(Boolean);
}

function Lightbox({ images, startIndex, onClose }) {
  const [active, setActive] = useState(startIndex);

  return (
    <Modal visible animationType='fade' transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle='light-content' backgroundColor='#000' />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Close */}
        <SafeAreaView style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
          <TouchableOpacity onPress={onClose}
            style={{ margin: 16, width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Full-size pager */}
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={startIndex}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
          onMomentumScrollEnd={e => {
            setActive(Math.round(e.nativeEvent.contentOffset.x / W));
          }}
          renderItem={({ item }) => (
            <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={{ uri: item }}
                style={{ width: W, height: H * 0.75 }}
                resizeMode='contain'
              />
            </View>
          )}
        />

        {/* Dot indicator */}
        {images.length > 1 && (
          <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0,
            flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {images.map((_, i) => (
              <View key={i} style={{
                width: i === active ? 20 : 6, height: 6, borderRadius: 3,
                backgroundColor: i === active ? '#FFF' : 'rgba(255,255,255,0.35)',
              }} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function ProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const r = useR();
  const { addToCart, openQuoteWithItems, authToken } = useApp();
  const p = route.params?.product;
  const min = Number(p?.minOrder ?? p?.min ?? 1);
  const price = Number(p?.price ?? 0);
  const [qty, setQty] = useState(min);
  // Text shown in the editable quantity field (kept apart so the user can clear it while typing)
  const [qtyText, setQtyText] = useState(String(min));
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const applyQty = (n) => {
    const v = Math.max(min, Math.floor(Number(n) || 0) || min);
    setQty(v);
    setQtyText(String(v));
  };
  const onQtyTyped = (v) => {
    const digits = v.replace(/[^0-9]/g, '');
    setQtyText(digits);
    const n = parseInt(digits, 10);
    if (Number.isFinite(n) && n >= min) setQty(n);
  };

  const openQuote = () => authToken
    ? openQuoteWithItems([{ ...p, qty }])
    : navigation.getParent('Root')?.navigate('Login');

  if (!p) return null;

  const imageList = getImageList(p);
  const hasImages = imageList.length > 0;
  const [mainImage, setMainImage] = useState(imageList[0] ?? null);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {lightboxIndex !== null && (
        <Lightbox
          images={imageList}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}>

        {/* Hero image */}
        <View style={{ backgroundColor: '#FFF', paddingTop: 32, paddingBottom: 16,
          alignItems: 'center', borderBottomWidth: 1, borderBottomColor: T.border }}>
          <TouchableOpacity
            activeOpacity={hasImages ? 0.8 : 1}
            onPress={() => {
              if (!hasImages) return;
              const idx = imageList.indexOf(mainImage);
              setLightboxIndex(idx >= 0 ? idx : 0);
            }}
            style={{ width: 180, height: 180, backgroundColor: T.bg, borderRadius: 24,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
            {mainImage ? (
              <>
                <Image source={{ uri: mainImage }} style={{ width: 180, height: 180 }} resizeMode='cover' />
                {hasImages && (
                  <View style={{ position: 'absolute', bottom: 8, right: 8,
                    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8,
                    paddingHorizontal: 6, paddingVertical: 3 }}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>🔍 Agrandir</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 80 }}>{p.img ?? p.emoji}</Text>
            )}
          </TouchableOpacity>

          {/* Thumbnail strip */}
          {imageList.length > 1 && (
            <FlatList
              horizontal
              data={imageList}
              keyExtractor={(_, i) => String(i)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
              style={{ marginBottom: 12 }}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setMainImage(item)}
                  style={{
                    width: 56, height: 56, borderRadius: 12, overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: mainImage === item ? T.primary : T.border,
                  }}>
                  <Image source={{ uri: item }} style={{ width: 56, height: 56 }} resizeMode='cover' />
                </TouchableOpacity>
              )}
            />
          )}

          <Badge status={p.stock} />
          {p.quantity != null && (
            <Text style={{ fontSize: 12, color: p.quantity > 0 ? T.muted : T.danger, marginTop: 6, fontWeight: '700' }}>
              {p.quantity > 0
                ? `${p.quantity} ${p.unit || 'unité'}${p.quantity > 1 ? 's' : ''} disponible${p.quantity > 1 ? 's' : ''}`
                : 'Épuisé'}
            </Text>
          )}
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
                onPress={() => applyQty(qty - min)}
                activeOpacity={0.7}
                style={{ width: 52, height: 52, borderRadius: 16,
                  borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg,
                  alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: T.primary }}>−</Text>
              </TouchableOpacity>
              <TextInput
                value={qtyText}
                onChangeText={onQtyTyped}
                onBlur={() => applyQty(qtyText)}
                onSubmitEditing={() => applyQty(qtyText)}
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
                maxLength={7}
                accessibilityLabel="Quantité"
                style={{ flex: 1, height: 52, borderRadius: 16,
                  borderWidth: 1.5, borderColor: T.primary, backgroundColor: T.primary + '08',
                  textAlign: 'center', fontWeight: '800', fontSize: 20, color: T.primary, paddingVertical: 0 }} />
              <TouchableOpacity
                onPress={() => applyQty(qty + min)}
                activeOpacity={0.7}
                style={{ width: 52, height: 52, borderRadius: 16,
                  borderWidth: 1.5, borderColor: T.primary, backgroundColor: T.primary,
                  alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: '#FFF' }}>+</Text>
              </TouchableOpacity>
            </View>

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

            <Btn label='Ajouter au panier' icon='🛒' bg={T.primary} size='lg'
              onPress={() => { addToCart(p, qty); navigation.goBack(); }} />
            <View style={{ height: 10 }} />
            <Btn label='Demander un devis' icon='📋'
              border={T.primary} color={T.primary} size='lg'
              onPress={openQuote} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
