import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { T } from '../constants/theme';
import CartHeaderButton from '../components/CartHeaderButton';
import NotificationBell from '../components/NotificationBell';
import { useApp } from '../context/AppContext';
import { useAuthStore } from '../stores/authStore';
import HomeScreen from '../screens/HomeScreen';
import CatalogueScreen from '../screens/CatalogueScreen';
import OrdersScreen from '../screens/OrdersScreen';
import QuotesScreen from '../screens/QuotesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminOrdersScreen from '../screens/AdminOrdersScreen';
import AdminQuotesScreen from '../screens/AdminQuotesScreen';
import AdminProductsScreen from '../screens/AdminProductsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
      <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
    </View>
  );
}

function HeaderRight() {
  const { authToken } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
      <NotificationBell isAuthenticated={!!authToken} />
      <CartHeaderButton />
    </View>
  );
}

function AdminHeaderRight() {
  const { authToken } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
      <NotificationBell isAuthenticated={!!authToken} />
    </View>
  );
}

function HomeTitle() {
  return (
    <Text style={{ fontSize: 20, fontWeight: '800', color: T.text }}>
      emballage<Text style={{ color: T.accent }}>.tn</Text>
    </Text>
  );
}

const headerBase = {
  headerStyle: { backgroundColor: '#FFF' },
  headerTitleStyle: { fontWeight: '800', fontSize: 20, color: T.text },
  headerShadowVisible: true,
  headerRight: () => <HeaderRight />,
};

const adminHeaderBase = {
  headerStyle: { backgroundColor: '#FFF' },
  headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
  headerShadowVisible: true,
  headerRight: () => <AdminHeaderRight />,
};

export default function TabNavigator() {
  const { user } = useAuthStore();
  const isAdmin = user?.roles?.includes('admin');

  return (
    <Tab.Navigator
      screenOptions={{
        ...(isAdmin ? adminHeaderBase : headerBase),
        tabBarActiveTintColor: T.primary,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopColor: T.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      {isAdmin ? (
        <>
          <Tab.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{
              headerTitle: () => <HomeTitle />,
              tabBarLabel: 'Dashboard',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="AdminOrders"
            component={AdminOrdersScreen}
            options={{
              title: 'Commandes',
              tabBarLabel: 'Commandes',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="AdminQuotes"
            component={AdminQuotesScreen}
            options={{
              title: 'Devis',
              tabBarLabel: 'Devis',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="AdminProducts"
            component={AdminProductsScreen}
            options={{
              title: 'Produits',
              tabBarLabel: 'Produits',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: 'Profil',
              tabBarLabel: 'Profil',
              tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
            }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              headerTitle: () => <HomeTitle />,
              tabBarLabel: 'Accueil',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Catalogue"
            component={CatalogueScreen}
            options={{
              title: 'Catalogue',
              tabBarLabel: 'Catalogue',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Orders"
            component={OrdersScreen}
            options={{
              title: 'Commandes',
              tabBarLabel: 'Commandes',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🚚" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Quotes"
            component={QuotesScreen}
            options={{
              title: 'Devis',
              tabBarLabel: 'Devis',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: 'Profil',
              tabBarLabel: 'Profil',
              tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
            }}
          />
        </>
      )}
    </Tab.Navigator>
  );
}
