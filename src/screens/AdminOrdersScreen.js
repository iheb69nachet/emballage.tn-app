import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Modal, Switch, Linking, Platform, KeyboardAvoidingView,
} from 'react-native';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';
import AppDialog from '../components/AppDialog';
import Badge from '../components/Badge';
import { openInvoice } from '../services/documents';
import { usePolling } from '../hooks/usePolling';

// API statuses are French strings: 'En cours' | 'En transit' | 'Livré' | 'Annulé'
const ORDER_STATUS_COLORS = {
  'En cours': '#3b82f6',
  'En transit': '#8b5cf6',
  'Livré': '#10b981',
  'Annulé': '#ef4444',
};

const ORDER_STATUS_LABELS = {
  'En cours': 'En cours',
  'En transit': 'En transit',
  'Livré': 'Livré',
  'Annulé': 'Annulé',
};

const STATUS_FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'a_valider', label: '⏳ À valider' },
  { key: 'En cours', label: 'En cours' },
  { key: 'En transit', label: 'En transit' },
  { key: 'Livré', label: 'Livré' },
  { key: 'Annulé', label: 'Annulé' },
];

const LEGACY_PAYMENT = {
  a_la_livraison: { icon: '🚚', name: 'À la livraison' },
  virement:       { icon: '🏦', name: 'Virement bancaire' },
  especes:        { icon: '💵', name: 'Espèces' },
};
const paymentName = (o) => o.paymentMethodLabel || LEGACY_PAYMENT[o.paymentMethod]?.name || o.paymentMethod || '—';
const paymentLabel = (o) => `${LEGACY_PAYMENT[o.paymentMethod]?.icon ?? '💳'} ${paymentName(o)}`;

const fmt = (n) => n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const STATUS_FLOW = ['En cours', 'En transit', 'Livré'];
/** Order frozen on payment approval — its status cannot move forward yet. */
const needsValidation = (o) => o.paymentValidationRequired && !o.paymentValidatedAt;
/**
 * Any order still waiting for its payment approval. Approving confirms the
 * order: it unlocks the facture and deducts the stock, so it is offered on
 * every order, not only the frozen ones.
 */
const canValidate = (o) => !o.paymentValidatedAt && o.status !== 'Annulé';
const hasGps = (o) => o.deliveryLat != null && o.deliveryLng != null;
const openMaps = (o) => {
  const lat = Number(o.deliveryLat), lng = Number(o.deliveryLng);
  const url = Platform.select({
    ios: `maps:0,0?q=${lat},${lng}`,
    default: `geo:${lat},${lng}?q=${lat},${lng}(Livraison ${o.orderNumber})`,
  });
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {}));
};
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR');

/** Settlement modes an admin can record on an invoice (mirrors users/payment-modes on the API). */
const SETTLEMENT_MODES = [
  { code: 'especes',        label: 'Espèces',        icon: '💵' },
  { code: 'cheque',         label: 'Chèque',         icon: '🧾' },
  { code: 'traite',         label: 'Traite',         icon: '📜' },
  { code: 'virement',       label: 'Virement',       icon: '🏦' },
  { code: 'carte_bancaire', label: 'Carte bancaire', icon: '💳' },
];
const settlementLabel = (code) => SETTLEMENT_MODES.find(m => m.code === code)?.label || code;
const needsBankDetails = (code) => code === 'cheque' || code === 'traite';
const referenceLabel = (code) => code === 'traite' ? 'Numéro de la traite' : 'Numéro du chèque';

/**
 * Payment approval. The mode is the one the client committed to at checkout and
 * is shown read-only — the admin confirms the collection, never substitutes a
 * different mode.
 */
