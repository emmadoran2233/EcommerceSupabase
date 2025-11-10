// ProductCard.jsx
import React from "react";
import { Link } from "react-router-dom";
import { assets } from "../assets/assets";

const currency = "$"; // ✅ add this line

const LendCard = ({ product }) => {
  return (
    <div> 
     <Link to={`/product/${product.id}`}
     className="border rounded-lg shadow-sm hover:shadow-md transition p-3 flex flex-col"
     >
      <img
        src={product.image_urls?.[0] || assets.placeholder_img}
        alt={product.name}
        className="w-full h-48 object-cover rounded"
      />
      <div className="mt-3 flex-1 flex flex-col justify-between">
        <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
        <p className="text-gray-500 text-xs mt-1 capitalize">
          {product.category}
        </p>
        <p className="text-black font-semibold mt-2">
          {currency}
          {product.price}
        </p>
      </div>

    </Link>
    </div>
  );
};

export default LendCard;
