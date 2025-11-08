import React from "react";
import { assets } from "../assets/assets";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
const Navbar = ({ setToken }) => {
  const handleLogout = async () => {
    try {
      // Clear local Supabase session (safe even if no session)
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error && error.name !== "AuthSessionMissingError") {
        console.error("Logout error:", error);
        toast.error("Failed to logout");
        return;
      }
    } catch (e) {
      if (e?.name !== "AuthSessionMissingError") {
        console.error("Logout error:", e);
        toast.error("Failed to logout");
        return;
      }
    } finally {
      // Clear app state and storage
      localStorage.removeItem("token");
      localStorage.removeItem("user_id");
      setToken("");
      toast.success("Logged out successfully");
    }
  };
  return (
    <div className="flex items-center py-2 px-[4%] justify-between">
      <img className="w-[max(10%,80px)]" src={assets.logo} alt="logo" />
      <button
        onClick={handleLogout}
        className="bg-gray-600 text-white px-5 py-2 sm:px-7 sm:py-2 rounded-full text-xs sm:text-sm"
      >
        Logout
      </button>
    </div>
  );
};

export default Navbar;
