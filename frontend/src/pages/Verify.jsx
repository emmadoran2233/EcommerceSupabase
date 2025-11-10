import React, { useContext, useEffect, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

const Verify = () => {
const { navigate, setCartItems } = useContext(ShopContext);
  const [searchParams] = useSearchParams();

  const success = searchParams.get('success');
  const orderId = searchParams.get('orderId');
  const [loading, setLoading] = useState(true);

  const checkOrderStatus = async () => {
    try {
      // Log environment for debugging
      console.log('Environment:', import.meta.env.MODE);
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Verifying orderId:', orderId, 'success:', success);

      if (!orderId) {
        toast.error("Missing orderId in URL");
        navigate('/cart');
        return;
      }

      // Check if payment was successful from Stripe redirect
      if (success === 'false') {
        toast.error("Payment was cancelled or failed");
        navigate('/cart');
        return;
      }

      // Call Supabase Edge Function to verify order status
      const response = await axios.post(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/checkOrderStatus`,
        { orderId },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('checkOrderStatus response:', response.data);

      if (response.data.success && response.data.order?.payment) {
        toast.success("Payment verified successfully!");
        setCartItems({}); // Clear cart
        setTimeout(() => navigate('/orders'), 1500);
      } else {
        toast.error("Payment not completed yet. Please try again.");
        navigate('/cart');
      }

    } catch (error) {
      console.error("Verify error:", error);
      toast.error(error?.response?.data?.error || error.message || "Verification failed");
      navigate('/cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkOrderStatus();
  }, [orderId]);

  return (
    <div className="flex flex-col justify-center items-center min-h-[80vh]">
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Verifying your payment...</p>
          <p className="text-sm text-gray-500">Order ID: {orderId}</p>
        </>
      ) : (
        <p className="text-gray-600">Redirecting...</p>
      )}
    </div>
  );
};

export default Verify;
