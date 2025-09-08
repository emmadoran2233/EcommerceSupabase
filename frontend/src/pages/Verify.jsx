import React from 'react'
import { useContext } from 'react'
import { ShopContext } from '../context/ShopContext'
import { useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'

const Verify = () => {

    const { navigate, token, setCartItems, backendUrl } = useContext(ShopContext)
    const [searchParams, setSearchParams] = useSearchParams()

    const success = searchParams.get('success')
    const orderId = searchParams.get('orderId')

    const verifyPayment = async () => {
        try {

            if (!token) {
                return null
            }
            const response = await axios.post(
                'https://vhbgepmpesopzpmzmcjs.supabase.co/functions/v1/verifyStripe',
                { success, orderId },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',},})
            if (response.data.success) {
                setCartItems({})
                navigate('/orders')
            } else {
                navigate('/cart')
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)}}

    useEffect(() => {
        verifyPayment()
    }, [token])

    return (
        <div>

        </div>
    )
}

export default Verify