import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Switch, Image,
} from 'react-native';
import { usePolling } from '../hooks/usePolling';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { showAlert } from '../services/dialog';

const fmt = (n) => Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function Section({ title, subtitle }) {
  return (
    <View style={{ paddingVertical: 16, paddingHorizontal: 0, marginTop: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: T.text }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{subtitle}</Text>}
    </View>
  );
}

function ToggleCard({ item, onToggle, toggling, children }) {
  return (
    <View style={{
      backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden',
      borderWidth: 1, borderColor: T.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
      opacity: item.isActive ? 1 : 0.65,
    }}>
      {children}
      {/* Footer with toggle */}
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: T.border,
        backgroundColor: item.isActive ? T.success + '08' : T.bg,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: item.isActive ? T.success : T.muted }}>
          {item.isActive ? 'Actif' : 'Inactif'}
        </Text>
        {toggling ? (
          <ActivityIndicator size="small" color={T.primary} />
        ) : (
          <Switch
            value={!!item.isActive}
            onValueChange={onToggle}
            trackColor={{ false: T.border, true: T.primary + '80' }}
            thumbColor={item.isActive ? T.primary : '#fff'}
          />
        )}
      </View>
    </View>
  );
}

export default function AdminAdsScreen({ navigation, route }) {
  const r = useR();
  const { authToken } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ads, setAds] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [togglingAdId, setTogglingAdId] = useState(null);
  const [togglingBundleId, setTogglingBundleId] = useState(null);
  const [activeTab, setActiveTab] = useState(route?.params?.tab === 'bundles' ? 'bundles' : 'ads');

  const fetchData = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const [adsData, bundlesData] = await Promise.all([
        api.admin.ads.list().catch(() => []),
        api.admin.bundles.list().catch(() => []),
      ]);
      setAds(adsData || []);
      setBundles(bundlesData || []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [authToken]);

  // Runs on focus (e.g. back from the pack form), then every 30s while visible
  usePolling(fetchData, 30000);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleToggleAd = useCallback(async (ad) => {
    const newValue = !ad.isActive;
    showAlert(
      newValue ? 'Activer la publicité' : 'Désactiver la publicité',
      `"${ad.title || 'Cette publicité'}" sera ${newValue ? 'visible' : 'masquée'} pour les clients.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setTogglingAdId(ad.id);
            try {
              await api.admin.ads.update(ad.id, { isActive: newValue });
              setAds(prev => prev.map(a => a.id === ad.id ? { ...a, isActive: newValue } : a));
            } catch (e) {
              showAlert('Erreur', e.message || 'Impossible de mettre à jour');
            }
            setTogglingAdId(null);
          },
        },
      ]
    );
  }, []);

  const handleToggleBundle = useCallback(async (bundle) => {
    const newValue = !bundle.isActive;
    showAlert(
      newValue ? 'Activer le pack' : 'Désactiver le pack',
      `"${bundle.name}" sera ${newValue ? 'visible' : 'masqué'} pour les clients.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setTogglingBundleId(bundle.id);
            try {
              await api.admin.bundles.update(bundle.id, { isActive: newValue });
              setBundles(prev => prev.map(b => b.id === bundle.id ? { ...b, isActive: newValue } : b));
            } catch (e) {
              showAlert('Erreur', e.message || 'Impossible de mettre à jour');
            }
            setTogglingBundleId(null);
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
        <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '12', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Accès administrateur</Text>
        <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>Cette section est réservée aux administrateurs</Text>
      </View>
    );
  }

  const activeAds = ads.filter(a => a.isActive).length;
  const activeBundles = bundles.filter(b => b.isActive).length;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Tab selector */}
      <View style={{ flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: T.border }}>
        {[
          { key: 'ads', label: `Publicités (${ads.length})` },
          { key: 'bundles', label: `Packs (${bundles.length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.7}
            style={{
              flex: 1, paddingVertical: 14, alignItems: 'center',
              borderBottomWidth: 2, borderBottomColor: activeTab === t.key ? T.primary : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === t.key ? T.primary : T.muted }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {activeTab === 'ads' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Section
                title="Publicités"
                subtitle={`${activeAds} active${activeAds > 1 ? 's' : ''} sur ${ads.length}`}
              />
              <TouchableOpacity onPress={() => navigation.navigate('AdminAdForm')} activeOpacity={0.8}
                style={{ backgroundColor: T.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 }}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>＋ Nouvelle pub</Text>
              </TouchableOpacity>
            </View>
            {ads.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📢</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>Aucune publicité</Text>
                <Text style={{ fontSize: 13, color: T.muted, marginTop: 4, textAlign: 'center' }}>Créez une bannière affichée en haut de l'accueil client.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {[...ads].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(ad => {
                  const bg = ad.backgroundColor || T.primary;
                  const accent = ad.accentColor || T.accent;
                  const expired = ad.expiresAt && new Date(ad.expiresAt).getTime() < Date.now();
                  return (
                    <ToggleCard
                      key={ad.id}
                      item={ad}
                      onToggle={() => handleToggleAd(ad)}
                      toggling={togglingAdId === ad.id}
                    >
                      <TouchableOpacity onPress={() => navigation.navigate('AdminAdForm', { ad })} activeOpacity={0.85} style={{ padding: 14 }}>
                        {/* Banner exactly as the client sees it */}
                        <View style={{ borderRadius: 14, padding: 16, backgroundColor: bg, marginBottom: 10 }}>
                          <View style={{
                            borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2,
                            alignSelf: 'flex-start', marginBottom: 6,
                            borderColor: accent + '80', backgroundColor: accent + '30',
                          }}>
                            <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>{ad.tag}</Text>
                          </View>
                          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{ad.title}</Text>
                          {ad.subtitle ? (
                            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3 }} numberOfLines={1}>{ad.subtitle}</Text>
                          ) : null}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: expired ? T.danger : T.muted, fontWeight: '600' }}>
                            Ordre {ad.sortOrder ?? 0}
                            {ad.expiresAt
                              ? ` · ${expired ? 'expirée le' : "jusqu'au"} ${new Date(ad.expiresAt).toLocaleDateString('fr-FR')}`
                              : ' · sans expiration'}
                          </Text>
                          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: T.primary + '60', backgroundColor: T.primary + '0A' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: T.primary }}>✏️ Modifier</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </ToggleCard>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Section
                title="Packs"
                subtitle={`${activeBundles} actif${activeBundles > 1 ? 's' : ''} sur ${bundles.length}`}
              />
              <TouchableOpacity onPress={() => navigation.navigate('AdminBundleForm')} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 }}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>＋ Nouveau pack</Text>
              </TouchableOpacity>
            </View>
            {bundles.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📚</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>Aucun pack</Text>
                <Text style={{ fontSize: 13, color: T.muted, marginTop: 4, textAlign: 'center' }}>Créez un pack pour proposer plusieurs articles à prix réduit.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {bundles.map(b => {
                  const items = Array.isArray(b.items) ? b.items : String(b.items || '').split(',').map(x => x.trim()).filter(Boolean);
                  return (
                    <ToggleCard
                      key={b.id}
                      item={b}
                      onToggle={() => handleToggleBundle(b)}
                      toggling={togglingBundleId === b.id}
                    >
                      <TouchableOpacity onPress={() => navigation.navigate('AdminBundleForm', { bundle: b })} activeOpacity={0.8} style={{ padding: 14 }}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          {b.imageUrl ? (
                            <Image source={{ uri: b.imageUrl }} style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: T.bg }} resizeMode="cover" />
                          ) : (
                            <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 30 }}>{b.emoji || '🎁'}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            {b.badge ? (
                              <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: b.badgeColor || T.primary, marginBottom: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF' }}>{b.badge}</Text>
                              </View>
                            ) : null}
                            <Text style={{ fontSize: 15, fontWeight: '800', color: T.text }} numberOfLines={1}>{b.name}</Text>
                            {items.length > 0 && (
                              <Text style={{ fontSize: 12, color: T.muted, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>{items.join(' · ')}</Text>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                              <Text style={{ fontSize: 16, fontWeight: '900', color: T.primary }}>{fmt(b.price)} TND</Text>
                              {b.originalPrice != null && Number(b.originalPrice) > Number(b.price) && (
                                <Text style={{ fontSize: 12, color: T.muted, textDecorationLine: 'line-through' }}>{fmt(b.originalPrice)}</Text>
                              )}
                              {Number(b.discount) > 0 && (
                                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: T.success + '20' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: T.success }}>-{Number(b.discount)}%</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: T.primary + '60', backgroundColor: T.primary + '0A' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: T.primary }}>✏️ Modifier</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </ToggleCard>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
