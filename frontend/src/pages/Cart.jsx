import React, { useContext, useEffect, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import Title from "../components/Title";
import { assets } from "../assets/assets";
import CartTotal from "../components/CartTotal";

const Cart = () => {
  const { products, currency, cartItems, updateQuantity, navigate } =
    useContext(ShopContext);
  const [cartData, setCartData] = useState([]);
  const toNumber = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^\d.-]/g, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const fmt = (v) => {
    const n = toNumber(v);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };

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
<<<<<<< HEAD
          const customization =
            typeof item === "object" ? item.customization : null;
          const baseSize =
            typeof item === "object" && item.baseSize
              ? item.baseSize
              : sizeKey.split("|custom:")[0];
=======
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)

          if (quantity > 0) {
            tempData.push({
              id: productId,
<<<<<<< HEAD
              sizeKey,
              displaySize: baseSize,
              quantity,
              rentInfo,
              customization,
=======
              size: sizeKey,
              quantity,
              rentInfo,
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
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
<<<<<<< HEAD
            <div
              key={`${item.id}-${item.sizeKey}`}
=======
                <div
                  key={`${item.id}-${item.size}`}
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
                  className="py-4 border-t border-b text-gray-700 grid grid-cols-[4fr_0.5fr_0.5fr]"
                >
                  <div className="flex items-start gap-6">
                    <img className="w-16 sm:w-20" src={imageSrc} alt="" />
                    <div>
                      <p className="text-xs sm:text-lg font-medium">
                        {productData.name}
                      </p>

                      {/* ✅ 租赁商品显示租期与价格 */}
<<<<<<< HEAD
                      {item.rentInfo ? (
                        <div className="text-sm text-gray-500 mt-2">
                          <p>
                            Rent Date:
                            {new Date(
                              item.rentInfo.startDate
                            ).toLocaleDateString()}
                            →
                            {new Date(
                              item.rentInfo.endDate
                            ).toLocaleDateString()}
                          </p>
                          <p>Rent Fee: ${fmt(item.rentInfo.rentFee)}</p>
                          <p>
                            Rent Deposit: ${fmt(item.rentInfo.deposit)}
                          </p>
                          <img
                            onClick={() =>
                              updateQuantity(item.id, item.sizeKey, 0)
                            }
                            src={assets.bin_icon}
                            alt="delete"
                            className="w-5 cursor-pointer hover:opacity-60 transition"
                          />
                          <p className="text-xs text-gray-400 mt-1"></p>
                        </div>
                      ) : (
                        // ✅ 普通商品显示 size / quantity
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="flex items-center gap-5">
                            <div>
                              <p>{currency + productData.price}</p>
                              <p className="px-2 sm:px-3 sm:py-1 border bg-slate-50 inline-block mt-1">
                                {item.displaySize}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <input
                                type="number"
                                min="0"
                                defaultValue={item.quantity}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  if (isNaN(value)) return;
                                  updateQuantity(item.id, item.sizeKey, value);
                                }}
                                className="border w-16 text-center"
                              />
                              <img
                                onClick={() =>
                                  updateQuantity(item.id, item.sizeKey, 0)
                                }
                                src={assets.bin_icon}
                                alt="delete"
                                className="w-5 cursor-pointer hover:opacity-60 transition"
                              />
                            </div>
                          </div>
                          {item.customization && (
                            <div className="text-xs text-gray-500 space-y-1">
                              <p className="font-medium flex items-center gap-1">
                                ✏️ Custom Text
                                <span
                                  className="inline-block w-3 h-3 rounded-full border"
                                  style={{
                                    backgroundColor:
                                      item.customization.color || "#111827",
                                  }}
                                />
                              </p>
                              <p>
                                {item.customization.lines
                                  ?.filter((line) => line)
                                  .join(" • ")}
                              </p>
                            </div>
                          )}
=======
                        {item.rentInfo ? (
                          <div className="text-sm text-gray-500 mt-2 space-y-1">
                            <p>
                              Rent Date:{" "}
                              {new Date(
                                item.rentInfo.startDate
                              ).toLocaleDateString()}{" "}
                              →{" "}
                              {new Date(
                                item.rentInfo.endDate
                              ).toLocaleDateString()}
                            </p>
                            <p>Rent Fee (due today): ${fmt(item.rentInfo.rentFee)}</p>
                            <p>Deposit Hold: ${fmt(item.rentInfo.deposit)}</p>
                            <p className="text-xs text-gray-400">
                              Deposit stays authorized only and releases at rental close
                              unless damages occur.
                            </p>
                            <img
                              onClick={() =>
                                updateQuantity(item.id, item.size, 0)
                              }
                              src={assets.bin_icon}
                              alt="delete"
                              className="w-5 cursor-pointer hover:opacity-60 transition"
                            />
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
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ✅ 小计显示逻辑 */}
<<<<<<< HEAD
                  <div className="flex items-center justify-end font-medium text-sm">
                    {currency}
                    {item.rentInfo
                      ? fmt(item.rentInfo.totalPrice)
                      : fmt((productData.price * item.quantity))}
                  </div>
=======
                    <div className="flex flex-col items-end text-sm font-medium">
                      <div>
                        {currency}
                        {item.rentInfo
                          ? fmt(item.rentInfo.rentFee)
                          : fmt(productData.price * item.quantity)}
                      </div>
                      {item.rentInfo && (
                        <p className="text-xs font-normal text-gray-500">
                          + ${fmt(item.rentInfo.deposit)} hold
                        </p>
                      )}
                    </div>
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
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
