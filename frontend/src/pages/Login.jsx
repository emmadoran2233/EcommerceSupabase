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

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      if (currentState === "Sign Up") {
        // 🟩 注册逻辑
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
          console.log("✅ user_id saved:", userId);
        } else {
          console.warn("⚠️ user_id missing in signUp:", data);
        }

        if (accessToken) {
          setToken(accessToken);
          localStorage.setItem("token", accessToken);
        }

        toast.success("Account created successfully!");
      } else {
        // 🟦 登录逻辑
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log("🟣 signIn data:", data);

        if (error) {
          toast.error(error.message);
          return;
        }

        // ✅ 兼容所有 Supabase 版本的 user_id 结构
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

  //Google OAuth Sign-In
  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin, // e.g. http://localhost:5173
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
      <input
        onChange={(e) => setPassword(e.target.value)}
        value={password}
        type="password"
        className="w-full px-3 py-2 border border-gray-800"
        placeholder="Password"
        required
      />

      <div className="w-full flex justify-between text-sm mt-[-8px]">
        <p className="cursor-pointer">Forgot your password?</p>
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
