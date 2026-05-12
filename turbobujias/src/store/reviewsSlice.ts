import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Review {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

interface ReviewsState {
  items: Review[];
}

const STORAGE_KEY = 'turbobujias_reviews';

const initialState: ReviewsState = {
  items: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
};

const reviewsSlice = createSlice({
  name: 'reviews',
  initialState,
  reducers: {
    addReview: (state, action: PayloadAction<Review>) => {
      state.items.unshift(action.payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    },
  },
});

export const { addReview } = reviewsSlice.actions;
export default reviewsSlice.reducer;
