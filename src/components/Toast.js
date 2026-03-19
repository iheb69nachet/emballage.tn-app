import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { T } from '../constants/theme';

export default function Toast() {
  const { toast, setToast } = useApp();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <View style={{
      position: 'absolute',
      bottom: insets.bottom + 86,
      alignSelf: 'center',
      backgroundColor: T.primary,
      borderRadius: 16,
      paddingHorizontal: 20, paddingVertical: 13,
      zIndex: 999, elevation: 16,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22, shadowRadius: 12,
      maxWidth: '85%',
    }}>
      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>{toast}</Text>
    </View>
  );
}
