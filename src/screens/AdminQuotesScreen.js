import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';
import { openQuote } from '../services/documents';
import { usePolling } from '../hooks/usePolling';

// Actual status values from the API
const STATUS_COLORS = {
  'En attente': '#f59e0b',
  'Prix proposé': '#3b82f6',
  'Accepté': '#16a34a',
  'Refusé': '#dc2626',
  'Expiré': '#94a3b8',
};

const STATUS_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'En attente', label: 'En attente' },
  { key: 'Prix proposé', label: 'Offre envoyée' },
  { key: 'Accepté', label: 'Acceptés' },
  { key: 'Refusé', label: 'Refusés' },
  { key: 'Expiré', label: 'Expiré' },
];

const fmt = (n) => Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: color + '18', borderWidth: 1, borderColor: color }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{status}</Text>
    </View>
  );
}

const round3 = (n) => Math.round(n * 1000) / 1000;
/** Line price once the per-line discount is applied. */
const lineTotal = (l) =>
  round3((Number(l.qty) || 0) * (parseFloat(l.price) || 0) * (1 - (parseFloat(l.discount) || 0) / 100));

const smallInput = {
  backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8,
  fontSize: 13, fontWeight: '700', color: T.text, borderWidth: 1, borderColor: T.border,
  textAlign: 'right',
};

