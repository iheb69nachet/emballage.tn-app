import React, { createContext, useContext, useState } from 'react';
import * as api from '../services/api';
import { useAuthStore } from '../stores/authStore';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { token: authToken, user: currentUser, login, logout } = useAuthStore();
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState('');
  const [quoteModal, setQuoteModal] = useState(false);
  const [quoteItems, setQuoteItems] = useState([]);

  const showToast = msg => setToast(msg);

  const addToCart = (p, q) => {
    const n = q || p.minOrder || p.min || 1;
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      return ex
        ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + n } : i)
        : [...prev, { ...p, qty: n }];
    });
    showToast(p.name + ' ajouté ✓');
  };

  const removeFromCart = id => setCart(prev => prev.filter(i => i.id !== id));

  const updateQty = (id, delta) =>
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );

  const placeOrder = async (address, paymentMethod = 'a_la_livraison', coords = null, deliveryMode = 'livraison') => {
    const items = cart.map(i => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      price: Number(i.price),
      unit: i.unit || 'pièce',
    }));
    if (authToken) {
      await api.orders.create(items, address, paymentMethod, coords, deliveryMode);
    }
    setCart([]);
    showToast('Commande passée ! 🎉');
  };

  // Open quote modal pre-filled with items (from cart or single product)
  const openQuoteWithItems = (items = []) => {
    setQuoteItems(items);
    setQuoteModal(true);
  };

  const submitQuote = async (data) => {
    await api.quotes.create(data);
    setQuoteModal(false);
    setQuoteItems([]);
    showToast('Devis envoyé ! Réponse sous 24h 📋');
  };

  const cartCount = cart.length;
  const cartTotal = cart.reduce((s, i) => s + Number(i.price) * i.qty, 0);

  return (
    <AppContext.Provider value={{
      cart, addToCart, removeFromCart, updateQty, placeOrder, cartCount, cartTotal,
      toast, showToast, setToast,
      quoteModal, setQuoteModal, quoteItems, openQuoteWithItems, submitQuote,
      authToken, currentUser, login, logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
