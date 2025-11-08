import React, {useState} from 'react'
import Title from '../components/Title'
import { assets } from '../assets/assets'
import NewsletterBox from '../components/NewsletterBox'
import ReturnPolicyModal from './ReturnPolicy'

const Contact = () => {
    const [open, setOpen] = useState(false);
  return (
    <div>
      
      <div className='text-center text-2xl pt-10 border-t'>
          <Title text1={'CONTACT'} text2={'US'} />
      </div>

      <div className='my-10 flex flex-col justify-center md:flex-row gap-10 mb-28'>
        <img className='w-full md:max-w-[480px]' src={assets.contact_img} alt="" />
        <div className='flex flex-col justify-center items-start gap-6'>
          <p className='font-semibold text-xl text-gray-600'>Our Store</p>
          <p className=' text-gray-500'>54709 Willms Station <br /> Suite 350, Washington, USA</p>
          <p className=' text-gray-500'>Tel: (415) 555-0132 <br /> Email: contact@reshareloop.com</p>
          <p className='font-semibold text-xl text-gray-600'>Careers at Forever</p>
          <p className=' text-gray-500'>Learn more about our teams and job openings.</p>
          <button className='border border-black px-8 py-4 text-sm hover:bg-black hover:text-white transition-all duration-500'>Explore Jobs</button>
        </div>
      </div>


      <div className='text-center text-2xl pt-10 border-t'>
       <p> At ReShareLoop, we want you to love your purchase. If you are not completely
        satisfied, you may return eligible items within <strong>30 days</strong> of delivery
        for a refund or store credit.
      </p>
      <button className="text-left underline" onClick={() => setOpen(true)}>Return policy</button>
        <ReturnPolicyModal open={open} onClose={() => setOpen(false)} />

      
      </div>
      <div className='my-10 flex flex-col justify-center md:flex-row gap-10 mb-28'>  <NewsletterBox/></div>
     
    </div>
  )
}

export default Contact
