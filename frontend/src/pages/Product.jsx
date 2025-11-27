<<<<<<< HEAD
import React, { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShopContext } from "../context/ShopContext";
import { assets } from "../assets/assets";
import RelatedProducts from "../components/RelatedProducts";
import RentCalendar from "../components/RentCalendar";
import { supabase } from "../supabaseClient";
import CustomizationModal from "../components/CustomizationModal";
import { toast } from "react-toastify";

const Product = () => {
  const { productId } = useParams();
  const { products, currency, addToCart, user, userId } =
    useContext(ShopContext);
  const [productData, setProductData] = useState(false);
  const [image, setImage] = useState("");
  const [size, setSize] = useState("");
  const [rentInfo, setRentInfo] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [userReview, setUserReview] = useState(null);

  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [savedCustomization, setSavedCustomization] = useState(null);
  const [savingCustomization, setSavingCustomization] = useState(false);
  const [loadingCustomization, setLoadingCustomization] = useState(false);

  const fetchProductData = async () => {
    products.map((item) => {
      if (item.id === productId) {
        setProductData(item);
        setImage(item.images[0]);
        return null;
      }
    });
  };

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error);
    } else {
      setReviews(data);

      if (user?.id) {
        const existing = data.find((r) => r.user_id === user.id);
        setUserReview(existing || null);
      }
    }
  };

  useEffect(() => {
    fetchProductData();
    fetchReviews();
  }, [productId, products]);

  useEffect(() => {
    setSavedCustomization(null);
  }, [productId]);

  useEffect(() => {
    if (!productData?.is_customizable || !userId) {
      setSavedCustomization(null);
      return;
    }

    const fetchCustomization = async () => {
      setLoadingCustomization(true);
      try {
        const { data, error } = await supabase
          .from("customizations")
          .select(
            "id, text_line_1, text_line_2, text_line_3, font, color, created_at"
          )
          .eq("product_id", productId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSavedCustomization({
            id: data.id,
            lines: [
              data.text_line_1 || "",
              data.text_line_2 || "",
              data.text_line_3 || "",
            ],
            color: data.color || "#111827",
          });
        } else {
          setSavedCustomization(null);
        }
      } catch (error) {
        console.warn("Customization fetch failed:", error.message);
      } finally {
        setLoadingCustomization(false);
      }
    };

    fetchCustomization();
  }, [productData?.is_customizable, productId, userId]);

  const handleSaveCustomization = async (payload) => {
    const trimmed = payload.lines.map((line) => line.trim()).slice(0, 3);
    const hasContent = trimmed.some((line) => line.length > 0);

    if (!hasContent) {
      toast.error("Enter at least one custom line.");
      return;
    }

    const localRecord = {
      id:
        payload.id ||
        (crypto?.randomUUID ? crypto.randomUUID() : `custom-${Date.now()}`),
      lines: trimmed,
      color: payload.color,
    };

    if (!userId) {
      setSavedCustomization(localRecord);
      setShowCustomizationModal(false);
      toast.success("Customization saved!");
      return;
    }

    setSavingCustomization(true);
    try {
      const { data, error } = await supabase
        .from("customizations")
        .insert([
          {
            product_id: productId,
            user_id: userId,
            text_line_1: trimmed[0] || null,
            text_line_2: trimmed[1] || null,
            text_line_3: trimmed[2] || null,
            color: payload.color,
          },
        ])
        .select()
        .maybeSingle();

      if (error) throw error;

      setSavedCustomization({
        ...localRecord,
        id: data?.id || localRecord.id,
      });
      toast.success("Customization saved!");
    } catch (error) {
      console.error("Save customization failed:", error);
      toast.warn(
        error.message ||
          "Unable to sync customization, but it will still be used for this order."
      );
      setSavedCustomization({ ...localRecord, unsynced: true });
    } finally {
      setSavingCustomization(false);
      setShowCustomizationModal(false);
    }
  };

  // ---------------- Handlers ----------------
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!user) {
      alert("You must be logged in to submit a review.");
      return;
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([
        {
          product_id: productId,
          user_id: user.id,
          user_name: anonymous ? "Anonymous" : user.name || "Anonymous",
          comment: newComment,
        },
      ])
      .select();

    if (!error) {
      setReviews([data[0], ...reviews]);
      setUserReview(data[0]);
      setNewComment("");
    }
  };

  const handleUpdateReview = async (id) => {
    if (!editText.trim()) return;

    const { data, error } = await supabase
      .from("reviews")
      .update({ comment: editText })
      .eq("id", id)
      .select();

    if (!error) {
      setReviews(reviews.map((r) => (r.id === id ? data[0] : r)));
      setEditingReviewId(null);
      setEditText("");
    }
  };

  const handleDeleteReview = async (id) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);

    if (!error) {
      setReviews(reviews.filter((r) => r.id !== id));
      if (userReview?.id === id) {
        setUserReview(null);
      }
    }
  };

  return productData ? (
    <>
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
            <div className="flex items-center gap-1 mt-2">
              <img src={assets.star_icon} alt="" className="w-3.5" />
              <img src={assets.star_icon} alt="" className="w-3.5" />
              <img src={assets.star_icon} alt="" className="w-3.5" />
              <img src={assets.star_icon} alt="" className="w-3.5" />
              <img src={assets.star_dull_icon} alt="" className="w-3.5" />
              <p className="pl-2">({reviews.length})</p>
            </div>

            {/* ✅ Simple Seller Link */}
            {productData.seller_id && (
              <p className="text-blue-600 text-sm mt-1">
                <a
                  href={`/store/${productData.seller_id}`}
                  className="underline hover:text-blue-800 font-medium"
                >
                  View Store
                </a>
              </p>
            )}
            <p className="mt-5 text-3xl font-medium">
              {currency}
              {productData.price}
            </p>

            {/* ✅ Stock display */}
            <p className="mt-2 text-sm text-gray-500">
              {productData.stock > 0
                ? `${productData.stock} in stock`
                : "Out of stock"}
            </p>

            <p className="mt-5 text-gray-500 md:w-4/5">
              {productData.description}
            </p>

            {/* ---------- Select Size ---------- */}
            {!productData.rentable && (
              <div className="flex flex-col gap-4 my-8">
                <p>Select Size</p>
                <div className="flex gap-2">
                  {productData.sizes.map((item, index) => (
                    <button
                      onClick={() => setSize(item)}
                      className={`border py-2 px-4 bg-gray-100 ${
                        item === size ? "border-orange-500" : ""
                      }`}
                      key={index}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {productData.is_customizable && (
              <div className="mt-6 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomizationModal(true)}
                    className="px-6 py-2 border border-black text-sm tracking-wide uppercase"
                  >
                    {savedCustomization ? "Edit Customization" : "Customize"}
                  </button>
                  {loadingCustomization && (
                    <p className="text-xs text-gray-500">Loading customization…</p>
                  )}
                </div>
                {savedCustomization ? (
                  <div className="text-xs sm:text-sm text-gray-600 bg-gray-50 border rounded p-3">
                    <p className="font-semibold text-gray-800">
                      Saved Custom Text
                    </p>
                    <p>
                      {savedCustomization.lines.filter(Boolean).join(" • ") ||
                        "No text yet"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Optional: add up to three short lines (15 characters each) to
                    personalize this item.
                  </p>
                )}
              </div>
            )}
            {/* ---------- RentCalendar for rentable products ---------- */}
            {productData.rentable && (
              <RentCalendar
                dailyRate={20}
                productPrice={productData.price}
                onRentChange={(info) => setRentInfo(info)}
              />
            )}
            {/* ✅ Add to Cart with stock check */}
            <button
              onClick={() =>
                addToCart(productData.id, size, rentInfo, savedCustomization)
              }
              disabled={productData.stock <= 0}
              className={`px-8 py-3 text-sm ${
                productData.stock <= 0
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-black text-white active:bg-gray-700"
              }`}
            >
              {productData.stock <= 0 ? "OUT OF STOCK" : "ADD TO CART"}
            </button>

            <hr className="mt-8 sm:w-4/5" />
            <div className="text-sm text-gray-500 mt-5 flex flex-col gap-1">
              <p>100% Original product.</p>
              <p>Cash on Rental is available on this product.</p>
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
          <div className="flex flex-col gap-4 border px-6 py-6 text-sm text-gray-500">
            {reviews.length === 0 && (
              <p>No reviews yet. Be the first to comment!</p>
            )}
            {reviews.map((review) => (
              <div
                key={review.id}
                className="border-b pb-2 flex justify-between items-start"
              >
                <div className="flex-1">
                  <b>{review.user_name}</b>{" "}
                  <span className="text-xs text-gray-400">
                    {new Date(review.created_at).toLocaleString()}
                  </span>
                  {editingReviewId === review.id ? (
                    <>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="border p-2 text-sm w-full mt-1"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateReview(review.id)}
                          className="bg-black text-white px-3 py-1 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingReviewId(null)}
                          className="bg-gray-300 px-3 py-1 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <p>{review.comment}</p>
                  )}
                </div>

                {review.user_id === user?.id && editingReviewId !== review.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingReviewId(review.id);
                        setEditText(review.comment);
                      }}
                      className="text-blue-600 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-red-600 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!userReview && (
            <form
              onSubmit={handleSubmitReview}
              className="mt-4 flex flex-col gap-2"
            >
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
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 text-sm self-start"
              >
                Submit Review
              </button>
            </form>
          )}
        </div>

        {/* --------- display related products ---------- */}
        <RelatedProducts
          category={productData.category}
          subCategory={productData.subCategory}
        />
      </div>
      <CustomizationModal
        open={showCustomizationModal}
        onClose={() => setShowCustomizationModal(false)}
        onSave={handleSaveCustomization}
        initialValue={savedCustomization}
        saving={savingCustomization}
      />
    </>
  ) : (
    <div className="opacity-0"></div>
  );
};

export default Product;
=======
import React, { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShopContext } from "../context/ShopContext";
import { assets } from "../assets/assets";
import RelatedProducts from "../components/RelatedProducts";
import RentCalendar from "../components/RentCalendar";
import { supabase } from "../supabaseClient";

const Product = () => {
  const { productId } = useParams();
  const { products, currency, addToCart, user } = useContext(ShopContext);
  const [productData, setProductData] = useState(false);
  const [image, setImage] = useState("");
  const [size, setSize] = useState("");
  const [rentInfo, setRentInfo] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [userReview, setUserReview] = useState(null);

  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editText, setEditText] = useState("");

  const fetchProductData = async () => {
    products.map((item) => {
      if (item.id === productId) {
        setProductData(item);
        setImage(item.images[0]);
        return null;
      }
    });
  };

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error);
    } else {
      setReviews(data);

      if (user?.id) {
        const existing = data.find((r) => r.user_id === user.id);
        setUserReview(existing || null);
      }
    }
  };

  useEffect(() => {
    fetchProductData();
    fetchReviews();
  }, [productId, products]);

  // ---------------- Handlers ----------------
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!user) {
      alert("You must be logged in to submit a review.");
      return;
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([
        {
          product_id: productId,
          user_id: user.id,
          user_name: anonymous ? "Anonymous" : user.name || "Anonymous",
          comment: newComment,
        },
      ])
      .select();

    if (!error) {
      setReviews([data[0], ...reviews]);
      setUserReview(data[0]);
      setNewComment("");
    }
  };

  const handleUpdateReview = async (id) => {
    if (!editText.trim()) return;

    const { data, error } = await supabase
      .from("reviews")
      .update({ comment: editText })
      .eq("id", id)
      .select();

    if (!error) {
      setReviews(reviews.map((r) => (r.id === id ? data[0] : r)));
      setEditingReviewId(null);
      setEditText("");
    }
  };

  const handleDeleteReview = async (id) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);

    if (!error) {
      setReviews(reviews.filter((r) => r.id !== id));
      if (userReview?.id === id) {
        setUserReview(null);
      }
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
          <div className="flex items-center gap-1 mt-2">
            <img src={assets.star_icon} alt="" className="w-3.5" />
            <img src={assets.star_icon} alt="" className="w-3.5" />
            <img src={assets.star_icon} alt="" className="w-3.5" />
            <img src={assets.star_icon} alt="" className="w-3.5" />
            <img src={assets.star_dull_icon} alt="" className="w-3.5" />
            <p className="pl-2">({reviews.length})</p>
          </div>

          {/* ✅ Simple Seller Link */}
          {productData.seller_id && (
            <p className="text-blue-600 text-sm mt-1">
              <a
                href={`/store/${productData.seller_id}`}
                className="underline hover:text-blue-800 font-medium"
              >
                View Store
              </a>
            </p>
          )}
          <p className="mt-5 text-3xl font-medium">
            {currency}
            {productData.price}
          </p>

          {/* ✅ Stock display */}
          <p className="mt-2 text-sm text-gray-500">
            {productData.stock > 0
              ? `${productData.stock} in stock`
              : "Out of stock"}
          </p>

          <p className="mt-5 text-gray-500 md:w-4/5">
            {productData.description}
          </p>

          {/* ---------- Select Size ---------- */}
          {!productData.rentable && (
            <div className="flex flex-col gap-4 my-8">
              <p>Select Size</p>
              <div className="flex gap-2">
                {productData.sizes.map((item, index) => (
                  <button
                    onClick={() => setSize(item)}
                    className={`border py-2 px-4 bg-gray-100 ${
                      item === size ? "border-orange-500" : ""
                    }`}
                    key={index}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* ---------- RentCalendar for rentable products ---------- */}
          {productData.rentable && (
            <RentCalendar
              dailyRate={20}
              productPrice={productData.price}
              onRentChange={(info) => setRentInfo(info)}
            />
          )}
          {/* ✅ Add to Cart with stock check */}
          <button
            onClick={() => addToCart(productData.id, size, rentInfo)}
            disabled={productData.stock <= 0}
            className={`px-8 py-3 text-sm ${
              productData.stock <= 0
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-black text-white active:bg-gray-700"
            }`}
          >
            {productData.stock <= 0 ? "OUT OF STOCK" : "ADD TO CART"}
          </button>

          <hr className="mt-8 sm:w-4/5" />
          <div className="text-sm text-gray-500 mt-5 flex flex-col gap-1">
            <p>100% Original product.</p>
            <p>Cash on Rental is available on this product.</p>
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
        <div className="flex flex-col gap-4 border px-6 py-6 text-sm text-gray-500">
          {reviews.length === 0 && (
            <p>No reviews yet. Be the first to comment!</p>
          )}
          {reviews.map((review) => (
            <div
              key={review.id}
              className="border-b pb-2 flex justify-between items-start"
            >
              <div className="flex-1">
                <b>{review.user_name}</b>{" "}
                <span className="text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleString()}
                </span>
                {editingReviewId === review.id ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="border p-2 text-sm w-full mt-1"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleUpdateReview(review.id)}
                        className="bg-black text-white px-3 py-1 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingReviewId(null)}
                        className="bg-gray-300 px-3 py-1 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <p>{review.comment}</p>
                )}
              </div>

              {review.user_id === user?.id && editingReviewId !== review.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingReviewId(review.id);
                      setEditText(review.comment);
                    }}
                    className="text-blue-600 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {!userReview && (
          <form
            onSubmit={handleSubmitReview}
            className="mt-4 flex flex-col gap-2"
          >
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
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 text-sm self-start"
            >
              Submit Review
            </button>
          </form>
        )}
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
>>>>>>> 5503b16 (Merged latest updates and added deposit-freeze functionality for rental items)
