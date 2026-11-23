import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from './src/components/Toast';
import QuoteSheet from './src/components/QuoteSheet';
import UpdateSheet from './src/components/UpdateSheet';
import AppDialog from './src/components/AppDialog';
import { View } from 'react-native';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { navigationRef, flushPendingNotification } from './src/services/navigation';

// Inner component so it can access AppContext
function AppInner() {
  const { authToken, showToast } = useApp();

  usePushNotifications({
    isAuthenticated: !!authToken,
    onNotification: (notif) => {
      showToast(`${notif.title}: ${notif.body}`);
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <RootNavigator />
      <Toast />
      <QuoteSheet />
      <UpdateSheet />
      <AppDialog />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer ref={navigationRef} onReady={flushPendingNotification}>
          <AppInner />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
