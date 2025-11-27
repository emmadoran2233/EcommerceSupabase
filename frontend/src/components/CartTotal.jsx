<<<<<<< HEAD
import React, { useContext } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from './Title';

const CartTotal = () => {

    const {currency,delivery_fee,getCartAmount} = useContext(ShopContext);
=======
import React, { useContext } from "react";
import { ShopContext } from "../context/ShopContext";
import Title from "./Title";

const CartTotal = () => {

    const { currency, delivery_fee, getCartTotals } = useContext(ShopContext);

    const totals = getCartTotals();
    const subtotal = totals.dueTodaySubtotal || 0;
    const rentSubtotal = totals.rentSubtotal || 0;
    const purchaseSubtotal = totals.purchaseSubtotal || 0;
    const depositHold = totals.depositTotal || 0;
    const shippingFee = subtotal === 0 ? 0 : delivery_fee;
    const totalDueToday = subtotal + shippingFee;
    const format = (value) =>
      currency + " " + (Number(value || 0)).toFixed(2);
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)

  return (
    <div className='w-full'>
      <div className='text-2xl'>
        <Title text1={'CART'} text2={'TOTALS'} />
      </div>

      <div className='flex flex-col gap-2 mt-2 text-sm'>
<<<<<<< HEAD
            <div className='flex justify-between'>
                <p>Subtotal</p>
                <p>{currency} {getCartAmount()}.00</p>
            </div>
            <hr />
            <div className='flex justify-between'>
                <p>Shipping Fee</p>
                <p>{currency} {delivery_fee}.00</p>
            </div>
            <hr />
            <div className='flex justify-between'>
                <b>Total</b>
                <b>{currency} {getCartAmount() === 0 ? 0 : getCartAmount() + delivery_fee}.00</b>
            </div>
      </div>
=======
              <div className='flex justify-between'>
                  <p>Rent Subtotal</p>
                  <p>{format(rentSubtotal)}</p>
              </div>
              <div className='flex justify-between'>
                  <p>Purchase Subtotal</p>
                  <p>{format(purchaseSubtotal)}</p>
              </div>
            <hr />
            <div className='flex justify-between'>
                <p>Shipping Fee</p>
                  <p>{format(shippingFee)}</p>
            </div>
            <hr />
              <div className='flex justify-between text-sm text-gray-600'>
                  <p>Deposit Hold (not charged)</p>
                  <p>{format(depositHold)}</p>
              </div>
              <hr />
            <div className='flex justify-between'>
                  <b>Total Due Today</b>
                  <b>{format(totalDueToday)}</b>
            </div>
      </div>
        <p className="text-xs text-gray-500 mt-2">
          Deposits stay as card authorizations until you return your rental or a
          damage claim is captured.
        </p>
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
    </div>
  )
}

<<<<<<< HEAD
export default CartTotal
=======
  export default CartTotal
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
