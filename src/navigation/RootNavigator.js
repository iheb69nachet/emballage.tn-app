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
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

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
    </App.Navigator>
  );
}

export default function RootNavigator() {
  const { token, hydrated, hydrate } = useAuthStore();

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
      {/* Onboarding always shown first for now */}
      <Root.Screen name="Onboarding" component={OnboardingScreen} />
      {token ? (
        <Root.Screen name="App" component={AppNavigator} />
      ) : (
        <>
          <Root.Screen name="Login" component={LoginScreen} />
          <Root.Screen name="Register" component={RegisterScreen} />
          <Root.Screen name="App" component={AppNavigator} />
        </>
      )}
    </Root.Navigator>
  );
}
