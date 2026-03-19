import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from './src/components/Toast';
import QuoteSheet from './src/components/QuoteSheet';
import { View } from 'react-native';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

async function checkForUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    Alert.alert('OTA Error', String(e?.message || e));
  }
}

export default function App() {
  useEffect(() => {
    if (!__DEV__) checkForUpdate();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <View style={{ flex: 1 }}>
            <RootNavigator />
            <Toast />
            <QuoteSheet />
          </View>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
