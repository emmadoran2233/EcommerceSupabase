/* eslint-env jest */
import { render, screen, fireEvent } from "@testing-library/react";
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import App from '~/App';
jest.mock('~/components/Navbar', () => (props) => (
  <div data-testid="navbar" onClick={() => props.setToken && props.setToken('')}>
    Navbar (click to logout)
  </div>
));

jest.mock('~/pages/Orders', () => ({ token }) => (
  <div data-testid="orders">Orders page — token:{token}</div>
));
jest.mock('~/components/Sidebar', () => () => (
  <div data-testid="sidebar">Sidebar</div>
));

jest.mock('~/components/Login', () => ({ setToken }) => (
  <div data-testid="login">
    Login
    <button onClick={() => setToken('mocktoken')} data-testid="login-btn">
      Mock Login
    </button>
  </div>
));

jest.mock('~/pages/Add', () => ({ token }) => (
  <div data-testid="add">Add page — token:{token}</div>
));
jest.mock('~/pages/List', () => ({ token }) => (
  <div data-testid="list">List page — token:{token}</div>
));
jest.mock('~/pages/Orders', () => ({ token }) => (
  <div data-testid="orders">Orders page — token:{token}</div>
));

describe('App', () => {
  beforeEach(() => {
    // Ensure a clean slate for each test
    localStorage.clear();
    jest.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows Login when no token in localStorage', () => {
    expect(localStorage.getItem('token')).toBeNull();

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('login')).toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // ToastContainer should exist (react-toastify root has class "Toastify")
    const toastRoot = document.body.querySelector('.Toastify');
    expect(toastRoot).toBeTruthy();
  });

  test('logging in sets token and shows authed layout', () => {
    render(
      <MemoryRouter initialEntries={['/list']}>
        <App />
      </MemoryRouter>
    );

    // Click our mocked login button to set the token
    fireEvent.click(screen.getByTestId('login-btn'));

    // App should now render the authed layout
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();

    // useEffect should have synced token to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'mocktoken');
    expect(localStorage.getItem('token')).toBe('mocktoken');
  });

  test('with existing token, renders the correct route and passes token down', () => {
    localStorage.setItem('token', 't123');

    render(
      <MemoryRouter initialEntries={['/list']}>
        <App />
      </MemoryRouter>
    );

    // Layout is present
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();

    // Correct route element and token prop
    expect(screen.getByTestId('list')).toHaveTextContent('token:t123');
  });

  // test('navigates to /add and /orders and still passes token', () => {
  //   localStorage.setItem('token', 'abc');

  //   // /add
  //   const { rerender } = render(
  //     <MemoryRouter initialEntries={['/add']}>
  //       <App />
  //     </MemoryRouter>
  //   );
  //   expect(screen.getByTestId('add')).toHaveTextContent('token:abc');

  //   // /orders
  //   rerender(
  //     <MemoryRouter initialEntries={['/orders']}>
  //       <App />
  //     </MemoryRouter>
  //   );
  //   expect(screen.getByTestId('orders')).toHaveTextContent('token:abc');
  // });

  test('logging out (Navbar calls setToken("")) shows Login again', () => {
    localStorage.setItem('token', 'stay');

    render(
      <MemoryRouter initialEntries={['/list']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('navbar')).toBeInTheDocument();

    // Click the mocked Navbar to trigger setToken('')
    fireEvent.click(screen.getByTestId('navbar'));

    // Back to Login view
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });
});