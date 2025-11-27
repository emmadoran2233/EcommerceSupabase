import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";

const AuthCallback = ({ setToken }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the session after email confirmation
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          toast.error("Email confirmation failed. Please try again.");
          navigate("/");
          return;
        }

        if (session) {
          const userId = session.user?.id;
          const accessToken = session.access_token;

          // Save to localStorage and state
          if (accessToken) {
            setToken(accessToken);
            localStorage.setItem("token", accessToken);
          }

          if (userId) {
            localStorage.setItem("user_id", userId);
          }

          toast.success("Email confirmed! Welcome to your admin panel.");
          navigate(`/admin/${userId}/add-sell`);
        } else {
          toast.error("No session found. Please login.");
          navigate("/");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        toast.error("An error occurred during confirmation.");
        navigate("/");
      }
    };

    handleEmailConfirmation();
  }, [navigate, setToken]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Confirming your email...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
