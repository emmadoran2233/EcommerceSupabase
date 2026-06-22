import React, { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { Routes, Route, useParams, useNavigate, Navigate, useLocation } from "react-router-dom";
import Add from "./pages/Add";
import Lend from "./pages/Lend";
import List from "./pages/List";
import LendList from "./pages/LendList";
import Orders from "./pages/Orders";
import Inventory from "./pages/Inventory";
import BannerControl from "./pages/BannerControl";
import Login from "./components/Login";
import AuthCallback from "./pages/AuthCallback";
import EditStore from "./pages/EditStore";
import ResetPassword from "./pages/ResetPassword";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "./supabaseClient";
import { toast } from "react-toastify";

export const backendUrl = import.meta.env.VITE_BACKEND_URL;
export const currency = "$";

const pendingWelcomeEmailRequests = new Set();

/* ------------------------------
   Sub-Routes for Seller Dashboard
---------------------------------*/
const SellerRoutes = ({ token, user }) => {
  const { sellerId } = useParams();

  // Optional: block access to other users' admin pages
  if (user && sellerId !== user.id) {
    return (
      <div className="text-center text-red-500 mt-10 text-lg">
        ⚠️ Access denied — you are not authorized to view this page.
      </div>
    );
  }

  return (
    <div className="flex w-full">
      <Sidebar sellerId={sellerId} />
      <div className="w-[70%] mx-auto ml-[max(5vw,25px)] my-8 text-gray-600 text-base">
        <Routes>
          <Route path="add-sell" element={<Add user={user} />} />
          <Route path="list" element={<List user={user} />} />
          <Route path="add-lend" element={<Lend user={user} />} />
          <Route path="lend-list" element={<LendList user={user} />} />
          <Route path="orders" element={<Orders token={token} user={user} />} />
          <Route path="inventory" element={<Inventory token={token} user={user} />} />
          <Route path="banner" element={<BannerControl token={token} user={user} />} />
          <Route path="edit-store" element={<EditStore user={user} />} />
          {/* Default redirect when visiting /admin/:sellerId */}
          <Route index element={<Navigate to="add-sell" replace />} />
        </Routes>
      </div>
    </div>
  );
};

/* ------------------------------
           MAIN APP
---------------------------------*/
const App = () => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isResetPasswordRoute = location.pathname === "/reset-password";

  const getOAuthDisplayName = (authUser) =>
    String(
      authUser?.user_metadata?.name ||
        authUser?.user_metadata?.full_name ||
        authUser?.email?.split("@")[0] ||
        "Seller"
    ).trim();

  const isOAuthUser = (authUser) =>
    Boolean(authUser?.app_metadata?.provider && authUser.app_metadata.provider !== "email");

  const syncPublicUser = async (authUser) => {
    if (!authUser?.id || !authUser?.email) return;

    const { error } = await supabase.from("users").upsert(
      {
        id: authUser.id,
        email: authUser.email,
        cartData: {},
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("Public user sync failed:", error.message || error);
    }
  };

  const sendOAuthWelcomeEmail = async (authUser) => {
    if (!authUser?.id || !authUser?.email || !isOAuthUser(authUser)) return;

    const welcomeEmailKey = `welcome_email_requested:seller:${authUser.id}`;
    if (localStorage.getItem(welcomeEmailKey)) return;
    if (pendingWelcomeEmailRequests.has(welcomeEmailKey)) return;
    pendingWelcomeEmailRequests.add(welcomeEmailKey);

    try {
      const { data, error } = await supabase.functions.invoke("sendWelcomeEmail", {
        body: {
          userId: authUser.id,
          email: authUser.email,
          name: getOAuthDisplayName(authUser),
          role: "seller",
        },
      });

      if (error) {
        console.warn("Welcome email failed:", error.message || error);
        return;
      }

      if (data?.success === false) {
        console.warn("Welcome email failed:", data.result?.error || data.error || data);
        return;
      }

      localStorage.setItem(welcomeEmailKey, "1");
    } catch (error) {
      console.warn("Welcome email failed:", error);
    } finally {
      pendingWelcomeEmailRequests.delete(welcomeEmailKey);
    }
  };

  const syncOAuthUserAfterAuth = async (authUser) => {
    if (!isOAuthUser(authUser)) return;
    await syncPublicUser(authUser);
    await sendOAuthWelcomeEmail(authUser);
  };

  // ✅ Persist token to localStorage
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
  }, [token]);

  // ✅ Initialize and listen for Supabase auth changes
  useEffect(() => {
    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Supabase session error:", error);
        toast.error("Failed to fetch user session");
        return;
      }

      if (data.session?.user) {
        const u = data.session.user;
        setUser({
            id: u.id,
            email: u.email,
            name: u.user_metadata?.name || "Seller",
          });
          setToken(data.session.access_token);
          await syncOAuthUserAfterAuth(u);
        } else {
          setUser(null);
          setToken("");
      }
    };

    initAuth();

    // ✅ FIX: redirect only on SIGNED_IN (not every refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔑 Auth event:", event); // Debug log

        if (session?.user) {
          const u = session.user;
          setUser({
            id: u.id,
            email: u.email,
            name: u.user_metadata?.name || "Seller",
          });
          setToken(session.access_token);
          syncOAuthUserAfterAuth(u);

          // ✅ Redirect only when the user signs in (not refresh)
          if (event === "SIGNED_IN" && !isResetPasswordRoute) {
            navigate(`/admin/${u.id}/add-sell`);
          }
        } else {
          setUser(null);
          setToken("");
          localStorage.removeItem("token");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [navigate, isResetPasswordRoute]);

  if (isResetPasswordRoute) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <ToastContainer />
        <ResetPassword />
      </div>
    );
  }

  // ✅ If not logged in → show login page
  if (!token) {
    return (
      <>
        <ToastContainer />
        <Login setToken={setToken} />
      </>
    );
  }

  // ✅ Wait until user info is ready
  if (!user) return <div className="text-center mt-20 text-gray-500">Loading user...</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      <ToastContainer />
      <Navbar setToken={setToken} />
      <hr />
      <Routes>
        {/* Auth callback for email confirmation */}
        <Route path="/auth/callback" element={<AuthCallback setToken={setToken} />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* All admin pages nested under /admin/:sellerId */}
        <Route path="/admin/:sellerId/*" element={<SellerRoutes token={token} user={user} />} />
        {/* Default redirect if visiting root */}
        <Route path="*" element={<Navigate to={`/admin/${user.id}/add-sell`} replace />} />
      </Routes>
    </div>
  );
};

export default App;
