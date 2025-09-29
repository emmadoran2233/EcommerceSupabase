import React, { useContext, useState } from 'react'
import axios from 'axios';
import Title from '../components/Title'
import CartTotal from '../components/CartTotal'
import { assets } from '../assets/assets'
import { ShopContext } from '../context/ShopContext'
import { supabase } from "../supabaseClient"
import { toast } from 'react-toastify'

const PlaceOrder = () => {
  const [method, setMethod] = useState('cod');
  const { navigate, cartItems, setCartItems, getCartAmount, delivery_fee, products, backendUrl } = useContext(ShopContext);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    street: '',
    city: '',
    state: '',
    zipcode: '',
    country: '',
    phone: ''
  });

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setFormData(data => ({ ...data, [name]: value }));
  };

  // ✅ helper function to decrement stock
  const updateStock = async (orderItems) => {
    for (const item of orderItems) {
      const { error: stockError } = await supabase
        .from("products")
        .update({ stock: item.stock - item.quantity })
        .eq("id", item.id);

      if (stockError) {
        console.error("Stock update error:", stockError);
        toast.error("Failed to update stock for " + item.name);
      }
    }
  };

  const initPay = (order) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'Order Payment',
      description: 'Order Payment',
      order_id: order.id,
      receipt: order.receipt,
      handler: async (response) => {
        try {
          const { data } = await axios.post(
            backendUrl + '/api/order/verifyRazorpay',
            response,
            { headers: { token } }
          );
          if (data.success) {
            navigate('/orders');
            setCartItems({});
          }
        } catch (error) {
          console.log(error);
          toast.error(error);
        }
      }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      let orderItems = [];

      for (const items in cartItems) {
        for (const item in cartItems[items]) {
          if (cartItems[items][item] > 0) {
            const itemInfo = structuredClone(products.find(product => String(product.id) === String(items)));
            if (itemInfo) {
              itemInfo.size = item;
              itemInfo.quantity = cartItems[items][item];
              orderItems.push(itemInfo);
            }
          }
        }
      }

      let orderData = {
        address: formData,
        items: orderItems,
        amount: getCartAmount() + delivery_fee,
        paymentmethod: method,
        payment: false,
        status: "Order Placed",
        date: new Date().toISOString()
      };

      switch (method) {
        // ✅ COD flow
        case 'cod': {
          const { error } = await supabase.from("orders").insert([orderData]);
          if (error) {
            toast.error(error.message);
          } else {
            await updateStock(orderItems); // ✅ update stock
            setCartItems({});
            navigate('/orders');
            toast.success("Order placed successfully!");
          }
          break;
        }

        // ✅ Stripe flow
        case 'stripe': {
          const { data: insertedOrder, error } = await supabase
            .from("orders")
            .insert([orderData])
            .select("id")
            .single();

          if (error) {
            toast.error(error.message);
            return;
          }

          await updateStock(orderItems); // ✅ update stock

          const orderId = insertedOrder.id;
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verifyStripe`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ orderId, amount: orderData.amount }),
            }
          );

          const data = await response.json();
          if (data.success) {
            window.location.replace(data.session_url);
          } else {
            toast.error(data.error || "Stripe order failed");
          }
          break;
        }

        // ✅ Google Pay flow
        case 'googlepay': {
          const { data: insertedOrder, error } = await supabase
            .from("orders")
            .insert([orderData])
            .select("id")
            .single();

          if (error) {
            toast.error(error.message);
            return;
          }

          await updateStock(orderItems); // ✅ update stock

          const orderId = insertedOrder.id;
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verifyGooglePay`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ orderId, amount: orderData.amount }),
            }
          );

          const data = await response.json();
          if (data.success) {
            window.location.replace(data.session_url);
          } else {
            toast.error(data.error || "Google Pay order failed");
          }
          break;
        }

        // ✅ Razorpay flow
        case 'razorpay': {
          const responseRazorpay = await axios.post(
            backendUrl + '/api/order/razorpay',
            orderData,
            { headers: { token } }
          );
          if (responseRazorpay.data.success) {
            await updateStock(orderItems); // ✅ update stock
            initPay(responseRazorpay.data.order);
          }
          break;
        }

        default:
          break;
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={onSubmitHandler} className='flex flex-col sm:flex-row justify-between gap-4 pt-5 sm:pt-14 min-h-[80vh] border-t'>
      {/* ------------- Left Side ---------------- */}
      <div className='flex flex-col gap-4 w-full sm:max-w-[480px]'>
        <div className='text-xl sm:text-2xl my-3'>
          <Title text1={'DELIVERY'} text2={'INFORMATION'} />
        </div>
        {/* form inputs... */}
        <div className='flex gap-3'>
          <input required onChange={onChangeHandler} name='firstName' value={formData.firstName} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='First name' />
          <input required onChange={onChangeHandler} name='lastName' value={formData.lastName} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='Last name' />
        </div>
        {/* ...rest of form unchanged */}
      </div>

      {/* ------------- Right Side ------------------ */}
      <div className='mt-8'>
        <div className='mt-8 min-w-80'>
          <CartTotal />
        </div>

        <div className='mt-12'>
          <Title text1={'PAYMENT'} text2={'METHOD'} />
          <div className='flex gap-3 flex-col lg:flex-row'>
            {/* payment method selectors... */}
          </div>

          <div className='w-full text-end mt-8'>
            <button type='submit' className='bg-black text-white px-16 py-3 text-sm'>PLACE ORDER</button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default PlaceOrder;
