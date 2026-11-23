import { createNavigationContainerRef } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';

export const navigationRef = createNavigationContainerRef();

/** A notification tapped before the navigator is mounted is replayed once it is. */
let pending = null;

const isAdmin = () => !!useAuthStore.getState().user?.roles?.includes('admin');

/** Jump into the "App" stack (everything the app shows once past login lives there). */
const inApp = (screen, params) => ['App', { screen, params }];
/** Jump to one of the bottom tabs, optionally opening one row on it. */
const inTab = (tab, params) => inApp('Main', { screen: tab, params });

/**
 * Where a notification payload points.
 * data: { type: 'quote' | 'order' | 'admin_quote' | 'admin_order' | 'fidelity', id?, reference? }
 */
function targetFor(data) {
  switch (data?.type) {
    case 'quote':
      return data?.id ? inApp('QuoteDetail', { quoteId: data.id }) : inTab('Quotes');
    case 'order':
      return inTab('Orders');
    case 'admin_quote':
      return isAdmin()
        ? inTab('AdminQuotes', data?.id ? { quoteId: data.id } : undefined)
        : inTab('Quotes');
    case 'admin_order':
      return isAdmin()
        ? inTab('AdminOrders', data?.id ? { orderId: data.id } : undefined)
        : inTab('Orders');
    case 'fidelity':
      return inApp('Fidelity', undefined);
    default:
      return inApp('Notifications', undefined);
  }
}

/** Open the screen a notification points at; queues the jump until the navigator is ready. */
export function openNotification(data) {
  if (!navigationRef.isReady()) {
    pending = data ?? {};
    return;
  }
  const [name, params] = targetFor(data);
  navigationRef.navigate(name, params);
}

/** Called once the NavigationContainer is ready — replays a notification tapped on a cold start. */
export function flushPendingNotification() {
  if (!pending) return;
  const data = pending;
  pending = null;
  openNotification(data);
}
