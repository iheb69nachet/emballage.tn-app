export const PRODUCTS = [
  { id: 1, name: 'Boîte Carton Simple', ref: 'BCS-100', cat: 'Carton', price: 0.45, unit: 'pièce', min: 500, stock: 'Disponible', img: '📦', desc: "Boîte standard simple cannelure, idéale pour l'expédition courrier et e-commerce." },
  { id: 2, name: 'Sac Kraft Brun', ref: 'SKB-250', cat: 'Sac', price: 0.18, unit: 'pièce', min: 1000, stock: 'Disponible', img: '🛍️', desc: 'Sac en papier kraft naturel résistant avec poignées torsadées.' },
  { id: 3, name: 'Film Étirable', ref: 'FET-500', cat: 'Film', price: 12.5, unit: 'rouleau', min: 10, stock: 'Disponible', img: '🎞️', desc: 'Film plastique étirable transparent pour palettisation et protection.' },
  { id: 4, name: 'Boîte Carton Double', ref: 'BCD-200', cat: 'Carton', price: 0.85, unit: 'pièce', min: 200, stock: 'Sur commande', img: '📫', desc: 'Double cannelure haute résistance pour expédition de produits lourds.' },
  { id: 5, name: 'Ruban Adhésif 48mm', ref: 'RAD-48', cat: 'Accessoire', price: 1.20, unit: 'rouleau', min: 50, stock: 'Disponible', img: '🔖', desc: 'Ruban adhésif transparent extra-fort 48mm × 66m.' },
  { id: 6, name: 'Papier Bulle 100cm', ref: 'PB-100', cat: 'Protection', price: 8.90, unit: 'rouleau', min: 5, stock: 'Disponible', img: '🫧', desc: "Film à bulles d'air 100cm de large, protection optimale objets fragiles." },
  { id: 7, name: 'Sac Plastique', ref: 'SPT-30', cat: 'Sac', price: 0.08, unit: 'pièce', min: 2000, stock: 'Disponible', img: '🗃️', desc: 'Sac polyéthylène transparent haute clarté, usage alimentaire.' },
  { id: 8, name: 'Intercalaire Carton', ref: 'IC-60', cat: 'Protection', price: 0.25, unit: 'pièce', min: 300, stock: 'Sur commande', img: '🗂️', desc: 'Feuille intercalaire carton pour séparation et protection sur palette.' },
];

export const ADS = [
  { tag: '🔥 OFFRE', title: '-30% sur les cartons', sub: 'Code: CARTON30', bg: '#1A3D2B', acc: '#C8A84B' },
  { tag: '🚀 NOUVEAU', title: 'Livraison express 24h', sub: 'Commandes > 500 TND', bg: '#0D2137', acc: '#4FC3F7' },
  { tag: '🎁 FIDÉLITÉ', title: 'Programme fidélité B2B', sub: 'Cumulez des points', bg: '#5D1A3D', acc: '#F48FB1' },
  { tag: '💼 PRO', title: 'Tarifs dégressifs', sub: 'Dès 1 000 pièces', bg: '#3D2B1A', acc: '#FFB74D' },
];

export const BUNDLES = [
  {
    id: 1, name: 'Pack Expédition Starter', badge: '⚡ Best-seller', bc: '#E74C3C',
    items: ['500× Boîte Carton Simple', '5× Ruban Adhésif', '2× Papier Bulle'],
    orig: 248.50, price: 179.00, saving: 69.50, pct: 28, icon: '📦',
  },
  {
    id: 2, name: 'Pack Commerce Essentiel', badge: '🌟 Populaire', bc: '#8E44AD',
    items: ['1000× Sac Kraft Brun', '500× Sac Plastique', '10× Ruban Adhésif'],
    orig: 312.00, price: 219.00, saving: 93.00, pct: 30, icon: '🛍️',
  },
  {
    id: 3, name: 'Pack Industrie Pro', badge: '💎 Premium', bc: '#1A3D2B',
    items: ['200× Boîte Carton Double', '5× Film Étirable', '300× Intercalaire'],
    orig: 542.00, price: 389.00, saving: 153.00, pct: 28, icon: '🏭',
  },
];

export const ORDERS = [
  { id: 'CMD-2024-0312', date: '12/02/2024', status: 'Livré', total: 1240.00, items: 3 },
  { id: 'CMD-2024-0289', date: '28/01/2024', status: 'En cours', total: 875.50, items: 2 },
  { id: 'CMD-2024-0251', date: '10/01/2024', status: 'En transit', total: 430.00, items: 1 },
];

export const QUOTES = [
  { id: 'DEV-2024-021', date: '15/02/2024', status: 'Accepté', total: 3200.00, val: '15/03/2024' },
  { id: 'DEV-2024-018', date: '05/02/2024', status: 'En attente', total: 1850.00, val: '05/03/2024' },
  { id: 'DEV-2024-010', date: '20/01/2024', status: 'Expiré', total: 920.00, val: '20/02/2024' },
];

export const CATS = ['Tous', 'Carton', 'Sac', 'Film', 'Protection', 'Accessoire'];