function ValidatePaymentModal({ order, methods, onClose, onValidated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const clientCode = order.paymentMethod;
  const clientLabel = paymentName(order);
  const clientMethod = methods.find(m => m.code === clientCode);

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      const updated = await api.admin.orders.validatePayment(order.id);
      onValidated(updated);
      onClose();
    } catch (e) {
      setError(e.message || 'Validation impossible');
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: T.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '86%' }}>
          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: T.text }}>Valider le paiement</Text>
            <Text style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              Commande {order.orderNumber} · {fmt(Number(order.total) || 0)} TND
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: T.info + '10', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.info + '40', marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: T.info, letterSpacing: 1 }}>CHOIX DU CLIENT</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: T.text, marginTop: 4 }}>{paymentLabel(order)}</Text>
              {Number(order.deliveryFee) > 0 && (
                <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                  dont {fmt(Number(order.deliveryFee))} TND de frais
                </Text>
              )}
            </View>

            <Text style={{ fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 8 }}>
              MODE DE RÈGLEMENT
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8,
              borderRadius: 14, backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.border,
            }}>
              <Text style={{ fontSize: 20, width: 30, textAlign: 'center' }}>{clientMethod?.icon || '💳'}</Text>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.text }}>{clientLabel}</Text>
              <Text style={{ fontSize: 15 }}>🔒</Text>
            </View>
            <Text style={{ fontSize: 11, color: T.muted, lineHeight: 17, marginBottom: 16 }}>
              Choisi par le client à la commande — il ne peut pas être modifié à la validation.
            </Text>

            <View style={{ backgroundColor: T.warning + '14', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.warning + '50', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 18 }}>
                La validation confirme la commande : elle débloque la facture et déduit les quantités du stock.
              </Text>
            </View>

            {error ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                <Text style={{ color: '#DC2626', fontSize: 13, lineHeight: 19 }}>⚠️ {error}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={submit} disabled={saving} activeOpacity={0.8}
              style={{ backgroundColor: T.success, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6, opacity: saving ? 0.6 : 1 }}>
              {saving ? <ActivityIndicator color="#FFF" />
                : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>✅ Valider le paiement</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} disabled={saving} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: T.muted, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      <AppDialog nested />
    </Modal>
  );
}

