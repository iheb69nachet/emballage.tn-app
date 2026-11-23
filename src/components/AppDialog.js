import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { T } from '../constants/theme';
import { KIND_META, useDialogStore } from '../services/dialog';

/**
 * Themed alert / confirm dialog. Driven by showAlert() in services/dialog.js.
 * Mounted once in App.js — never render it in a screen.
 */
export default function AppDialog({ nested = false }) {
  const dialog = useDialogStore(s => s.dialog);
  const hide = useDialogStore(s => s.hide);
  const hosts = useDialogStore(s => s.hosts);
  const addHost = useDialogStore(s => s.addHost);
  const removeHost = useDialogStore(s => s.removeHost);

  // Register as the active host while mounted inside a screen Modal
  useEffect(() => {
    if (!nested) return undefined;
    addHost();
    return () => removeHost();
  }, [nested]);
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dialog) return;
    scale.setValue(0.92); opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
    ]).start();
  }, [dialog]);

  if (!dialog) return null;
  // A nested host is open: it renders the dialog, the root host stays silent
  if (!nested && hosts > 0) return null;

  const meta = KIND_META[dialog.kind] || KIND_META.info;
  const buttons = dialog.buttons;
  const cancelBtn = buttons.find(b => b.style === 'cancel');
  const stacked = buttons.length > 2 || buttons.some(b => (b.text || '').length > 18);

  const press = (b) => {
    hide();
    // Let the modal close before running the handler (avoids stacking dialogs / alerts)
    if (b?.onPress) setTimeout(() => b.onPress(), 60);
  };
  const dismiss = () => {
    if (!dialog.dismissable) return;
    press(cancelBtn || (buttons.length === 1 ? buttons[0] : null));
  };

  const btnStyle = (b, i) => {
    const isCancel = b.style === 'cancel';
    const isDestructive = b.style === 'destructive';
    const primary = !isCancel && !isDestructive;
    return {
      flex: stacked ? undefined : 1,
      paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: isCancel ? '#FFF' : isDestructive ? T.danger : T.primary,
      borderWidth: isCancel ? 1.5 : 0, borderColor: T.border,
    };
  };
  const btnText = (b) => ({
    fontSize: 15, fontWeight: '800',
    color: b.style === 'cancel' ? T.text : '#FFF',
  });

  // Keep the cancel button first in row layout (left), last in stacked layout (bottom)
  const ordered = stacked
    ? [...buttons.filter(b => b.style !== 'cancel'), ...buttons.filter(b => b.style === 'cancel')]
    : buttons;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 20, 0.55)', opacity, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={dismiss} />
        <Animated.View style={{
          width: Math.min(width - 48, 400), backgroundColor: '#FFF', borderRadius: 24, padding: 22,
          transform: [{ scale }],
          shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 20,
        }}>
          {/* Icon */}
          <View style={{ alignSelf: 'center', width: 64, height: 64, borderRadius: 22, backgroundColor: meta.color + '16', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 30 }}>{dialog.icon}</Text>
          </View>

          {!!dialog.title && (
            <Text style={{ fontSize: 18, fontWeight: '800', color: T.text, textAlign: 'center', lineHeight: 24 }}>
              {dialog.title}
            </Text>
          )}
          {!!dialog.message && (
            <Text style={{ fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 21, marginTop: dialog.title ? 8 : 0 }}>
              {dialog.message}
            </Text>
          )}

          <View style={{ marginTop: 20, flexDirection: stacked ? 'column' : 'row', gap: 10 }}>
            {ordered.map((b, i) => (
              <Pressable key={`${b.text}-${i}`} onPress={() => press(b)}
                style={({ pressed }) => [btnStyle(b, i), pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}>
                <Text style={btnText(b)} numberOfLines={1}>{b.text || 'OK'}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
