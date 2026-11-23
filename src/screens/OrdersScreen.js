import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import Badge from '../components/Badge';
import { usePolling } from '../hooks/usePolling';

const LEGACY_PAYMENT = {
  a_la_livraison: { icon: '🚚', name: 'Paiement à la livraison' },
  virement:       { icon: '🏦', name: 'Virement bancaire' },
  especes:        { icon: '💵', name: 'Espèces' },
};
const paymentLabel = (o) => {
  const legacy = LEGACY_PAYMENT[o.paymentMethod];
  return `${legacy?.icon ?? '💳'} ${o.paymentMethodLabel || legacy?.name || o.paymentMethod || '—'}`;
};

const fmt = (n) => Number(n || 0).toFixed(3);

/** Amount lines of an order: HT, VAT and any extra fee charged by the payment method. */
function amountLines(o) {
  const total = Number(o.total) || 0;
  const fee = Number(o.deliveryFee) || 0;
  const tax = Number(o.taxAmount) || 0;
  const stamp = Number(o.stampDuty) || 0;
  // Orders placed before VAT tracking store subtotal = 0 → derive it
  const subtotal = Number(o.subtotal) > 0 ? Number(o.subtotal) : total - fee - tax - stamp;
  return { total, fee, tax, stamp, subtotal, taxRate: Number(o.taxRate) || 19 };
}

const STEPS = [
  { icon: '✅', label: 'Confirmée',      sub: (o) => 'Reçue le ' + new Date(o.createdAt).toLocaleDateString('fr-FR'), active: (o) => ['En cours','En transit','Livré'].includes(o.status) },
  { icon: '📦', label: 'En préparation', sub: () => 'Prise en charge',       active: (o) => ['En cours','En transit','Livré'].includes(o.status) },
  { icon: '🚚', label: 'Expédiée',       sub: () => 'En route',              active: (o) => ['En transit','Livré'].includes(o.status) },
  { icon: '🏠', label: 'Livrée',         sub: () => 'Remis au destinataire', active: (o) => o.status === 'Livré' },
];

