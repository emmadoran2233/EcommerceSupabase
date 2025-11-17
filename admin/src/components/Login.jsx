import { supabase } from "../supabaseClient";
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const Login = ({ setToken }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentState, setCurrentState] = useState("Login");
  const navigate = useNavigate();

  const redirectUrl =
    (typeof window !== "undefined" &&
      String(window.location?.origin || "").trim()) ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:5174"
      : "https://admin.reshareloop.com");

  // -------------------- EMAIL LOGIN --------------------
  const onSubmitHandler = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data?.session) {
        const session = data.session;
        const sellerId = session.user?.id;

        // ✅ Save session token
        setToken(session.access_token);
        localStorage.setItem("token", session.access_token);
        localStorage.setItem("user_id", sellerId);

        toast.success("Login successful!");

        // ✅ Redirect to this seller’s admin panel
        navigate(`/admin/${sellerId}/add-sell`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  // -------------------- GOOGLE LOGIN --------------------
  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) toast.error(error.message);
      // Redirect will happen automatically on success
    } catch (err) {
      toast.error(err.message);
    }
  };

  // -------------------- SESSION AUTO LOGIN --------------------
  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (session) {
        const token = session.access_token;
        const sellerId = session.user?.id;

        if (token) {
          setToken(token);
          localStorage.setItem("token", token);
        }

        if (sellerId) {
          localStorage.setItem("user_id", sellerId);
          // ✅ Auto redirect if already logged in
          navigate(`/admin/${sellerId}/add-sell`);
        }
      }
    };

    fetchSession();
  }, [navigate, setToken]);

  // -------------------- UI --------------------
  return (
    <div className="min-h-screen flex items-center justify-center w-full bg-gray-100">
      <div className="bg-white shadow-md rounded-lg px-8 py-6 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">Admin Panel</h1>

        <form onSubmit={onSubmitHandler}>
          <div className="mb-3 min-w-72">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Email Address
            </p>
            <input
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              className="rounded-md w-full px-3 py-2 border border-gray-300 outline-none"
              type="email"
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="mb-3 min-w-72">
            <p className="text-sm font-medium text-gray-700 mb-2">Password</p>
            <input
              onChange={(e) => setPassword(e.target.value)}
              value={password}
              className="rounded-md w-full px-3 py-2 border border-gray-300 outline-none"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            className="mt-2 w-full py-2 px-4 rounded-md text-white bg-black hover:bg-gray-800 transition"
            type="submit"
          >
            Login with Email
          </button>

          {currentState === "Login" && (
            <>
              <div className="flex items-center gap-2 w-full mt-4">
                <div className="h-px bg-gray-300 flex-1" />
                <span className="text-xs text-gray-500">or</span>
                <div className="h-px bg-gray-300 flex-1" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full border border-gray-800 py-2 mt-2 hover:bg-gray-50 transition"
              >
                Sign In with Google
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
