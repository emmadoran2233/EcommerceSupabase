import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
//import axios from 'axios'
import { supabase } from "../supabaseClient"

export const ShopContext = createContext();

const ShopContextProvider = (props) => {

    const currency = '$';
    const delivery_fee = 10;
    // const backendUrl = import.meta.env.VITE_BACKEND_URL
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [cartItems, setCartItems] = useState({});
    const [products, setProducts] = useState([]);
    const [token, setToken] = useState('');
    const [userId, setUserId] = useState(""); 
    const [user, setUser] = useState(null);
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
                if (Array.isArray(data?.items)) {
                    const cartObject = {};
                    data.items.forEach((item) => {
                        if (!cartObject[item.id]) cartObject[item.id] = {};
                        cartObject[item.id][item.size] = item.quantity || 1;
                    });
                    setCartItems(cartObject);
                } else {
                    setCartItems(data?.items || {});
                }

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
    getProductsData();
  }, []);

  useEffect(() => {
    // Load existing session from Supabase
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const u = data.session.user;
        setToken(data.session.access_token);
        setUserId(u.id);
        setUser({
          id: u.id,
          name: u.user_metadata?.name || "User",
          email: u.email,
        });
        getUserCart(u.id);
      }
    };
    initAuth();

    // Subscribe to login/logout events
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setToken(session.access_token);
          setUserId(session.user.id);
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || "User",
            email: session.user.email,
          });
          getUserCart(session.user.id);
        } else {
          setToken("");
          setUserId("");
          setUser(null);
          setCartItems({});
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

    const value = {
        products, currency, delivery_fee,
        search, setSearch, showSearch, setShowSearch,
        cartItems, addToCart, setCartItems,
        getCartCount, updateQuantity,
        getCartAmount, navigate,
        setToken, token, user
    }

    return (
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    )

}

export default ShopContextProvider;