export default function OrdersScreen() {
  const navigation = useNavigation();
  const r = useR();
  const { authToken } = useApp();
  const [orders, setOrders] = useState([]);
  const [openOrder, setOpenOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const data = await api.orders.list();
      setOrders(data || []);
    } catch (_) {}
    setLoading(false);
  }, [authToken]);

  usePolling(fetchOrders, 30000);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={T.primary} />
    </View>;
  }

  if (!authToken) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: r.px, gap: 16 }}>
        <View style={{
          width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '12',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Accès restreint</Text>
        <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>
          Connectez-vous pour voir et suivre vos commandes
        </Text>
        <TouchableOpacity onPress={() => navigation.getParent('Root')?.navigate('Login')}
          activeOpacity={0.8}
          style={{
            backgroundColor: T.primary, borderRadius: 16,
            paddingHorizontal: 32, paddingVertical: 14,
            shadowColor: T.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
          }}>
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {orders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <View style={{
              width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '10',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 44 }}>🚚</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 6 }}>
              Aucune commande
            </Text>
            <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center' }}>
              Vos commandes apparaîtront ici
            </Text>
          </View>
        ) : null}

        {orders.map(o => (
          <View key={o.id} style={{
            backgroundColor: '#FFF', borderRadius: 20, marginBottom: 12,
            overflow: 'hidden', borderWidth: 1, borderColor: T.border,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06, shadowRadius: 8,
          }}>
            {/* Header strip */}
            <View style={{
              backgroundColor: T.primary + '08', paddingHorizontal: 18, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: T.border,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <View>
                <Text style={{ fontWeight: '800', fontSize: 14, color: T.text }}>{o.orderNumber}</Text>
                <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                  {new Date(o.createdAt).toLocaleDateString('fr-FR')} · {o.items?.length ?? 0} article{(o.items?.length ?? 0) > 1 ? 's' : ''}
                </Text>
              </View>
              <Badge status={o.status} />
            </View>

            {/* Amount */}
            <View style={{
              paddingHorizontal: 18, paddingVertical: 14,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 13, color: T.muted, fontWeight: '600' }}>Montant total TTC</Text>
                <Text style={{ fontSize: 12, color: T.text, marginTop: 3, fontWeight: '600' }}>
                  {paymentLabel(o)}
                </Text>
                <Text style={{ fontSize: 12, color: T.muted, marginTop: 2, fontWeight: '600' }}>
                  {o.deliveryMode === 'retrait' ? '🏪 Retrait en magasin' : '🚚 Livraison à domicile'}
                </Text>
                {o.quoteNumber ? (
                  <Text style={{ fontSize: 11, color: T.info, marginTop: 3, fontWeight: '700' }}>
                    📋 Issue du devis {o.quoteNumber}
                  </Text>
                ) : null}
                {o.paymentValidationRequired && !o.paymentValidatedAt && o.status !== 'Annulé' && (
                  <Text style={{ fontSize: 11, color: T.warning, marginTop: 3, fontWeight: '700' }}>⏳ En attente de validation par nos équipes</Text>
                )}
              </View>
              <Text style={{ fontWeight: '800', fontSize: 20, color: T.primary }}>
                {Number(o.total).toFixed(3)} <Text style={{ fontSize: 13 }}>TND</Text>
              </Text>
            </View>

            {/* Amount breakdown — the client sees exactly what was added on top */}
            {(() => {
              const a = amountLines(o);
              if (!(a.fee > 0 || a.tax > 0 || a.stamp > 0)) return null;
              return (
                <View style={{
                  marginHorizontal: 18, marginBottom: 14, padding: 12, borderRadius: 12,
                  backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontSize: 12, color: T.muted }}>Sous-total HT</Text>
                    <Text style={{ fontSize: 12, color: T.text, fontWeight: '600' }}>{fmt(a.subtotal)} TND</Text>
                  </View>
                  {a.tax > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 12, color: T.muted }}>TVA ({a.taxRate}%)</Text>
                      <Text style={{ fontSize: 12, color: T.text, fontWeight: '600' }}>{fmt(a.tax)} TND</Text>
                    </View>
                  )}
                  {a.fee > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 12, color: T.warning, fontWeight: '700' }}>
                        Frais supplémentaires{o.paymentMethodLabel ? ` (${o.paymentMethodLabel})` : ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: T.warning, fontWeight: '800' }}>+ {fmt(a.fee)} TND</Text>
                    </View>
                  )}
                  {a.stamp > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 12, color: T.muted }}>Droit de timbre</Text>
                      <Text style={{ fontSize: 12, color: T.text, fontWeight: '600' }}>{fmt(a.stamp)} TND</Text>
                    </View>
                  )}
                  <View style={{ height: 1, backgroundColor: T.border, marginVertical: 5 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: T.text, fontWeight: '800' }}>Total TTC</Text>
                    <Text style={{ fontSize: 13, color: T.primary, fontWeight: '900' }}>{fmt(a.total)} TND</Text>
                  </View>
                </View>
              );
            })()}

            {/* Tracking toggle */}
            <TouchableOpacity
              onPress={() => setOpenOrder(openOrder === o.id ? null : o.id)}
              activeOpacity={0.7}
              style={{
                paddingVertical: 10, alignItems: 'center',
                borderTopWidth: 1, borderTopColor: T.border,
                backgroundColor: openOrder === o.id ? T.primary + '06' : 'transparent',
              }}>
              <Text style={{ fontSize: 12, color: T.primary, fontWeight: '700' }}>
                {openOrder === o.id ? '▲  Masquer le détail' : '▼  Voir les articles et le suivi'}
              </Text>
            </TouchableOpacity>

            {/* Tracking steps */}
            {openOrder === o.id && (
              <View style={{ padding: 18, paddingTop: 14, backgroundColor: T.bg }}>
                {/* Articles — what the client actually ordered */}
                <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 8 }}>
                  ARTICLES ({o.items?.length ?? 0})
                </Text>
                <View style={{
                  backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: T.border,
                  overflow: 'hidden', marginBottom: 18,
                }}>
                  {(o.items ?? []).length === 0 ? (
                    <Text style={{ fontSize: 12, color: T.muted, padding: 12 }}>
                      Aucun article enregistré sur cette commande.
                    </Text>
                  ) : (o.items ?? []).map((it, i) => (
                    <View key={i} style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 12, paddingVertical: 10,
                      borderTopWidth: i ? 1 : 0, borderTopColor: T.border,
                    }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }} numberOfLines={2}>
                          {it.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                          {Number(it.qty)} {it.unit || 'pièce'}
                          {Number(it.price) > 0 ? ` × ${fmt(it.price)} TND` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: T.text }}>
                        {fmt(Number(it.price || 0) * Number(it.qty || 0))} TND
                      </Text>
                    </View>
                  ))}
                </View>

                {o.deliveryAddress ? (
                  <View style={{ marginBottom: 18 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 6 }}>
                      LIVRAISON
                    </Text>
                    <Text style={{ fontSize: 12, color: T.text, lineHeight: 18 }}>📍 {o.deliveryAddress}</Text>
                  </View>
                ) : null}

                <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 12 }}>
                  SUIVI
                </Text>
                {STEPS.map((step, i) => {
                  const done = step.active(o);
                  const isLast = i === STEPS.length - 1;
                  return (
                    <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
                      {/* Left: circle + line */}
                      <View style={{ alignItems: 'center', width: 38 }}>
                        <View style={{
                          width: 38, height: 38, borderRadius: 19,
                          backgroundColor: done ? T.primary : '#E5E7EB',
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: done ? 0 : 1.5, borderColor: '#D1D5DB',
                        }}>
                          {done
                            ? <Text style={{ fontSize: 16 }}>{step.icon}</Text>
                            : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#D1D5DB' }} />
                          }
                        </View>
                        {!isLast && (
                          <View style={{
                            width: 2, flex: 1, minHeight: 20,
                            backgroundColor: done ? T.primary + '40' : '#E5E7EB',
                            marginVertical: 3,
                          }} />
                        )}
                      </View>

                      {/* Right: text */}
                      <View style={{ flex: 1, paddingTop: 8, paddingBottom: isLast ? 0 : 16 }}>
                        <Text style={{
                          fontWeight: '700', fontSize: 13,
                          color: done ? T.text : T.muted,
                        }}>{step.label}</Text>
                        {done && (
                          <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                            {step.sub(o)}
                          </Text>
                        )}
                      </View>

                      {done && (
                        <View style={{ paddingTop: 10 }}>
                          <View style={{
                            width: 20, height: 20, borderRadius: 10,
                            backgroundColor: T.success + '20',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 11, color: T.success, fontWeight: '800' }}>✓</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
