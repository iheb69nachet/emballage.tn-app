import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Linking,
} from 'react-native';
import { usePolling } from '../hooks/usePolling';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';
import { mapsUrl } from '../services/geo';

/** Fallback list — the API (GET /users/payment-modes) is the source of truth. */
const DEFAULT_PAYMENT_MODES = [
  { code: 'especes', label: 'Espèces' },
  { code: 'cheque', label: 'Chèque' },
  { code: 'traite', label: 'Traite' },
  { code: 'virement', label: 'Virement' },
  { code: 'carte_bancaire', label: 'Carte bancaire' },
];
const PAYMENT_MODE_ICONS = { especes: '💵', cheque: '🧾', traite: '📜', virement: '🏦', carte_bancaire: '💳' };

/** Normalise the API user (firstName/lastName/roles[]) for display. */
const normalizeUser = (u) => ({
  ...u,
  name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.name || u.email || '—',
  role: (u.roles || []).some(r => (typeof r === 'string' ? r : r?.name) === 'admin') ? 'admin' : 'user',
  isActive: u.isActive !== false,
  isDeleted: !!u.deletedAt,
  paymentModes: Array.isArray(u.paymentModes) && u.paymentModes.length ? u.paymentModes : ['especes'],
});

function FidelityBadge({ balance }) {
  if (balance == null) return null;
  const tier = balance >= 1000 ? { label: 'Platinum', color: '#8b5cf6' }
    : balance >= 500 ? { label: 'Gold', color: T.accent }
    : balance >= 100 ? { label: 'Silver', color: '#64748b' }
    : { label: 'Bronze', color: '#92400e' };
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: tier.color + '18', borderWidth: 1, borderColor: tier.color }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: tier.color }}>{tier.label}</Text>
    </View>
  );
}

