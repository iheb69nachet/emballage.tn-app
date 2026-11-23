import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import Badge from '../components/Badge';
import { usePolling } from '../hooks/usePolling';

const fmt = (n) => n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const ORDER_STATUS_COLORS = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

const ORDER_STATUS_LABELS = {
  pending: 'En attente',
  processing: 'En cours',
  shipped: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

/** Colors keyed by the French label shown in the UI. */
const STATUS_LABEL_COLORS = Object.fromEntries(
  Object.entries(ORDER_STATUS_LABELS).map(([code, label]) => [label, ORDER_STATUS_COLORS[code]]),
);

function StatCard({ title, value, sub, icon, loading }) {
  return (
    <View style={{
      backgroundColor: '#FFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: T.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }}>{title}</Text>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      {loading ? (
        <View style={{ height: 32, width: 80, backgroundColor: T.muted + '30', borderRadius: 8 }} />
      ) : (
        <Text style={{ fontSize: 24, fontWeight: '800', color: T.text }}>{value}</Text>
      )}
      {sub && <Text style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</Text>}
    </View>
  );
}

export default function AdminDashboardScreen({ navigation }) {
  const r = useR();
  const { authToken, user } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    orders: [],
    products: [],
    users: [],
    quotes: [],
    fidelity: [],
    bundles: [],
    ads: [],
  });

  const fetchData = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const [orders, products, users, quotes, fidelity, bundles, ads] = await Promise.all([
        api.admin.orders.list().catch(() => []),
        api.admin.products.list().catch(() => []),
        api.admin.users.list().catch(() => []),
        api.admin.quotes.list().catch(() => []),
        api.admin.fidelity.list().catch(() => []),
        api.admin.bundles.list().catch(() => []),
        api.admin.ads.list().catch(() => []),
      ]);
      setData({ orders, products, users, quotes, fidelity, bundles, ads });
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [authToken]);

  usePolling(fetchData, 30000);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (!authToken ) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: r.px, gap: 16, backgroundColor: T.bg }}>
        <View style={{
          width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '12',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Accès administrateur</Text>
        <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>
          Cette section est réservée aux administrateurs
        </Text>
      </View>
    );
  }

  const { orders, products, users, quotes, fidelity, bundles, ads } = data;

  // Derived stats
  const totalRevenue = orders.filter(o => o.status === 'Livré').reduce((s, o) => s + (Number(o.total) || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'En cours').length;
  const toValidateOrders = orders.filter(o => o.paymentValidationRequired && !o.paymentValidatedAt).length;
  const invoicedCount = orders.filter(o => !!o.invoiceNumber).length;
  const activeProducts = products.filter(p => p.isActive).length;
  const totalPoints = fidelity.reduce((s, f) => s + (f.balance || 0), 0);
  const goldClients = fidelity.filter(f => f.balance >= 500).length;
  const activeAds = ads.filter(a => a.isActive).length;
  const pendingQuotes = quotes.filter(q => q.status === 'En attente').length;
  const offeredQuotes = quotes.filter(q => q.status === 'Prix proposé').length;

  // Recent orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
      >
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: T.text }}>Tableau de bord</Text>
          <Text style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Vue d'ensemble de toutes les activités</Text>
        </View>

        {/* KPI Row 1 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Chiffre d'affaires"
              value={`${fmt(totalRevenue)} TND`}
              sub="Commandes livrées uniquement"
              icon="📈"
              loading={loading}
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Commandes"
              value={orders.length}
              sub={`${pendingOrders} en attente / traitement`}
              icon="🛒"
              loading={loading}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Utilisateurs"
              value={users.length}
              sub={`${goldClients} clients Gold`}
              icon="👥"
              loading={loading}
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Produits actifs"
              value={activeProducts}
              sub={`sur ${products.length} produits au total`}
              icon="📦"
              loading={loading}
            />
          </View>
        </View>

        {/* KPI Row 2 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Devis en attente"
              value={pendingQuotes}
              sub={`${offeredQuotes} offre${offeredQuotes > 1 ? 's' : ''} envoyée${offeredQuotes > 1 ? 's' : ''} · ${quotes.length} au total`}
              icon="📋"
              loading={loading}
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Points fidélité"
              value={totalPoints.toLocaleString('fr-TN')}
              sub={`${fidelity.length} clients inscrits`}
              icon="⭐"
              loading={loading}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Packs"
              value={bundles.length}
              sub="Packs de produits"
              icon="📚"
              loading={loading}
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <StatCard
              title="Publicités actives"
              value={activeAds}
              sub={`sur ${ads.length} publicités au total`}
              icon="📢"
              loading={loading}
            />
          </View>
        </View>

        {/* Recent Orders */}
        <View style={{
          backgroundColor: '#FFF',
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: T.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
          marginBottom: 20,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 4 }}>Commandes récentes</Text>
          <Text style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Les 6 dernières commandes</Text>

          {recentOrders.length === 0 ? (
            <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center', paddingVertical: 20 }}>
              Aucune commande
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {recentOrders.map(o => {
                const statusLabel = ORDER_STATUS_LABELS[o.status] || o.status;
                const statusColor = ORDER_STATUS_COLORS[o.status] || '#94a3b8';
                return (
                  <View key={o.id} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: T.border,
                  }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>#{o.orderNumber}</Text>
                      {(o.clientName || o.user?.firstName || o.user?.lastName || o.user?.email) ? (
                        <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }} numberOfLines={1}>
                          👤 {o.clientName || [o.user?.firstName, o.user?.lastName].filter(Boolean).join(' ') || o.user?.email}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Badge status={o.status} />
                      </View>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: T.primary }}>
                      {fmt(Number(o.total) || 0)} TND
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Order Status Distribution */}
        <View style={{
          backgroundColor: '#FFF',
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: T.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
          marginBottom: 20,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 16 }}>Statuts des commandes</Text>

          {Object.entries(
            orders.reduce((acc, o) => {
              // Group by displayed label: legacy orders may still carry 'delivered' instead of 'Livré'
              const label = ORDER_STATUS_LABELS[o.status] || o.status;
              acc[label] = (acc[label] || 0) + 1;
              return acc;
            }, {})
          ).map(([label, count]) => {
            const status = label;
            const color = STATUS_LABEL_COLORS[label] || '#94a3b8';
            const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
            return (
              <View key={status} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: T.text }}>{label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>{count}</Text>
                </View>
                <View style={{ height: 8, backgroundColor: T.muted + '30', borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: 8, backgroundColor: color, borderRadius: 4, width: `${pct}%` }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Quick actions */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginBottom: 12 }}>Gestion</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminUsers')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 18,
              borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            }}
          >
            <Text style={{ fontSize: 32 }}>👥</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>Mes clients</Text>
            <Text style={{ fontSize: 12, color: T.muted }}>{users.length} membres</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminAds')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 18,
              borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            }}
          >
            <Text style={{ fontSize: 32 }}>📢</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>Publicités & Packs</Text>
            <Text style={{ fontSize: 12, color: T.muted }}>{activeAds} pub · {bundles.length} packs</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminProductForm')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 18,
              borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            }}
          >
            <Text style={{ fontSize: 32 }}>📷</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>Nouvel article</Text>
            <Text style={{ fontSize: 12, color: T.muted }}>avec photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminSettings')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 18,
              borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            }}
          >
            <Text style={{ fontSize: 32 }}>💳</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>Règlements</Text>
            <Text style={{ fontSize: 12, color: T.muted }}>livraison · frais</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminFactures')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 18,
              borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            }}
          >
            <Text style={{ fontSize: 32 }}>🧾</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>Factures</Text>
            <Text style={{ fontSize: 12, color: T.muted }}>{invoicedCount} créée{invoicedCount > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminCompany')}
            activeOpacity={0.8}
            style={{
              flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 18,
              borderWidth: 1, borderColor: T.border, alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
            }}
          >
            <Text style={{ fontSize: 32 }}>🏢</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>Société</Text>
            <Text style={{ fontSize: 12, color: T.muted }}>facture · timbre · retrait</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
