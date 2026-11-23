import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { T } from '../constants/theme';
import { useAuthStore } from '../stores/authStore';
import CartHeaderButton from '../components/CartHeaderButton';
import TabNavigator from './TabNavigator';
import ProductScreen from '../screens/ProductScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FidelityScreen from '../screens/FidelityScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminAdsScreen from '../screens/AdminAdsScreen';
import AdminProductFormScreen from '../screens/AdminProductFormScreen';
import AdminSettingsScreen from '../screens/AdminSettingsScreen';
import AdminCompanyScreen from '../screens/AdminCompanyScreen';
import AdminBundleFormScreen from '../screens/AdminBundleFormScreen';
import AdminUserFormScreen from '../screens/AdminUserFormScreen';
import AdminAdFormScreen from '../screens/AdminAdFormScreen';
import QuoteDetailScreen from '../screens/QuoteDetailScreen';
import AdminFacturesScreen from '../screens/AdminFacturesScreen';
import FacturesScreen from '../screens/FacturesScreen';

const adminHeader = {
  headerStyle: { backgroundColor: '#FFF' },
  headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
  headerTintColor: T.primary,
  headerBackTitleVisible: false,
  headerShadowVisible: true,
};

const Root = createNativeStackNavigator();
const App = createNativeStackNavigator();

function AppNavigator() {
  return (
    <App.Navigator>
      <App.Screen name="Main" component={TabNavigator}
        options={{ headerShown: false }} />
      <App.Screen name="Product" component={ProductScreen}
        options={({ route }) => ({
          title: route.params?.product?.name || 'Produit',
          headerStyle: { backgroundColor: '#FFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
          headerTintColor: T.primary,
          headerBackTitleVisible: false,
          headerShadowVisible: true,
          headerRight: () => <CartHeaderButton />,
        })} />
      <App.Screen name="Cart" component={CartScreen}
        options={{
          title: 'Mon Panier',
          headerStyle: { backgroundColor: '#FFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
          headerTintColor: T.primary,
          headerBackTitleVisible: false,
          headerShadowVisible: true,
        }} />
      <App.Screen name="Checkout" component={CheckoutScreen}
        options={{
          title: 'Finaliser la commande',
          headerStyle: { backgroundColor: '#FFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
          headerTintColor: T.primary,
          headerBackTitleVisible: false,
          headerShadowVisible: true,
        }} />
      <App.Screen name="Notifications" component={NotificationsScreen}
        options={{
          title: 'Notifications',
          headerStyle: { backgroundColor: '#FFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
          headerTintColor: T.primary,
          headerBackTitleVisible: false,
          headerShadowVisible: true,
        }} />
      <App.Screen name="Fidelity" component={FidelityScreen}
        options={{
          title: 'Fidélité',
          headerStyle: { backgroundColor: '#FFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
          headerTintColor: T.primary,
          headerBackTitleVisible: false,
          headerShadowVisible: true,
        }} />
      <App.Screen name="AdminUsers" component={AdminUsersScreen}
        options={{
          title: 'Mes clients',
          headerStyle: { backgroundColor: '#FFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
          headerTintColor: T.primary,
          headerBackTitleVisible: false,
          headerShadowVisible: true,
        }} />
      <App.Screen name="AdminAds" component={AdminAdsScreen}
        options={{
          title: 'Publicités & Packs',
          headerStyle: { backgroundColor: '#FFF' },
          headerTitleStyle: { fontWeight: '800', fontSize: 18, color: T.text },
          headerTintColor: T.primary,
          headerBackTitleVisible: false,
          headerShadowVisible: true,
        }} />
      <App.Screen name="AdminProductForm" component={AdminProductFormScreen}
        options={{ title: 'Article', ...adminHeader }} />
      <App.Screen name="AdminSettings" component={AdminSettingsScreen}
        options={{ title: 'Règlements & livraison', ...adminHeader }} />
      <App.Screen name="AdminCompany" component={AdminCompanyScreen}
        options={{ title: 'Société', ...adminHeader }} />
      <App.Screen name="AdminBundleForm" component={AdminBundleFormScreen}
        options={{ title: 'Pack', ...adminHeader }} />
      <App.Screen name="AdminUserForm" component={AdminUserFormScreen}
        options={{ title: 'Client', ...adminHeader }} />
      <App.Screen name="AdminAdForm" component={AdminAdFormScreen}
        options={{ title: 'Publicité', ...adminHeader }} />
      <App.Screen name="QuoteDetail" component={QuoteDetailScreen}
        options={{ title: 'Devis', ...adminHeader }} />
      <App.Screen name="AdminFactures" component={AdminFacturesScreen}
        options={{ title: 'Factures', ...adminHeader }} />
      <App.Screen name="Factures" component={FacturesScreen}
        options={{ title: 'Mes factures', ...adminHeader }} />
    </App.Navigator>
  );
}

export default function RootNavigator() {
  const { hydrated, hydrate, hasSeenOnboarding } = useAuthStore();

  useEffect(() => { hydrate(); }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  return (
    <Root.Navigator id="Root" screenOptions={{ headerShown: false }}>
      {/* Onboarding shown only on first launch */}
      {!hasSeenOnboarding && (
        <Root.Screen name="Onboarding" component={OnboardingScreen} />
      )}

      {/* Main app — always accessible without login */}
      <Root.Screen name="App" component={AppNavigator} />

      {/* Auth screens — reachable from anywhere in the app */}
      <Root.Screen name="Login" component={LoginScreen} />
      <Root.Screen name="Register" component={RegisterScreen} />
      <Root.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Root.Navigator>
  );
}
