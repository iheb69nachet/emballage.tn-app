import React from 'react';
import { View, Text } from 'react-native';
import { statusColor } from '../constants/theme';

export default function Badge({ status }) {
  const c = statusColor(status);
  return (
    <View style={{
      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
      backgroundColor: c + '18', alignSelf: 'flex-start',
      flexDirection: 'row', alignItems: 'center', gap: 5,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: c }}>{status}</Text>
    </View>
  );
}
