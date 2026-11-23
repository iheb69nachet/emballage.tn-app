import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  StyleSheet, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/theme';
import { notifications as notifApi } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { openNotification } from '../services/navigation';

/** Icon shown next to a notification, based on what it points at. */
const ICONS = {
  quote: '📋',
  admin_quote: '📋',
  order: '🚚',
  admin_order: '🛒',
  fidelity: '🎁',
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await notifApi.list();
      setItems(data || []);
      await notifApi.markAllRead();
    } catch (_) {}
    setLoading(false);
  }, []);

  const load = async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  };

  usePolling(fetch, 30000);

  /** Tapping a notification marks it read and opens the screen it points at. */
  const open = useCallback((item) => {
    if (!item?.data?.type || item.data.type === 'generic') return;
    if (!item.isRead) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      notifApi.markRead(item.id).catch(() => {});
    }
    openNotification(item.data);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : { paddingVertical: 8 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔕</Text>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptySubtitle}>Vous n'avez pas encore reçu de notification.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const target = item.data?.type;
          const openable = !!target && target !== 'generic';
          return (
            <TouchableOpacity
              activeOpacity={openable ? 0.6 : 1}
              disabled={!openable}
              onPress={() => open(item)}
              style={[styles.item, !item.isRead && styles.itemUnread]}
            >
              {!item.isRead && <View style={styles.dot} />}
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>
                  {ICONS[target] ? `${ICONS[target]}  ` : ''}{item.title}
                </Text>
                <Text style={styles.itemBody}>{item.body}</Text>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemDate}>
                    {new Date(item.createdAt).toLocaleDateString('fr-TN', {
                      day: 'numeric', month: 'long',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  {openable && (
                    <Text style={styles.itemLink}>
                      {item.data?.reference ? `${item.data.reference} · ` : ''}Ouvrir ›
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 20 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
  },
  itemUnread: { backgroundColor: T.primary + '06' },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: T.primary,
    marginTop: 6, marginRight: 12, flexShrink: 0,
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: T.text, marginBottom: 4 },
  itemBody: { fontSize: 14, color: T.muted, lineHeight: 21, marginBottom: 6 },
  itemDate: { fontSize: 11, color: '#9CA3AF' },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemLink: { fontSize: 11, color: T.primary, fontWeight: '800' },
});
