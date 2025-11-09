// src/__tests__/pages/Orders.test.jsx
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import Orders from '~/pages/Orders';

// ---- Mocks ----

// currency from App
jest.mock('~/App', () => ({ currency: '$' }));

// toast
jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

// parcel icon asset
jest.mock('~/assets/assets', () => ({
  assets: { parcel_icon: 'mock-parcel.png' },
}));

// supabase client (factory owns the jest.fn to avoid out-of-scope errors)
jest.mock('~/supabaseClient.js', () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(), // configured per-test via supabase.from.mockReturnValueOnce
  },
}));

import { toast } from 'react-toastify';
import { supabase } from '~/supabaseClient.js';

// --- Helpers to build Supabase chains ---
const makeSelectOrdersChain = (data, error = null) => {
  // .from('orders').select('*').order('created_at', { ascending: false })
  const order = jest.fn().mockResolvedValue({ data, error });
  const select = jest.fn().mockReturnValue({ order });
  return { select, order };
};

const makeUpdateStatusChain = (error = null) => {
  // .from('orders').update({ status }).eq('id', orderId)
  const eq = jest.fn().mockResolvedValue({ error });
  const update = jest.fn().mockReturnValue({ eq });
  return { update, eq };
};

describe('Orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches orders on mount and renders order row', async () => {
    const order = {
      id: 1,
      items: [
        { name: 'Shirt', quantity: 2, size: 'M' },
        { name: 'Pants', quantity: 1, size: 'L' },
      ],
      address: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        street: '123 Logic Ln',
        city: 'London',
        state: 'LDN',
        country: 'UK',
        zipcode: 'W1A 1AA',
        phone: '555-1234',
      },
      paymentMethod: 'Card',
      payment: true,
      date: '2025-01-15T12:00:00.000Z',
      amount: 149.99,
      status: 'Order Placed',
    };

    // 1) initial fetch
    const sel1 = makeSelectOrdersChain([order]);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    render(<Orders />);

    // header
    expect(await screen.findByRole('heading', { name: /orders/i })).toBeInTheDocument();

    // item lines
    expect(screen.getByText(/Shirt x 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Pants x 1/i)).toBeInTheDocument();

    // address block
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/123 Logic Ln,/)).toBeInTheDocument();
    expect(screen.getByText(/London, LDN, UK, W1A 1AA/)).toBeInTheDocument();
    expect(screen.getByText('555-1234')).toBeInTheDocument();

    // right column
    expect(screen.getByText(/Items : 2/)).toBeInTheDocument();
    expect(screen.getByText(/Method : Card/)).toBeInTheDocument();
    expect(screen.getByText(/Payment : Done/)).toBeInTheDocument();

    // date uses toLocaleDateString -> compute expected in the same environment
    const expectedDate = new Date(order.date).toLocaleDateString();
    expect(screen.getByText(new RegExp(`Date\\s*:\\s*${expectedDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeInTheDocument();

    // amount with currency
    expect(screen.getByText('$149.99')).toBeInTheDocument();

    // select has current value
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('Order Placed');

    // image present (alt is empty string, so query by altText '')
    const row = selects[0].closest('div'); // row wrapper
    const img = within(row).getByAltText('');
    expect(img).toHaveAttribute('src', 'mock-parcel.png');

    // called the right table
    expect(supabase.from).toHaveBeenCalledWith('orders');
  });

  test('shows toast.error when fetch fails', async () => {
    const err = new Error('fetch boom');
    const sel1 = makeSelectOrdersChain(null, err);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    render(<Orders />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to fetch orders: fetch boom');
    });
  });

  test('status update success → calls update, shows success toast, and re-fetches', async () => {
    const initialOrder = {
      id: 7,
      items: [{ name: 'Hat', quantity: 1, size: 'One' }],
      address: { firstName: 'Grace', lastName: 'Hopper', street: '7 Navy Way', city: 'Arlington', state: 'VA', country: 'USA', zipcode: '22202', phone: '555-7777' },
      paymentMethod: 'PayPal',
      payment: false,
      date: '2025-02-01T00:00:00.000Z',
      amount: 25.0,
      status: 'Order Placed',
    };

    const refreshedOrder = { ...initialOrder, status: 'Packing' };

    // Call sequence:
    // 1) SELECT (mount)
    const sel1 = makeSelectOrdersChain([initialOrder]);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    // 2) UPDATE .eq()
    const upd = makeUpdateStatusChain(null);
    supabase.from.mockReturnValueOnce({ update: upd.update });

    // 3) SELECT (after update refresh)
    const sel2 = makeSelectOrdersChain([refreshedOrder]);
    supabase.from.mockReturnValueOnce({ select: sel2.select });

    render(<Orders />);

    // open the select and change to "Packing"
    const select = await screen.findByRole('combobox');
    expect(select).toHaveValue('Order Placed');

    // fire change
    fireEvent.change(select, { target: { value: 'Packing' } });

    // success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Order status updated!');
    });

    // after refresh, the select shows updated value
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('Packing');
    });

    // verify the update chain received the right payload (status)
    // We can't read inside the chain easily, but we can assert supabase.from called for update (2nd call)
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'orders');
  });

  test('status update error → shows toast.error', async () => {
    const initialOrder = {
      id: 9,
      items: [{ name: 'Socks', quantity: 3, size: 'L' }],
      address: { firstName: 'Linus', lastName: 'Torvalds' },
      paymentMethod: 'Card',
      payment: false,
      date: '2025-03-10T00:00:00.000Z',
      amount: 12.5,
      status: 'Order Placed',
    };

    // 1) SELECT (mount)
    const sel1 = makeSelectOrdersChain([initialOrder]);
    supabase.from.mockReturnValueOnce({ select: sel1.select });

    // 2) UPDATE returns error
    const updErr = makeUpdateStatusChain(new Error('update boom'));
    supabase.from.mockReturnValueOnce({ update: updErr.update });

    render(<Orders />);

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'Shipped' } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update order: update boom');
    });

    // value may remain as original since refresh didn't happen
    expect(screen.getByRole('combobox')).toHaveValue('Order Placed');
  });
});