import { create } from 'zustand';

/**
 * Themed replacement for React Native's Alert.alert.
 * Same signature: showAlert(title, message?, buttons?, options?)
 *   buttons: [{ text, onPress?, style?: 'default' | 'cancel' | 'destructive' }]
 *   options: { kind?: 'info' | 'success' | 'error' | 'warning' | 'question', icon?: string, dismissable?: boolean }
 * The dialog itself is rendered once by <AppDialog /> (mounted in App.js).
 */
export const useDialogStore = create((set) => ({
  dialog: null,
  show: (dialog) => set({ dialog }),
  hide: () => set({ dialog: null }),
  /** Number of <AppDialog nested /> hosts currently mounted inside an open RN Modal.
   *  On iOS a Modal rendered at the root cannot appear above another presented Modal,
   *  so screens that open a Modal mount a nested host and the root host steps aside. */
  hosts: 0,
  addHost: () => set(s => ({ hosts: s.hosts + 1 })),
  removeHost: () => set(s => ({ hosts: Math.max(0, s.hosts - 1) })),
}));

const DESTRUCTIVE_WORDS = /supprim|bloquer|annuler la|retirer|désactiver/i;

/** Pick an icon + accent from the title / buttons when the caller did not say. */
function inferKind(title = '', buttons = []) {
  const t = String(title);
  if (/^erreur|échec|invalide|impossible|manquant|requis/i.test(t)) return 'error';
  if (/envoyé|validé|succès|enregistré|bravo|merci/i.test(t)) return 'success';
  if (buttons.some(b => b.style === 'destructive') || DESTRUCTIVE_WORDS.test(t)) return 'warning';
  if (buttons.length > 1 || /\?$/.test(t.trim())) return 'question';
  return 'info';
}

export const KIND_META = {
  info:     { icon: '💬', color: '#2980B9' },
  success:  { icon: '✅', color: '#27AE60' },
  error:    { icon: '⚠️', color: '#C0392B' },
  warning:  { icon: '🚫', color: '#F39C12' },
  question: { icon: '💬', color: '#1A3D2B' },
};

/** Contextual icon from the dialog subject (first matching rule wins). */
const ICON_RULES = [
  [/supprim/i, '🗑️'],
  [/débloquer|réactiver/i, '🔓'],
  [/bloquer/i, '🚫'],
  [/caméra|photo|image|galerie/i, '📷'],
  [/facture/i, '🧾'],
  [/paiement|règlement|frais/i, '💳'],
  [/offre|devis|montant/i, '📋'],
  [/statut/i, '🔄'],
  [/commande/i, '📦'],
  [/produit|article/i, '📦'],
  [/catégorie/i, '🏷️'],
  [/publicité|bannière/i, '📣'],
  [/pack/i, '🎁'],
  [/compte|utilisateur|client/i, '👤'],
  [/lien|url/i, '🔗'],
  [/position|gps|localisation/i, '📍'],
  [/déconnexion|déconnecter/i, '👋'],
];

function inferIcon(kind, title = '', message = '') {
  if (kind === 'error') return '⚠️';
  if (kind === 'success') return '✅';
  const text = `${title} ${message}`;
  const hit = ICON_RULES.find(([re]) => re.test(text));
  return hit ? hit[1] : KIND_META[kind].icon;
}

export function showAlert(title, message, buttons, options = {}) {
  const btns = Array.isArray(buttons) && buttons.length ? buttons : [{ text: 'OK', style: 'default' }];
  const kind = options.kind || inferKind(title, btns);
  useDialogStore.getState().show({
    title: title || '',
    message: message || '',
    buttons: btns,
    kind,
    icon: options.icon || inferIcon(kind, title, message),
    dismissable: options.dismissable !== false,
  });
}

/** Convenience helpers */
export const dialog = {
  alert: showAlert,
  error: (message, title = 'Erreur') => showAlert(title, message, undefined, { kind: 'error' }),
  success: (title, message) => showAlert(title, message, undefined, { kind: 'success' }),
  info: (title, message) => showAlert(title, message, undefined, { kind: 'info' }),
  /** confirm(title, message, { confirmText, cancelText, destructive, onConfirm }) */
  confirm: (title, message, { confirmText = 'Confirmer', cancelText = 'Annuler', destructive = false, onConfirm, onCancel } = {}) =>
    showAlert(title, message, [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ], { kind: destructive ? 'warning' : 'question' }),
};
