import React, { useContext, useEffect, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
const Login = () => {
  const [currentState, setCurrentState] = useState("Login");
  const { token, setToken, navigate } = useContext(ShopContext);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const redirectUrl =
  (typeof window !== "undefined" && window.location?.origin?.trim()) ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:5173"
    : "https://www.reshareloop.com");
  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      if (currentState === "Sign Up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        console.log("🟢 signUp data:", data);

        if (error) {
          toast.error(error.message);
          return;
        }

        const userId = data?.user?.id || data?.session?.user?.id || null;
        const accessToken = data?.session?.access_token || "";

        if (userId) {
          localStorage.setItem("user_id", userId);
          console.log("user_id saved:", userId);
        } else {
          console.warn("user_id missing in signUp:", data);
        }

        if (accessToken) {
          setToken(accessToken);
          localStorage.setItem("token", accessToken);
        }

        toast.success("Account created successfully!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        const userId =
          data?.user?.id ||
          data?.session?.user?.id ||
          data?.session?.user?.aud ||
          null;

        const accessToken = data?.session?.access_token || "";

        if (userId) {
          localStorage.setItem("user_id", userId);
          console.log("✅ user_id saved:", userId);
        } else {
          console.warn("⚠️ user_id not found in session", data);
        }

        if (accessToken) {
          setToken(accessToken);
          localStorage.setItem("token", accessToken);
        }

        toast.success("Login successful!");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (token) {
      navigate("/");
    }
  }, [token]);

  // Password Reset Function
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("Email value:", email);
    if (!email) {
      toast.error("Please enter your email address first");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectUrl}/reset-password`,
      });
      
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

  //Google OAuth Sign-In
  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: { access_type: "offline", prompt: "consent" }, // optional
        },
      });
      if (error) toast.error(error.message);
      // Redirect happens automatically on success
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const sessionToken = session.access_token;
        const userId = session.user?.id;
        console.log('session found:', session);
        if (sessionToken) {
          setToken(sessionToken);
          localStorage.setItem("token", sessionToken);
        }
        if (userId) {
          localStorage.setItem("user_id", userId);
        }
        navigate("/");
      }
    };
    fetchSession();
  }, []);

  return (
    <form
      onSubmit={onSubmitHandler}
      className="flex flex-col items-center w-[90%] sm:max-w-96 m-auto mt-14 gap-4 text-gray-800"
    >
      <div className="inline-flex items-center gap-2 mb-2 mt-10">
        <p className="prata-regular text-3xl">{currentState}</p>
        <hr className="border-none h-[1.5px] w-8 bg-gray-800" />
      </div>

      {currentState === "Login" ? (
        ""
      ) : (
        <input
          onChange={(e) => setName(e.target.value)}
          value={name}
          type="text"
          className="w-full px-3 py-2 border border-gray-800"
          placeholder="Name"
          required
        />
      )}

      <input
        onChange={(e) => setEmail(e.target.value)}
        value={email}
        type="email"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Email"
        required
      />
      <div className="relative w-full">
        <input
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          type={showPassword ? "text" : "password"}
          className="w-full px-3 py-2 border border-gray-800"
          placeholder="Password"
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

      <div className="w-full flex justify-between text-sm mt-[-8px]">
        <button 
          type="button"
          onClick={handlePasswordReset}
          className="cursor-pointer hover:underline text-gray-600 bg-transparent border-none p-0 text-sm"
        >
          Forgot your password?
        </button>
        {currentState === "Login" ? (
          <p
            onClick={() => setCurrentState("Sign Up")}
            className="cursor-pointer"
          >
            Create account
          </p>
        ) : (
          <p
            onClick={() => setCurrentState("Login")}
            className="cursor-pointer"
          >
            Login Here
          </p>
        )}
      </div>

      <button className="bg-black text-white font-light px-8 py-2 mt-4">
        {currentState === "Login" ? "Sign In" : "Sign Up"}
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
            className="w-full border border-gray-800 py-2 mt-2"
          >
            Sign In with Google
          </button>
        </>
      )}
    </form>
  );
};

export default Login;
