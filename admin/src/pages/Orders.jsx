import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'
import { currency } from '../App'
import { supabase } from '../supabase'   // by supabase-js

const Orders = () => {
  const [orders, setOrders] = useState([])

  // pull orders
  const fetchAllOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error("Fetch orders error:", error.message)
      toast.error("Failed to fetch orders: " + error.message)
    }
  }

  // change orders status
  const statusHandler = async (event, orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: event.target.value })
        .eq('id', orderId)

      if (error) throw error
      toast.success("Order status updated!")
      await fetchAllOrders()
    } catch (error) {
      console.error("Update status error:", error.message)
      toast.error("Failed to update order: " + error.message)
    }
  }

  useEffect(() => {
    fetchAllOrders()
  }, [])

  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Orders</h3>
      <div>
        {orders.map((order, index) => (
          <div
            key={order.id || index}
            className="grid grid-cols-1 sm:grid-cols-[0.5fr_2fr_1fr] lg:grid-cols-[0.5fr_2fr_1fr_1fr_1fr] gap-3 items-start border-2 border-gray-200 p-5 md:p-8 my-3 md:my-4 text-xs sm:text-sm text-gray-700"
          >
            <img className="w-12" src={assets.parcel_icon} alt="" />
            <div>
              <div>
                {order.items?.map((item, idx) => (
                  <p className="py-0.5" key={idx}>
                    {item.name} x {item.quantity} <span>{item.size}</span>
                    {idx < order.items.length - 1 ? ',' : ''}
                  </p>
                ))}
              </div>
              <p className="mt-3 mb-2 font-medium">
                {order.address?.firstName} {order.address?.lastName}
              </p>
              <div>
                <p>{order.address?.street},</p>
                <p>
                  {order.address?.city}, {order.address?.state}, {order.address?.country}, {order.address?.zipcode}
                </p>
              </div>
              <p>{order.address?.phone}</p>
            </div>
            <div>
              <p className="text-sm sm:text-[15px]">Items : {order.items?.length}</p>
              <p className="mt-3">Method : {order.paymentMethod}</p>
              <p>Payment : {order.payment ? 'Done' : 'Pending'}</p>
              <p>Date : {new Date(order.date).toLocaleDateString()}</p>
            </div>
            <p className="text-sm sm:text-[15px]">{currency}{order.amount}</p>
            <select
              onChange={(event) => statusHandler(event, order.id)}
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
      </div>
    </div>
  )
}

export default Orders
