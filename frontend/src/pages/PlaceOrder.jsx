import React, { useContext, useState } from 'react'
import axios from 'axios';
import Title from '../components/Title'
import CartTotal from '../components/CartTotal'
import { assets } from '../assets/assets'
import { ShopContext } from '../context/ShopContext'
import { supabase } from "../supabaseClient"
import { toast } from 'react-toastify'

const PlaceOrder = () => {
  const [method, setMethod] = useState("cod");
  const { navigate, cartItems, setCartItems, getCartAmount, delivery_fee, products, backendUrl } =
    useContext(ShopContext);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    city: "",
    state: "",
    zipcode: "",
    country: "",
    phone: "",
  });
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
    })

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setFormData((data) => ({ ...data, [name]: value }));
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
      name: "Order Payment",
      description: "Order Payment",
      order_id: order.id,
      receipt: order.receipt,
      handler: async (response) => {
        try {
          const { data } = await axios.post(
            backendUrl + "/api/order/verifyRazorpay",
            response,
            { headers: { token } }
          );
          if (data.success) {
            navigate("/orders");
            setCartItems({});
          }
        } catch (error) {
          console.log(error);
          toast.error(error);
        }
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      let orderItems = [];

      // ✅ Build orderItems list
      for (const items in cartItems) {
        for (const item in cartItems[items]) {
          if (cartItems[items][item] > 0) {
            const itemInfo = structuredClone(
              products.find((product) => String(product.id) === String(items))
            );
            if (itemInfo) {
              orderItems.push({
                id: itemInfo.id,
                name: itemInfo.name,
                price: itemInfo.price,
                size: item,
                quantity: cartItems[items][item],
                seller_id: itemInfo.seller_id, // ✅ new field
                stock: itemInfo.stock,
              });
            }
          }
        }
      }

      // ✅ Prepare orderData
      let orderData = {
        address: formData,
        items: orderItems,
        amount: getCartAmount() + delivery_fee,
        paymentmethod: method,
        payment: false,
        status: "Order Placed",
        date: new Date().toISOString(),
        sellers: [...new Set(orderItems.map((item) => item.seller_id))], // ✅ unique sellers
      };

      // Optional: track buyer (if logged in)
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          orderData.buyer_id = userData.user.id;
        }
      } catch (err) {
        console.warn("Could not fetch buyer info:", err);
      }

      // ✅ Payment method flows
      switch (method) {
        // COD
        case "cod": {
          const { error } = await supabase.from("orders").insert([orderData]);
          if (error) {
            toast.error(error.message);
          } else {
            await updateStock(orderItems);
            setCartItems({});
            navigate("/orders");
            toast.success("Order placed successfully!");
          }
          break;
        }

        // Stripe
        case "stripe": {
          const { data: insertedOrder, error } = await supabase
            .from("orders")
            .insert([orderData])
            .select("id")
            .single();

          if (error) {
            toast.error(error.message);
            return;
          }

          await updateStock(orderItems);
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

        // Google Pay
        case "googlepay": {
          const { data: insertedOrder, error } = await supabase
            .from("orders")
            .insert([orderData])
            .select("id")
            .single();

          if (error) {
            toast.error(error.message);
            return;
          }

          await updateStock(orderItems);
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

        // Razorpay
        case "razorpay": {
          const responseRazorpay = await axios.post(
            backendUrl + "/api/order/razorpay",
            orderData,
            { headers: { token } }
          );
          if (responseRazorpay.data.success) {
            await updateStock(orderItems);
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
    <form
      onSubmit={onSubmitHandler}
      className="flex flex-col sm:flex-row justify-between gap-4 pt-5 sm:pt-14 min-h-[80vh] border-t"
    >
      {/* ------------- Left Side ---------------- */}
      <div className="flex flex-col gap-4 w-full sm:max-w-[480px]">
        <div className="text-xl sm:text-2xl my-3">
          <Title text1={"DELIVERY"} text2={"INFORMATION"} />
        </div>
        <div className="flex gap-3">
          <input
            required
            onChange={onChangeHandler}
            name="firstName"
            value={formData.firstName}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            type="text"
            placeholder="First name"
          />
          <input
            required
            onChange={onChangeHandler}
            name="lastName"
            value={formData.lastName}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            type="text"
            placeholder="Last name"
          />
        </div>
        <input
          required
          onChange={onChangeHandler}
          name="email"
          value={formData.email}
          className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
          type="email"
          placeholder="Email address"
        />
        <input
          required
          onChange={onChangeHandler}
          name="street"
          value={formData.street}
          className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
          type="text"
          placeholder="Street"
        />
        <div className="flex gap-3">
          <input
            required
            onChange={onChangeHandler}
            name="city"
            value={formData.city}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            type="text"
            placeholder="City"
          />
          <input
            onChange={onChangeHandler}
            name="state"
            value={formData.state}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            type="text"
            placeholder="State"
          />
        </div>
        <div className="flex gap-3">
          <input
            required
            onChange={onChangeHandler}
            name="zipcode"
            value={formData.zipcode}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            type="number"
            placeholder="Zipcode"
          />
          <input
            required
            onChange={onChangeHandler}
            name="country"
            value={formData.country}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            type="text"
            placeholder="Country"
          />
        </div>
        <input
          required
          onChange={onChangeHandler}
          name="phone"
          value={formData.phone}
          className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
          type="number"
          placeholder="Phone"
        />
      </div>

      {/* ------------- Right Side ------------------ */}
      <div className="mt-8">
        <div className="mt-8 min-w-80">
          <CartTotal />
        </div>

        <div className="mt-12">
          <Title text1={"PAYMENT"} text2={"METHOD"} />
          <div className="flex gap-3 flex-col lg:flex-row">
            <div
              onClick={() => setMethod("stripe")}
              className="flex items-center gap-3 border p-2 px-3 cursor-pointer"
            >
              <p
                className={`min-w-3.5 h-3.5 border rounded-full ${
                  method === "stripe" ? "bg-green-400" : ""
                }`}
              ></p>
              <img className="h-5 mx-4" src={assets.stripe_logo} alt="" />
            </div>
            <div
              onClick={() => setMethod("googlepay")}
              className="flex items-center gap-3 border p-2 px-3 cursor-pointer"
            >
              <p
                className={`min-w-3.5 h-3.5 border rounded-full ${
                  method === "googlepay" ? "bg-green-400" : ""
                }`}
              ></p>
              <img
                className="h-14 mx-4"
                src={assets.googlepay_logo}
                alt="Google Pay"
              />
            </div>
            <div
              onClick={() => setMethod("razorpay")}
              className="flex items-center gap-3 border p-2 px-3 cursor-pointer"
            >
              <p
                className={`min-w-3.5 h-3.5 border rounded-full ${
                  method === "razorpay" ? "bg-green-400" : ""
                }`}
              ></p>
              <img className="h-5 mx-4" src={assets.razorpay_logo} alt="" />
            </div>
            <div
              onClick={() => setMethod("cod")}
              className="flex items-center gap-3 border p-2 px-3 cursor-pointer"
            >
              <p
                className={`min-w-3.5 h-3.5 border rounded-full ${
                  method === "cod" ? "bg-green-400" : ""
                }`}
              ></p>
              <p className="text-gray-500 text-sm font-medium mx-4">
                CASH ON DELIVERY
              </p>
            </div>
          </div>

          <div className="w-full text-end mt-8">
            <button
              type="submit"
              className="bg-black text-white px-16 py-3 text-sm"
            >
              PLACE ORDER
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default PlaceOrder;
