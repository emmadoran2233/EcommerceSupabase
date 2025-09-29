import React, { useState } from 'react'
import { assets } from '../assets/assets'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'

const Add = ({ token }) => {
  const [image1, setImage1] = useState(false)
  const [image2, setImage2] = useState(false)
  const [image3, setImage3] = useState(false)
  const [image4, setImage4] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("Men")
  const [subCategory, setSubCategory] = useState("Topwear")
  const [bestseller, setBestseller] = useState(false)
  const [sizes, setSizes] = useState([])
  const [stock, setStock] = useState(0) // ✅ new stock state

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

      const { error: insertError } = await supabase.from("products").insert([
        {
          name,
          description,
          price,
          category,
          sub_category: subCategory,
          bestseller,
          sizes,
          images: imageUrls,
          stock: parseInt(stock) // ✅ save stock
        },
      ])

      if (insertError) throw insertError

      toast.success("Product added successfully!")

      // Reset form
      setName("")
      setDescription("")
      setPrice("")
      setCategory("Men")
      setSubCategory("Topwear")
      setBestseller(false)
      setSizes([])
      setStock(0)
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
        <p className="mb-2">Product name</p>
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
        <p className="mb-2">Product description</p>
        <textarea
          onChange={(e) => setDescription(e.target.value)}
          value={description}
          className="w-full max-w-[500px] px-3 py-2"
          placeholder="Write content here"
          required
        />
      </div>

      {/* Category / Subcategory / Price / Stock */}
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:gap-8">
        <div>
          <p className="mb-2">Product category</p>
          <select
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2"
          >
            <option value="Men">Men</option>
            <option value="Women">Women</option>
            <option value="Kids">Kids</option>
          </select>
        </div>

        <div>
          <p className="mb-2">Sub category</p>
          <select
            onChange={(e) => setSubCategory(e.target.value)}
            className="w-full px-3 py-2"
          >
            <option value="Topwear">Topwear</option>
            <option value="Bottomwear">Bottomwear</option>
            <option value="Winterwear">Winterwear</option>
          </select>
        </div>

        <div>
          <p className="mb-2">Product Price</p>
          <input
            onChange={(e) => setPrice(e.target.value)}
            value={price}
            className="w-full px-3 py-2 sm:w-[120px]"
            type="number"
            placeholder="25"
            required
          />
        </div>

        {/* ✅ Stock Input */}
        <div>
          <p className="mb-2">Stock</p>
          <input
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full px-3 py-2 sm:w-[120px]"
            placeholder="100"
            required
          />
        </div>
      </div>

      {/* Sizes */}
      <div>
        <p className="mb-2">Product Sizes</p>
        <div className="flex gap-3">
          {["S", "M", "L", "XL", "XXL"].map((size) => (
            <div
              key={size}
              onClick={() =>
                setSizes((prev) =>
                  prev.includes(size)
                    ? prev.filter((item) => item !== size)
                    : [...prev, size]
                )
              }
            >
              <p
                className={`${
                  sizes.includes(size) ? "bg-pink-100" : "bg-slate-200"
                } px-3 py-1 cursor-pointer`}
              >
                {size}
              </p>
            </div>
          ))}
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
          Add to bestseller
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

export default Add
