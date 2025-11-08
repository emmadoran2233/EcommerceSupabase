import React from "react";
import Title from "../components/Title";
import { assets } from "../assets/assets";
import NewsletterBox from "../components/NewsletterBox";

const About = () => {
  return (
    <div>
      <div className="my-10 flex flex-col md:flex-row gap-16">
        <img
          className="w-full md:max-w-[450px]"
          src={assets.about_img}
          alt="About Us"
        />
        <div className="flex flex-col justify-center gap-6 md:w-2/4 text-gray-600">
          <p>
            The idea for ReShareLoop started from a personal goal — I’ve always
            wanted to find practical, flexible ways to make extra income outside
            my full-time job. Like many people, I wanted to explore
            opportunities that didn’t require starting a business from scratch,
            but still allowed me to use my time, skills, and possessions more
            effectively.{" "}
          </p>
          <p>
            As I looked around, I realized countless others felt the same —
            talented individuals with tools, items, and abilities that weren’t
            being used to their full potential. That’s when I envisioned a
            single platform where people could lend or sell what they already
            own and offer personal services to others in their community.
          </p>
          <b className="text-gray-800">Our Mission</b>
          <p>
            ReShareLoop was built from that idea — a place where anyone can earn
            extra income, share resources, and build new connections beyond the
            traditional 9-to-5.
          </p>
        </div>
      </div>

      <div className=" text-xl py-4">
        <Title
          text1={"Join thousands of others "}
          text2={
            "building a smarter, more sustainable way to live, work, and share."
          }
        />
      </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-1 mb-20 items-stretch">
        <div className="border px-8 md:px-12 py-4 flex flex-col justify-between flex-1 box-border min-h-[100px]">
          <b className="text-lg text-center">Sell What You No Longer Need</b>
          <p className="text-gray-600 leading-relaxed m-0 text-center">
            List your unused or gently used items — from tools to electronics —
            and turn them into cash instead of clutter.
          </p>
        </div>

        <div className="border px-8 md:px-12 py-4 flex flex-col justify-between flex-1 box-border min-h-[100px]">
          <b className="text-lg text-center">Lend What You Don’t Use Often</b>
          <p className="text-gray-600 leading-relaxed m-0 text-center">
            From cameras and camping gear to musical instruments and power tools
            — lend them out safely through ReShareLoop and earn extra income.

          </p>
        </div>

        <div className="border px-8 md:px-12 py-4 flex flex-col justify-between flex-1 box-border min-h-[100px]">
          <b className="text-lg text-center">Offer Your Skills</b>
          <p className="text-gray-600 leading-relaxed text-center">
            Tutoring, design, repair, pet sitting — whatever you’re good at,
            someone nearby needs. Create a simple service profile and start
            earning today.
          </p>
        </div>
      </div>

      <NewsletterBox />
    </div>
  );
};

export default About;
