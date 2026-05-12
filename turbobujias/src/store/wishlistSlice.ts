import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../data';

interface WishlistState {
  items: Product[];
  isOpen: boolean;
}

const initialState: WishlistState = {
  items: JSON.parse(localStorage.getItem('wishlist_items') || '[]'),
  isOpen: false,
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    toggleWishlist: (state, action: PayloadAction<Product>) => {
      const existingIndex = state.items.findIndex(p => p.id === action.payload.id);
      if (existingIndex >= 0) {
        state.items.splice(existingIndex, 1);
      } else {
        state.items.push(action.payload);
      }
      localStorage.setItem('wishlist_items', JSON.stringify(state.items));
    },
    removeFromWishlist: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(p => p.id !== action.payload);
      localStorage.setItem('wishlist_items', JSON.stringify(state.items));
    },
    setWishlistOpen: (state, action: PayloadAction<boolean>) => {
      state.isOpen = action.payload;
    },
    clearWishlist: (state) => {
      state.items = [];
      localStorage.removeItem('wishlist_items');
    }
  },
});

export const { toggleWishlist, removeFromWishlist, setWishlistOpen, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
