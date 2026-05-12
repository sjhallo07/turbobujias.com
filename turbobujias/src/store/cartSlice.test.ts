import { describe, it, expect } from 'vitest';
import cartReducer, { addToCart, removeFromCart, updateQuantity } from './cartSlice';

describe('cartSlice reducer', () => {
  const initialState = {
    items: [],
    savedItems: [],
    isOpen: false,
  };

  it('should handle initial state', () => {
    expect(cartReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle addToCart', () => {
    const product = {
      id: 'p1',
      name: 'Test Product',
      brand: 'Test Brand',
      category: 'Spark Plug' as const,
      price: 100,
      image: 'test.jpg',
      description: 'Test',
      specs: {},
      stock: 5,
    };
    
    // Add product
    let state = cartReducer(initialState, addToCart(product));
    expect(state.items.length).toBe(1);
    expect(state.items[0].product.id).toBe('p1');
    expect(state.items[0].quantity).toBe(1);

    // Increment same product
    state = cartReducer(state, addToCart(product));
    expect(state.items.length).toBe(1);
    expect(state.items[0].quantity).toBe(2);
  });

  it('should handle removeFromCart', () => {
    const state = {
      ...initialState,
      items: [
        {
          product: {
            id: 'p1',
            name: 'Test Product',
            brand: 'Test Brand',
            category: 'Spark Plug' as const,
            price: 100,
            image: 'test.jpg',
            description: 'Test',
            specs: {},
            stock: 5,
          },
          quantity: 2
        }
      ]
    };

    const nextState = cartReducer(state, removeFromCart('p1'));
    expect(nextState.items.length).toBe(0);
  });
});
