import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { T, statusColor } from '../constants/theme';

export default function ProdCard({ p, onPress }) {
  const stockColor = statusColor(p.stock);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={{
        backgroundColor: '#FFF', borderRadius: 18, marginBottom: 10,
        flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
        borderWidth: 1, borderColor: T.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
      }}>
      {/* Left accent */}
      <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: stockColor + '60' }} />

      {/* Thumbnail */}
      <View style={{
        width: 72, height: 72, margin: 14, borderRadius: 16,
        backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', borderWidth: 1, borderColor: T.border,
      }}>
        {p.imageUrl ? (
          <Image source={{ uri: p.imageUrl }} style={{ width: 72, height: 72 }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 34 }}>{p.img ?? p.emoji}</Text>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, paddingRight: 14 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.text, marginBottom: 2 }}
          numberOfLines={1}>{p.name}</Text>
        <Text style={{ fontSize: 11, color: T.muted }}>Réf: {p.ref}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'center', marginTop: 8 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.primary }}>
              {Number(p.price).toFixed(3)}
              <Text style={{ fontSize: 11, fontWeight: '600', color: T.muted }}> TND/{p.unit}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: stockColor + '18', borderRadius: 20,
            paddingHorizontal: 8, paddingVertical: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: stockColor }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: stockColor }}>{p.stock}</Text>
          </View>
        </View>
      </View>

      {/* Chevron */}
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: T.primary + '10',
        alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Text style={{ color: T.primary, fontSize: 14, fontWeight: '700' }}>›</Text>
      </View>
    </TouchableOpacity>
  );
}
