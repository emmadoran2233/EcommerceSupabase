import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShopContext } from '../context/ShopContext';
import { assets } from '../assets/assets';
import RelatedProducts from '../components/RelatedProducts';
import { supabase } from '../supabaseClient';

const Product = () => {
  const { productId } = useParams();
  const { products, currency, addToCart, user } = useContext(ShopContext);

  const [productData, setProductData] = useState(false);
  const [image, setImage] = useState('');
  const [size, setSize] = useState('');

  const [reviews, setReviews] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [userReview, setUserReview] = useState(null);

  const fetchProductData = () => {
    products.map((item) => {
      if (String(item.id) === String(productId)) {
        setProductData(item);
        setImage(item.images[0]);
        return null;
      }
    });
  };

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
    } else {
      setReviews(data);
    }
  };

  useEffect(() => {
    fetchProductData();
    fetchReviews();
  }, [productId, products]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!user) {
      alert('You must be logged in to submit a review.');
      return;
    }

    if (userReview) {
      const { data, error } = await supabase
        .from('reviews')
        .update({
          comment: newComment,
          user_name: anonymous ? 'Anonymous' : user.name || 'Anonymous',
        })
        .eq('id', userReview.id)
        .select();

      if (error) {
        console.error('Error updating review:', error);
      } else {
        setReviews(reviews.map((r) => (r.id === userReview.id ? data[0] : r)));
        setUserReview(data[0]);
      }
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert([
          {
            product_id: productId,
            user_id: user.id,
            user_name: anonymous ? 'Anonymous' : user.name || 'Anonymous',
            comment: newComment,
          },
        ])
        .select();

      if (error) {
        console.error('Error submitting review:', error);
      } else {
        setReviews([data[0], ...reviews]);
        setUserReview(data[0]);
      }
    }
  };

  const handleDeleteReview = async () => {
    if (!userReview) return;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', userReview.id);

    if (error) {
      console.error('Error deleting review:', error);
    } else {
      setReviews(reviews.filter((r) => r.id !== userReview.id));
      setUserReview(null);
      setNewComment('');
    }
  };

  return productData ? (
    <div className="border-t-2 pt-10 transition-opacity ease-in duration-500 opacity-100">
      {/*----------- Product Data-------------- */}
      <div className="flex gap-12 sm:gap-12 flex-col sm:flex-row">
        {/*---------- Product Images------------- */}
        <div className="flex-1 flex flex-col-reverse gap-3 sm:flex-row">
          <div className="flex sm:flex-col overflow-x-auto sm:overflow-y-scroll justify-between sm:justify-normal sm:w-[18.7%] w-full">
            {productData.images.map((item, index) => (
              <img
                onClick={() => setImage(item)}
                src={item}
                key={index}
                className="w-[24%] sm:w-full sm:mb-3 flex-shrink-0 cursor-pointer"
                alt=""
              />
            ))}
          </div>
          <div className="w-full sm:w-[80%]">
            <img className="w-full h-auto" src={image} alt="" />
          </div>
        </div>

        {/* -------- Product Info ---------- */}
        <div className="flex-1">
          <h1 className="font-medium text-2xl mt-2">{productData.name}</h1>
          <div className=" flex items-center gap-1 mt-2">
            <img src={assets.star_icon} alt="" className="w-3 5" />
            <img src={assets.star_icon} alt="" className="w-3 5" />
            <img src={assets.star_icon} alt="" className="w-3 5" />
            <img src={assets.star_icon} alt="" className="w-3 5" />
            <img src={assets.star_dull_icon} alt="" className="w-3 5" />
            <p className="pl-2">({reviews.length})</p>
          </div>
          <p className="mt-5 text-3xl font-medium">
            {currency}
            {productData.price}
          </p>
          <p className="mt-5 text-gray-500 md:w-4/5">{productData.description}</p>
          <div className="flex flex-col gap-4 my-8">
            <p>Select Size</p>
            <div className="flex gap-2">
              {productData.sizes.map((item, index) => (
                <button
                  onClick={() => setSize(item)}
                  className={`border py-2 px-4 bg-gray-100 ${
                    item === size ? 'border-orange-500' : ''
                  }`}
                  key={index}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => addToCart(productData.id, size)}
            className="bg-black text-white px-8 py-3 text-sm active:bg-gray-700"
          >
            ADD TO CART
          </button>
          <hr className="mt-8 sm:w-4/5" />
          <div className="text-sm text-gray-500 mt-5 flex flex-col gap-1">
            <p>100% Original product.</p>
            <p>Cash on delivery is available on this product.</p>
            <p>Easy return and exchange policy within 7 days.</p>
          </div>
        </div>
      </div>

      {/* ---------- Description & Review Section ------------- */}
      <div className="mt-20">
        <div className="flex">
          <b className="border px-5 py-3 text-sm">Description</b>
          <p className="border px-5 py-3 text-sm">Reviews ({reviews.length})</p>
        </div>

        {/* Existing reviews */}
        <div className="flex flex-col gap-4 border px-6 py-6 text-sm text-gray-500">
          {reviews.length === 0 && (
            <p>No reviews yet. Be the first to comment!</p>
          )}
          {reviews.map((review) => (
            <div key={review.id} className="border-b pb-2">
              <b>{review.user_name}</b>{' '}
              <span className="text-xs text-gray-400">
                {new Date(review.created_at).toLocaleString()}
              </span>
              <p>{review.comment}</p>
            </div>
          ))}
        </div>

        {/* Add/Edit/Delete review */}
        <form onSubmit={handleSubmitReview} className="mt-4 flex flex-col gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write your review..."
            className="border p-2 text-sm"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={() => setAnonymous(!anonymous)}
            />
            Post as Anonymous
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 text-sm"
            >
              {userReview ? 'Update Review' : 'Submit Review'}
            </button>

            {userReview && (
              <button
                type="button"
                onClick={handleDeleteReview}
                className="bg-red-600 text-white px-4 py-2 text-sm"
              >
                Delete Review
              </button>
            )}
          </div>
        </form>
      </div>
      {/* --------- display related products ---------- */}
      <RelatedProducts
        category={productData.category}
        subCategory={productData.subCategory}
      />
    </div>
  ) : (
    <div className="opacity-0"></div>
  );
};

export default Product;

