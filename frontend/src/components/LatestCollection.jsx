import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from './Title';
import ProductItem from './ProductItem';

const LatestCollection = () => {

    const { products } = useContext(ShopContext);
    const [latestProducts,setLatestProducts] = useState([]);

    useEffect(() => {
    const filtered = products
      .filter((item) => item.rentable === false)
      .slice(0, 10); // 取前10个 避免页面太长或卡顿

    setLatestProducts(filtered);
  }, [products]);

  return (
    <div className='my-10'>
      <div className='text-center py-8 text-3xl'>
          <Title text1={'PRODUCTS FOR'} text2={'SELL'} />
          <p className='w-3/4 m-auto text-xs sm:text-sm md:text-base text-gray-600'>
          Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the.
          </p>
      </div>

      {/* Rendering Products */}
      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
        {
          latestProducts.map((item,index)=>(
            <ProductItem key={index} id={item.id} image={item.images} name={item.name} price={item.price} />
          ))
        }
      </div>
    </div>
  )
}

export default LatestCollection