export default function AdminUsersScreen({ navigation }) {
  const r = useR();
  const { authToken } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [fidelityMap, setFidelityMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [paymentModes, setPaymentModes] = useState(DEFAULT_PAYMENT_MODES);
  const [busyId, setBusyId] = useState(null);

  const patchUser = (id, patch) => setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...patch } : u)));

  // ── Actions ────────────────────────────────────────────────
  const toggleBlock = (u) => {
    const blocking = u.isActive;
    showAlert(
      blocking ? 'Bloquer cet utilisateur ?' : 'Débloquer cet utilisateur ?',
      blocking
        ? `${u.name} ne pourra plus se connecter ni commander.`
        : `${u.name} pourra à nouveau se connecter et commander.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: blocking ? 'Bloquer' : 'Débloquer', style: blocking ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(u.id);
            try {
              if (blocking) await api.admin.users.block(u.id); else await api.admin.users.unblock(u.id);
              patchUser(u.id, { isActive: !blocking });
            } catch (e) { showAlert('Erreur', e.message || 'Action impossible'); }
            setBusyId(null);
          },
        },
      ]
    );
  };

  const deleteUser = (u) => {
    showAlert(
      'Supprimer cet utilisateur ?',
      `${u.name} (${u.email}) et ses données seront supprimés définitivement. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            setBusyId(u.id);
            try {
              await api.admin.users.remove(u.id);
              setUsers(prev => prev.filter(x => x.id !== u.id));
              setExpandedUser(null);
            } catch (e) { showAlert('Erreur', e.message || 'Suppression impossible'); }
            setBusyId(null);
          },
        },
      ]
    );
  };

  /** Toggle one mode in the customer's allowed list (at least one must remain). */
  const togglePaymentMode = async (u, code) => {
    const previous = u.paymentModes;
    const has = previous.includes(code);
    if (has && previous.length === 1) {
      showAlert('Mode requis', 'Un client doit avoir au moins un mode de règlement.');
      return;
    }
    const next = has ? previous.filter(c => c !== code) : [...previous, code];
    patchUser(u.id, { paymentModes: next });
    try {
      await api.admin.users.setPaymentModes(u.id, next);
    } catch (e) {
      patchUser(u.id, { paymentModes: previous });
      showAlert('Erreur', e.message || 'Impossible de modifier les modes de règlement');
    }
  };

  const fetchData = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const [usersData, fidelityData, modes] = await Promise.all([
        api.admin.users.list().catch(() => []),
        api.admin.fidelity.list().catch(() => []),
        api.admin.users.paymentModes().catch(() => null),
      ]);
      setUsers((usersData || []).map(normalizeUser));
      if (Array.isArray(modes) && modes.length) setPaymentModes(modes);
      const map = {};
      (fidelityData || []).forEach(f => {
        if (f.userId || f.user?.id) map[f.userId || f.user?.id] = f;
      });
      setFidelityMap(map);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [authToken]);

  // Runs on focus (e.g. back from the client form), then every 30s while visible
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

  const filteredUsers = users
    .filter(u => {
      const matchesSearch = !searchQuery ||
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => a.name?.localeCompare(b.name));

  const adminCount = users.filter(u => u.role === 'admin').length;
  const clientCount = users.filter(u => u.role !== 'admin').length;
  const blockedCount = users.filter(u => !u.isActive).length;
  const modeLabel = (code) => paymentModes.find(m => m.code === code)?.label || code;
  const modesSummary = (codes) => codes.map(c => `${PAYMENT_MODE_ICONS[c] || '💳'} ${modeLabel(c)}`).join(' · ');

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Summary */}
      <View style={{ paddingHorizontal: r.px, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: 13, color: T.muted, flex: 1 }}>
          <Text style={{ fontWeight: '700', color: T.primary }}>{clientCount}</Text> clients ·{' '}
          <Text style={{ fontWeight: '700', color: T.accent }}>{adminCount}</Text> admins
          {blockedCount > 0 ? <Text> · <Text style={{ fontWeight: '700', color: T.danger }}>{blockedCount}</Text> bloqué{blockedCount > 1 ? 's' : ''}</Text> : null}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminUserForm')} activeOpacity={0.8}
          style={{ backgroundColor: T.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}>
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>＋ Nouveau client</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: r.px, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        <TextInput
          placeholder="Rechercher par nom ou email..."
          placeholderTextColor={T.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 16,
            paddingVertical: 12, fontSize: 14, color: T.text, borderWidth: 1, borderColor: T.border,
          }}
        />
      </View>

      {/* Role filter */}
      <View style={{ flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        {[{ key: 'all', label: 'Tous' }, { key: 'user', label: 'Clients' }, { key: 'admin', label: 'Admins' }].map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setRoleFilter(f.key)}
            activeOpacity={0.7}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center',
              borderBottomWidth: 2, borderBottomColor: roleFilter === f.key ? T.primary : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: roleFilter === f.key ? T.primary : T.muted }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Users list */}
      <ScrollView
        contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {filteredUsers.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <Text style={{ fontSize: 44, marginBottom: 16 }}>👥</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Aucun utilisateur</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredUsers.map(u => {
              const fid = fidelityMap[u.id];
              const balance = fid?.balance ?? null;
              const isExpanded = expandedUser === u.id;
              const initials = u.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
              return (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => setExpandedUser(isExpanded ? null : u.id)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden',
                    borderWidth: 1, borderColor: !u.isActive ? T.danger + '60' : T.border,
                    opacity: !u.isActive ? 0.75 : 1,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
                  }}
                >
                  <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Avatar */}
                    <View style={{
                      width: 48, height: 48, borderRadius: 24,
                      backgroundColor: u.role === 'admin' ? T.accent + '30' : T.primary + '12',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: u.role === 'admin' ? T.accent : T.primary }}>{initials}</Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }} numberOfLines={1}>{u.name}</Text>
                        {u.role === 'admin' && (
                          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: T.accent + '20' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: T.accent }}>Admin</Text>
                          </View>
                        )}
                        {!u.isActive && (
                          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: T.danger + '18' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: T.danger }}>Bloqué</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }} numberOfLines={1}>{u.email}</Text>
                      {u.role !== 'admin' && (
                        <Text style={{ fontSize: 11, color: T.primary, marginTop: 3, fontWeight: '600' }} numberOfLines={1}>
                          {modesSummary(u.paymentModes)}
                        </Text>
                      )}
                    </View>

                    {/* Fidelity */}
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {balance != null && <FidelityBadge balance={balance} />}
                      {balance != null && (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>{balance} pts</Text>
                      )}
                    </View>
                  </View>

                  {/* Expanded */}
                  {isExpanded && (
                    <View style={{ padding: 14, paddingTop: 0, backgroundColor: T.bg, gap: 8 }}>
                      <View style={{ height: 1, backgroundColor: T.border, marginBottom: 8 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: T.muted }}>Téléphone</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>{u.phone || '—'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                        <Text style={{ fontSize: 12, color: T.muted }}>Adresse</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: T.text, flex: 1, textAlign: 'right' }}>{u.address || '—'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: T.muted }}>Ville</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>{u.city || '—'}</Text>
                      </View>
                      {u.latitude != null && u.longitude != null && (
                        <TouchableOpacity onPress={() => Linking.openURL(mapsUrl(u.latitude, u.longitude)).catch(() => {})} activeOpacity={0.7}
                          style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: T.muted }}>Position GPS</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: T.info }}>
                            📍 {Number(u.latitude).toFixed(5)}, {Number(u.longitude).toFixed(5)} · Ouvrir dans Maps
                          </Text>
                        </TouchableOpacity>
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: T.muted }}>Membre depuis</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </Text>
                      </View>
                      {fid && (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: T.muted }}>Points fidélité</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: T.primary }}>{fid.balance ?? 0} pts</Text>
                          </View>
                          {fid.totalEarned != null && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: T.muted }}>Total gagné</Text>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: T.text }}>{fid.totalEarned} pts</Text>
                            </View>
                          )}
                        </>
                      )}

                      {/* Mode de règlement par défaut */}
                      <View style={{ marginTop: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, color: T.muted }}>Modes de règlement autorisés</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: T.primary }}>
                            {u.paymentModes.length}/{paymentModes.length}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {paymentModes.map(m => {
                            const active = u.paymentModes.includes(m.code);
                            return (
                              <TouchableOpacity key={m.code} onPress={() => togglePaymentMode(u, m.code)} activeOpacity={0.7}
                                style={{
                                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1,
                                  backgroundColor: active ? T.primary : '#FFF', borderColor: active ? T.primary : T.border,
                                }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#FFF' : T.text }}>
                                  {active ? '✓ ' : ''}{PAYMENT_MODE_ICONS[m.code] || '💳'} {m.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border }}>
                        <TouchableOpacity onPress={() => navigation.navigate('AdminUserForm', { user: u })} disabled={busyId === u.id} activeOpacity={0.8}
                          style={{
                            flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', borderWidth: 1.5,
                            borderColor: T.primary, backgroundColor: T.primary + '10', opacity: busyId === u.id ? 0.6 : 1,
                          }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: T.primary }}>✏️ Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleBlock(u)} disabled={busyId === u.id} activeOpacity={0.8}
                          style={{
                            flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', borderWidth: 1.5,
                            borderColor: u.isActive ? T.warning : T.success,
                            backgroundColor: u.isActive ? T.warning + '14' : T.success + '14',
                            opacity: busyId === u.id ? 0.6 : 1,
                          }}>
                          {busyId === u.id
                            ? <ActivityIndicator size="small" color={u.isActive ? T.warning : T.success} />
                            : <Text style={{ fontSize: 13, fontWeight: '700', color: u.isActive ? T.warning : T.success }}>
                                {u.isActive ? '🚫 Bloquer' : '✅ Débloquer'}
                              </Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteUser(u)} disabled={busyId === u.id} activeOpacity={0.8}
                          style={{
                            flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', borderWidth: 1.5,
                            borderColor: T.danger, backgroundColor: T.danger + '10', opacity: busyId === u.id ? 0.6 : 1,
                          }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: T.danger }}>🗑️ Supprimer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
