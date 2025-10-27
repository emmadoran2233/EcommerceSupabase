import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import Title from '../components/Title';
import { assets } from '../assets/assets';
import CartTotal from '../components/CartTotal';

const Cart = () => {

  const { products, currency, cartItems, updateQuantity, navigate } = useContext(ShopContext);

  const [cartData, setCartData] = useState([]);

  useEffect(() => {
    if (products.length > 0) {
      const tempData = [];
      for (const productId in cartItems) {
        for (const size in cartItems[productId]) {
          const item = cartItems[productId][size];
          if (item.quantity > 0) {
            tempData.push({
              id: productId,
              size: size,
              quantity: item.quantity,
              customText: item.custom_text || null, // ✅ 自定义内容
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
        <Title text1="YOUR" text2="CART" />
      </div>

      {/* cart items list */}
      <div>
        {cartData.map((item) => {
          const productData = products.find(
            (product) => String(product.id) === String(item.id)
          );
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

                  {/* ✅ 显示自定义内容 */}
                  {item.customText && (
                    <p className="text-sm mt-1 italic text-orange-600">
                      ✎ Custom: {item.customText}
                    </p>
                  )}

                  <div className="flex items-center gap-5 mt-2">
                    <p>{currency}{productData.price}</p>
                    <p className="px-2 sm:px-3 sm:py-1 border bg-slate-50">{item.size}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <input
                        type="number"
                        min="0"
                        defaultValue={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.id, item.size, Number(e.target.value))
                        }
                        className="border w-16 text-center"
                      />
                      <img
                        onClick={() => updateQuantity(item.id, item.size, 0)}
                        src={assets.bin_icon}
                        alt="delete"
                        className="w-5 cursor-pointer hover:opacity-60 transition"
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* checkout */}
      <div className="flex justify-end my-20">
        <div className="w-full sm:w-[450px]">
          <CartTotal />
          <div className="w-full text-end">
            <button
              onClick={() => navigate('/place-order')}
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
