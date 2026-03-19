import { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { T } from '../constants/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '📦',
    title: 'Bienvenue sur\nemballage.tn',
    subtitle: 'Votre fournisseur B2B en matériaux d\'emballage — cartons, films, sacs et bien plus.',
    bg: T.primary,
    accent: T.accent,
  },
  {
    icon: '🛒',
    title: 'Commandez\nen quelques clics',
    subtitle: 'Parcourez notre catalogue, ajoutez au panier et passez votre commande avec livraison à l\'adresse de votre choix.',
    bg: '#1E4D36',
    accent: T.accent,
  },
  {
    icon: '📋',
    title: 'Devis personnalisés\npour votre business',
    subtitle: 'Demandez un devis sur mesure. Notre équipe vous répond sous 24h avec une offre adaptée à vos besoins.',
    bg: '#16392A',
    accent: T.accent,
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (index) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrent(index);
  };

  const handleNext = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      navigation.navigate('App');
    }
  };

  const handleScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== current) setCurrent(index);
  };

  const slide = SLIDES[current];

  return (
    <View style={{ flex: 1, backgroundColor: slide.bg }}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}>
        {SLIDES.map((s, i) => (
          <Animated.View key={i} style={{
            width, flex: 1, paddingHorizontal: 36, paddingTop: 100,
            alignItems: 'center',
            opacity: i === current ? fadeAnim : 1,
          }}>
            {/* Icon bubble */}
            <View style={{
              width: 130, height: 130, borderRadius: 40,
              backgroundColor: s.accent,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 44,
              shadowColor: s.accent,
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.4, shadowRadius: 24, elevation: 16,
            }}>
              <Text style={{ fontSize: 64 }}>{s.icon}</Text>
            </View>

            <Text style={{
              color: '#FFF', fontSize: 30, fontWeight: '900',
              textAlign: 'center', lineHeight: 38, marginBottom: 18,
            }}>{s.title}</Text>

            <Text style={{
              color: 'rgba(255,255,255,0.65)', fontSize: 15,
              textAlign: 'center', lineHeight: 24,
            }}>{s.subtitle}</Text>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={{ paddingHorizontal: 36, paddingBottom: 52, paddingTop: 24 }}>
        {/* Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
              <View style={{
                height: 4, borderRadius: 2,
                backgroundColor: i === current ? slide.accent : 'rgba(255,255,255,0.25)',
                width: i === current ? 28 : 8,
              }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Next / Start button */}
        <TouchableOpacity onPress={handleNext} activeOpacity={0.85}
          style={{
            backgroundColor: slide.accent, borderRadius: 18,
            paddingVertical: 18, alignItems: 'center',
            shadowColor: slide.accent, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
          }}>
          <Text style={{ color: T.primary, fontWeight: '900', fontSize: 17 }}>
            {current === SLIDES.length - 1 ? 'Commencer →' : 'Suivant →'}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        {current < SLIDES.length - 1 && (
          <TouchableOpacity onPress={() => navigation.navigate('App')}
            style={{ marginTop: 14, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
