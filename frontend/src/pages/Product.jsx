import React, { useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShopContext } from '../context/ShopContext';
import RelatedProducts from '../components/RelatedProducts';
import { supabase } from '../supabaseClient';

const Product = () => {

  const { productId } = useParams();
  const { products, currency ,addToCart } = useContext(ShopContext);
  const [productData, setProductData] = useState(false);
  const [image, setImage] = useState('')
  const [size,setSize] = useState('')
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [customText, setCustomText] = useState("");  

  const fetchProductData = () => {
    products.map((item) => {
      if (String(item.id) === String(productId)) {
        setProductData(item)
        setImage(item.images[0])
        return null;
      }
    })
  }

  useEffect(() => {
    fetchProductData();
  }, [productId, products])

  const handleSaveCustomization = async () => {
    if (!customText.trim()) {
      alert("Please enter text before confirming");
      return;
    }

    const { error } = await supabase
      .from("customizations")
      .insert([
        {
          product_id: productData.id,
          custom_text: customText.trim(),
        },
      ]);

    if (error) {
      alert("Failed to save customization: " + error.message);
    } else {
      alert("Customization saved ✅");
      setShowModal(false);
    }
  };


  // ✅ Add to Cart 时传递 customText → 然后清空输入框
  const handleAddToCart = () => {
    addToCart(productData.id, size, customText);
    setCustomText(""); // ✅ 重置文本框，避免重复添加
  };


  return productData ? (
    <div className='border-t-2 pt-10 transition-opacity ease-in duration-500 opacity-100'>
      
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-96 p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-3">Customize Your Product</h2>

            <textarea
              className="w-full border p-2 rounded h-24 resize-none"
              maxLength={30}
              placeholder="Enter text to print..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowModal(false)}
                className="text-gray-600 border px-4 py-2 rounded hover:bg-gray-100">Close</button>

              <button onClick={handleSaveCustomization}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">Confirm</button>
            </div>
          </div>
        </div>
      )}


      {/* Product Section */}
      <div className='flex gap-12 sm:gap-12 flex-col sm:flex-row'>
        
        {/* Images */}
        <div className='flex-1 flex flex-col-reverse gap-3 sm:flex-row'>
          <div className='flex sm:flex-col overflow-x-auto sm:overflow-y-scroll justify-between sm:justify-normal sm:w-[18.7%] w-full'>
            {productData.images.map((item,index)=>(
              <img onClick={()=>setImage(item)} src={item} key={index}
                className='w-[24%] sm:w-full sm:mb-3 flex-shrink-0 cursor-pointer' />
            ))}
          </div>

          <div className='w-full sm:w-[80%]'>
            <img className='w-full h-auto' src={image} alt="" />
          </div>
        </div>


        {/* Product Info */}
        <div className='flex-1'>
          <h1 className='font-medium text-2xl mt-2'>{productData.name}</h1>
          <p className='mt-5 text-3xl font-medium'>{currency}{productData.price}</p>
          <p className='mt-5 text-gray-500 md:w-4/5'>{productData.description}</p>

          {/* ✅ Show Custom on Product Page */}
          {customText && (
            <p className="mt-3 text-orange-600 font-medium text-sm">
              ✎ Custom: {customText}
            </p>
          )}

          {/* Size Select */}
          <div className='flex flex-col gap-4 my-8'>
            <p>Select Size</p>
            <div className='flex gap-2'>
              {productData.sizes.map((item,index)=>(
                <button key={index} onClick={()=>setSize(item)}
                  className={`border py-2 px-4 bg-gray-100 ${item === size ? 'border-orange-500' : ''}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAddToCart}
            className='bg-black text-white px-8 py-3 text-sm active:bg-gray-700'>
            ADD TO CART
          </button>

          {productData.is_customizable && (
            <button className='ml-3 bg-orange-500 text-white px-8 py-3 text-sm rounded active:bg-orange-600'
              onClick={() => setShowModal(true)}>
              CUSTOMIZE
            </button>
          )}

          <hr className='mt-8 sm:w-4/5' />
        </div>
      </div>

      <RelatedProducts category={productData.category} subCategory={productData.subCategory} />
    </div>
  ) : <div className=' opacity-0'></div>
}

export default Product
