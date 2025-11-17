import React from "react";
import { NavLink } from "react-router-dom";
import { assets } from "../assets/assets";

const Sidebar = ({ sellerId }) => {
  return (
    <div className="w-[18%] min-h-screen border-r-2 bg-white">
      <div className="flex flex-col gap-4 pt-6 pl-[20%] text-[15px]">

        {/* ---------- SELL SECTION ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-2">SELL</h3>

        <NavLink
          to={`/admin/${sellerId}/add-sell`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img className="w-5 h-5" src={assets.add_icon} alt="add_icon" />
          <p className="hidden md:block">Add Sell Item</p>
        </NavLink>

        <NavLink
          to={`/admin/${sellerId}/list`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="list_icon" />
          <p className="hidden md:block">Sell Item List</p>
        </NavLink>

        {/* ---------- LEND SECTION ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">LEND</h3>

        <NavLink
          to={`/admin/${sellerId}/add-lend`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img className="w-5 h-5" src={assets.add_icon} alt="lend_add_icon" />
          <p className="hidden md:block">Add Lend Item</p>
        </NavLink>

        <NavLink
          to={`/admin/${sellerId}/lend-list`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="lend_list_icon" />
          <p className="hidden md:block">Lend Item List</p>
        </NavLink>

        {/* ---------- MANAGE SECTION ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">MANAGE</h3>

        <NavLink
          to={`/admin/${sellerId}/orders`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="order_icon" />
          <p className="hidden md:block">Orders</p>
        </NavLink>

        <NavLink
          to={`/admin/${sellerId}/inventory`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="inventory_icon" />
          <p className="hidden md:block">Inventory</p>
        </NavLink>

        {/* ---------- STORE SETTINGS ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">STORE SETTINGS</h3>

        <NavLink
          to={`/admin/${sellerId}/banner`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img
            className="w-5 h-5"
            src={assets.edit_icon || assets.add_icon}
            alt="banner_icon"
          />
          <p className="hidden md:block">Edit Banner</p>
        </NavLink>

        <NavLink
          to={`/admin/${sellerId}/edit-store`}
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="store" />
          <p className="hidden md:block">Edit Store Info</p>
        </NavLink>

      </div>
    </div>
  );
};

export default Sidebar;
