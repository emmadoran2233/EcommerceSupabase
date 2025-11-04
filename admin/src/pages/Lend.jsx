import React, { useState } from 'react'
import { assets } from '../assets/assets'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'

const Lend = ({ user }) => {
  const [image1, setImage1] = useState(false)
  const [image2, setImage2] = useState(false)
  const [image3, setImage3] = useState(false)
  const [image4, setImage4] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Cellphone")
  const [subCategory, setSubCategory] = useState("Electronics")
  const [pricePerDay, setPricePerDay] = useState("")
  const [estimatedValue, setEstimatedValue] = useState("")
  const [bestseller, setBestseller] = useState(false)
  const [sizes, setSizes] = useState([])

  const onSubmitHandler = async (e) => {
    e.preventDefault()

    try {
      const imageUrls = []
      const images = [image1, image2, image3, image4]

      for (let img of images) {
        if (img) {
          const fileName = `${Date.now()}_${img.name}`
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(fileName, img)

          if (uploadError) throw uploadError

          const { data: publicUrl } = supabase.storage
            .from("product-images")
            .getPublicUrl(fileName)

          imageUrls.push(publicUrl.publicUrl)
        }
      }

      const { error: insertError } = await supabase.from("lends").insert([
        {
          name,
          description,
          category,
          sub_category: subCategory,
          price_per_day: parseFloat(pricePerDay),
          estimated_value: parseFloat(estimatedValue),
          bestseller,
          sizes,
          images: imageUrls,
          seller_id: user?.id,
        },
      ])

      if (insertError) throw insertError

      toast.success("Lend item added successfully!")

      // Reset form
      setName("")
      setDescription("")
      setCategory("Cellphone")
      setSubCategory("Electronics")
      setPricePerDay("")
      setEstimatedValue("")
      setBestseller(false)
      setSizes([])
      setImage1(false)
      setImage2(false)
      setImage3(false)
      setImage4(false)
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  return (
    <form
      onSubmit={onSubmitHandler}
      className="flex flex-col w-full items-start gap-3"
    >
      {/* Image Upload */}
      <div>
        <p className="mb-2">Upload Image</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((num, idx) => {
            const setImage = [setImage1, setImage2, setImage3, setImage4][idx]
            const image = [image1, image2, image3, image4][idx]
            return (
              <label key={num} htmlFor={`image${num}`}>
                <img
                  className="w-20"
                  src={!image ? assets.upload_area : URL.createObjectURL(image)}
                  alt=""
                />
                <input
                  onChange={(e) => setImage(e.target.files[0])}
                  type="file"
                  id={`image${num}`}
                  hidden
                />
              </label>
            )
          })}
        </div>
      </div>

      {/* Product Name */}
      <div className="w-full">
        <p className="mb-2">Item name</p>
        <input
          onChange={(e) => setName(e.target.value)}
          value={name}
          className="w-full max-w-[500px] px-3 py-2"
          type="text"
          placeholder="Type here"
          required
        />
      </div>

      {/* Description */}
      <div className="w-full">
        <p className="mb-2">Item description</p>
        <textarea
          onChange={(e) => setDescription(e.target.value)}
          value={description}
          className="w-full max-w-[500px] px-3 py-2"
          placeholder="Write content here"
          required
        />
      </div>

      {/* Category / Estimated Value / Price per day */}
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:gap-8">
        <div>
          <p className="mb-2">Category</p>
          <select
            onChange={(e) => setCategory(e.target.value)}
            value={category}
            className="w-full px-3 py-2"
          >
            <option value="Cellphone">Cellphone</option>
            <option value="Cameras">Cameras</option>
            <option value="Drone">Drone</option>
            <option value="Grass Trimmer">Grass Trimmer</option>
            <option value="Other Garden Appliance">Other Garden Appliance</option>
            <option value="Carpet Cleaner">Carpet Cleaner</option>
            <option value="Radon Detectors">Radon Detectors</option>
            <option value="Air Purifier">Air Purifier</option>
            <option value="Dehumidifier">Dehumidifier</option>
            <option value="Other Home Appliances">Other Home Appliances</option>
            <option value="Party Decoration">Party Decoration</option>
          </select>
        </div>

        <div>
          <p className="mb-2">Estimated Value ($)</p>
          <input
            onChange={(e) => setEstimatedValue(e.target.value)}
            value={estimatedValue}
            className="w-full px-3 py-2 sm:w-[150px]"
            type="number"
            step="0.01"
            placeholder="e.g. 200"
            required
          />
        </div>

        <div>
          <p className="mb-2">Price Per Day ($)</p>
          <input
            onChange={(e) => setPricePerDay(e.target.value)}
            value={pricePerDay}
            className="w-full px-3 py-2 sm:w-[150px]"
            type="number"
            step="0.01"
            placeholder="e.g. 15"
            required
          />
        </div>
      </div>

      {/* Bestseller checkbox */}
      <div className="flex gap-2 mt-2">
        <input
          onChange={() => setBestseller((prev) => !prev)}
          checked={bestseller}
          type="checkbox"
          id="bestseller"
        />
        <label className="cursor-pointer" htmlFor="bestseller">
          Mark as popular
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-28 py-3 mt-4 bg-black text-white"
      >
        ADD
      </button>
    </form>
  )
}

export default Lend
