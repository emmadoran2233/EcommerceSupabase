import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const Verify = () => {
  const { navigate, setCartItems } = useContext(ShopContext);
  const [searchParams] = useSearchParams();

  const success = searchParams.get('success');
  const orderId = searchParams.get('orderId');
  const [loading, setLoading] = useState(true);

  const checkOrderStatus = async () => {
    try {
      if (!orderId) {
        toast.error("Missing orderId in URL");
        navigate('/cart');
        return;
      }

      const response = await axios.post(
        import.meta.env.VITE_SUPABASE_URL + '/functions/v1/checkOrderStatus',
        { orderId },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success && response.data.order?.payment) {
        setCartItems({});
        navigate('/orders');
      } else {
        toast.error("Payment not completed");
        navigate('/cart');
      }

    } catch (error) {
      console.error("Verify error:", error);
      toast.error(error.message || "Verification failed");
      navigate('/cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkOrderStatus();
  }, [orderId]);

  return (
    <div className="flex justify-center items-center h-[80vh]">
      {loading ? <p>Verifying payment...</p> : null}
    </div>
  );
};

export default Verify;
