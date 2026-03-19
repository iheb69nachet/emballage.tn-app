import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { T } from '../constants/theme';
import { useR } from '../hooks/useR';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import Badge from '../components/Badge';
import Btn from '../components/Btn';

const STATUS_META = {
  'En attente':   { icon: '⏳', color: '#F59E0B' },
  'Prix proposé': { icon: '💰', color: '#10B981' },
  'Expiré':       { icon: '📅', color: '#6B7280' },
};

export default function QuotesScreen() {
  const navigation = useNavigation();
  const r = useR();
  const { openQuoteWithItems, authToken } = useApp();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadQuotes = useCallback(() => {
    if (!authToken) { setLoading(false); return; }
    setLoading(true);
    api.quotes.list()
      .then(setQuotes)
      .finally(() => setLoading(false));
  }, [authToken]);

  useFocusEffect(loadQuotes);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={T.primary} />
    </View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Top bar */}
      <View style={{
        paddingHorizontal: r.px, paddingVertical: 12,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: '#FFF',
      }}>
        <Text style={{ fontSize: 13, color: T.muted, fontWeight: '600' }}>
          {quotes.length} devis
        </Text>
        <TouchableOpacity
          onPress={() => authToken
            ? openQuoteWithItems([])
            : navigation.getParent('Root')?.navigate('Login')}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: T.primary, borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 9,
          }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>+ Nouveau devis</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: r.px, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {!authToken ? (
          <View style={{ alignItems: 'center', paddingVertical: 64, gap: 16 }}>
            <View style={{
              width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '12',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 44 }}>🔒</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>Accès restreint</Text>
            <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>
              Connectez-vous pour envoyer et suivre vos devis
            </Text>
            <TouchableOpacity
              onPress={() => navigation.getParent('Root')?.navigate('Login')}
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
        ) : quotes.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64 }}>
            <View style={{
              width: 90, height: 90, borderRadius: 28, backgroundColor: T.primary + '10',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 44 }}>📋</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 6 }}>
              Aucun devis
            </Text>
            <Text style={{ fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 24 }}>
              Vos demandes de devis apparaîtront ici
            </Text>
            <Btn label="Demander un devis" icon="📋" bg={T.primary}
              onPress={() => openQuoteWithItems([])} />
          </View>
        ) : quotes.map(q => {
          const meta = STATUS_META[q.status] || { icon: '📋', color: T.muted };
          const total = Number(q.total);
          const discount = Number(q.discount ?? 0);
          const finalPrice = total * (1 - discount / 100);
          const hasOffer = q.status === 'Prix proposé' && total > 0;

          return (
            <View key={q.id} style={{
              backgroundColor: '#FFF', borderRadius: 20,
              marginBottom: 12, overflow: 'hidden',
              borderWidth: 1, borderColor: hasOffer ? '#10B981' + '40' : T.border,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 8,
            }}>
              {/* Header */}
              <View style={{
                paddingHorizontal: 18, paddingVertical: 14,
                backgroundColor: hasOffer ? '#10B981' + '08' : T.primary + '06',
                borderBottomWidth: 1, borderBottomColor: T.border,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: meta.color + '18',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                  </View>
                  <View>
                    <Text style={{ fontWeight: '800', fontSize: 13, color: T.text }}>{q.quoteNumber}</Text>
                    <Text style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                      {new Date(q.createdAt).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
                <Badge status={q.status} />
              </View>

              {/* Body */}
              <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
                {q.validUntil && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: '#FFF8E1', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
                  }}>
                    <Text style={{ fontSize: 13 }}>⏳</Text>
                    <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                      Valable jusqu'au {new Date(q.validUntil).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                )}

                {hasOffer ? (
                  /* Price breakdown when offer received */
                  <View style={{
                    backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: '#BBF7D0',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534',
                      letterSpacing: 1, marginBottom: 10 }}>OFFRE REÇUE</Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: '#4B5563' }}>Prix proposé</Text>
                      <Text style={{ fontSize: 13, color: '#4B5563',
                        textDecorationLine: discount > 0 ? 'line-through' : 'none' }}>
                        {total.toFixed(3)} TND
                      </Text>
                    </View>

                    {discount > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, color: '#10B981', fontWeight: '700' }}>
                          Remise {discount}%
                        </Text>
                        <Text style={{ fontSize: 13, color: '#10B981', fontWeight: '700' }}>
                          − {(total * discount / 100).toFixed(3)} TND
                        </Text>
                      </View>
                    )}

                    <View style={{
                      borderTopWidth: 1, borderTopColor: '#BBF7D0',
                      marginTop: 8, paddingTop: 10,
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#166534' }}>Prix final</Text>
                      <Text style={{ fontWeight: '900', fontSize: 24, color: '#166534' }}>
                        {finalPrice.toFixed(3)} <Text style={{ fontSize: 13 }}>TND</Text>
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: T.muted, fontWeight: '600' }}>En cours d'évaluation</Text>
                    <Text style={{ fontSize: 13, color: T.muted }}>—</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
