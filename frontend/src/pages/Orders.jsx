import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from '../components/Title';
import { supabase } from "../supabaseClient"
import axios from 'axios';

const Orders = () => {

  const { currency} = useContext(ShopContext);

  const [orderData,setOrderData] = useState([])

  const loadOrderData = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("items, status, payment, paymentmethod, date")
        .order("created_at", { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      let allOrdersItem = []
      data.forEach((order) => {
        order.items.forEach((item) => {
          item.status = order.status
          item.payment = order.payment
          item.paymentmethod = order.paymentmethod
          item.date = order.date
          allOrdersItem.push(item)
        })
      })
      setOrderData(allOrdersItem)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(()=>{
    loadOrderData()
  },[])

  return (
    <div className='border-t pt-16'>

        <div className='text-2xl'>
            <Title text1={'MY'} text2={'ORDERS'}/>
        </div>

        <div>
            {
              orderData.map((item,index) => (
                <div key={index} className='py-4 border-t border-b text-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
                    <div className='flex items-start gap-6 text-sm'>
                        <img className='w-16 sm:w-20' src={Array.isArray(item.images) ? item.images[0] : item.images} alt="" />
                        <div>
                          <p className='sm:text-base font-medium'>{item.name}</p>
                          <div className='flex items-center gap-3 mt-1 text-base text-gray-700'>
                            <p>{currency}{item.price}</p>
                            <p>Quantity: {item.quantity}</p>
                            <p>Size: {item.size}</p>
                          </div>
                          <p className='mt-1'>Date: <span className=' text-gray-400'>{new Date(item.date).toDateString()}</span></p>
                          <p className='mt-1'>Payment: <span className=' text-gray-400'>{item.paymentmethod}</span></p>
                        </div>
                    </div>
                    <div className='md:w-1/2 flex justify-between'>
                        <div className='flex items-center gap-2'>
                            <p className='min-w-2 h-2 rounded-full bg-green-500'></p>
                            <p className='text-sm md:text-base'>{item.status}</p>
                        </div>
                        <button onClick={loadOrderData} className='border px-4 py-2 text-sm font-medium rounded-sm'>Track Order</button>
                    </div>
                </div>
              ))
            }
        </div>
    </div>
  )
}

export default Orders
