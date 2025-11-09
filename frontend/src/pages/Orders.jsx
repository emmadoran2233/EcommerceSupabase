import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from '../components/Title'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

const Orders = () => {
  const { currency } = useContext(ShopContext)
  const [orderData, setOrderData] = useState([])

  const loadOrderData = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, items, status, payment, paymentmethod, date')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Supabase fetch error:', error)
        return
      }

      const formattedOrders = data.map(order => ({
        id: order.id,
        status: order.status,
        payment: order.payment,
        paymentmethod: order.paymentmethod,
        date: order.date,
        items: order.items || []
      }));
      setOrderData(formattedOrders);
    } catch (error) {
      console.error('🔥 loadOrderData error:', error)
    }
  }

  useEffect(() => {
    loadOrderData()
  }, [])

  const { userId, token, getUserCart, navigate } = useContext(ShopContext);

  const handleReorder = async (orderId) => {
    console.log("🧠 Sending reorder request for order_id:", orderId);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          order_id: orderId,
        }),
      });

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

  return (
    <div className="border-t pt-16">
      <div className="text-2xl">
        <Title text1={'MY'} text2={'ORDERS'} />
      </div>

      <div>
        {orderData.map((order, index) => (
          <div key={index} className="py-4 border-t border-b text-gray-700">
            <p className="font-semibold mb-2">Order #{order.id}</p>
            {order.items.map((item, i) => (
              <div key={i} className="flex items-start gap-6 text-sm mb-3">
                <img className="w-16 sm:w-20" src={item.images?.[0] || ""} alt={item.name} />
                <div>
                  <p>{item.name}</p>
                  <p>{order.paymentmethod} | Size: {item.size} | Qty: {item.quantity}</p>
                </div>
              </div>
            ))}
            <button
              onClick={() => handleReorder(order.id)}
              className="border px-4 py-2 text-sm font-medium rounded-sm text-green-500 hover:bg-green-50"
            >
              Reorder
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Orders
