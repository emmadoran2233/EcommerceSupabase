import React, { useContext, useState } from "react";
import axios from "axios";
import Title from "../components/Title";
import CartTotal from "../components/CartTotal";
import { assets } from "../assets/assets";
import { ShopContext } from "../context/ShopContext";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";

const PlaceOrder = () => {
  const [method, setMethod] = useState("cod");
  const {
    navigate,
    cartItems,
    setCartItems,
    getCartAmount,
    delivery_fee,
    products,
    backendUrl,
    user,
    userId,
  } = useContext(ShopContext);

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

  const onChangeHandler = (e) => {
    const { name, value } = e.target;
    setFormData((data) => ({ ...data, [name]: value }));
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      const uid = user?.id || userId || localStorage.getItem("user_id");
      if (!uid) {
        toast.error("User not logged in — please login again!");
        return;
      }

      // ✅ Build order items and collect all seller IDs
      let orderItems = [];
      let sellerIds = new Set();

      for (const productId in cartItems) {
        for (const sizeKey in cartItems[productId]) {
          const entry = cartItems[productId][sizeKey];
          const quantity = typeof entry === "object" ? entry.quantity : entry;
          if (!quantity || quantity <= 0) continue;

          const itemInfo = structuredClone(
            products.find((p) => String(p.id) === String(productId))
          );
          if (itemInfo) {
            itemInfo.size =
              typeof entry === "object" && entry.baseSize
                ? entry.baseSize
                : sizeKey.split("|custom:")[0];
            itemInfo.size_key = sizeKey;
            itemInfo.quantity = quantity;

            if (typeof entry === "object" && entry.customization)
              itemInfo.customization = entry.customization;
            if (typeof entry === "object" && entry.rentInfo)
              itemInfo.rentInfo = entry.rentInfo;

            // ✅ Capture seller_id from product
            if (itemInfo.seller_id) sellerIds.add(itemInfo.seller_id);

            orderItems.push(itemInfo);
          }
        }
      }

      // ✅ If multiple sellers, pick first (or adapt later for multi-seller split)
      const mainSellerId = Array.from(sellerIds)[0] || null;

      const orderData = {
        address: formData,
        items: orderItems,
        amount: getCartAmount() + delivery_fee,
        paymentmethod: method,
        payment: false,
        status: "Order Placed",
        date: new Date().toISOString(),
        user_id: uid, // buyer
        buyer_id: uid, // duplicate for consistency
        seller_id: mainSellerId, // ✅ NEW: seller tracking
      };

      /* ---------------------- COD ---------------------- */
      if (method === "cod") {
        const { error } = await supabase.from("orders").insert([orderData]);
        if (error) {
          toast.error(error.message);
        } else {
          setCartItems({});
          navigate("/orders");
          toast.success("Order placed successfully!");
        }
        return;
      }

      /* ---------------------- STRIPE ---------------------- */
      if (method === "stripe") {
        const { data: insertedOrder, error } = await supabase
          .from("orders")
          .insert([orderData])
          .select("id")
          .single();

        if (error) {
          toast.error(error.message);
          return;
        }

        const orderId = insertedOrder?.id;
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verifyStripe`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${
                import.meta.env.VITE_SUPABASE_ANON_KEY
              }`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId, amount: orderData.amount }),
          }
        );

        const data = await response.json();
        if (data.success && data.session_url) {
          window.location.replace(data.session_url);
        } else {
          toast.error(data.error || "Stripe order failed");
        }
        return;
      }

      /* ---------------------- GOOGLE PAY ---------------------- */
      if (method === "googlepay") {
        const { data: insertedOrder, error } = await supabase
          .from("orders")
          .insert([orderData])
          .select("id")
          .single();

        if (error) {
          toast.error(error.message);
          return;
        }

        const orderId = insertedOrder?.id;
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verifyGooglePay`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${
                import.meta.env.VITE_SUPABASE_ANON_KEY
              }`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId, amount: orderData.amount }),
          }
        );

        const data = await response.json();
        if (data.success && data.session_url) {
          window.location.replace(data.session_url);
        } else {
          toast.error(data.error || "Google Pay order failed");
        }
        return;
      }

      /* ---------------------- RAZORPAY ---------------------- */
      if (method === "razorpay") {
        const { error } = await supabase.from("orders").insert([orderData]);
        if (error) {
          toast.error(error.message);
          return;
        }

        const responseRazorpay = await axios.post(
          backendUrl + "/api/order/razorpay",
          orderData
        );

        if (responseRazorpay.data.success) {
          toast.success("Redirecting to payment...");
        }
        return;
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  return (
    <form
      onSubmit={onSubmitHandler}
      className="flex flex-col sm:flex-row justify-between gap-4 pt-5 sm:pt-14 min-h-[80vh] border-t"
    >
      {/* ---------- Left Side (Address Info) ---------- */}
      <div className="flex flex-col gap-4 w-full sm:max-w-[480px]">
        <div className="text-xl sm:text-2xl my-3">
          <Title text1={"DELIVERY"} text2={"INFORMATION"} />
        </div>

        <div className="flex gap-3">
          <input
            required
            name="firstName"
            value={formData.firstName}
            onChange={onChangeHandler}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            placeholder="First name"
          />
          <input
            required
            name="lastName"
            value={formData.lastName}
            onChange={onChangeHandler}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            placeholder="Last name"
          />
        </div>

        <input
          required
          name="email"
          value={formData.email}
          onChange={onChangeHandler}
          className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
          placeholder="Email address"
        />

        <input
          required
          name="street"
          value={formData.street}
          onChange={onChangeHandler}
          className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
          placeholder="Street"
        />

        <div className="flex gap-3">
          <input
            required
            name="city"
            value={formData.city}
            onChange={onChangeHandler}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            placeholder="City"
          />
          <input
            name="state"
            value={formData.state}
            onChange={onChangeHandler}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            placeholder="State"
          />
        </div>

        <div className="flex gap-3">
          <input
            required
            name="zipcode"
            value={formData.zipcode}
            onChange={onChangeHandler}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            placeholder="Zipcode"
          />
          <input
            required
            name="country"
            value={formData.country}
            onChange={onChangeHandler}
            className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
            placeholder="Country"
          />
        </div>

        <input
          required
          name="phone"
          value={formData.phone}
          onChange={onChangeHandler}
          className="border border-gray-300 rounded py-1.5 px-3.5 w-full"
          placeholder="Phone"
        />
      </div>

      {/* ---------- Right Side (Payment Info) ---------- */}
      <div className="mt-8">
        <CartTotal />
        <div className="mt-12">
          <Title text1={"PAYMENT"} text2={"METHOD"} />
          <div className="flex gap-3 flex-col lg:flex-row">
            {["stripe", "googlepay", "razorpay", "cod"].map((m) => (
              <div
                key={m}
                onClick={() => setMethod(m)}
                className="flex items-center gap-3 border p-2 px-3 cursor-pointer"
              >
                <p
                  className={`min-w-3.5 h-3.5 border rounded-full ${
                    method === m ? "bg-green-400" : ""
                  }`}
                ></p>
                {m === "stripe" && (
                  <img className="h-5 mx-4" src={assets.stripe_logo} alt="" />
                )}
                {m === "googlepay" && (
                  <img
                    className="h-14 mx-4"
                    src={assets.googlepay_logo}
                    alt="Google Pay"
                  />
                )}
                {m === "razorpay" && (
                  <img
                    className="h-5 mx-4"
                    src={assets.razorpay_logo}
                    alt=""
                  />
                )}
                {m === "cod" && (
                  <p className="text-gray-500 text-sm font-medium mx-4">
                    CASH ON DELIVERY
                  </p>
                )}
              </div>
            ))}
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