function OfferForm({ quote, onSubmit, submitting }) {
  const quoteItems = Array.isArray(quote.items) ? quote.items : [];
  const [mode, setMode] = useState(
    quote.pricingMode === 'items' && quoteItems.length > 0 ? 'items' : 'global',
  );
  const [total, setTotal] = useState(quote.total ? String(quote.total) : '');
  const [discount, setDiscount] = useState(quote.discount ? String(quote.discount) : '0');
  const [message, setMessage] = useState(quote.offerMessage || '');
  const [lines, setLines] = useState(() =>
    quoteItems.map((i) => ({
      id: i.id ?? null,
      name: i.name,
      qty: Number(i.qty) || 0,
      unit: i.unit ?? null,
      price: i.price != null ? String(Number(i.price)) : '',
      discount: i.discount != null ? String(Number(i.discount)) : '0',
    })),
  );

  const setLine = (index, patch) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const itemsTotal = round3(lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const baseTotal = mode === 'items' ? itemsTotal : parseFloat(total) || 0;
  const finalPrice = round3(baseTotal * (1 - (parseFloat(discount) || 0) / 100));

  const handleSubmit = () => {
    if (mode === 'items') {
      if (!lines.length) {
        showAlert('Erreur', 'Ce devis ne contient aucun article à tarifer.');
        return;
      }
      if (lines.some((l) => l.price === '' || isNaN(parseFloat(l.price)))) {
        showAlert('Erreur', 'Saisissez un prix unitaire pour chaque article.');
        return;
      }
      if (!(itemsTotal > 0)) {
        showAlert('Erreur', 'Le total des articles doit être supérieur à zéro.');
        return;
      }
      onSubmit({
        mode: 'items',
        discount: parseFloat(discount) || 0,
        message: message.trim() || undefined,
        items: lines.map((l) => ({
          ...(l.id != null ? { id: Number(l.id) } : {}),
          name: l.name,
          qty: Number(l.qty) || 0,
          ...(l.unit ? { unit: l.unit } : {}),
          price: parseFloat(l.price) || 0,
          discount: parseFloat(l.discount) || 0,
        })),
      }, finalPrice);
      return;
    }

    const t = parseFloat(total);
    if (!t || t <= 0) {
      showAlert('Erreur', 'Veuillez saisir un montant valide.');
      return;
    }
    onSubmit({
      mode: 'global',
      total: t,
      discount: parseFloat(discount) || 0,
      message: message.trim() || undefined,
    }, finalPrice);
  };

  return (
    <View style={{ marginTop: 12, padding: 14, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6' + '40' }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: T.text, marginBottom: 12 }}>Proposer un prix</Text>

      {/* Pricing mode */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[
          { key: 'global', label: 'Prix global' },
          { key: 'items', label: 'Prix par article' },
        ].map((m) => {
          const active = mode === m.key;
          const disabled = m.key === 'items' && quoteItems.length === 0;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => !disabled && setMode(m.key)}
              activeOpacity={disabled ? 1 : 0.7}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                backgroundColor: active ? '#3b82f6' : '#FFF',
                borderWidth: 1, borderColor: active ? '#3b82f6' : T.border,
                opacity: disabled ? 0.45 : 1,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFF' : T.text }}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'global' ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: '600' }}>Montant total HT (TND)</Text>
          <TextInput
            value={total}
            onChangeText={setTotal}
            keyboardType="decimal-pad"
            placeholder="0.000"
            placeholderTextColor={T.muted}
            style={{
              backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12,
              paddingVertical: 10, fontSize: 15, fontWeight: '700', color: T.text,
              borderWidth: 1, borderColor: T.border,
            }}
          />
        </View>
      ) : (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: '600' }}>
            Prix unitaire HT et remise par article
          </Text>
          {lines.map((l, index) => (
            <View
              key={index}
              style={{
                backgroundColor: '#FFF', borderRadius: 10, padding: 10, marginBottom: 8,
                borderWidth: 1, borderColor: T.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, flex: 1, marginRight: 8 }} numberOfLines={2}>
                  {l.name}
                </Text>
                <Text style={{ fontSize: 11, color: T.muted }}>{l.qty} {l.unit || 'pièce'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1.4 }}>
                  <Text style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>P.U. HT</Text>
                  <TextInput
                    value={l.price}
                    onChangeText={(v) => setLine(index, { price: v })}
                    keyboardType="decimal-pad"
                    placeholder="0.000"
                    placeholderTextColor={T.muted}
                    style={smallInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Remise %</Text>
                  <TextInput
                    value={l.discount}
                    onChangeText={(v) => setLine(index, { discount: v })}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={T.muted}
                    style={smallInput}
                  />
                </View>
                <View style={{ flex: 1.2, paddingBottom: 10 }}>
                  <Text style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Total ligne</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: T.primary, textAlign: 'right' }}>
                    {fmt(lineTotal(l))}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>Total des articles</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: T.text }}>{fmt(itemsTotal)} TND</Text>
          </View>
        </View>
      )}

      <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: '600' }}>
          {mode === 'items' ? 'Remise globale supplémentaire (%)' : 'Remise (%)'}
        </Text>
        <TextInput
          value={discount}
          onChangeText={setDiscount}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={T.muted}
          style={{
            backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12,
            paddingVertical: 10, fontSize: 15, fontWeight: '700', color: T.text,
            borderWidth: 1, borderColor: T.border,
          }}
        />
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: '600' }}>Message au client (optionnel)</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Délai de livraison, conditions…"
          placeholderTextColor={T.muted}
          style={{
            backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12,
            paddingVertical: 10, fontSize: 13, color: T.text, minHeight: 64,
            textAlignVertical: 'top', borderWidth: 1, borderColor: T.border,
          }}
        />
      </View>

      {baseTotal > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 12, color: T.muted }}>Prix final client (HT)</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: T.primary }}>{fmt(finalPrice)} TND</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
        style={{
          backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 12,
          alignItems: 'center', opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>Envoyer l'offre au client</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function AdminQuotesScreen({ route }) {
  const r = useR();
  const { authToken } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedQuote, setExpandedQuote] = useState(null);
  const [showOfferForm, setShowOfferForm] = useState(null);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchQuotes = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const data = await api.admin.quotes.list();
      setQuotes(data || []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [authToken]);

  usePolling(fetchQuotes, 30000);

  // Opened from a notification: show that quote's details straight away
  const targetQuoteId = route?.params?.quoteId;
  useEffect(() => {
    if (targetQuoteId) {
      setExpandedQuote(targetQuoteId);
      setStatusFilter('all');
      setSearchQuery('');
    }
  }, [targetQuoteId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchQuotes();
  }, [fetchQuotes]);

  const handleOfferPrice = useCallback(async (quote, payload, finalPrice) => {
    showAlert(
      'Confirmer l\'offre',
      `Envoyer une offre de ${fmt(finalPrice)} TND au client pour le devis #${quote.quoteNumber || quote.id} ?` +
        (payload.mode === 'items' ? ` Le détail par article sera visible par le client.` : ''),
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            setSubmittingOffer(true);
            try {
              // The API recomputes the total in items mode — take its answer as truth
              const updated = await api.admin.quotes.offerPrice(quote.id, payload);
              setQuotes(prev => prev.map(q =>
                q.id === quote.id ? { ...q, ...(updated || { status: 'Prix proposé' }) } : q
              ));
              setShowOfferForm(null);
              showAlert('Offre envoyée', 'Le client a été notifié par email et notification push.');
            } catch (e) {
              showAlert('Erreur', e.message || 'Impossible d\'envoyer l\'offre');
            }
            setSubmittingOffer(false);
          },
        },
      ]
    );
  }, []);

  const handleMarkExpired = useCallback(async (quote) => {
    showAlert(
      'Marquer comme expiré',
      `Le devis #${quote.quoteNumber || quote.id} sera marqué comme expiré.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            setUpdatingId(quote.id);
            try {
              await api.admin.quotes.updateStatus(quote.id, 'Expiré');
              setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'Expiré' } : q));
            } catch (e) {
              showAlert('Erreur', e.message || 'Impossible de mettre à jour');
            }
            setUpdatingId(null);
          },
        },
      ]
    );
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  if (!authToken) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: r.px, gap: 16, backgroundColor: T.bg }}>
        <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Accès administrateur</Text>
        <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>Cette section est réservée aux administrateurs</Text>
      </View>
    );
  }

  const filteredQuotes = quotes
    .filter(q => {
      const matchesSearch = !searchQuery ||
        String(q.quoteNumber || q.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const pendingCount = quotes.filter(q => q.status === 'En attente').length;
  const offerCount = quotes.filter(q => q.status === 'Prix proposé').length;
  const acceptedCount = quotes.filter(q => q.status === 'Accepté').length;
  const refusedCount = quotes.filter(q => q.status === 'Refusé').length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        {/* Summary bar */}
        <View style={{ paddingHorizontal: r.px, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border, flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 13, color: T.muted }}>
            <Text style={{ fontWeight: '700', color: '#f59e0b' }}>{pendingCount}</Text> en attente ·{' '}
            <Text style={{ fontWeight: '700', color: '#3b82f6' }}>{offerCount}</Text> offre envoyée ·{' '}
            <Text style={{ fontWeight: '700', color: '#16a34a' }}>{acceptedCount}</Text> acceptés ·{' '}
            <Text style={{ fontWeight: '700', color: '#dc2626' }}>{refusedCount}</Text> refusés
          </Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: r.px, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
          <TextInput
            placeholder="Rechercher par numéro ou client..."
            placeholderTextColor={T.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 16,
              paddingVertical: 12, fontSize: 14, color: T.text, borderWidth: 1, borderColor: T.border,
            }}
          />
        </View>

        {/* Filters — plain View wrapper so the row keeps its full height next to the flex:1 list */}
        <View style={{ backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border, flexShrink: 0 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: r.px, paddingVertical: 12, gap: 8, alignItems: 'center' }}
            style={{ flexGrow: 0, flexShrink: 0 }}
          >
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setStatusFilter(f.key)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 16, height: 34, justifyContent: 'center', borderRadius: 20,
                  backgroundColor: statusFilter === f.key ? T.primary : T.bg,
                  borderWidth: 1, borderColor: statusFilter === f.key ? T.primary : T.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: statusFilter === f.key ? '#FFF' : T.text }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quotes list */}
        <ScrollView
          contentContainerStyle={{ padding: r.px, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        >
          {filteredQuotes.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 64 }}>
              <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 44 }}>📋</Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 6 }}>Aucun devis</Text>
              <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center' }}>
                {searchQuery || statusFilter !== 'all' ? 'Aucun résultat' : 'Les devis apparaîtront ici'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filteredQuotes.map(q => {
                const isExpanded = expandedQuote === q.id;
                const isShowingOffer = showOfferForm === q.id;
                const answered = q.status === 'Accepté' || q.status === 'Refusé';
                // A quote the client already answered is final — no new offer, no expiry
                const canOffer = !answered && (q.status === 'En attente' || q.status === 'Prix proposé');
                const canExpire = !answered && q.status !== 'Expiré';

                return (
                  <View key={q.id} style={{
                    backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
                    borderWidth: 1, borderColor: T.border,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
                  }}>
                    {/* Header */}
                    <View style={{
                      backgroundColor: T.primary + '08', paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: T.border,
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <View>
                        <Text style={{ fontWeight: '800', fontSize: 14, color: T.text }}>
                          #{q.quoteNumber || q.id}
                        </Text>
                        <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                          {new Date(q.createdAt).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                      <StatusBadge status={q.status} />
                    </View>

                    {/* Client */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border }}>
                      <Text style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Client</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }}>
                        {q.contactName || 'Inconnu'}
                      </Text>
                      {q.contactEmail && (
                        <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{q.contactEmail}</Text>
                      )}
                      {q.contactPhone && (
                        <Text style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>{q.contactPhone}</Text>
                      )}
                    </View>

                    {/* Price row */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 12, color: T.muted }}>
                          {q.items?.length ?? 0} article{(q.items?.length ?? 0) > 1 ? 's' : ''}
                        </Text>
                        {q.discount > 0 && (
                          <Text style={{ fontSize: 12, color: T.success, marginTop: 2 }}>Remise : {q.discount}%</Text>
                        )}
                      </View>
                      {q.total > 0 ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          {q.discount > 0 && (
                            <Text style={{ fontSize: 11, color: T.muted, textDecorationLine: 'line-through' }}>
                              {fmt(q.total)} TND
                            </Text>
                          )}
                          <Text style={{ fontWeight: '800', fontSize: 20, color: T.primary }}>
                            {fmt(q.total * (1 - (q.discount || 0) / 100))} <Text style={{ fontSize: 13 }}>TND</Text>
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 13, color: T.muted, fontStyle: 'italic' }}>Prix à définir</Text>
                      )}
                    </View>

                    {/* Client answer */}
                    {q.status === 'Accepté' && (
                      <View style={{
                        marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12,
                        backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>✅ Offre acceptée par le client</Text>
                        <Text style={{ fontSize: 12, color: '#166534', marginTop: 4, lineHeight: 18 }}>
                          {q.orderNumber ? `Commande ${q.orderNumber}` : 'Commande créée'}
                          {q.respondedAt ? ` · le ${new Date(q.respondedAt).toLocaleDateString('fr-FR')}` : ''}
                        </Text>
                      </View>
                    )}
                    {q.status === 'Refusé' && (
                      <View style={{
                        marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12,
                        backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#B91C1C' }}>❌ Offre refusée par le client</Text>
                        {q.declineReason ? (
                          <Text style={{ fontSize: 12, color: '#7F1D1D', marginTop: 4, lineHeight: 18 }}>
                            Motif : {q.declineReason}
                          </Text>
                        ) : null}
                        {q.respondedAt ? (
                          <Text style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>
                            Le {new Date(q.respondedAt).toLocaleDateString('fr-FR')}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    {/* Action buttons */}
                    {(canOffer || canExpire) && (
                      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: T.border }}>
                        {canOffer && (
                          <TouchableOpacity
                            onPress={() => {
                              setShowOfferForm(isShowingOffer ? null : q.id);
                              setExpandedQuote(q.id);
                            }}
                            activeOpacity={0.7}
                            style={{
                              flex: 1, paddingVertical: 11, alignItems: 'center',
                              backgroundColor: isShowingOffer ? '#3b82f6' : '#3b82f6' + '10',
                              borderRightWidth: canExpire ? 1 : 0, borderRightColor: T.border,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isShowingOffer ? '#FFF' : '#3b82f6' }}>
                              💰 Proposer un prix
                            </Text>
                          </TouchableOpacity>
                        )}
                        {canExpire && (
                          <TouchableOpacity
                            onPress={() => handleMarkExpired(q)}
                            disabled={updatingId === q.id}
                            activeOpacity={0.7}
                            style={{ flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: 'transparent' }}
                          >
                            {updatingId === q.id ? (
                              <ActivityIndicator size="small" color={T.muted} />
                            ) : (
                              <Text style={{ fontSize: 12, fontWeight: '700', color: T.muted }}>Marquer expiré</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => openQuote(q.id)}
                      activeOpacity={0.8}
                      style={{
                        marginHorizontal: 16, marginBottom: 14, borderRadius: 12,
                        paddingVertical: 11, alignItems: 'center',
                        backgroundColor: T.primary + '12', borderWidth: 1, borderColor: T.primary,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: T.primary }}>
                        🖨️ Voir / imprimer le devis
                      </Text>
                    </TouchableOpacity>

                    {/* Expand toggle */}
                    <TouchableOpacity
                      onPress={() => setExpandedQuote(isExpanded ? null : q.id)}
                      activeOpacity={0.7}
                      style={{
                        paddingVertical: 10, alignItems: 'center',
                        borderTopWidth: 1, borderTopColor: T.border,
                        backgroundColor: isExpanded ? T.primary + '06' : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: T.primary, fontWeight: '700' }}>
                        {isExpanded ? '▲  Masquer les détails' : '▼  Voir les détails'}
                      </Text>
                    </TouchableOpacity>

                    {/* Expanded section */}
                    {isExpanded && (
                      <View style={{ padding: 16, backgroundColor: T.bg }}>
                        {/* Offer form */}
                        {isShowingOffer && (
                          <OfferForm
                            quote={q}
                            onSubmit={(payload, finalPrice) => handleOfferPrice(q, payload, finalPrice)}
                            submitting={submittingOffer}
                          />
                        )}

                        {/* Needs / notes */}
                        {q.needs && (
                          <View style={{ marginTop: isShowingOffer ? 16 : 0, marginBottom: 12 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 6 }}>Besoins du client</Text>
                            <Text style={{ fontSize: 13, color: T.muted, lineHeight: 20 }}>{q.needs}</Text>
                          </View>
                        )}

                        {/* Items */}
                        {q.items && q.items.length > 0 && (
                          <View style={{ marginBottom: 12 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Articles demandés</Text>
                            {q.items.map((item, i) => (
                              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ fontSize: 13, color: T.text, flex: 1 }}>
                                  {item.qty ?? item.quantity}× {item.name || item.productName}{item.unit ? ` (${item.unit})` : ''}
                                </Text>
                                {item.price != null && (
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }}>{fmt(item.price)} TND</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Admin notes */}
                        {q.adminNotes && (
                          <View>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 6 }}>Notes admin</Text>
                            <Text style={{ fontSize: 13, color: T.muted, lineHeight: 20 }}>{q.adminNotes}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
