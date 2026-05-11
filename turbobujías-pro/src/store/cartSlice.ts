import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../data';
import { RootState } from './index';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  savedItems: CartItem[];
  isOpen: boolean;
}

const initialState: CartState = {
  items: JSON.parse(localStorage.getItem('cart_items') || '[]'),
  savedItems: JSON.parse(localStorage.getItem('saved_items') || '[]'),
  isOpen: false,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<Product>) => {
      const existing = state.items.find(item => item.product.id === action.payload.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ product: action.payload, quantity: 1 });
      }
      localStorage.setItem('cart_items', JSON.stringify(state.items));
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.product.id !== action.payload);
      localStorage.setItem('cart_items', JSON.stringify(state.items));
    },
    updateQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const item = state.items.find(item => item.product.id === action.payload.id);
      if (item) {
        item.quantity = action.payload.quantity;
      }
      localStorage.setItem('cart_items', JSON.stringify(state.items));
    },
    toggleCart: (state, action: PayloadAction<boolean | undefined>) => {
      state.isOpen = action.payload !== undefined ? action.payload : !state.isOpen;
    },
    clearCart: (state) => {
      state.items = [];
      localStorage.removeItem('cart_items');
    },
    saveForLater: (state, action: PayloadAction<string>) => {
      const itemIndex = state.items.findIndex(item => item.product.id === action.payload);
      if (itemIndex !== -1) {
        const [item] = state.items.splice(itemIndex, 1);
        const existingSaved = state.savedItems.find(i => i.product.id === item.product.id);
        if (existingSaved) {
          existingSaved.quantity += item.quantity;
        } else {
          state.savedItems.push(item);
        }
        localStorage.setItem('cart_items', JSON.stringify(state.items));
        localStorage.setItem('saved_items', JSON.stringify(state.savedItems));
      }
    },
    moveToCart: (state, action: PayloadAction<string>) => {
      const itemIndex = state.savedItems.findIndex(item => item.product.id === action.payload);
      if (itemIndex !== -1) {
        const [item] = state.savedItems.splice(itemIndex, 1);
        const existingCart = state.items.find(i => i.product.id === item.product.id);
        if (existingCart) {
          existingCart.quantity += item.quantity;
        } else {
          state.items.push(item);
        }
        localStorage.setItem('cart_items', JSON.stringify(state.items));
        localStorage.setItem('saved_items', JSON.stringify(state.savedItems));
      }
    },
    removeFromSaved: (state, action: PayloadAction<string>) => {
      state.savedItems = state.savedItems.filter(item => item.product.id !== action.payload);
      localStorage.setItem('saved_items', JSON.stringify(state.savedItems));
    }
  },
});

export const { 
  addToCart, 
  removeFromCart, 
  updateQuantity, 
  toggleCart, 
  clearCart,
  saveForLater,
  moveToCart,
  removeFromSaved
} = cartSlice.actions;

export const selectCartItems = (state: RootState) => state.cart.items;
export const selectCartTotalItems = (state: RootState) => 
  state.cart.items.reduce((total, item) => total + item.quantity, 0);
export const selectCartTotalAmount = (state: RootState) => 
  state.cart.items.reduce((total, item) => total + item.product.price * item.quantity, 0);

export default cartSlice.reducer;
