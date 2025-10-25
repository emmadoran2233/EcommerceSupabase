import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Sidebar from "~/components/Sidebar";
import { assets } from "~/assets/assets.js";
// Mock assets to avoid loading actual image files
jest.mock("~/assets/assets", () => ({
  assets: {
    add_icon: "add-icon.png",
    order_icon: "order-icon.png",
  },
}));

describe("Sidebar", () => {
  test("renders all navigation links with correct text", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // Verify all three link texts are present
    expect(screen.getByText("Add Items")).toBeInTheDocument();
    expect(screen.getByText("List Items")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();

    // Verify link count
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
  });

  test("each NavLink points to the correct route", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/add");
    expect(links[1]).toHaveAttribute("href", "/list");
    expect(links[2]).toHaveAttribute("href", "/orders");
  });

  test("renders correct icons with accessible alt text", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // Find all images by their alt text
    const addIcon = screen.getByAltText("add_icon");
    const orderIcons = screen.getAllByAltText("order_icon");

    expect(addIcon).toHaveAttribute("src", "add-icon.png");
    expect(orderIcons).toHaveLength(2);
    orderIcons.forEach((img) =>
      expect(img).toHaveAttribute("src", "order-icon.png")
    );
  });

  test("clicking links navigates correctly (href check)", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Sidebar />
      </MemoryRouter>
    );

    const ordersLink = screen.getByText("Orders");
    await user.click(ordersLink);

    // The underlying <a> tag should have the correct href
    expect(ordersLink.closest("a")).toHaveAttribute("href", "/orders");
  });
});
