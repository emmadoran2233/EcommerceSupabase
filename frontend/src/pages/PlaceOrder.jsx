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
    const { navigate, cartItems, setCartItems, getCartTotals, delivery_fee, products, backendUrl } = useContext(ShopContext);
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
        const name = event.target.name
        const value = event.target.value
        setFormData(data => ({ ...data, [name]: value }))
    }

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
                console.log(response)
                try {

                    const { data } = await axios.post(backendUrl + '/api/order/verifyRazorpay', response, { headers: { token } })
                    if (data.success) {
                        navigate('/orders')
                        setCartItems({})
                    }
                } catch (error) {
                    console.log(error)
                    toast.error(error)
                }
            }
        }
        const rzp = new window.Razorpay(options)
        rzp.open()
    }

const onSubmitHandler = async (event) => {
        event.preventDefault()
        try {

              let orderItems = []

              for (const productId in cartItems) {
                  for (const sizeKey in cartItems[productId]) {
                      const entry = cartItems[productId][sizeKey];
                      const quantity = typeof entry === "object" ? entry.quantity || 1 : entry;
                        if (quantity > 0) {
                          const itemInfo = structuredClone(products.find(product => String(product.id) === String(productId)))
                          if (itemInfo) {
                              itemInfo.size = sizeKey
                              itemInfo.quantity = quantity
                              if (typeof entry === "object" && entry.rentInfo) {
                                    const rentInfo = entry.rentInfo;
                                    itemInfo.rentInfo = {
                                        ...rentInfo,
                                        startDate: rentInfo.startDate instanceof Date
                                            ? rentInfo.startDate.toISOString()
                                            : rentInfo.startDate,
                                        endDate: rentInfo.endDate instanceof Date
                                            ? rentInfo.endDate.toISOString()
                                            : rentInfo.endDate,
                                    };
                              }
                              orderItems.push(itemInfo)
                          }
                      }
                  }
              }

              const totals = getCartTotals();
              const subtotal = totals.dueTodaySubtotal || 0;
              const shippingFee = subtotal === 0 ? 0 : delivery_fee;
              const amountDue = subtotal + shippingFee;
              const depositTotal = totals.depositTotal || 0;
              const rentSubtotal = totals.rentSubtotal || 0;
              const purchaseSubtotal = totals.purchaseSubtotal || 0;
              const rentBreakdown = totals.rentItemsSummary || [];
              const depositStatus = depositTotal > 0 ? "pending_authorization" : "none";
              const depositEndDate = totals.maxRentalEndDate;

              if (amountDue <= 0) {
                  toast.error("Your cart total must be greater than $0 to place an order.");
                  return;
              }

              let orderData = {
                address: formData,
                items: orderItems,
                  amount: amountDue,
                  rent_subtotal: rentSubtotal,
                  purchase_subtotal: purchaseSubtotal,
                  shipping_fee: shippingFee,
                  deposit_total: depositTotal,
                  deposit_currency: "usd",
                  charge_currency: "usd",
                  rent_breakdown: rentBreakdown,
                  deposit_hold_status: depositStatus,
                  deposit_rental_end_date: depositEndDate,
                paymentmethod: method,
                payment: false,
                status: "Order Placed",
                date: new Date().toISOString()
            }
              console.log("cartItems:", cartItems);
              console.log("products:", products);
              console.log("checkout totals:", totals);
              console.log("shipping_fee:", shippingFee);
              console.log("orderData:", orderData);


            switch (method) {

                // API Calls for COD
                case 'cod':
                    const { error } = await supabase.from("orders").insert([orderData])
                    if (error) {
                        toast.error(error.message)
                    } else {
                        setCartItems({})
                        navigate('/orders')
                        toast.success("Order placed successfully!")
                    }
                    // const response = await axios.post(backendUrl + '/api/order/place',orderData,{headers:{token}})
                    // if (response.data.success) {
                    //     setCartItems({})
                    //     navigate('/orders')
                    // } else {
                    //     toast.error(response.data.message)
                    // }
                    break;

                case 'stripe':
                    try {
                        const userId = localStorage.getItem("user_id");

                        if (!userId) {
                            toast.error("User not logged in — please login again!");
                            return;
                        }

                        // ✅ 插入订单并附加 user_id
                          const { data: insertedOrders, error } = await supabase
                            .from("orders")
                            .insert([
                                {
                                    ...orderData,
                                    user_id: userId,
                                },
                            ])
                              .select("id");

                        if (error) {
                            toast.error(error.message);
                            return;
                        }

                          const orderId = Array.isArray(insertedOrders)
                              ? insertedOrders[0]?.id
                              : insertedOrders?.id;
                        if (!orderId) {
                            toast.error("Order ID missing after insert");
                            return;
                        }

                        // ✅ 调用 verifyStripe Edge Function
                        const response = await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verifyStripe`,
                            {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                                    "Content-Type": "application/json",
                                },
                                  body: JSON.stringify({ orderId }),
                            }
                        );

                        const data = await response.json();

                        if (data.success && data.session_url) {
                            window.location.replace(data.session_url);
                        } else {
                            toast.error(data.error || "Stripe order failed");
                        }

                    } catch (err) {
                        console.error("Stripe order error:", err);
                        toast.error("Stripe order failed");
                    }
                    break;

                case 'googlepay':
                    try {
                        const userId = localStorage.getItem("user_id");

                        if (!userId) {
                            toast.error("User not logged in — please login again!");
                            return;
                        }

                        // ✅ 插入订单并附加 user_id
                        const { data: insertedOrder, error } = await supabase
                            .from("orders")
                            .insert([
                                {
                                    ...orderData,
                                    user_id: userId,
                                },
                            ])
                            .select("id")
                            .single();

                        if (error) {
                            toast.error(error.message);
                            return;
                        }

                        const orderId = insertedOrder?.id;
                        if (!orderId) {
                            toast.error("Order ID missing after insert");
                            return;
                        }

                        // ✅ 调用 verifyGooglePay Edge Function
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

                        if (data.success && data.session_url) {
                            window.location.replace(data.session_url);
                        } else {
                            toast.error(data.error || "Google Pay order failed");
                        }

                    } catch (err) {
                        console.error("Google Pay order error:", err);
                        toast.error("Google Pay order failed");
                    }
                    break;





                case 'razorpay':

                    const responseRazorpay = await axios.post(backendUrl + '/api/order/razorpay', orderData, { headers: { token } })
                    if (responseRazorpay.data.success) {
                        initPay(responseRazorpay.data.order)
                    }

                    break;

                default:
                    break;
            }


        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }


    return (
        <form onSubmit={onSubmitHandler} className='flex flex-col sm:flex-row justify-between gap-4 pt-5 sm:pt-14 min-h-[80vh] border-t'>
            {/* ------------- Left Side ---------------- */}
            <div className='flex flex-col gap-4 w-full sm:max-w-[480px]'>

                <div className='text-xl sm:text-2xl my-3'>
                    <Title text1={'DELIVERY'} text2={'INFORMATION'} />
                </div>
                <div className='flex gap-3'>
                    <input required onChange={onChangeHandler} name='firstName' value={formData.firstName} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='First name' />
                    <input required onChange={onChangeHandler} name='lastName' value={formData.lastName} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='Last name' />
                </div>
                <input required onChange={onChangeHandler} name='email' value={formData.email} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="email" placeholder='Email address' />
                <input required onChange={onChangeHandler} name='street' value={formData.street} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='Street' />
                <div className='flex gap-3'>
                    <input required onChange={onChangeHandler} name='city' value={formData.city} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='City' />
                    <input onChange={onChangeHandler} name='state' value={formData.state} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='State' />
                </div>
                <div className='flex gap-3'>
                    <input required onChange={onChangeHandler} name='zipcode' value={formData.zipcode} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="number" placeholder='Zipcode' />
                    <input required onChange={onChangeHandler} name='country' value={formData.country} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="text" placeholder='Country' />
                </div>
                <input required onChange={onChangeHandler} name='phone' value={formData.phone} className='border border-gray-300 rounded py-1.5 px-3.5 w-full' type="number" placeholder='Phone' />
            </div>

            {/* ------------- Right Side ------------------ */}
            <div className='mt-8'>

                <div className='mt-8 min-w-80'>
                    <CartTotal />
                </div>

                <div className='mt-12'>
                    <Title text1={'PAYMENT'} text2={'METHOD'} />
                    {/* --------------- Payment Method Selection ------------- */}
                    <div className='flex gap-3 flex-col lg:flex-row'>
                        <div onClick={() => setMethod('stripe')} className='flex items-center gap-3 border p-2 px-3 cursor-pointer'>
                            <p className={`min-w-3.5 h-3.5 border rounded-full ${method === 'stripe' ? 'bg-green-400' : ''}`}></p>
                            <img className='h-5 mx-4' src={assets.stripe_logo} alt="" />
                        </div>
                        <div onClick={() => setMethod('googlepay')}
                            className='flex items-center gap-3 border p-2 px-3 cursor-pointer'>
                            <p className={`min-w-3.5 h-3.5 border rounded-full ${method === 'googlepay' ? 'bg-green-400' : ''}`}></p>
                            <img className='h-14 mx-4' src={assets.googlepay_logo} alt="Google Pay" />
                        </div>
                        <div onClick={() => setMethod('razorpay')} className='flex items-center gap-3 border p-2 px-3 cursor-pointer'>
                            <p className={`min-w-3.5 h-3.5 border rounded-full ${method === 'razorpay' ? 'bg-green-400' : ''}`}></p>
                            <img className='h-5 mx-4' src={assets.razorpay_logo} alt="" />
                        </div>
                        <div onClick={() => setMethod('cod')} className='flex items-center gap-3 border p-2 px-3 cursor-pointer'>
                            <p className={`min-w-3.5 h-3.5 border rounded-full ${method === 'cod' ? 'bg-green-400' : ''}`}></p>
                            <p className='text-gray-500 text-sm font-medium mx-4'>CASH ON DELIVERY</p>
                        </div>
                    </div>

                    <div className='w-full text-end mt-8'>
                        <button type='submit' className='bg-black text-white px-16 py-3 text-sm'>PLACE ORDER</button>
                    </div>
                </div>
            </div>
        </form>
    )
}

export default PlaceOrder
