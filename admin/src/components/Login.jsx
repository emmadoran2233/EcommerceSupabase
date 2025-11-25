import { supabase } from "../supabaseClient";
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const Login = ({ setToken }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [currentState, setCurrentState] = useState("Login");
  const [showPassword, setShowPassword] = useState(false);
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
      if (currentState === "Sign Up") {
        // Sign Up Logic
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        const userId = data?.user?.id || data?.session?.user?.id || null;
        const accessToken = data?.session?.access_token || "";

        if (userId) {
          localStorage.setItem("user_id", userId);
        }

        if (accessToken) {
          setToken(accessToken);
          localStorage.setItem("token", accessToken);
        }

        toast.success("Admin account created successfully!");
      } else {
        // Login Logic
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

  // Password Reset Function
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("Password reset clicked!");
    console.log("Email:", email);
    console.log("Redirect URL:", `${redirectUrl}/reset-password`);

    if (!email) {
      toast.error("Please enter your email address first");
      return;
    }

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectUrl}/reset-password`,
      });

      console.log("Reset password response:", { data, error });

      if (error) {
        console.error("Reset password error:", error);
        toast.error(error.message);
        return;
      }

      toast.success("Password reset email sent! Check your inbox.");
    } catch (err) {
      console.error("Reset password exception:", err);
      toast.error(err.message);
    }
  };

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
          {currentState === "Sign Up" && (
            <div className="mb-3 min-w-72">
              <p className="text-sm font-medium text-gray-700 mb-2">Admin User Name</p>
              <input
                onChange={(e) => setName(e.target.value)}
                value={name}
                className="rounded-md w-full px-3 py-2 border border-gray-300 outline-none"
                type="text"
                placeholder="Your name"
                required
              />
            </div>
          )}
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
            <div className="relative">
              <input
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                className="rounded-md w-full px-3 py-2 border border-gray-300 outline-none"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handlePasswordReset}
              className="text-xs text-gray-600 hover:underline mt-1"
            >
              Forgot your password?
            </button>
          </div>
          {currentState === "Login" && (
            <button
              type="button"
              onClick={() => setCurrentState("Sign Up")}
              className="text-xs text-gray-600 hover:underline mb-2"
            >
              No account? Sign up here
            </button>
          )}
          <button
            className="mt-2 w-full py-2 px-4 rounded-md text-white bg-black hover:bg-gray-800 transition"
            type="submit"
          >
            {currentState === "Login" ? "Login with Email" : "Sign Up"}
          </button>
          {currentState === "Sign Up" && (
            <button
              type="button"
              onClick={() => setCurrentState("Login")}
              className="text-xs text-gray-600 hover:underline mt-2"
            >
              Already have an account? Login here
            </button>
          )}

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
