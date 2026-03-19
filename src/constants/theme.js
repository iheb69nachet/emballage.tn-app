export const T = {
  bg: '#F5F0E8', card: '#FFF', primary: '#1A3D2B', accent: '#C8A84B', accentL: '#E8D5A3',
  text: '#1C1C1C', muted: '#6B6B6B', border: '#E0D8CC',
  danger: '#C0392B', success: '#27AE60', warning: '#F39C12', info: '#2980B9',
};

export const statusColor = s =>
  ['Livré', 'Disponible', 'Accepté', 'Prix proposé'].includes(s) ? T.success :
  ['En cours', 'En attente', 'Sur commande'].includes(s) ? T.warning :
  s === 'En transit' ? T.info : s === 'Expiré' ? T.muted : T.muted;
