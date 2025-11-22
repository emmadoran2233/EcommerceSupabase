import React, { useState, useEffect, useRef } from "react";
import { assets } from "../assets/assets";
const Carousel = () => {
  const bestRentals = [
    assets.drone_2,
    assets.robot_img,
    assets.chanel,
    assets.iphone17pro_2,
    assets.partyTent,
    assets.radon_detector,
    assets.rolex,
    assets.camera_1,
    assets.questVR,
    assets.Louis,
    assets.carpetCleaner,
    assets.weddingDress,
    assets.electricGenerator,
  ].filter(Boolean);
  const [index, setIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);
  const [itemWidth, setItemWidth] = useState(0); // how many images visible at once
  const autoplay = true;
  const intervalMs = 3500;
  const autoplayRef = useRef(null);
  const viewportRef = useRef(null);

  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      const newVisible = w < 640 ? 1 : w < 960 ? 4 : 6;
      setVisibleCount(newVisible);

      // measure viewport width and compute item width (px)
      const vp = viewportRef.current;
      const vpWidth = vp ? vp.clientWidth : Math.min(1024, w);
      setItemWidth(Math.floor(vpWidth / newVisible));

      // clamp index so we don't overflow
      setIndex((i) => {
        const max = Math.max(0, bestRentals.length - newVisible);
        return Math.min(i, max);
      });
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [bestRentals.length]);

  const maxIndex = Math.max(0, bestRentals.length - visibleCount);

  const goPrev = () => setIndex((i) => (i - 1 < 0 ? maxIndex : i - 1));
  const goNext = () => setIndex((i) => (i + 1 > maxIndex ? 0 : i + 1));

  if (bestRentals.length === 0) return null;
  // autoplay
  useEffect(() => {
    if (!autoplay || bestRentals.length <= visibleCount) return;
    autoplayRef.current = setInterval(() => {
      setIndex((i) => (i + 1 > maxIndex ? 0 : i + 1));
    }, intervalMs);
    return () => clearInterval(autoplayRef.current);
  }, [autoplay, bestRentals.length, visibleCount, intervalMs, maxIndex]);

  if (bestRentals.length === 0) return null;

  // item width is 100% / visibleCount (in relation to carousel viewport)
  const itemWidthPercent = 100 / visibleCount;
  const translatePercent = -(index * itemWidthPercent);
  return (
    <section className="w-full max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-center gap-4 my-6">
        <div className="h-px w-20 bg-gray-300" />
        <h1 className="text-center text-gray-700">Shop our best rentals</h1>
        <div className="h-px w-20 bg-gray-300" />
      </div>

      {/* Carousel viewport */}
      <div className="w-full flex justify-center">
        <div className="w-full relative">
          <div
            ref={viewportRef}
            className="overflow-hidden rounded-lg"
            style={{ height: "auto" }}
          >
            {/* Track */}
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${index * itemWidth}px)`,
                width: `${bestRentals.length * itemWidth}px`,
              }}
            >
              {bestRentals.map((src, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 p-1"
                  style={{ width: `${itemWidth}px` }}
                >
                  <div className="w-full h-48 sm:h-48 md:h-56 overflow-hidden rounded-lg bg-white">
                    <img
                      src={src}
                      alt={`Best rental ${i + 1}`}
                      className="w-full h-full object-cover block"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* prev / next buttons */}
          <button
            onClick={goPrev}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white px-3 py-1 rounded shadow"
          >
            ‹
          </button>
          <button
            onClick={goNext}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white px-3 py-1 rounded shadow"
          >
            ›
          </button>

          {/* page indicators */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {Array.from({ length: maxIndex + 1 }).map((_, page) => (
              <button
                key={page}
                onClick={() => setIndex(page)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  page === index ? "bg-gray-800" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Carousel;
