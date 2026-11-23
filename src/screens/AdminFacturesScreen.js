import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { openInvoice } from '../services/documents';
import { usePolling } from '../hooks/usePolling';

const fmt = (n) => Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR');

const SETTLEMENT_LABELS = {
  especes: 'Espèces',
  cheque: 'Chèque',
  traite: 'Traite',
  virement: 'Virement',
  carte_bancaire: 'Carte bancaire',
};

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'sent', label: '✓ Envoyées' },
  { key: 'unsent', label: 'Non envoyées' },
];

const clientOf = (f) =>
  f.clientName || [f.user?.firstName, f.user?.lastName].filter(Boolean).join(' ') || '—';

function Stat({ emoji, label, value }) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12,
      borderWidth: 1, borderColor: T.border, gap: 2,
    }}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={{ fontSize: 15, fontWeight: '900', color: T.text }} numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 11, color: T.muted }}>{label}</Text>
    </View>
  );
}

export default function AdminFacturesScreen({ navigation }) {
  const r = useR();
  const { authToken } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [factures, setFactures] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const fetchFactures = useCallback(async () => {
    if (!authToken) { setLoading(false); setRefreshing(false); return; }
    try {
      const data = await api.admin.orders.invoices();
      setFactures(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [authToken]);

  // Polling also refetches on focus: coming back from the orders screen after invoicing shows the new row
  usePolling(fetchFactures, 30000);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchFactures(); }, [fetchFactures]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const visible = factures.filter(f => {
    const matchesSearch = !q
      || f.invoiceNumber?.toLowerCase().includes(q)
      || f.orderNumber?.toLowerCase().includes(q)
      || clientOf(f).toLowerCase().includes(q)
      || f.user?.email?.toLowerCase().includes(q);
    const matchesFilter = filter === 'all'
      || (filter === 'sent' ? !!f.invoiceSentAt : !f.invoiceSentAt);
    return matchesSearch && matchesFilter;
  });

  const billed = factures.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
  const sent = factures.filter(f => f.invoiceSentAt).length;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Search */}
      <View style={{ paddingHorizontal: r.px, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        <TextInput
          placeholder="Rechercher par n° de facture, commande ou client..."
          placeholderTextColor={T.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 16,
            paddingVertical: 12, fontSize: 14, color: T.text, borderWidth: 1, borderColor: T.border,
          }}
        />
      </View>

      {/* Filters */}
      <View style={{ backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: r.px, paddingVertical: 12, gap: 8, alignItems: 'center' }}
          style={{ flexGrow: 0, flexShrink: 0 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} activeOpacity={0.7}
              style={{
                paddingHorizontal: 16, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 20,
                backgroundColor: filter === f.key ? T.primary : T.bg,
                borderWidth: 1, borderColor: filter === f.key ? T.primary : T.border,
              }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: filter === f.key ? '#FFF' : T.text }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {/* Totals */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Stat emoji="🧾" label="factures" value={String(factures.length)} />
          <Stat emoji="💰" label="TND facturés" value={fmt(billed)} />
          <Stat emoji="📧" label="envoyées" value={`${sent}/${factures.length}`} />
        </View>

        {visible.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <View style={{
              width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '10',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 44 }}>🧾</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 6 }}>
              Aucune facture
            </Text>
            <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 20 }}>
              {searchQuery || filter !== 'all'
                ? 'Aucun résultat pour votre recherche'
                : 'Créez une facture depuis une commande dont le paiement est validé.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {visible.map(f => {
              const open = expanded === f.id;
              return (
                <View key={f.id} style={{
                  backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
                  borderWidth: 1, borderColor: T.border,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
                }}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded(open ? null : f.id)}>
                    <View style={{
                      backgroundColor: T.primary + '08', paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: T.border,
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '900', fontSize: 15, color: T.primary }}>
                          🧾 {f.invoiceNumber}
                        </Text>
                        <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                          Commande #{f.orderNumber} · {fmtDate(f.createdAt)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: T.text }}>
                          {fmt(Number(f.total) || 0)} <Text style={{ fontSize: 11 }}>TND</Text>
                        </Text>
                        <Text style={{
                          fontSize: 10, fontWeight: '800', marginTop: 3,
                          color: f.invoiceSentAt ? T.success : T.muted,
                        }}>
                          {f.invoiceSentAt ? '✓ ENVOYÉE' : 'NON ENVOYÉE'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Text style={{ fontSize: 12, color: T.muted }}>Client</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: T.text, marginTop: 2 }}>
                        {clientOf(f)}
                      </Text>
                      {f.user?.email ? (
                        <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{f.user.email}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {open && (
                    <View style={{ padding: 16, backgroundColor: T.bg, gap: 6 }}>
                      {(() => {
                        const total = Number(f.total) || 0;
                        const fee = Number(f.deliveryFee) || 0;
                        const tax = Number(f.taxAmount) || 0;
                        const taxRate = Number(f.taxRate) || 19;
                        const stamp = Number(f.stampDuty) || 0;
                        const subtotal = Number(f.subtotal) > 0 ? Number(f.subtotal) : total - fee - tax - stamp;
                        const Row = ({ label, value, strong }) => (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: strong ? T.text : T.muted, fontWeight: strong ? '800' : '400' }}>{label}</Text>
                            <Text style={{ fontSize: 12, color: strong ? T.primary : T.text, fontWeight: strong ? '900' : '600' }}>{value}</Text>
                          </View>
                        );
                        return (
                          <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border, gap: 6 }}>
                            <Row label="Sous-total HT" value={`${fmt(subtotal)} TND`} />
                            {tax > 0 && <Row label={`TVA (${taxRate}%)`} value={`${fmt(tax)} TND`} />}
                            {fee > 0 && <Row label="Frais supplémentaires" value={`+ ${fmt(fee)} TND`} />}
                            {stamp > 0 && <Row label="Droit de timbre" value={`+ ${fmt(stamp)} TND`} />}
                            <View style={{ height: 1, backgroundColor: T.border, marginVertical: 2 }} />
                            <Row label="Total TTC" value={`${fmt(total)} TND`} strong />
                          </View>
                        );
                      })()}

                      <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border, gap: 6, marginTop: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: T.muted }}>Mode de paiement</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>
                            {f.paymentMethodLabel || f.paymentMethod || '—'}
                          </Text>
                        </View>
                        {f.settlementMode ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: T.muted }}>Mode de règlement</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: T.text, flexShrink: 1, textAlign: 'right' }}>
                              {SETTLEMENT_LABELS[f.settlementMode] ?? f.settlementMode}
                              {(f.settlementBank || f.settlementReference)
                                ? ` · ${[f.settlementBank, f.settlementReference].filter(Boolean).join(' n° ')}`
                                : ''}
                            </Text>
                          </View>
                        ) : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: T.muted }}>Envoi au client</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: f.invoiceSentAt ? T.success : T.muted }}>
                            {f.invoiceSentAt ? `✓ le ${fmtDate(f.invoiceSentAt)}` : 'non envoyée'}
                          </Text>
                        </View>
                        {f.invoiceNotes ? (
                          <Text style={{ fontSize: 12, color: T.muted, lineHeight: 18, marginTop: 2 }}>{f.invoiceNotes}</Text>
                        ) : null}
                      </View>

                      {f.items?.length ? (
                        <View style={{ marginTop: 10 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Articles</Text>
                          {f.items.map((item, i) => (
                            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ fontSize: 13, color: T.text, flex: 1 }} numberOfLines={1}>
                                {item.qty ?? item.quantity}x {item.name || item.productName}
                              </Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }}>
                                {fmt(Number(item.price) || 0)} TND
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <TouchableOpacity
                          onPress={() => openInvoice(f.id)}
                          activeOpacity={0.8}
                          style={{ flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
                            backgroundColor: T.primary, borderWidth: 1, borderColor: T.primary }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>
                            🖨️ Voir / imprimer
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('Main', { screen: 'AdminOrders', params: { orderId: f.id } })}
                          activeOpacity={0.8}
                          style={{ flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
                            backgroundColor: T.primary + '12', borderWidth: 1, borderColor: T.primary }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: T.primary }}>
                            ✏️ La commande
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={{ paddingVertical: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: T.border }}>
                    <Text style={{ fontSize: 12, color: T.primary, fontWeight: '700' }}>
                      {open ? '▲  Masquer' : '▼  Voir le détail'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
