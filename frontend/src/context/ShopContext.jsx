import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export const ShopContext = createContext();

const ShopContextProvider = (props) => {
  const currency = "$";
  const delivery_fee = 10;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [cartItems, setCartItems] = useState({});
  const [products, setProducts] = useState([]);
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [user, setUser] = useState(null);

  const navigate = useNavigate();
  const logout = async (navigate) => {
    try {
      // Clear Supabase session
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout Error:", error.message);
        return;
      }

      // Clear local storage and app state
      localStorage.removeItem("token");
      setToken("");
      setCartItems({});
      navigate("/login");
    } catch (err) {
      console.error("Logout Failed:", err.message);
    }
  };
  // ✅ 改进版 addToCart：支持 rentable 商品 + customization
  const addToCart = async (
    itemId,
    size,
    rentInfo = null,
    customization = null
  ) => {
    const product = products.find((p) => String(p.id) === String(itemId));

    if (!product) {
      toast.error("Product not found");
      return;
    }

    // ✅ 非租赁商品必须选 size
    if (!product.rentable && (!size || size === "")) {
      toast.error("Select Product Size");
      return;
    }

    // ✅ 对租赁商品固定用 key 'rent'
    let baseSizeKey = product.rentable ? "rent" : size;
    let sizeKey;
    if (product.rentable && rentInfo?.startDate && rentInfo?.endDate) {
      const start = new Date(rentInfo.startDate).toISOString().split("T")[0];
      const end = new Date(rentInfo.endDate).toISOString().split("T")[0];
      sizeKey = `rent_${start}_to_${end}`; // ✅ 每个租期生成唯一 key
    } else {
      sizeKey = baseSizeKey;
    }

    let customizationPayload = null;
    if (
      !product.rentable &&
      product.is_customizable &&
      customization?.lines?.some((line) => line.trim().length > 0)
    ) {
      const trimmedLines = customization.lines.map((line) => line.trim());
      const customId =
        customization.id ||
        (globalThis.crypto?.randomUUID
          ? crypto.randomUUID()
          : `custom-${Date.now()}`);
      customizationPayload = {
        ...customization,
        id: customId,
        lines: trimmedLines,
      };
      sizeKey = `${baseSizeKey}|custom:${customId}`;
    }

    let cartData = structuredClone(cartItems);
    if (!cartData[itemId]) cartData[itemId] = {};

    // ✅ 如果是租赁商品，存入租赁信息
    if (product.rentable) {
      cartData[itemId][sizeKey] = {
        quantity: 1,
        rentInfo: rentInfo || {},
      };
    } else if (customizationPayload) {
      const existing = cartData[itemId][sizeKey];
      const currentQty =
        typeof existing === "object"
          ? existing.quantity || 0
          : Number(existing) || 0;
      cartData[itemId][sizeKey] = {
        quantity: currentQty + 1,
        customization: customizationPayload,
        baseSize: size,
      };
    } else {
      cartData[itemId][sizeKey] = (cartData[itemId][sizeKey] || 0) + 1;
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
      toast.success("Added to cart!", {autoClose: 800});
    } catch (err) {
      toast.error("Failed to update cart: " + err.message);
    }
  };

  const getCartCount = () => {
    let totalCount = 0;
    for (const productId in cartItems) {
      for (const size in cartItems[productId]) {
        const item = cartItems[productId][size];
        const qty = typeof item === "object" ? item.quantity : item;
        if (qty > 0) totalCount += qty;
      }
    }
    return totalCount;
  };

  const updateQuantity = async (itemId, size, quantity) => {
    let cartData = structuredClone(cartItems);
    if (!cartData[itemId]) cartData[itemId] = {};
    if (typeof cartData[itemId][size] === "object") {
      cartData[itemId][size].quantity = quantity;
    } else {
      cartData[itemId][size] = quantity;
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

  const getCartAmount = () => {
    let totalAmount = 0;
    for (const productId in cartItems) {
      const itemInfo = products.find((p) => String(p.id) === String(productId));
      if (!itemInfo) continue;

      for (const size in cartItems[productId]) {
        const item = cartItems[productId][size];
        if (typeof item === "object" && item.rentInfo) {
          // ✅ 租赁商品使用 rentInfo.totalPrice
          totalAmount += item.rentInfo.totalPrice || 0;
        } else {
          const qty = typeof item === "object" ? item.quantity : item;
          if (qty > 0) totalAmount += itemInfo.price * qty;
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
        .order("created_at", { ascending: false });

      if (error) toast.error(error.message);
      else setProducts(data);
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    }
  };

  useEffect(() => {
    getProductsData();
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUserId = localStorage.getItem("user_id");

    if (storedToken) setToken(storedToken);
    if (storedUserId) {
      setUserId(storedUserId);
      getUserCart(storedUserId);
    }
  }, []);

  useEffect(() => {
  const initAuth = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Auth init error:", error);
      return;
    }

    if (data.session?.user) {
      const u = data.session.user;
      setUser(u);
      setUserId(u.id);
      setToken(data.session.access_token);
      localStorage.setItem("token", data.session.access_token);
      localStorage.setItem("user_id", u.id);
      getUserCart(u.id);
    }
  };

  initAuth();

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      const u = session.user;
      setUser(u);
      setUserId(u.id);
      setToken(session.access_token);
      localStorage.setItem("token", session.access_token);
      localStorage.setItem("user_id", u.id);
      getUserCart(u.id);
    } else {
      setUser(null);
      setUserId("");
      setToken("");
      setCartItems({});
      localStorage.removeItem("token");
      localStorage.removeItem("user_id");
    }
  });

  return () => listener.subscription.unsubscribe();
}, []);
  const value = {
    products,
    currency,
    delivery_fee,
    search,
    setSearch,
    showSearch,
    setShowSearch,
    cartItems,
    addToCart,
    setCartItems,
    getCartCount,
    updateQuantity,
    getCartAmount,
    navigate,
    backendUrl,
    setToken,
    token,
    setUserId,
    userId,
    getUserCart,
    logout,
    user,
    setUser,
  };

  return (
    <ShopContext.Provider value={value}>{props.children}</ShopContext.Provider>
  );
};

export default ShopContextProvider;
