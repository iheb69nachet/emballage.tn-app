import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, Linking, RefreshControl,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';
import { locateWithAddress, mapsUrl } from '../services/geo';
import { openQuote } from '../services/documents';
import { usePolling } from '../hooks/usePolling';

const TAX_RATE = 0.19;
const fmt = (n) => Number(n || 0).toFixed(3);

const STATUS_META = {
  'En attente':   { icon: '⏳', color: '#F59E0B', label: 'En attente' },
  'Prix proposé': { icon: '💰', color: '#10B981', label: 'Offre reçue' },
  'Accepté':      { icon: '✅', color: '#16A34A', label: 'Accepté' },
  'Refusé':       { icon: '❌', color: '#DC2626', label: 'Refusé' },
  'Expiré':       { icon: '📅', color: '#6B7280', label: 'Expiré' },
};

/** Reasons offered as one-tap chips before the free-text box. */
const DECLINE_REASONS = [
  'Prix trop élevé',
  'Délai trop long',
  'Besoin annulé',
  "J'ai trouvé ailleurs",
  'Quantités à revoir',
];

function Section({ title, children, style }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.4, marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Card({ children, style }) {
  return (
    <View style={[{
      backgroundColor: '#FFF', borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: T.border,
    }, style]}>
      {children}
    </View>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <Text style={{ fontSize: 13, color: bold ? T.text : T.muted, fontWeight: bold ? '800' : '500' }}>{label}</Text>
      <Text style={{ fontSize: bold ? 15 : 13, color: color || T.text, fontWeight: bold ? '900' : '600' }}>{value}</Text>
    </View>
  );
}

export default function QuoteDetailScreen({ route, navigation }) {
  const r = useR();
  const { currentUser } = useApp();
  const quoteId = route.params?.quoteId ?? route.params?.quote?.id;

  const [quote, setQuote] = useState(route.params?.quote ?? null);
  const [loading, setLoading] = useState(!route.params?.quote);
  const [refreshing, setRefreshing] = useState(false);

  // Response UI
  const [mode, setMode] = useState(null);            // null | 'accept' | 'decline'
  const [methods, setMethods] = useState(null);      // null = loading
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [address, setAddress] = useState(currentUser?.address || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!quoteId) return;
    try {
      const data = await api.quotes.get(quoteId);
      if (data) setQuote(data);
    } catch (e) {
      if (!quote) setError(e?.message || 'Devis introuvable');
    }
    setLoading(false);
    setRefreshing(false);
  }, [quoteId]);

  usePolling(load, 30000);

  useEffect(() => {
    navigation.setOptions({ title: quote?.quoteNumber || 'Devis' });
  }, [quote?.quoteNumber]);

  // Payment methods are only needed once the client starts accepting
  useEffect(() => {
    if (mode !== 'accept' || methods !== null) return;
    api.settings.paymentMethods()
      .then(list => {
        const arr = Array.isArray(list) ? list : [];
        setMethods(arr);
        setPaymentMethod(prev => (arr.some(m => m.code === prev) ? prev : (arr[0]?.code ?? null)));
      })
      .catch(() => setMethods([]));
  }, [mode, methods]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const fillFromGps = async () => {
    setLocating(true); setError('');
    try {
      const { coords: c, address: place } = await locateWithAddress();
      setCoords(c);
      if (place) {
        if (place.street || place.full) setAddress(place.street || place.full);
        if (place.city) setCity(place.city);
      }
    } catch (e) {
      setError(e?.message || 'Impossible de récupérer la position.');
    } finally {
      setLocating(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: r.px, gap: 12, backgroundColor: T.bg }}>
        <Text style={{ fontSize: 40 }}>📋</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: T.text }}>Devis introuvable</Text>
        {error ? <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center' }}>{error}</Text> : null}
      </View>
    );
  }

  const meta = STATUS_META[quote.status] || { icon: '📋', color: T.muted, label: quote.status };
  const items = Array.isArray(quote.items) ? quote.items : [];
  // The admin can price the quote as a whole, or line by line
  const perItem = quote.pricingMode === 'items';
  const lineAmount = (it) =>
    it.lineTotal != null
      ? Number(it.lineTotal)
      : Number(it.price || 0) * Number(it.qty || 0);
  const total = Number(quote.total) || 0;
  const discount = Number(quote.discount) || 0;
  const finalHT = total * (1 - discount / 100);
  const expired = quote.validUntil && new Date(quote.validUntil).getTime() < Date.now();
  const canRespond = quote.status === 'Prix proposé' && !expired;
  const hasOffer = total > 0;

  const selected = (methods || []).find(m => m.code === paymentMethod) || null;
  const fee = Number(selected?.fee) || 0;
  const tax = finalHT * TAX_RATE;
  const grandTotal = finalHT + tax + fee;

  // ── Actions ────────────────────────────────────────────────
  const submitAccept = () => {
    if (!selected) { setError('Choisissez un mode de règlement.'); return; }
    if (!address.trim()) { setError('Indiquez une adresse de livraison.'); return; }
    setError('');
    showAlert(
      'Accepter cette offre ?',
      `Une commande de ${fmt(grandTotal)} TND TTC sera créée et réglée par « ${selected.name} ».`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            setSubmitting(true);
            try {
              const full = `${address.trim()}${city.trim() ? ', ' + city.trim() : ''}`;
              const res = await api.quotes.accept(quote.id, {
                paymentMethod: selected.code,
                address: full,
                ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
              });
              setQuote(res?.quote ?? { ...quote, status: 'Accepté' });
              setMode(null);
              if (selected.type === 'online' && selected.url) {
                Linking.openURL(selected.url).catch(() => {});
              }
              showAlert(
                'Devis accepté ✅',
                `Votre commande ${res?.order?.orderNumber ?? ''} a été créée.`,
                [
                  { text: 'Voir mes commandes', onPress: () => navigation.navigate('Main', { screen: 'Orders' }) },
                  { text: 'Fermer', style: 'cancel' },
                ],
              );
            } catch (e) {
              setError(e.message || "Impossible d'accepter l'offre");
            }
            setSubmitting(false);
          },
        },
      ],
    );
  };

  const submitDecline = () => {
    const text = reason.trim();
    if (!text) { setError('Indiquez le motif du refus.'); return; }
    setError('');
    showAlert(
      'Refuser cette offre ?',
      'Nos équipes seront informées de votre refus et du motif indiqué.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser', style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const updated = await api.quotes.decline(quote.id, text);
              setQuote(updated ?? { ...quote, status: 'Refusé', declineReason: text });
              setMode(null);
            } catch (e) {
              setError(e.message || 'Impossible de refuser l’offre');
            }
            setSubmitting(false);
          },
        },
      ],
    );
  };

  const inputStyle = {
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: T.text, borderWidth: 1.5, borderColor: T.border,
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: r.px, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF',
          borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 16,
        }}>
          <View style={{
            width: 46, height: 46, borderRadius: 14, backgroundColor: meta.color + '18',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: T.text }}>{quote.quoteNumber}</Text>
            <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              Demandé le {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
            backgroundColor: meta.color + '18', borderWidth: 1, borderColor: meta.color,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: meta.color }}>{meta.label}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => openQuote(quote.id)}
          activeOpacity={0.8}
          style={{
            marginBottom: 16, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
            backgroundColor: T.primary + '10', borderWidth: 1.5, borderColor: T.primary,
          }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: T.primary }}>
            🖨️  Voir / imprimer le devis
          </Text>
        </TouchableOpacity>

        {/* Validity */}
        {quote.validUntil && quote.status !== 'Accepté' && quote.status !== 'Refusé' && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
            backgroundColor: expired ? '#FEF2F2' : '#FFF8E1', borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 10,
            borderWidth: 1, borderColor: expired ? '#FECACA' : '#FDE68A',
          }}>
            <Text style={{ fontSize: 14 }}>{expired ? '⚠️' : '⏳'}</Text>
            <Text style={{ fontSize: 12, color: expired ? '#DC2626' : '#92400E', fontWeight: '700', flex: 1 }}>
              {expired
                ? `Offre expirée le ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}`
                : `Valable jusqu'au ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}`}
            </Text>
          </View>
        )}

        {/* Items */}
        <Section title={perItem ? `DÉTAIL PAR ARTICLE (${items.length})` : `ARTICLES DEMANDÉS (${items.length})`}>
          {items.length === 0 ? (
            <Card><Text style={{ fontSize: 13, color: T.muted }}>Aucun article listé — voir le besoin décrit ci-dessous.</Text></Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {items.map((it, i) => {
                const priced = it.price != null && Number(it.price) > 0;
                const lineDiscount = Number(it.discount) || 0;
                return (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, paddingVertical: 11,
                    borderTopWidth: i ? 1 : 0, borderTopColor: T.border,
                  }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }} numberOfLines={2}>{it.name}</Text>
                      <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                        {Number(it.qty)} {it.unit || 'pièce'}
                        {priced ? ` · ${fmt(it.price)} TND / ${it.unit || 'pièce'}` : ''}
                      </Text>
                      {lineDiscount > 0 && (
                        <Text style={{ fontSize: 11, color: '#10B981', marginTop: 2, fontWeight: '700' }}>
                          Remise {lineDiscount}% sur cette ligne
                        </Text>
                      )}
                    </View>
                    {priced && (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>
                        {fmt(lineAmount(it))}
                      </Text>
                    )}
                  </View>
                );
              })}
              {perItem && (
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderTopWidth: 1, borderTopColor: T.border, backgroundColor: '#F9FAFB',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: T.text }}>Total des articles (HT)</Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: T.primary }}>{fmt(total)} TND</Text>
                </View>
              )}
            </Card>
          )}
        </Section>

        {/* Note the admin attached to the offer */}
        {quote.offerMessage ? (
          <Section title="MESSAGE DE NOS ÉQUIPES">
            <Card style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
              <Text style={{ fontSize: 13, color: '#92400E', lineHeight: 20 }}>{quote.offerMessage}</Text>
            </Card>
          </Section>
        ) : null}

        {/* Needs */}
        {quote.needs ? (
          <Section title="BESOIN EXPRIMÉ">
            <Card><Text style={{ fontSize: 13, color: T.text, lineHeight: 20 }}>{quote.needs}</Text></Card>
          </Section>
        ) : null}

        {/* Offer */}
        {hasOffer ? (
          <Section title="OFFRE DE PRIX">
            <Card style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
              <Row
                label={perItem ? 'Total des articles (HT)' : 'Prix proposé (HT)'}
                value={`${fmt(total)} TND`}
              />
              {discount > 0 && (
                <Row label={`Remise ${discount}%`} value={`− ${fmt(total * discount / 100)} TND`} color="#10B981" />
              )}
              <View style={{ height: 1, backgroundColor: '#BBF7D0', marginVertical: 8 }} />
              <Row label="Prix négocié (HT)" value={`${fmt(finalHT)} TND`} bold color="#166534" />
              <Text style={{ fontSize: 11, color: '#166534', marginTop: 6, lineHeight: 16 }}>
                TVA 19% et frais du mode de règlement s'ajoutent à ce montant lors de la commande.
              </Text>
            </Card>
          </Section>
        ) : (
          <Section title="OFFRE DE PRIX">
            <Card>
              <Text style={{ fontSize: 13, color: T.muted, lineHeight: 20 }}>
                Votre demande est en cours d'évaluation. Vous serez notifié dès qu'une offre sera disponible.
              </Text>
            </Card>
          </Section>
        )}

        {/* Outcome — already answered */}
        {quote.status === 'Accepté' && (
          <Card style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC', marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534', marginBottom: 4 }}>✅ Offre acceptée</Text>
            <Text style={{ fontSize: 12, color: '#166534', lineHeight: 18 }}>
              {quote.orderNumber
                ? `Commande ${quote.orderNumber} créée le ${new Date(quote.respondedAt || Date.now()).toLocaleDateString('fr-FR')}.`
                : 'Votre commande a été créée.'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Orders' })} activeOpacity={0.8}
              style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#166534', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>📦 Voir la commande</Text>
            </TouchableOpacity>
          </Card>
        )}
        {quote.status === 'Refusé' && (
          <Card style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#B91C1C', marginBottom: 4 }}>❌ Offre refusée</Text>
            {quote.declineReason ? (
              <Text style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 18 }}>Motif : {quote.declineReason}</Text>
            ) : null}
          </Card>
        )}

        {/* ── Respond ─────────────────────────────────────────── */}
        {canRespond && mode === null && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity onPress={() => { setMode('decline'); setError(''); }} activeOpacity={0.8}
              style={{
                flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center',
                borderWidth: 1.5, borderColor: T.danger, backgroundColor: T.danger + '0A',
              }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: T.danger }}>❌ Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMode('accept'); setError(''); }} activeOpacity={0.8}
              style={{
                flex: 1.4, paddingVertical: 15, borderRadius: 14, alignItems: 'center',
                backgroundColor: T.success,
                shadowColor: T.success, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
              }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>✅ Accepter et commander</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Accept flow */}
        {canRespond && mode === 'accept' && (
          <View>
            <Section title="MODE DE RÈGLEMENT">
              {methods === null && <ActivityIndicator color={T.primary} style={{ marginVertical: 12 }} />}
              {methods !== null && methods.length === 0 && (
                <Card><Text style={{ fontSize: 13, color: T.muted }}>Aucun mode de règlement disponible pour le moment.</Text></Card>
              )}
              {(methods || []).map(m => {
                const active = paymentMethod === m.code;
                return (
                  <TouchableOpacity key={m.id} onPress={() => setPaymentMethod(m.code)} activeOpacity={0.8}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      backgroundColor: active ? T.primary + '0D' : '#FFF', borderRadius: 14,
                      padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: active ? T.primary : T.border,
                    }}>
                    {m.imageUrl
                      ? <Image source={{ uri: m.imageUrl }} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: T.bg }} resizeMode="contain" />
                      : <Text style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{m.icon || '💳'}</Text>}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>{m.name}</Text>
                      <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                        {Number(m.fee) > 0 ? `+ ${fmt(m.fee)} TND de frais · ` : ''}
                        {m.type === 'online' ? 'paiement en ligne' : 'paiement hors ligne'}
                      </Text>
                    </View>
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                      borderColor: active ? T.primary : T.border, alignItems: 'center', justifyContent: 'center',
                    }}>
                      {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary }} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Section>

            <Section title="ADRESSE DE LIVRAISON">
              <TouchableOpacity onPress={fillFromGps} disabled={locating} activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
                  backgroundColor: coords ? T.success + '14' : T.primary + '10',
                  borderRadius: 12, paddingVertical: 12, borderWidth: 1.5,
                  borderColor: coords ? T.success : T.primary + '40', opacity: locating ? 0.7 : 1,
                }}>
                {locating
                  ? <ActivityIndicator size="small" color={T.primary} />
                  : <Text style={{ fontSize: 16 }}>{coords ? '✅' : '📡'}</Text>}
                <Text style={{ color: coords ? T.success : T.primary, fontWeight: '700', fontSize: 13 }}>
                  {locating ? 'Localisation en cours…' : coords ? 'Adresse remplie depuis le GPS' : "Remplir l'adresse depuis le GPS"}
                </Text>
              </TouchableOpacity>
              {coords && (
                <TouchableOpacity onPress={() => Linking.openURL(mapsUrl(coords.latitude, coords.longitude)).catch(() => {})}
                  style={{ marginBottom: 10 }} hitSlop={6}>
                  <Text style={{ fontSize: 11, color: T.info, fontWeight: '600' }}>
                    📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} · Ouvrir dans Maps
                  </Text>
                </TouchableOpacity>
              )}
              <TextInput style={[inputStyle, { minHeight: 64, textAlignVertical: 'top', marginBottom: 10 }]} multiline
                value={address} onChangeText={setAddress} placeholder="Adresse complète" placeholderTextColor={T.muted} />
              <TextInput style={inputStyle} value={city} onChangeText={setCity} placeholder="Ville" placeholderTextColor={T.muted} />
            </Section>

            <Section title="RÉCAPITULATIF DE LA COMMANDE">
              <Card style={{ backgroundColor: T.primary, borderColor: T.primary }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Prix négocié (HT)</Text>
                  <Text style={{ fontSize: 13, color: '#FFF', fontWeight: '700' }}>{fmt(finalHT)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>TVA (19%)</Text>
                  <Text style={{ fontSize: 13, color: '#FFF', fontWeight: '700' }}>{fmt(tax)}</Text>
                </View>
                {fee > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                      Frais {selected?.name ? `(${selected.name})` : ''}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#FFF', fontWeight: '700' }}>{fmt(fee)}</Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>Total TTC</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: T.accent }}>
                    {fmt(grandTotal)} <Text style={{ fontSize: 13, fontWeight: '700' }}>TND</Text>
                  </Text>
                </View>
              </Card>
            </Section>

            {error ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                <Text style={{ color: '#DC2626', fontSize: 13 }}>⚠️ {error}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={submitAccept} disabled={submitting || !selected} activeOpacity={0.8}
              style={{
                backgroundColor: T.success, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
                opacity: submitting || !selected ? 0.6 : 1,
              }}>
              {submitting ? <ActivityIndicator color="#FFF" />
                : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>✅ Confirmer la commande</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMode(null); setError(''); }} disabled={submitting} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: T.muted, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Decline flow */}
        {canRespond && mode === 'decline' && (
          <View>
            <Section title="MOTIF DU REFUS">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {DECLINE_REASONS.map(rsn => {
                  const active = reason.trim() === rsn;
                  return (
                    <TouchableOpacity key={rsn} onPress={() => setReason(rsn)} activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1,
                        backgroundColor: active ? T.danger : '#FFF', borderColor: active ? T.danger : T.border,
                      }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#FFF' : T.text }}>{rsn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput style={[inputStyle, { minHeight: 96, textAlignVertical: 'top' }]} multiline
                value={reason} onChangeText={setReason}
                placeholder="Expliquez pourquoi cette offre ne convient pas…" placeholderTextColor={T.muted} />
              <Text style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 16 }}>
                Nos équipes reçoivent ce motif et peuvent vous proposer une nouvelle offre.
              </Text>
            </Section>

            {error ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                <Text style={{ color: '#DC2626', fontSize: 13 }}>⚠️ {error}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={submitDecline} disabled={submitting || !reason.trim()} activeOpacity={0.8}
              style={{
                backgroundColor: T.danger, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
                opacity: submitting || !reason.trim() ? 0.6 : 1,
              }}>
              {submitting ? <ActivityIndicator color="#FFF" />
                : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>❌ Confirmer le refus</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMode(null); setError(''); }} disabled={submitting} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: T.muted, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contact block */}
        <Section title="COORDONNÉES" style={{ marginTop: 12 }}>
          <Card>
            <Row label="Contact" value={quote.contactName || '—'} />
            <Row label="E-mail" value={quote.contactEmail || '—'} />
            {quote.contactPhone ? <Row label="Téléphone" value={quote.contactPhone} /> : null}
          </Card>
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
