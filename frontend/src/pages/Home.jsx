import React from 'react'
import Carousel from '../components/Carousel'
import LatestCollection from '../components/ProductForSell'
import BestSeller from '../components/ProductForRent'
import OurPolicy from '../components/OurPolicy'
import NewsletterBox from '../components/NewsletterBox'

const Home = () => {
  return (
    <div>
      <Carousel />
      <LatestCollection/>
      <BestSeller/>
      <OurPolicy/>
      <NewsletterBox/>
    </div>
  )
}

export default Home
