import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../constants/theme';
import CartHeaderButton from '../components/CartHeaderButton';
import HomeScreen from '../screens/HomeScreen';
import CatalogueScreen from '../screens/CatalogueScreen';
import OrdersScreen from '../screens/OrdersScreen';
import QuotesScreen from '../screens/QuotesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home',      icon: '🏠', label: 'Accueil'  },
  { name: 'Catalogue', icon: '📦', label: 'Catalogue' },
  { name: 'Orders',    icon: '🚚', label: 'Commandes' },
  { name: 'Quotes',    icon: '📋', label: 'Devis'     },
  { name: 'Profile',   icon: '👤', label: 'Profil'    },
];

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      backgroundColor: '#FFF', flexDirection: 'row',
      borderTopWidth: 1, borderTopColor: T.border,
      paddingBottom: insets.bottom + 6,
      paddingTop: 8,
    }}>
      {state.routes.map((route, index) => {
        const tab = TABS.find(t => t.name === route.name) || TABS[index];
        const active = state.index === index;

        return (
          <TouchableOpacity key={route.key}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
            style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              alignItems: 'center', justifyContent: 'center',
           paddingVertical: 6, borderRadius: 16,
              backgroundColor: active ? T.primary + '12' : 'transparent',
              minWidth: 52,
            }}>
              <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
              <Text style={{
                fontSize: 9, marginTop: 3,
                fontWeight: active ? '500' : '500',
                color: active ? T.primary : T.muted,
              }}>{tab.label}</Text>
            </View>
            {active && (
              <View style={{ width: 20, height: 3, borderRadius: 2,
                backgroundColor: T.accent, marginTop: 1 }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const headerBase = {
  headerStyle: { backgroundColor: '#FFF' },
  headerTitleStyle: { fontWeight: '800', fontSize: 20, color: T.text },
  headerShadowVisible: true,
  headerRight: () => <CartHeaderButton />,
};

function HomeTitle() {
  return (
    <Text style={{ fontSize: 20, fontWeight: '800', color: T.text }}>
      emballage<Text style={{ color: T.accent }}>.tn</Text>
    </Text>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={headerBase}>
      <Tab.Screen name="Home"      component={HomeScreen}
        options={{ headerTitle: () => <HomeTitle /> }} />
      <Tab.Screen name="Catalogue" component={CatalogueScreen}
        options={{ title: 'Catalogue' }} />
      <Tab.Screen name="Orders"    component={OrdersScreen}
        options={{ title: 'Commandes' }} />
      <Tab.Screen name="Quotes"    component={QuotesScreen}
        options={{ title: 'Devis' }} />
      <Tab.Screen name="Profile"   component={ProfileScreen}
        options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
