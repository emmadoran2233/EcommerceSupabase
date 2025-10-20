import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { currency } from '../App'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'

const Orders = ({ token, user }) => {
  const [orders, setOrders] = useState([])

  // ---------------- Fetch Orders ----------------
  const fetchAllOrders = async () => {
    if (!token || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // ✅ Filter: only include orders that have items from this seller
      const sellerOrders = data.filter(order =>
        order.items?.some(item => item.seller_id === user.id)
      );

      setOrders(sellerOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(error.message);
    }
  };

  // ---------------- Update Order Status ----------------
  const statusHandler = async (event, orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: event.target.value })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Order status updated!');
      await fetchAllOrders();
    } catch (error) {
      console.error('Status update error:', error);
      toast.error(error.message);
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, [token, user]);

  // ---------------- Render ----------------
  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Orders</h3>

      <div>
        {orders.map((order, index) => (
          <div
            key={index}
            className="grid grid-cols-1 sm:grid-cols-[0.5fr_2fr_1fr] lg:grid-cols-[0.5fr_2fr_1fr_1fr_1fr] gap-3 items-start border-2 border-gray-200 p-5 md:p-8 my-3 md:my-4 text-xs sm:text-sm text-gray-700"
          >
            <img className="w-12" src={assets.parcel_icon} alt="parcel" />

            <div>
              <div>
                {/* ✅ Only show this seller’s items */}
                {order.items
                  .filter(item => item.seller_id === user.id)
                  .map((item, i) => (
                    <p key={i} className="py-0.5">
                      {item.name} × {item.quantity}{" "}
                      <span className="text-gray-500">{item.size}</span>
                    </p>
                  ))}
              </div>

              <p className="mt-3 mb-2 font-medium">
                {order.address.firstName + " " + order.address.lastName}
              </p>
              <div>
                <p>{order.address.street},</p>
                <p>
                  {order.address.city}, {order.address.state},{" "}
                  {order.address.country}, {order.address.zipcode}
                </p>
              </div>
              <p>{order.address.phone}</p>
            </div>

            <div>
              <p className="text-sm sm:text-[15px]">
                Items:{" "}
                {order.items.filter(item => item.seller_id === user.id).length}
              </p>
              <p className="mt-3">Method: {order.paymentMethod}</p>
              <p>Payment: {order.payment ? "Done" : "Pending"}</p>
              <p>Date: {new Date(order.date).toLocaleDateString()}</p>
            </div>

            {/* ✅ Seller subtotal */}
            <p className="text-sm sm:text-[15px] font-medium">
              {currency}
              {order.items
                .filter(item => item.seller_id === user.id)
                .reduce((sum, item) => sum + item.price * item.quantity, 0)
                .toFixed(2)}
            </p>

            {/* ✅ Status control */}
            <select
              onChange={event => statusHandler(event, order.id)}
              value={order.status}
              className="p-2 font-semibold"
            >
              <option value="Order Placed">Order Placed</option>
              <option value="Packing">Packing</option>
              <option value="Shipped">Shipped</option>
              <option value="Out for delivery">Out for delivery</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
        ))}

        {orders.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            No orders found for your products.
          </p>
        )}
      </div>
    </div>
  );
};

export default Orders;
