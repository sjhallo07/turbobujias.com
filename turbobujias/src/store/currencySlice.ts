import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';

interface CurrencyState {
  rates: {
    USD: number;
    VES: number;
    EUR: number;
  };
  lastUpdated: string | null;
  selectedCurrency: 'USD' | 'VES' | 'EUR';
  isLoading: boolean;
}

const initialState: CurrencyState = {
  rates: {
    USD: 1,
    VES: 36.5, // Default/Fallback
    EUR: 39.2, // Default/Fallback
  },
  lastUpdated: null,
  selectedCurrency: 'USD',
  isLoading: false,
};

export const fetchExchangeRates = createAsyncThunk('currency/fetchRates', async () => {
  const response = await fetch('/api/rates');
  return response.json();
});

const currencySlice = createSlice({
  name: 'currency',
  initialState,
  reducers: {
    setSelectedCurrency: (state, action: PayloadAction<'USD' | 'VES' | 'EUR'>) => {
      state.selectedCurrency = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExchangeRates.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchExchangeRates.fulfilled, (state, action) => {
        state.rates.VES = action.payload.VES;
        state.rates.EUR = action.payload.EUR;
        state.lastUpdated = action.payload.lastUpdated;
        state.isLoading = false;
      })
      .addCase(fetchExchangeRates.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const { setSelectedCurrency } = currencySlice.actions;
export default currencySlice.reducer;
