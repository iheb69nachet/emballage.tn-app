import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/theme';
import { fidelity as fidelityApi } from '../services/api';
import { usePolling } from '../hooks/usePolling';

const TIER_THRESHOLDS = [
  { min: 500, label: 'Gold', color: '#D97706', bg: '#FEF3C7', icon: '🥇' },
  { min: 200, label: 'Silver', color: '#6B7280', bg: '#F3F4F6', icon: '🥈' },
  { min: 0,   label: 'Bronze', color: '#92400E', bg: '#FEF3C7', icon: '🥉' },
];

function getTier(balance) {
  return TIER_THRESHOLDS.find(t => balance >= t.min) || TIER_THRESHOLDS[2];
}

function FidelityCard({ balance }) {
  const tier = getTier(balance);
  const nextTier = TIER_THRESHOLDS.find(t => t.min > balance);
  const progress = nextTier
    ? Math.min((balance / nextTier.min) * 100, 100)
    : 100;

  return (
    <View style={styles.card}>
      {/* Card background decorations */}
      <View style={styles.cardCircle1} />
      <View style={styles.cardCircle2} />

      {/* Top row */}
      <View style={styles.cardTop}>
        <Text style={styles.cardBrand}>emballage.tn</Text>
        <View style={styles.tierBadge}>
          <Text style={styles.tierIcon}>{tier.icon}</Text>
          <Text style={styles.tierLabel}>{tier.label}</Text>
        </View>
      </View>

      {/* Coin display */}
      <View style={styles.coinRow}>
        <View style={styles.coin}>
          <Text style={styles.coinSymbol}>⭐</Text>
        </View>
        <View>
          <Text style={styles.pointsValue}>{balance.toLocaleString('fr-TN')}</Text>
          <Text style={styles.pointsLabel}>points de fidélité</Text>
        </View>
      </View>

      {/* Progress to next tier */}
      {nextTier && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {nextTier.min - balance} pts pour atteindre {nextTier.label}
            </Text>
            <Text style={styles.progressText}>{nextTier.icon}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}
    </View>
  );
}

function TransactionItem({ item }) {
  const isPositive = item.points > 0;
  return (
    <View style={styles.txItem}>
      <View style={[styles.txIcon, { backgroundColor: isPositive ? '#ECFDF5' : '#FEF2F2' }]}>
        <Text style={{ fontSize: 18 }}>{isPositive ? '⭐' : '➖'}</Text>
      </View>
      <View style={styles.txContent}>
        <Text style={styles.txReason}>{item.reason || (isPositive ? 'Points gagnés' : 'Points déduits')}</Text>
        <Text style={styles.txDate}>
          {new Date(item.createdAt).toLocaleDateString('fr-TN', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </Text>
      </View>
      <Text style={[styles.txPoints, { color: isPositive ? T.success : '#EF4444' }]}>
        {isPositive ? '+' : ''}{item.points} pts
      </Text>
    </View>
  );
}

export default function FidelityScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await fidelityApi.getMe();
      setData(result);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  };

  usePolling(load, 30000);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const balance = data?.balance ?? 0;
  const history = data?.history ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.primary} />
      }
    >
      {/* Credit card */}
      <View style={styles.cardWrapper}>
        <FidelityCard balance={balance} />
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comment ça marche ?</Text>
        <View style={styles.rulesRow}>
          {[
            { icon: '🛒', text: '1 pt par TND dépensé' },
            { icon: '🎁', text: 'Récompenses exclusives' },
            { icon: '📈', text: 'Montez de niveau' },
          ].map(r => (
            <View key={r.text} style={styles.ruleCard}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>{r.icon}</Text>
              <Text style={styles.ruleText}>{r.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Transaction history */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historique</Text>
        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📭</Text>
            <Text style={styles.emptyText}>
              Passez votre première commande pour gagner des points !
            </Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {history.map((item, i) => (
              <View key={item.id}>
                <TransactionItem item={item} />
                {i < history.length - 1 && <View style={styles.txSep} />}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },

  // Card
  cardWrapper: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  card: {
    backgroundColor: T.primary,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    minHeight: 200,
  },
  cardCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40,
  },
  cardCircle2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: 20,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  cardBrand: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  tierIcon: { fontSize: 14 },
  tierLabel: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  coin: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  coinSymbol: { fontSize: 26 },
  pointsValue: { color: '#FFF', fontSize: 36, fontWeight: '900', lineHeight: 42 },
  pointsLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },

  progressSection: { gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  progressBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: T.accent, borderRadius: 2 },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 14 },

  rulesRow: { flexDirection: 'row', gap: 10 },
  ruleCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: T.border,
  },
  ruleText: { fontSize: 11, fontWeight: '600', color: T.muted, textAlign: 'center', lineHeight: 16 },

  txList: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  txSep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 60 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txContent: { flex: 1 },
  txReason: { fontSize: 14, fontWeight: '600', color: T.text, marginBottom: 2 },
  txDate: { fontSize: 11, color: T.muted },
  txPoints: { fontSize: 15, fontWeight: '800' },

  emptyHistory: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: T.border,
  },
  emptyText: { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 20 },
});
