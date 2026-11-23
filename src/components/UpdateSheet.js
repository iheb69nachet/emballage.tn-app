import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/theme';
import { useOtaUpdates } from '../hooks/useOtaUpdates';

/**
 * Bottom sheet shown when an OTA update is detected.
 * available → "Mettre à jour" / "Plus tard"
 * downloading → progress bar (%)
 * pending → already downloaded, "Redémarrer" / "Plus tard"
 * ready → restarting
 * error → retry
 */
export default function UpdateSheet() {
  const insets = useSafeAreaInsets();
  const { status, progress, error, download, restart, dismiss } = useOtaUpdates();
  const visible = status !== 'idle';

  const slide = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  useEffect(() => {
    Animated.timing(bar, { toValue: progress, duration: 200, useNativeDriver: false }).start();
  }, [progress, bar]);

  if (!visible) return null;

  const pct = Math.round(progress * 100);
  const width = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });

  const title =
    status === 'available'   ? 'Nouvelle version disponible' :
    status === 'downloading' ? 'Téléchargement de la mise à jour…' :
    status === 'pending'     ? 'Mise à jour prête' :
    status === 'ready'       ? 'Mise à jour installée' :
                               'Mise à jour impossible';
  const subtitle =
    status === 'available'   ? 'Une mise à jour de l\'application est prête. Elle s\'installe en quelques secondes.' :
    status === 'downloading' ? `${pct} %` :
    status === 'pending'     ? 'Redémarrez l\'application pour appliquer la nouvelle version.' :
    status === 'ready'       ? 'Redémarrage de l\'application…' :
                               (error || 'Vérifiez votre connexion puis réessayez.');

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end' }}>
      {(status === 'downloading' || status === 'ready') && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} />
      )}
      <Animated.View style={{
        transform: [{ translateY }],
        backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 + insets.bottom,
        shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.primary + '14', alignItems: 'center', justifyContent: 'center' }}>
            {status === 'downloading' || status === 'ready'
              ? <ActivityIndicator color={T.primary} />
              : <Text style={{ fontSize: 22 }}>{status === 'error' ? '⚠️' : status === 'pending' ? '✅' : '🚀'}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: T.text }}>{title}</Text>
            <Text style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 17 }}>{subtitle}</Text>
          </View>
        </View>

        {(status === 'downloading' || status === 'ready') && (
          <View style={{ marginTop: 16 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: T.border, overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', width, backgroundColor: T.primary, borderRadius: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontSize: 11, color: T.muted }}>{status === 'ready' ? 'Terminé' : 'Ne fermez pas l\'application'}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: T.primary, fontVariant: ['tabular-nums'] }}>{pct} %</Text>
            </View>
          </View>
        )}

        {status === 'available' && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity onPress={dismiss} activeOpacity={0.8}
              style={{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: T.border }}>
              <Text style={{ color: T.muted, fontWeight: '700', fontSize: 14 }}>Plus tard</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={download} activeOpacity={0.8}
              style={{ flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: T.primary }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>⬇️ Mettre à jour</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'error' && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity onPress={dismiss} activeOpacity={0.8}
              style={{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: T.border }}>
              <Text style={{ color: T.muted, fontWeight: '700', fontSize: 14 }}>Fermer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={download} activeOpacity={0.8}
              style={{ flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: T.primary }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>🔄 Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'pending' && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity onPress={dismiss} activeOpacity={0.8}
              style={{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: T.border }}>
              <Text style={{ color: T.muted, fontWeight: '700', fontSize: 14 }}>Plus tard</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={restart} activeOpacity={0.8}
              style={{ flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: T.primary }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>🔄 Redémarrer maintenant</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
