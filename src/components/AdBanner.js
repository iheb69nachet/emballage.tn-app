import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useR } from '../hooks/useR';
import * as api from '../services/api';

export default function AdBanner() {
  const r = useR();
  const [ads, setAds] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api.ads.list().then(setAds);
  }, []);

  useEffect(() => {
    if (ads.length === 0) return;
    const t = setInterval(() => setIdx(i => (i + 1) % ads.length), 3800);
    return () => clearInterval(t);
  }, [ads.length]);

  if (ads.length === 0) return null;

  const ad = ads[idx];

  return (
    <View style={{ marginHorizontal: r.px, marginTop: 16, borderRadius: 20,
      padding: 20, minHeight: 120, backgroundColor: ad.backgroundColor,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15, shadowRadius: 10 }}>
      <View style={{ borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3,
        alignSelf: 'flex-start', marginBottom: 8,
        borderColor: ad.accentColor + '80', backgroundColor: ad.accentColor + '30' }}>
        <Text style={{ color: ad.accentColor, fontSize: 11, fontWeight: '700' }}>{ad.tag}</Text>
      </View>
      <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>{ad.title}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 14 }}>{ad.subtitle}</Text>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {ads.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => setIdx(i)}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}>
            <View style={{ width: i === idx ? 20 : 6, height: 5, borderRadius: 3,
              backgroundColor: i === idx ? ad.accentColor : 'rgba(255,255,255,0.35)' }} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
