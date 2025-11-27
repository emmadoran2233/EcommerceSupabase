import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from './Title';
import ProductItem from './ProductItem';

const BestSeller = () => {

  const { products } = useContext(ShopContext);
  const [bestSeller, setBestSeller] = useState([]);

  useEffect(() => {
    const bestProduct = products.filter(
      (item) => item.bestseller === true && item.rentable === true
    );
    setBestSeller(bestProduct);
  }, [products]);


  return (
    <div className='my-10'>
      <div className='text-center text-2xl py-8'>
        <Title text1={'PRODUCTS FOR'} text2={'RENT'} />
        <p className='w-3/4 m-auto text-xs sm:text-sm md:text-base text-gray-600'>
          Smarter Ownership Starts Here
        </p>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
        {
          bestSeller.map((item, index) => (
            <ProductItem key={index} id={item.id} name={item.name} image={item.images} price={item.price} />
          ))
        }
      </div>
    </div>
  )
}

export default BestSeller
