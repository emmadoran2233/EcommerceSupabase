import React, { useContext, useEffect, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import Title from "../components/Title";
import { assets } from "../assets/assets";
import CartTotal from "../components/CartTotal";

const Cart = () => {
  const { products, currency, cartItems, updateQuantity, navigate } =
    useContext(ShopContext);
  const [cartData, setCartData] = useState([]);

  useEffect(() => {
    if (products.length > 0) {
      const tempData = [];

      for (const productId in cartItems) {
        const product = products.find(
          (p) => String(p.id) === String(productId)
        );
        if (!product) continue;

        for (const sizeKey in cartItems[productId]) {
          const item = cartItems[productId][sizeKey];

          const quantity = typeof item === "object" ? item.quantity : item;
          const rentInfo = typeof item === "object" ? item.rentInfo : null;

          if (quantity > 0) {
            tempData.push({
              id: productId,
              size: sizeKey,
              quantity,
              rentInfo,
              productData: product,
            });
          }
        }
      }
      setCartData(tempData);
    }
  }, [cartItems, products]);

  return (
    <div className="border-t pt-14">
      <div className="text-2xl mb-3">
        <Title text1={"YOUR"} text2={"CART"} />
      </div>

      {/* ---------- CART ITEMS ---------- */}
      <div>
        {Array.isArray(cartData) &&
          cartData
            .filter((item) => item && typeof item === "object")
            .map((item, index) => {
              const productData = item.productData;
              if (!productData) return null;

              const imageSrc = productData.images?.[0] || "";

              return (
                <div
                  key={`${item.id}-${item.size}`}
                  className="py-4 border-t border-b text-gray-700 grid grid-cols-[4fr_0.5fr_0.5fr]"
                >
                  <div className="flex items-start gap-6">
                    <img className="w-16 sm:w-20" src={imageSrc} alt="" />
                    <div>
                      <p className="text-xs sm:text-lg font-medium">
                        {productData.name}
                      </p>

                      {/* ✅ 租赁商品显示租期与价格 */}
                      {item.rentInfo ? (
                        <div className="text-sm text-gray-500 mt-2">
                          <p>
                            Rent Date:{" "}
                            {new Date(
                              item.rentInfo.startDate
                            ).toLocaleDateString()}
                            →
                            {new Date(
                              item.rentInfo.endDate
                            ).toLocaleDateString()}
                          </p>
                          <p>
                             Rent Fee: $
                            {item?.rentInfo?.rentFee?.toFixed(2) || 'Error Calculating'}
                          </p>
                          <p>
                            Rent Deposit: ${item.rentInfo.deposit.toFixed(2)}
                          </p>
                          <img
                              onClick={() =>
                                updateQuantity(item.id, item.size, 0)
                              }
                              src={assets.bin_icon}
                              alt="delete"
                              className="w-5 cursor-pointer hover:opacity-60 transition"
                            />
                          <p className="text-xs text-gray-400 mt-1">
                          </p>
                        </div>
                      ) : (
                        // ✅ 普通商品显示 size / quantity
                        <div className="flex items-center gap-5 mt-2">
                          <p>{currency + productData.price}</p>
                          <p className="px-2 sm:px-3 sm:py-1 border bg-slate-50">
                            {item.size}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <input
                              type="number"
                              min="0"
                              defaultValue={item.quantity}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                if (isNaN(value)) return;
                                updateQuantity(item.id, item.size, value);
                              }}
                              className="border w-16 text-center"
                            />
                            <img
                              onClick={() =>
                                updateQuantity(item.id, item.size, 0)
                              }
                              src={assets.bin_icon}
                              alt="delete"
                              className="w-5 cursor-pointer hover:opacity-60 transition"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ✅ 小计显示逻辑 */}
                  <div className="flex items-center justify-end font-medium text-sm">
                    {currency}
                    {item.rentInfo
                      ? item.rentInfo.totalPrice.toFixed(2)
                      : (productData.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              );
            })}
      </div>

      {/* ---------- CART TOTAL ---------- */}
      <div className="flex justify-end my-20">
        <div className="w-full sm:w-[450px]">
          <CartTotal />
          <div className="w-full text-end">
            <button
              onClick={() => navigate("/place-order")}
              className="bg-black text-white text-sm my-8 px-8 py-3"
            >
              PROCEED TO CHECKOUT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
