import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
//import axios from 'axios'
import { supabase } from "../supabaseClient"

export const ShopContext = createContext();

const ShopContextProvider = (props) => {

    const currency = '$';
    const delivery_fee = 10;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [cartItems, setCartItems] = useState({});
    const [products, setProducts] = useState([]);
    const [token, setToken] = useState('');
    const [userId, setUserId] = useState(""); 
    const navigate = useNavigate();


    const addToCart = async (itemId, size) => {
        if (!size) {
        toast.error("Select Product Size");
        return;
        }

        let cartData = structuredClone(cartItems);

        if (cartData[itemId]) {
        cartData[itemId][size] = (cartData[itemId][size] || 0) + 1;
        } else {
        cartData[itemId] = { [size]: 1 };
        }

        setCartItems(cartData);

        try {
        if (userId) {
            const { error } = await supabase
            .from("carts")
            .update({ items: cartData, updated_at: new Date() })
            .eq("user_id", userId);

            if (error) throw error;
        }
        } catch (err) {
        toast.error("Failed to update cart: " + err.message);
        }
    };

    const getCartCount = () => {
        let totalCount = 0;
        for (const productId in cartItems) {
        for (const size in cartItems[productId]) {
            const qty = cartItems[productId][size];
            if (qty > 0) totalCount += qty;
        }
        }
        return totalCount;
    };

    const updateQuantity = async (itemId, size, quantity) => {
        let cartData = structuredClone(cartItems);
        if (!cartData[itemId]) cartData[itemId] = {};
        cartData[itemId][size] = quantity;

        setCartItems(cartData);

        try {
        if (userId) {
            const { error } = await supabase
            .from("carts")
            .update({ items: cartData, updated_at: new Date() })
            .eq("user_id", userId);

            if (error) throw error;
        }
        } catch (err) {
        toast.error("Failed to update cart: " + err.message);
        }
    };

    const getCartAmount = () => {
        let totalAmount = 0;
        for (const productId in cartItems) {
        const itemInfo = products.find(
            (p) => String(p.id) === String(productId)
        );
        if (!itemInfo) continue;

        for (const size in cartItems[productId]) {
            const qty = cartItems[productId][size];
            if (qty > 0) {
            totalAmount += itemInfo.price * qty;
            }
        }
        }
        return totalAmount;
    };

    const getUserCart = async (userId) => {
        try {
        const { data, error } = await supabase
            .from("carts")
            .select("items")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) {
            toast.error(error.message);
        } else {
            setCartItems(data?.items || {});
        }
        } catch (error) {
        toast.error(error.message);
        }
    };

    const getProductsData = async () => {
        try {
            const { data, error } = await supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false })

            if (error) {
            toast.error(error.message)
            } else {
            setProducts(data)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }


    useEffect(() => {
        getProductsData()
    }, [])

    useEffect(() => {
        // Load from localStorage on first mount
        const storedToken = localStorage.getItem("token");
        const storedUserId = localStorage.getItem("user_id"); // ✅ load userId

        if (storedToken) setToken(storedToken);
        if (storedUserId) {
        setUserId(storedUserId);
        getUserCart(storedUserId);
        }
    }, []);

    const value = {
        products, currency, delivery_fee,
        search, setSearch, showSearch, setShowSearch,
        cartItems, addToCart,setCartItems,
        getCartCount, updateQuantity,
        getCartAmount, navigate, backendUrl,
        setToken, token,
        setUserId, userId
        
    }

    return (
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    )

}

export default ShopContextProvider;