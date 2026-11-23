import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
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

function Row({ label, value, strong }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: strong ? T.text : T.muted, fontWeight: strong ? '800' : '400' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, color: strong ? T.primary : T.text, fontWeight: strong ? '900' : '600' }}>
        {value}
      </Text>
    </View>
  );
}

/** The client's own factures — issued by the admin once the payment is validated. */
export default function FacturesScreen({ navigation }) {
  const r = useR();
  const { authToken } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [factures, setFactures] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const fetchFactures = useCallback(async () => {
    if (!authToken) { setLoading(false); setRefreshing(false); return; }
    try {
      const data = await api.invoices.list();
      setFactures(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [authToken]);

  usePolling(fetchFactures, 30000);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchFactures(); }, [fetchFactures]);

  if (!authToken) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: r.px, gap: 16, backgroundColor: T.bg }}>
        <View style={{
          width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '12',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Connectez-vous</Text>
        <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>
          Vos factures sont accessibles depuis votre compte.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const billed = factures.reduce((sum, f) => sum + (Number(f.total) || 0), 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={{ padding: r.px, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
    >
      {factures.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 80 }}>
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
            Vos factures apparaîtront ici dès qu'elles seront émises pour vos commandes.
          </Text>
        </View>
      ) : (
        <>
          <View style={{
            backgroundColor: T.primary, borderRadius: 16, padding: 16, marginBottom: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <View>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' }}>
                {factures.length} facture{factures.length > 1 ? 's' : ''}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF', marginTop: 2 }}>
                {fmt(billed)} <Text style={{ fontSize: 13 }}>TND</Text>
              </Text>
            </View>
            <Text style={{ fontSize: 34 }}>🧾</Text>
          </View>

          <View style={{ gap: 12 }}>
            {factures.map(f => {
              const open = expanded === f.id;
              const total = Number(f.total) || 0;
              const fee = Number(f.deliveryFee) || 0;
              const tax = Number(f.taxAmount) || 0;
              const taxRate = Number(f.taxRate) || 19;
              const stamp = Number(f.stampDuty) || 0;
              const subtotal = Number(f.subtotal) > 0 ? Number(f.subtotal) : total - fee - tax - stamp;
              return (
                <View key={f.id} style={{
                  backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
                  borderWidth: 1, borderColor: T.border,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
                }}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setExpanded(open ? null : f.id)}
                    style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 46, height: 46, borderRadius: 14, backgroundColor: T.primary + '12',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 22 }}>🧾</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: T.text }}>{f.invoiceNumber}</Text>
                      <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                        Commande #{f.orderNumber} · {fmtDate(f.createdAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: T.primary }}>
                        {fmt(total)} <Text style={{ fontSize: 11 }}>TND</Text>
                      </Text>
                      <Text style={{ fontSize: 16, color: T.muted, marginTop: 2 }}>{open ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>

                  {open && (
                    <View style={{ padding: 16, paddingTop: 4, backgroundColor: T.bg, gap: 10 }}>
                      <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border, gap: 6 }}>
                        <Row label="Sous-total HT" value={`${fmt(subtotal)} TND`} />
                        {tax > 0 && <Row label={`TVA (${taxRate}%)`} value={`${fmt(tax)} TND`} />}
                        {fee > 0 && <Row label="Frais supplémentaires" value={`+ ${fmt(fee)} TND`} />}
                        {stamp > 0 && <Row label="Droit de timbre" value={`+ ${fmt(stamp)} TND`} />}
                        <View style={{ height: 1, backgroundColor: T.border, marginVertical: 2 }} />
                        <Row label="Total TTC" value={`${fmt(total)} TND`} strong />
                      </View>

                      <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border, gap: 6 }}>
                        <Row label="Mode de paiement" value={f.paymentMethodLabel || f.paymentMethod || '—'} />
                        {f.settlementMode ? (
                          <Row
                            label="Mode de règlement"
                            value={SETTLEMENT_LABELS[f.settlementMode] ?? f.settlementMode}
                          />
                        ) : null}
                        <Row label="Statut commande" value={f.status} />
                        {f.invoiceSentAt ? (
                          <Row label="Reçue par e-mail" value={`le ${fmtDate(f.invoiceSentAt)}`} />
                        ) : null}
                      </View>

                      {f.invoiceNotes ? (
                        <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1, marginBottom: 4 }}>
                            NOTES
                          </Text>
                          <Text style={{ fontSize: 12, color: T.text, lineHeight: 18 }}>{f.invoiceNotes}</Text>
                        </View>
                      ) : null}

                      <TouchableOpacity onPress={() => openInvoice(f.id)} activeOpacity={0.85}
                        style={{ borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                          backgroundColor: T.primary }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>
                          🖨️  Voir / imprimer la facture
                        </Text>
                      </TouchableOpacity>

                      {f.items?.length ? (
                        <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1, marginBottom: 8 }}>
                            ARTICLES
                          </Text>
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
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
