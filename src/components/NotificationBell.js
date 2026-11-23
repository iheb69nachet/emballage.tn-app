import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { notifications as notifApi } from '../services/api';
import { usePolling } from '../hooks/usePolling';

export default function NotificationBell({ isAuthenticated }) {
  const navigation = useNavigation();
  const [unread, setUnread] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await notifApi.unreadCount();
      setUnread(data?.count ?? 0);
    } catch (_) {}
  }, [isAuthenticated]);

  // Interval + AppState foreground-resume polling
  usePolling(fetchCount, 30000);

  // Also refresh when the user navigates back to any tab (screen focus)
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchCount);
    return unsub;
  }, [navigation, fetchCount]);

  if (!isAuthenticated) return null;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={styles.btn}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>🔔</Text>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { position: 'relative', padding: 4 },
  icon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
