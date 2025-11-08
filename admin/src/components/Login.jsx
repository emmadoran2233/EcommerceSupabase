import { supabase } from "../supabaseClient";
import React, { useState, useEffect } from "react";
//import { backendUrl } from '../App'
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
const Login = ({ setToken }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); //['admin@example.com', 'Asdfg12345']
  const [currentState, setCurrentState] = useState("Login");
  const navigate = useNavigate();
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

      // Save the session or access token if needed
      setToken(data.session.access_token);

      toast.success("Login successful!");
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };
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
        // navigate("/orders");
      }
    };
    fetchSession();
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center w-full">
      <div className="bg-white shadow-md rounded-lg px-8 py-6 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
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
            className="mt-2 w-full py-2 px-4 rounded-md text-white bg-black"
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
                className="w-full border border-gray-800 py-2 mt-2"
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
