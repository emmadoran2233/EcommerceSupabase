import React, { useState } from "react";
import { assets } from "../assets/assets";
import { useNavigate } from "react-router-dom";
import ReturnPolicyModal from "../pages/ReturnPolicy";
const Footer = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-col sm:grid grid-cols-[3fr_1fr_1fr] gap-14 my-10 mt-40 text-sm">
        <div>
          <img src={assets.logo} className="mb-5 w-32" alt="" />
          <p className="w-full md:w-2/3 text-gray-600 text-justify">
            ReShareLoop is not just a rental platform—it is a movement toward sustainable consumption, trusted connections, and empowered communities.
                      Verified users, smart deposit escrow, and optional insurance ensure
            your belongings are always protected.</p>
        </div>

        <div>
          <p className="text-xl font-medium mb-5">COMPANY</p>
          <ul className="flex flex-col gap-1 text-gray-600">
            <li onClick={() => navigate("/")}>Home</li>
            <li onClick={() => navigate("/about")}>About us</li>
            <li onClick={() => navigate("/contact")}>Contact</li>
            <li onClick={() => setOpen(true)}>Return policy</li>
          </ul>
        </div>
        <ReturnPolicyModal open={open} onClose={() => setOpen(false)} />
        <div>
          <p className="text-xl font-medium mb-5">GET IN TOUCH</p>
          <ul className="flex flex-col gap-1 text-gray-600">
            <li>+1-212-456-7890</li>
            <li>contact@reshareloop.com</li>
          </ul>
        </div>
      </div>

      <div>
        <hr />
        <p className="py-5 text-sm text-center">
          Copyright 2024@ forever.com - All Right Reserved.
        </p>
      </div>
    </div>
  );
};

export default Footer;
