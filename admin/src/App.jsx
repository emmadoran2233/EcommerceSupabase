import React, { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { Routes, Route } from "react-router-dom";
import Add from "./pages/Add";
import Lend from "./pages/Lend";
import List from "./pages/List";
import LendList from "./pages/LendList";
import Orders from "./pages/Orders";
import Inventory from "./pages/Inventory";
import BannerControl from "./pages/BannerControl";
import Login from "./components/Login";
import EditStore from "./pages/EditStore";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "./supabaseClient"; // ✅ Supabase client
import { toast } from "react-toastify"; // ✅ Toasts

export const backendUrl = import.meta.env.VITE_BACKEND_URL;
export const currency = "$";

const App = () => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);

  // ✅ Persist token to localStorage
  useEffect(() => {
    localStorage.setItem("token", token);
  }, [token]);

  // ✅ Initialize and listen for Supabase auth changes
  useEffect(() => {
    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error(error);
        toast.error("Failed to fetch user session");
        return;
      }

      if (data.session) {
        const u = data.session.user;
        setUser({
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || "Seller",
        });
        setToken(data.session.access_token);
      } else {
        setUser(null);
        setToken("");
      }
    };

    initAuth();

    // ✅ Listen for login/logout changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const u = session.user;
          setUser({
            id: u.id,
            email: u.email,
            name: u.user_metadata?.name || "Seller",
          });
          setToken(session.access_token);
        } else {
          setUser(null);
          setToken("");
          localStorage.removeItem("token"); // ✅ Clear on logout
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // ✅ Keep login check
  if (!token) return <Login setToken={setToken} />;

  return (
    <div className="bg-gray-50 min-h-screen">
      <ToastContainer />
      {!token ? (
        <>
          <Login setToken={setToken} />
          <Route path="/" element={<Login setToken={setToken} />} />
        </>
      ) : (
        <>
          <Navbar setToken={setToken} />
          <hr />
          <div className="flex w-full">
            <Sidebar />
            <div className="w-[70%] mx-auto ml-[max(5vw,25px)] my-8 text-gray-600 text-base">
              <Routes>
                <Route path="/add-sell" element={<Add user={user} />} />
                <Route path="/list" element={<List user={user} />} />
                <Route path="/add-lend" element={<Lend user={user} />} />
                <Route path="/lend-list" element={<LendList user={user} />} />
                <Route path="/add-sell" element={<Add user={user} />} />
                <Route path="/list" element={<List user={user} />} />
                <Route path="/add-lend" element={<Lend user={user} />} />
                <Route path="/lend-list" element={<LendList user={user} />} />
                <Route path="/orders" element={<Orders token={token} />} />
                <Route
                  path="/inventory"
                  element={<Inventory token={token} user={user} />}
                />
                <Route
                  path="/banner"
                  element={<BannerControl token={token} user={user} />}
                />
                <Route path="/edit-store" element={<EditStore user={user} />} />
              </Routes>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
