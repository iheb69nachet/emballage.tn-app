import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function CartHeaderButton() {
  const navigation = useNavigation();
  const { cartCount } = useApp();

  return (
    <TouchableOpacity onPress={() => navigation.navigate('Cart')} activeOpacity={0.75}
      style={{ backgroundColor: T.accent, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row',
        alignItems: 'center', gap: 6, marginRight: 4 }}>
      <Text style={{ fontWeight: '800', fontSize: 13, color: T.primary }}>🛒</Text>
      {cartCount > 0 && (
        <View style={{ backgroundColor: T.primary, borderRadius: 10,
          paddingHorizontal: 6, paddingVertical: 1 }}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{cartCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
