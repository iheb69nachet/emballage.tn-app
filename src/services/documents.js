import { Linking } from 'react-native';
import * as api from './api';
import { showAlert } from './dialog';

/**
 * Opens the printable facture / devis in the device browser, where the user can
 * read it and use the browser's own print / "save as PDF" action.
 *
 * Going through the browser keeps this OTA-updatable: no PDF or WebView native
 * module is involved.
 */
async function open(kind, id) {
  try {
    const { url } = kind === 'invoice'
      ? await api.documents.invoiceLink(id)
      : await api.documents.quoteLink(id);
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error("Aucun navigateur disponible pour ouvrir le document.");
    await Linking.openURL(url);
  } catch (e) {
    showAlert('Document indisponible', e.message || "Impossible d'ouvrir le document.");
  }
}

export const openInvoice = (orderId) => open('invoice', orderId);
export const openQuote = (quoteId) => open('quote', quoteId);
