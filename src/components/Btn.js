import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

export default function Btn({ label, onPress, bg, border, color, icon, size = 'md' }) {
  const py = size === 'lg' ? 17 : size === 'sm' ? 10 : 14;
  const fs = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;
  const shadow = bg && !border ? {
    shadowColor: bg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 6,
  } : {};
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[{
        borderRadius: 16, paddingVertical: py, paddingHorizontal: 20,
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8,
        backgroundColor: bg || 'transparent',
        borderWidth: border ? 2 : 0, borderColor: border || 'transparent',
      }, shadow]}>
      {icon && <Text style={{ fontSize: fs }}>{icon}</Text>}
      <Text style={{ color: color || '#FFF', fontWeight: '800', fontSize: fs }}>{label}</Text>
    </TouchableOpacity>
  );
}
