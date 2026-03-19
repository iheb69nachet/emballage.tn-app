import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView,
  Platform, ScrollView, SafeAreaView } from 'react-native';
import { useApp } from '../context/AppContext';
import { T } from '../constants/theme';
import Btn from './Btn';

const inputStyle = {
  backgroundColor: '#F8F8FA',
  borderRadius: 14,
  padding: 15,
  fontSize: 14,
  color: '#111',
  marginBottom: 12,
  borderWidth: 1.5,
  borderColor: '#EBEBEB',
};

function buildNeedsFromItems(items) {
  if (!items || items.length === 0) return '';
  const lines = items.map(i =>
    `• ${i.name} — qté: ${i.qty} (${Number(i.price).toFixed(3)} TND/${i.unit || 'pièce'})`
  );
  return 'Produits demandés :\n' + lines.join('\n') + '\n\nPrécisions supplémentaires :';
}

export default function QuoteSheet() {
  const { quoteModal, setQuoteModal, quoteItems, submitQuote, currentUser } = useApp();
  const [form, setForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', needs: '' });

  useEffect(() => {
    if (quoteModal) {
      setForm({
        contactName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '',
        contactEmail: currentUser?.email || '',
        contactPhone: '',
        needs: buildNeedsFromItems(quoteItems),
      });
    }
  }, [quoteModal]);

  const handleSend = async () => {
    await submitQuote(form);
    setForm({ contactName: '', contactEmail: '', contactPhone: '', needs: '' });
  };

  return (
    <Modal visible={quoteModal} transparent animationType="slide"
      onRequestClose={() => setQuoteModal(false)} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1} onPress={() => setQuoteModal(false)} />

        <View style={{
          backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          maxHeight: '88%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12, shadowRadius: 16, elevation: 24,
        }}>
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12,
                backgroundColor: T.primary + '15', alignItems: 'center', justifyContent: 'center',
                marginRight: 12 }}>
                <Text style={{ fontSize: 20 }}>📋</Text>
              </View>
              <View>
                <Text style={{ fontWeight: '800', fontSize: 17, color: T.text }}>Demander un devis</Text>
                <Text style={{ color: T.muted, fontSize: 12, marginTop: 1 }}>Réponse sous 24h ouvrables</Text>
              </View>
            </View>

            {/* Products summary */}
            {quoteItems.length > 0 && (
              <View style={{
                backgroundColor: T.primary + '08', borderRadius: 14, padding: 14,
                marginTop: 14, marginBottom: 4, borderWidth: 1, borderColor: T.primary + '20',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: T.primary,
                  letterSpacing: 1, marginBottom: 8 }}>PRODUITS INCLUS</Text>
                {quoteItems.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: T.text, flex: 1 }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 13, color: T.muted, fontWeight: '700', marginLeft: 8 }}>×{item.qty}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 18 }} />

            <TextInput placeholder="Nom / société" placeholderTextColor={T.muted}
              value={form.contactName} onChangeText={v => setForm(f => ({ ...f, contactName: v }))}
              style={inputStyle} />
            <TextInput placeholder="Email" placeholderTextColor={T.muted}
              keyboardType="email-address" autoCapitalize="none"
              value={form.contactEmail} onChangeText={v => setForm(f => ({ ...f, contactEmail: v }))}
              style={inputStyle} />
            <TextInput placeholder="Téléphone" placeholderTextColor={T.muted}
              keyboardType="phone-pad"
              value={form.contactPhone} onChangeText={v => setForm(f => ({ ...f, contactPhone: v }))}
              style={inputStyle} />
            <TextInput placeholder="Décrivez vos besoins..." multiline numberOfLines={5}
              placeholderTextColor={T.muted}
              value={form.needs} onChangeText={v => setForm(f => ({ ...f, needs: v }))}
              style={{ ...inputStyle, minHeight: 120, textAlignVertical: 'top', marginBottom: 20 }} />

            <Btn label="Envoyer la demande" icon="📤" bg={T.primary} size="lg" onPress={handleSend} />
            <TouchableOpacity onPress={() => setQuoteModal(false)} style={{ marginTop: 10, paddingVertical: 10 }}>
              <Text style={{ textAlign: 'center', color: T.muted, fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
          <SafeAreaView />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
