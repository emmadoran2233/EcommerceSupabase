// src/__tests__/components/Login.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// SUT
import Login from "~/components/Login";

// Mocks
jest.mock("axios", () => ({
  post: jest.fn(),
}));
jest.mock("~/utils/env.js", () => ({
  // Make sure this path matches your Jest moduleNameMapper alias setup
  backendUrl: "http://example.test",
}));
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn() },
}));

import axios from "axios";
import { toast } from "react-toastify";

describe("Login", () => {
  const setup = () => {
    const setToken = jest.fn();
    render(<Login setToken={setToken} />);
    const emailInput = screen.getByPlaceholderText("your@email.com");
    const passwordInput = screen.getByPlaceholderText("Enter your password");
    const submitBtn = screen.getByRole("button", { name: /login/i });
    return { setToken, emailInput, passwordInput, submitBtn };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("submits with email & password and sets token on success", async () => {
    const user = userEvent.setup();
    const { setToken, emailInput, passwordInput, submitBtn } = setup();

    // Arrange axios response
    axios.post.mockResolvedValueOnce({
      data: { success: true, token: "abc123" },
    });

    // Type credentials
    await user.type(emailInput, "admin@example.com");
    await user.type(passwordInput, "secret");

    // Submit
    await user.click(submitBtn);

    // Assert axios call
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, payload] = axios.post.mock.calls[0];
    expect(url).toMatch(/\/api\/user\/admin$/);
    expect(payload).toEqual({ email: "admin@example.com", password: "secret" });

    // Assert token set and no error toast
    expect(setToken).toHaveBeenCalledWith("abc123");
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("shows toast error when backend says success=false", async () => {
    const user = userEvent.setup();
    const { setToken, emailInput, passwordInput, submitBtn } = setup();

    axios.post.mockResolvedValueOnce({
      data: { success: false, message: "Invalid credentials" },
    });

    await user.type(emailInput, "admin@example.com");
    await user.type(passwordInput, "wrongpass");

    await user.click(submitBtn);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(setToken).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
  });

  test("shows toast error when request throws", async () => {
    const user = userEvent.setup();
    const { setToken, emailInput, passwordInput, submitBtn } = setup();

    axios.post.mockRejectedValueOnce(new Error("Network error"));

    await user.type(emailInput, "admin@example.com");
    await user.type(passwordInput, "secret");

    await user.click(submitBtn);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(setToken).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Network error");
  });

  test("renders basic UI", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: /admin panel/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter your password")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });
});
