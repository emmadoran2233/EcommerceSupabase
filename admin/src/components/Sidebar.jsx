import React from "react";
import { NavLink } from "react-router-dom";
import { assets } from "../assets/assets";

<<<<<<< HEAD
const Sidebar = ({ sellerId }) => {
=======
const Sidebar = () => {
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
  return (
    <div className="w-[18%] min-h-screen border-r-2 bg-white">
      <div className="flex flex-col gap-4 pt-6 pl-[20%] text-[15px]">

        {/* ---------- SELL SECTION ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-2">SELL</h3>

        <NavLink
<<<<<<< HEAD
          to={`/admin/${sellerId}/add-sell`}
=======
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
<<<<<<< HEAD
=======
          to="/add-sell"
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
        >
          <img className="w-5 h-5" src={assets.add_icon} alt="add_icon" />
          <p className="hidden md:block">Add Sell Item</p>
        </NavLink>

        <NavLink
<<<<<<< HEAD
          to={`/admin/${sellerId}/list`}
=======
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
<<<<<<< HEAD
=======
          to="/list"
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="list_icon" />
          <p className="hidden md:block">Sell Item List</p>
        </NavLink>

        {/* ---------- LEND SECTION ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">LEND</h3>

        <NavLink
<<<<<<< HEAD
          to={`/admin/${sellerId}/add-lend`}
=======
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
<<<<<<< HEAD
=======
          to="/add-lend"
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
        >
          <img className="w-5 h-5" src={assets.add_icon} alt="lend_add_icon" />
          <p className="hidden md:block">Add Lend Item</p>
        </NavLink>

        <NavLink
<<<<<<< HEAD
          to={`/admin/${sellerId}/lend-list`}
=======
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
<<<<<<< HEAD
=======
          to="/lend-list"
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="lend_list_icon" />
          <p className="hidden md:block">Lend Item List</p>
        </NavLink>

<<<<<<< HEAD
        {/* ---------- MANAGE SECTION ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">MANAGE</h3>

        <NavLink
          to={`/admin/${sellerId}/orders`}
=======
        {/* ---------- ORDERS / INVENTORY ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">MANAGE</h3>

        <NavLink
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
<<<<<<< HEAD
=======
          to="/orders"
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="order_icon" />
          <p className="hidden md:block">Orders</p>
        </NavLink>

        <NavLink
<<<<<<< HEAD
          to={`/admin/${sellerId}/inventory`}
=======
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
<<<<<<< HEAD
=======
          to="/inventory"
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
        >
          <img className="w-5 h-5" src={assets.order_icon} alt="inventory_icon" />
          <p className="hidden md:block">Inventory</p>
        </NavLink>

<<<<<<< HEAD
        {/* ---------- STORE SETTINGS ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">STORE SETTINGS</h3>

        <NavLink
          to={`/admin/${sellerId}/banner`}
=======
        {/* ---------- BANNER ---------- */}
        <h3 className="text-gray-500 text-sm font-semibold mt-6">STORE SETTINGS</h3>

        <NavLink
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          className={({ isActive }) =>
            `flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l ${
              isActive ? "bg-gray-200 font-semibold" : ""
            }`
          }
<<<<<<< HEAD
        >
          <img
            className="w-5 h-5"
            src={assets.edit_icon || assets.add_icon}
            alt="banner_icon"
          />
=======
          to="/banner"
        >
          <img className="w-5 h-5" src={assets.edit_icon || assets.add_icon} alt="banner_icon" />
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
          <p className="hidden md:block">Edit Banner</p>
        </NavLink>

        <NavLink
<<<<<<< HEAD
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

=======
          className="flex items-center gap-3 border border-gray-300 border-r-0 px-3 py-2 rounded-l"
          to="/edit-store"
        >
          <img className='w-5 h-5' src={assets.order_icon} alt="store" />
          <p className="hidden md:block">Edit Store Info</p>
        </NavLink>
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
      </div>
    </div>
  );
};

<<<<<<< HEAD
export default Sidebar;
=======
export default Sidebar;
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
