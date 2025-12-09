import React, { useContext, useEffect, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import Title from "../components/Title";
import { supabase } from "../supabaseClient";

const Orders = () => {
  const { user, token, getUserCart, currency, userId, navigate } =
    useContext(ShopContext);
  const [orderData, setOrderData] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Load only orders for the current user
  const loadOrderData = async () => {
    if (!user?.id) return; // Wait until user is available

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id, items, status, payment, paymentmethod, date, buyer_id")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Supabase fetch error:", error);
        return;
      }

      const formattedOrders = (data || []).map((order) => ({
        id: order.id,
        status: order.status,
        payment: order.payment,
        paymentmethod: order.paymentmethod,
        date: order.date,
        items: order.items || [],
      }));

      setOrderData(formattedOrders);
    } catch (error) {
      console.error("🔥 loadOrderData error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderData();
  }, [user]);

  // ✅ Reorder feature
  const handleReorder = async (orderId) => {
    console.log("🧠 Sending reorder request for order_id:", orderId);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reorder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: userId,
            order_id: orderId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        alert("🛒 Items added to your cart!");
        await getUserCart(userId);
        navigate("/cart");
      } else {
        alert(data.message || "Reorder failed");
      }
    } catch (err) {
      console.error("handleReorder error:", err);
      alert("Reorder failed: " + err.message);
    }
  };

  // ✅ UI Rendering
  if (loading)
    return (
      <div className="text-center py-20 text-gray-500 text-lg">
        Loading your orders...
      </div>
    );

  if (!user)
    return (
      <div className="text-center py-20 text-gray-500 text-lg">
        Please log in to view your orders.
      </div>
    );

  if (orderData.length === 0)
    return (
      <div className="text-center py-20 text-gray-500 text-lg">
        You haven’t placed any orders yet.
      </div>
    );

  return (
    <div className="border-t pt-16">
      <div className="text-2xl mb-6">
        <Title text1={"MY"} text2={"ORDERS"} />
      </div>

      <div>
        {orderData.map((order) => (
          <div key={order.id} className="py-4 border-t border-b text-gray-700">
            <p className="font-semibold mb-2">
              Order #{order.id}{" "}
              <span className="text-sm text-gray-500 ml-2">
                {new Date(order.date).toLocaleDateString()}
              </span>
            </p>

            {order.items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-6 text-sm mb-3 bg-gray-50 p-3 rounded"
              >
                <img
                  className="w-16 sm:w-20 rounded border"
                  src={item.images?.[0] || ""}
                  alt={item.name}
                />
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-gray-600">
                    {order.paymentmethod} | Size: {item.size} | Qty:{" "}
                    {item.quantity}
                  </p>
                  {item.customization && (
                    <p className="text-xs text-gray-500 mt-1">
                      ✏️ Custom:{" "}
                      {item.customization.lines
                        ?.filter(Boolean)
                        .join(" • ") || "None"}
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center mt-3">
              <p className="text-sm text-gray-500">
                Status:{" "}
                <span className="font-medium text-black">{order.status}</span>
              </p>
              <button
                onClick={() => handleReorder(order.id)}
                className="border px-4 py-2 text-sm font-medium rounded-sm text-green-600 hover:bg-green-50"
              >
                Reorder
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;