/** Create / edit an invoice for an order (number, settlement mode, notes, optional e-mail to the client). */
function InvoiceEditor({ order, onClose, onSaved }) {
  const isEditing = !!order.invoiceNumber;
  const [invoiceNumber, setInvoiceNumber] = useState(order.invoiceNumber || '');
  const [invoiceNotes, setInvoiceNotes] = useState(order.invoiceNotes || '');
  const [settlementMode, setSettlementMode] = useState(order.settlementMode || '');
  const [settlementBank, setSettlementBank] = useState(order.settlementBank || '');
  const [settlementReference, setSettlementReference] = useState(order.settlementReference || '');
  const [send, setSend] = useState(false);
  const [saving, setSaving] = useState(false);
  const clientEmail = order.user?.email;
  // Modes the customer is allowed to use come first; the others stay available but dimmed
  const allowed = Array.isArray(order.user?.paymentModes) ? order.user.paymentModes : null;
  const modes = allowed
    ? [...SETTLEMENT_MODES].sort((a, b) => Number(allowed.includes(b.code)) - Number(allowed.includes(a.code)))
    : SETTLEMENT_MODES;
  const showBankFields = needsBankDetails(settlementMode);

  const save = async () => {
    const num = invoiceNumber.trim();
    if (!num) { showAlert('Numéro manquant', 'Indiquez un numéro de facture.'); return; }
    if (showBankFields && (!settlementBank.trim() || !settlementReference.trim())) {
      showAlert('Informations manquantes', `Indiquez la banque et le ${referenceLabel(settlementMode).toLowerCase()}.`);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.admin.orders.updateInvoice(order.id, {
        invoiceNumber: num,
        invoiceNotes: invoiceNotes.trim() || undefined,
        settlementMode,
        settlementBank: showBankFields ? settlementBank.trim() : undefined,
        settlementReference: showBankFields ? settlementReference.trim() : undefined,
        send,
      });
      onSaved(updated);
    } catch (e) {
      showAlert('Erreur', e.message || "Impossible d'enregistrer la facture");
    }
    setSaving(false);
  };

  const input = {
    backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: T.text, borderWidth: 1.5, borderColor: T.border,
  };
  const label = { fontSize: 11, fontWeight: '800', color: T.muted, letterSpacing: 1.2, marginBottom: 6 };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => !saving && onClose()}>
      {/* 'padding' keeps the focused field above the keyboard on both platforms (the sheet scrolls if needed) */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => !saving && onClose()} />
        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%' }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 34, gap: 12 }}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>
                🧾 {isEditing ? 'Modifier la facture' : 'Créer une facture'}
              </Text>
              <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={10}>
                <Text style={{ fontSize: 20, color: T.muted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: T.muted }}>
              Commande #{order.orderNumber} · {fmt(Number(order.total) || 0)} TND TTC
            </Text>

            <View>
              <Text style={label}>NUMÉRO DE FACTURE *</Text>
              <TextInput style={input} value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="ex : F-2026-0010"
                placeholderTextColor={T.muted} autoCapitalize="characters" />
            </View>

            {/* Settlement mode */}
            <View>
              <Text style={label}>MODE DE RÈGLEMENT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {modes.map(m => {
                  const active = settlementMode === m.code;
                  const permitted = !allowed || allowed.includes(m.code);
                  return (
                    <TouchableOpacity key={m.code} activeOpacity={0.7}
                      onPress={() => setSettlementMode(active ? '' : m.code)}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
                        borderColor: active ? T.primary : T.border, backgroundColor: active ? T.primary + '14' : T.bg,
                        opacity: permitted || active ? 1 : 0.5 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? T.primary : T.text }}>
                        {active ? '✓ ' : ''}{m.icon} {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {allowed && settlementMode && !allowed.includes(settlementMode) && (
                <Text style={{ fontSize: 11, color: T.warning || '#b45309', marginTop: 6 }}>
                  Ce mode n'est pas dans les modes autorisés pour ce client.
                </Text>
              )}
            </View>

            {showBankFields && (
              <View style={{ gap: 12, backgroundColor: T.primary + '08', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.primary + '25' }}>
                <View>
                  <Text style={label}>BANQUE *</Text>
                  <TextInput style={{ ...input, backgroundColor: '#FFF' }} value={settlementBank} onChangeText={setSettlementBank}
                    placeholder="ex : BIAT, Amen Bank, STB…" placeholderTextColor={T.muted} autoCapitalize="words" />
                </View>
                <View>
                  <Text style={label}>{referenceLabel(settlementMode).toUpperCase()} *</Text>
                  <TextInput style={{ ...input, backgroundColor: '#FFF' }} value={settlementReference} onChangeText={setSettlementReference}
                    placeholder={settlementMode === 'traite' ? 'ex : TR-0001234' : 'ex : 0001234'} placeholderTextColor={T.muted}
                    autoCapitalize="characters" autoCorrect={false} />
                </View>
              </View>
            )}

            <View>
              <Text style={label}>NOTES / CONDITIONS</Text>
              <TextInput style={[input, { minHeight: 80, textAlignVertical: 'top' }]} multiline value={invoiceNotes} onChangeText={setInvoiceNotes}
                placeholder="Conditions de paiement, mentions légales…" placeholderTextColor={T.muted} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>📧 Envoyer au client</Text>
                <Text style={{ fontSize: 11, color: clientEmail ? T.muted : T.danger, marginTop: 2 }}>
                  {clientEmail || 'Aucun e-mail enregistré'}
                </Text>
              </View>
              <Switch value={send} onValueChange={setSend} disabled={!clientEmail}
                trackColor={{ false: T.border, true: T.primary + '80' }} thumbColor={send ? T.primary : '#fff'} />
            </View>

            <TouchableOpacity onPress={save} disabled={saving || !invoiceNumber.trim()} activeOpacity={0.8}
              style={{ backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: saving || !invoiceNumber.trim() ? 0.6 : 1 }}>
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>{send ? '💾 Enregistrer & envoyer' : '💾 Enregistrer'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <AppDialog nested />
    </Modal>
  );
}

export default function AdminOrdersScreen({ route }) {
  const r = useR();
  const { authToken, user } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null); // order being invoiced (modal)

  const [validateOrder, setValidateOrder] = useState(null); // order awaiting payment approval
  const [paymentMethods, setPaymentMethods] = useState([]);

  const fetchOrders = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const data = await api.admin.orders.list();
      setOrders(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);

  }, [authToken]);

  usePolling(fetchOrders, 30000);

  // Opened from a notification: show that order's details straight away
  const targetOrderId = route?.params?.orderId;
  useEffect(() => {
    if (targetOrderId) {
      setExpandedOrder(targetOrderId);
      setStatusFilter('all');
      setSearchQuery('');
    }
  }, [targetOrderId]);

  useEffect(() => {
    if (!authToken) return;
    api.admin.paymentMethods.list()
      .then(list => setPaymentMethods(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, [authToken]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusUpdate = useCallback(async (order, newStatus) => {
    if (needsValidation(order) && newStatus !== 'Annulé') {
      showAlert(
        'Paiement à valider',
        `Le paiement de cette commande (${paymentName(order)}) doit d'abord être validé. Seule l'annulation est possible avant validation.`,
      );
      return;
    }
    showAlert(
      'Changer le statut',
      `Passer la commande #${order.orderNumber} à "${ORDER_STATUS_LABELS[newStatus]}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setUpdatingId(order.id);
            try {
              await api.admin.orders.updateStatus(order.id, newStatus);
              setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
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

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const clientName = o.clientName ||
      [o.user?.firstName, o.user?.lastName].filter(Boolean).join(' ');
    const matchesSearch = !searchQuery ||
      o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'a_valider' ? needsValidation(o) : o.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  // Sort by date (newest first)
  const sortedOrders = [...filteredOrders].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: r.px, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        <TextInput
          placeholder="Rechercher par numéro ou client..."
          placeholderTextColor={T.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            backgroundColor: T.bg,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14,
            color: T.text,
            borderWidth: 1,
            borderColor: T.border,
          }}
        />
      </View>

      {/* Status filters */}
      <View style={{ backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border, flexShrink: 0 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: r.px, paddingVertical: 12, gap: 8, alignItems: 'center' }}
        style={{ flexGrow: 0, flexShrink: 0 }}
      >
        {STATUS_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.key}
            onPress={() => setStatusFilter(filter.key)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 16,
              // paddingVertical: 8,
              height: 32,
              justifyContent:'center',
              alignItems:'center',
              borderRadius: 20,
              backgroundColor: statusFilter === filter.key ? T.primary : T.bg,
              borderWidth: 1,
              borderColor: statusFilter === filter.key ? T.primary : T.border,
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: '600',
              color: statusFilter === filter.key ? '#FFF' : T.text,
            }}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      </View>

      {/* Orders list */}
      <ScrollView
        contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
        }
      >
        {sortedOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <View style={{
              width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '10',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 44 }}>📦</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 6 }}>
              Aucune commande
            </Text>
            <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center' }}>
              {searchQuery || statusFilter !== 'all'
                ? 'Aucun résultat pour votre recherche'
                : 'Les commandes apparaîtront ici'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {sortedOrders.map(o => (
              <View key={o.id} style={{
                backgroundColor: '#FFF',
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: T.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}>
                {/* Header */}
                <View style={{
                  backgroundColor: T.primary + '08',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: T.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <View>
                    <Text style={{ fontWeight: '800', fontSize: 14, color: T.text }}>#{o.orderNumber}</Text>
                    <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      {new Date(o.createdAt).toLocaleDateString('fr-FR')} · {o.items?.length ?? 0} article{(o.items?.length ?? 0) > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Badge status={o.status} />
                    {needsValidation(o) && (
                      <View style={{ backgroundColor: T.warning + '22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: T.warning }}>⏳ À VALIDER</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Customer info */}
                {(o.clientName || o.user) && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border }}>
                    <Text style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Client</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }}>
                      {o.clientName || [o.user?.firstName, o.user?.lastName].filter(Boolean).join(' ')}
                    </Text>
                    {o.user?.email && (
                      <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{o.user.email}</Text>
                    )}
                  </View>
                )}

                {/* Amount */}
                <View style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <View>
                    <Text style={{ fontSize: 13, color: T.muted, fontWeight: '600' }}>Montant total</Text>
                    <Text style={{ fontSize: 12, color: T.text, marginTop: 4, fontWeight: '600' }}>
                      {paymentLabel(o)}
                      {Number(o.deliveryFee) > 0 ? ` · frais ${fmt(Number(o.deliveryFee))} TND` : ''}
                    </Text>
                    <Text style={{ fontSize: 12, color: o.deliveryMode === 'retrait' ? T.info : T.muted, marginTop: 2, fontWeight: '600' }}>
                      {o.deliveryMode === 'retrait' ? '🏪 Retrait en magasin' : '🚚 Livraison'}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', fontSize: 20, color: T.primary }}>
                    {fmt(Number(o.total) || 0)} <Text style={{ fontSize: 13 }}>TND</Text>
                  </Text>
                </View>

                {/* Payment approval — confirms the order (facture + stock) */}
                {canValidate(o) && (
                  <TouchableOpacity
                    onPress={() => setValidateOrder(o)}
                    disabled={updatingId === o.id}
                    activeOpacity={0.8}
                    style={{
                      marginHorizontal: 16, marginBottom: 14, backgroundColor: T.warning,
                      borderRadius: 12, paddingVertical: 12, alignItems: 'center',
                      opacity: updatingId === o.id ? 0.6 : 1,
                    }}
                  >
                    {updatingId === o.id
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>✅ Valider le paiement</Text>}
                  </TouchableOpacity>
                )}
                {o.paymentValidatedAt && (
                  <Text style={{ marginHorizontal: 16, marginBottom: 12, fontSize: 11, color: T.success, fontWeight: '700' }}>
                    ✓ Paiement validé le {new Date(o.paymentValidatedAt).toLocaleDateString('fr-FR')}
                  </Text>
                )}

                {/* Expand toggle */}
                <TouchableOpacity
                  onPress={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderTopColor: T.border,
                    backgroundColor: expandedOrder === o.id ? T.primary + '06' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 12, color: T.primary, fontWeight: '700' }}>
                    {expandedOrder === o.id ? '▲  Masquer les détails' : '▼  Voir les détails'}
                  </Text>
                </TouchableOpacity>

                {/* Expanded details */}
                {expandedOrder === o.id && (
                  <View style={{ padding: 16, backgroundColor: T.bg }}>
                    {/* Status update — frozen until the payment is validated */}
                    {o.status !== 'Annulé' && o.status !== 'Livré' && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Changer le statut</Text>
                        {needsValidation(o) && (
                          <View style={{
                            flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
                            backgroundColor: T.warning + '14', borderRadius: 12, padding: 12,
                            borderWidth: 1, borderColor: T.warning + '50',
                          }}>
                            <Text style={{ fontSize: 15 }}>🔒</Text>
                            <Text style={{ flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 17 }}>
                              Validez d'abord le paiement ({paymentName(o)}) pour pouvoir faire avancer la commande.
                            </Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {(needsValidation(o) ? [] : STATUS_FLOW.filter(s => s !== o.status)).map(s => (
                            <TouchableOpacity
                              key={s}
                              onPress={() => handleStatusUpdate(o, s)}
                              disabled={updatingId === o.id}
                              activeOpacity={0.7}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: ORDER_STATUS_COLORS[s] + '18',
                                borderWidth: 1,
                                borderColor: ORDER_STATUS_COLORS[s],
                                opacity: updatingId === o.id ? 0.5 : 1,
                              }}
                            >
                              {updatingId === o.id ? (
                                <ActivityIndicator size="small" color={ORDER_STATUS_COLORS[s]} />
                              ) : (
                                <Text style={{ fontSize: 12, fontWeight: '700', color: ORDER_STATUS_COLORS[s] }}>
                                  → {ORDER_STATUS_LABELS[s]}
                                </Text>
                              )}
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            onPress={() => handleStatusUpdate(o, 'Annulé')}
                            disabled={updatingId === o.id}
                            activeOpacity={0.7}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 20,
                              backgroundColor: '#ef444418',
                              borderWidth: 1,
                              borderColor: '#ef4444',
                              opacity: updatingId === o.id ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444' }}>Annuler</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    {/* Amounts — HT, VAT and the extra fee charged on this order */}
                    {(() => {
                      const total = Number(o.total) || 0;
                      const fee = Number(o.deliveryFee) || 0;
                      const tax = Number(o.taxAmount) || 0;
                      const taxRate = Number(o.taxRate) || 19;
                      const stamp = Number(o.stampDuty) || 0;
                      const subtotal = Number(o.subtotal) > 0 ? Number(o.subtotal) : total - fee - tax - stamp;
                      return (
                        <View style={{ marginBottom: 16 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Montants</Text>
                          <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.border }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ fontSize: 12, color: T.muted }}>Sous-total HT</Text>
                              <Text style={{ fontSize: 12, color: T.text, fontWeight: '600' }}>{fmt(subtotal)} TND</Text>
                            </View>
                            {tax > 0 && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ fontSize: 12, color: T.muted }}>TVA ({taxRate}%)</Text>
                                <Text style={{ fontSize: 12, color: T.text, fontWeight: '600' }}>{fmt(tax)} TND</Text>
                              </View>
                            )}
                            {fee > 0 ? (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ fontSize: 12, color: T.warning, fontWeight: '700' }}>
                                  Frais supplémentaires{o.paymentMethodLabel ? ` (${o.paymentMethodLabel})` : ''}
                                </Text>
                                <Text style={{ fontSize: 12, color: T.warning, fontWeight: '800' }}>+ {fmt(fee)} TND</Text>
                              </View>
                            ) : (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ fontSize: 12, color: T.muted }}>Frais supplémentaires</Text>
                                <Text style={{ fontSize: 12, color: T.muted, fontWeight: '600' }}>Aucun</Text>
                              </View>
                            )}
                            {stamp > 0 && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ fontSize: 12, color: T.muted }}>Droit de timbre</Text>
                                <Text style={{ fontSize: 12, color: T.text, fontWeight: '600' }}>{fmt(stamp)} TND</Text>
                              </View>
                            )}
                            <View style={{ height: 1, backgroundColor: T.border, marginVertical: 6 }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: T.text, fontWeight: '800' }}>Total TTC</Text>
                              <Text style={{ fontSize: 13, color: T.primary, fontWeight: '900' }}>{fmt(total)} TND</Text>
                            </View>
                            {o.quoteNumber ? (
                              <Text style={{ fontSize: 11, color: T.info, fontWeight: '700', marginTop: 8 }}>
                                📋 Commande issue du devis {o.quoteNumber}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })()}

                    {/* Items */}
                    {o.items && o.items.length > 0 && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Articles</Text>
                        {o.items.map((item, i) => (
                          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ fontSize: 13, color: T.text, flex: 1 }}>
                              {item.qty ?? item.quantity}x {item.productName || item.name}
                            </Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }}>
                              {fmt(Number(item.price) || 0)} TND
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Address */}
                    {(o.deliveryAddress || hasGps(o)) && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Adresse de livraison</Text>
                        {o.deliveryAddress ? (
                          <Text style={{ fontSize: 13, color: T.muted, lineHeight: 20 }}>{o.deliveryAddress}</Text>
                        ) : null}
                        {hasGps(o) && (
                          <TouchableOpacity onPress={() => openMaps(o)} activeOpacity={0.8}
                            style={{ marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
                              backgroundColor: T.info + '14', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: T.info + '40' }}>
                            <Text style={{ fontSize: 14 }}>📍</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: T.info }}>
                              Ouvrir dans Maps · {Number(o.deliveryLat).toFixed(5)}, {Number(o.deliveryLng).toFixed(5)}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Invoice */}
                    <View style={{ marginBottom: 16, backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: o.invoiceNumber ? T.primary + '40' : T.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>🧾 Facture</Text>
                        {o.invoiceNumber ? (
                          <Text style={{ fontSize: 13, fontWeight: '800', color: T.primary }}>{o.invoiceNumber}</Text>
                        ) : (
                          <Text style={{ fontSize: 12, color: T.muted }}>Aucune facture</Text>
                        )}
                      </View>
                      {o.invoiceNumber ? (
                        <View style={{ marginTop: 8, gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: T.muted }}>Montant</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>{fmt(Number(o.total) || 0)} TND</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: T.muted }}>Mode de paiement</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>{paymentName(o)}</Text>
                          </View>
                          {!!o.settlementMode && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: T.muted }}>Mode de règlement</Text>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>
                                {settlementLabel(o.settlementMode)}
                                {needsBankDetails(o.settlementMode) && (o.settlementBank || o.settlementReference)
                                  ? ` · ${[o.settlementBank, o.settlementReference].filter(Boolean).join(' n° ')}`
                                  : ''}
                              </Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: T.muted }}>Envoi au client</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: o.invoiceSentAt ? T.success : T.muted }}>
                              {o.invoiceSentAt ? `✓ envoyée le ${fmtDate(o.invoiceSentAt)}` : 'non envoyée'}
                            </Text>
                          </View>
                          {o.invoiceNotes ? (
                            <Text style={{ fontSize: 12, color: T.muted, lineHeight: 18, marginTop: 4 }}>{o.invoiceNotes}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      {o.paymentValidatedAt ? (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                          <TouchableOpacity onPress={() => setInvoiceOrder(o)} activeOpacity={0.8}
                            style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                              backgroundColor: o.invoiceNumber ? T.primary + '12' : T.primary, borderWidth: 1, borderColor: T.primary }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: o.invoiceNumber ? T.primary : '#FFF' }}>
                              {o.invoiceNumber ? '✏️ Modifier' : '➕ Créer une facture'}
                            </Text>
                          </TouchableOpacity>
                          {o.invoiceNumber ? (
                            <TouchableOpacity onPress={() => openInvoice(o.id)} activeOpacity={0.8}
                              style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                                backgroundColor: T.primary, borderWidth: 1, borderColor: T.primary }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>🖨️ Voir / imprimer</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : (
                        <View style={{ marginTop: 10, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
                          backgroundColor: T.warning + '14', borderWidth: 1, borderColor: T.warning + '50' }}>
                          <Text style={{ fontSize: 15 }}>🔒</Text>
                          <Text style={{ flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 17 }}>
                            Validez le paiement pour pouvoir créer la facture.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Phone */}
                    {o.phone && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Téléphone</Text>
                        <Text style={{ fontSize: 13, color: T.text }}>{o.phone}</Text>
                      </View>
                    )}

                    {/* Notes */}
                    {o.notes && (
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 8 }}>Notes</Text>
                        <Text style={{ fontSize: 13, color: T.muted, lineHeight: 20 }}>{o.notes}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {validateOrder && (
        <ValidatePaymentModal
          order={validateOrder}
          methods={paymentMethods}
          onClose={() => setValidateOrder(null)}
          onValidated={(updated) => {
            setOrders(prev => prev.map(o => (o.id === validateOrder.id ? { ...o, ...updated } : o)));
          }}

        />
      )}

      {invoiceOrder && (
        <InvoiceEditor
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
          onSaved={(updated) => {
            setOrders(prev => prev.map(o => o.id === invoiceOrder.id ? { ...o, ...updated } : o));
            setInvoiceOrder(null);
          }}
        />
      )}
    </View>
  );
}
