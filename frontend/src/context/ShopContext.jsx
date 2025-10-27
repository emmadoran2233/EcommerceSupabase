import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

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


    // ✅ 新版 addToCart，加入 custom_text
    const addToCart = async (itemId, size, customText = null) => {
        if (!size) {
            toast.error("Select Product Size");
            return;
        }

        let cartData = structuredClone(cartItems);

        // ✅ SKU 已存在
        if (cartData[itemId] && cartData[itemId][size]) {
            cartData[itemId][size].quantity += 1;

            // ✅ 如果有新传 custom text，则覆盖旧的
            if (customText) {
                cartData[itemId][size].custom_text = customText;
            }
        } 
        // ✅ SKU 不存在
        else {
            cartData[itemId] = cartData[itemId] || {};
            cartData[itemId][size] = {
                quantity: 1,
                custom_text: customText || null,
            };
        }

        setCartItems(cartData);

        // ✅ 非登录模式暂不推送到 carts 表
    };


    const getCartCount = () => {
        let totalCount = 0;
        for (const productId in cartItems) {
            for (const size in cartItems[productId]) {
                const qty = cartItems[productId][size].quantity;
                if (qty > 0) totalCount += qty;
            }
        }
        return totalCount;
    };

    const updateQuantity = (itemId, size, quantity) => {
        let cartData = structuredClone(cartItems);
        if (cartData[itemId] && cartData[itemId][size]) {
            cartData[itemId][size].quantity = quantity;
            if (quantity === 0) {
                delete cartData[itemId][size];
                if (Object.keys(cartData[itemId]).length === 0) {
                    delete cartData[itemId];
                }
            }
        }
        setCartItems(cartData);
    };

    const getCartAmount = () => {
        let totalAmount = 0;
        for (const productId in cartItems) {
            const itemInfo = products.find(
                (p) => String(p.id) === String(productId)
            );
            if (!itemInfo) continue;

            for (const size in cartItems[productId]) {
                const qty = cartItems[productId][size].quantity;
                if (qty > 0) {
                    totalAmount += itemInfo.price * qty;
                }
            }
        }
        return totalAmount;
    };

    const getProductsData = async () => {
        try {
            const { data, error } = await supabase
                .from("products")
                .select("*")
                .order("created_at", { ascending: false });

            if (!error) setProducts(data);
        } catch (error) {
            console.log(error)
        }
    };

    useEffect(() => {
        getProductsData();
    }, []);

    const value = {
        products, currency, delivery_fee,
        search, setSearch, showSearch, setShowSearch,
        cartItems, addToCart, setCartItems,
        getCartCount, updateQuantity,
        getCartAmount, navigate, backendUrl,
        setToken, token,
        setUserId, userId,
    };

    return (
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    );
};

export default ShopContextProvider;
