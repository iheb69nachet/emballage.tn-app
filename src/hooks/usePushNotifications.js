import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notifications as notifApi } from '../services/api';
import { openNotification } from '../services/navigation';

// How foreground notifications are handled (show banner + sound)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** The deep-link payload the API attaches to every push. */
const dataOf = (notif) => notif?.request?.content?.data ?? {};

export function usePushNotifications({ isAuthenticated, onNotification }) {
  const receivedRef = useRef(null);
  const responseRef = useRef(null);
  // A cold start opens the notification once; a re-render must not replay it.
  const coldStartHandled = useRef(false);
  // The cold-start response is also delivered to the listener on some platforms
  const handledIds = useRef(new Set());

  /** Navigate once per tapped notification, whichever path delivered it. */
  const handleResponse = (response) => {
    const id = response?.notification?.request?.identifier;
    if (id) {
      if (handledIds.current.has(id)) return;
      handledIds.current.add(id);
    }
    openNotification(dataOf(response?.notification));
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    async function setup() {
      try {
        // Request permission
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // Android channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#1E6B4C',
          });
        }

        // Get Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '650f7b21-3677-4921-9769-47cece705e9a',
        });
        const token = tokenData.data;

        // Save token to backend (fire and forget)
        notifApi.savePushToken(token).catch(() => {});
      } catch (_) {}
    }

    setup();

    // The app was opened by tapping a notification while it was killed
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) handleResponse(response);
        })
        .catch(() => {});
    }

    // Listen for foreground notifications
    receivedRef.current = Notifications.addNotificationReceivedListener((notif) => {
      if (onNotification) {
        onNotification({
          title: notif.request.content.title,
          body: notif.request.content.body,
          data: dataOf(notif),
        });
      }
    });

    // The user tapped the notification (app in foreground or background)
    responseRef.current = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, [isAuthenticated]);
}
