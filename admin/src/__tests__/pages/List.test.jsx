import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import List from '~/pages/List';

// Mock currency import from App
jest.mock('~/App', () => ({ currency: '$' }));

// Mock toast
jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

// IMPORTANT: create the mock function INSIDE the factory
jest.mock('~/supabaseClient', () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(), // we'll configure this in the tests
  },
}));

import { toast } from 'react-toastify';
import { supabase } from '~/supabaseClient';

// --- Helpers to build the supabase method chains ---
const makeSelectChain = (data, error = null) => {
  const order = jest.fn().mockResolvedValue({ data, error });
  const select = jest.fn().mockReturnValue({ order });
  return { select, order };
};

const makeDeleteChain = (error = null) => {
  const eq = jest.fn().mockResolvedValue({ error });
  const del = jest.fn().mockReturnValue({ eq });
  return { delete: del, eq };
};

describe('List', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches products on mount and renders rows', async () => {
    const rows = [
      { id: 1, name: 'Widget A', category: 'Gadgets', price: 12.34, images: ['a.jpg'] },
      { id: 2, name: 'Widget B', category: 'Tools',   price: 56.78, images: ['b.jpg'] },
    ];

    // 1) SELECT chain for initial fetch
    const sel1 = makeSelectChain(rows);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    render(<List token="t123" />);

    // Table header & content
    expect(await screen.findByText('All Products List')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();

    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('Widget B')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    expect(screen.getByText('$56.78')).toBeInTheDocument();

    expect(supabase.from).toHaveBeenCalledWith('products');
  });

  test('shows toast.error when fetch fails', async () => {
    const err = new Error('Fetch failed');

    const sel1 = makeSelectChain(null, err);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    render(<List token="t123" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Fetch failed');
    });
  });

  test('delete product: success → toast.success and refresh list', async () => {
    const initialRows = [{ id: 101, name: 'Removable', category: 'Temp', price: 9.99, images: ['x.jpg'] }];
    const refreshedRows = []; // After deletion, nothing left

    // Call sequence:
    // 1) from('products').select().order()  -> initial fetch
    // 2) from('products').delete().eq()     -> delete
    // 3) from('products').select().order()  -> refresh fetch

    const sel1 = makeSelectChain(initialRows);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    const del = makeDeleteChain(null);
    supabase.from.mockReturnValueOnce({ delete: del.delete });

    const sel2 = makeSelectChain(refreshedRows);
    supabase.from.mockReturnValueOnce({ select: sel2.select });

    render(<List token="t123" />);

    const rowName = await screen.findByText('Removable');
    const row = rowName.closest('div');
    const action = within(row).getByText('X');
    fireEvent.click(action);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Product removed successfully!');
    });

    await waitFor(() => {
      expect(screen.queryByText('Removable')).not.toBeInTheDocument();
    });

    expect(supabase.from).toHaveBeenNthCalledWith(2, 'products'); // delete call
  });

  test('delete product: error → toast.error', async () => {
    const initialRows = [{ id: 202, name: 'KeepMe', category: 'Safe', price: 5.55, images: ['y.jpg'] }];

    const sel1 = makeSelectChain(initialRows);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    const delErr = makeDeleteChain(new Error('Cannot delete'));
    supabase.from.mockReturnValueOnce({ delete: delErr.delete });

    render(<List token="t123" />);

    const rowName = await screen.findByText('KeepMe');
    const row = rowName.closest('div');
    const action = within(row).getByText('X');
    fireEvent.click(action);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Cannot delete');
    });

    // Item still there
    expect(screen.getByText('KeepMe')).toBeInTheDocument();
  });
});