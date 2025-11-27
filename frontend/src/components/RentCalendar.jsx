import React, { useState, useEffect, useRef } from "react";
import { DateRange } from "react-date-range";
import { differenceInCalendarDays } from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

const RentCalendar = ({ dailyRate, productPrice, onRentChange }) => {
  const [range, setRange] = useState([
    {
      startDate: null,
      endDate: null,
      key: "selection",
    },
  ]);

  const [days, setDays] = useState(0);
  const [rentFee, setRentFee] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const prevPayloadRef = useRef(null);
  useEffect(() => {
    const start = range[0].startDate;
    const end = range[0].endDate;

    if (start && end) {
      const diff = differenceInCalendarDays(end, start) + 1;
      const rentFeeCalc = diff * dailyRate;
      const depositCalc = Math.max(productPrice - rentFeeCalc, 0);  // ✅ 商品原价 − rentFee，最低为0
      const totalCalc = rentFeeCalc >= productPrice ? rentFeeCalc : rentFeeCalc + depositCalc;

      setDays(diff);
      setRentFee(rentFeeCalc);
      setDeposit(depositCalc);
      setFinalTotal(totalCalc);

         const payload = {
        startDate: start,
        endDate: end,
        days: diff,
        rentFee: rentFeeCalc,
        deposit: depositCalc,
        totalPrice: totalCalc,
      };

      // only call parent when actual values changed to avoid update loops
      const prev = prevPayloadRef.current;
      const same =
        prev &&
        prev.startDate?.getTime() === payload.startDate.getTime() &&
        prev.endDate?.getTime() === payload.endDate.getTime() &&
        prev.days === payload.days &&
        prev.rentFee === payload.rentFee &&
        prev.deposit === payload.deposit &&
        prev.totalPrice === payload.totalPrice;

      if (!same) {
        prevPayloadRef.current = payload;
        onRentChange(payload);
      }
    } else {
      // reset local state only if needed
      if (days !== 0) setDays(0);
      if (rentFee !== 0) setRentFee(0);
      if (deposit !== 0) setDeposit(0);
      if (finalTotal !== 0) setFinalTotal(0);
      prevPayloadRef.current = null;
    }
  }, [range, dailyRate, productPrice, onRentChange]);

  return (
    <div className="p-4 border rounded-lg mt-4 bg-gray-50">
      <h3 className="font-semibold text-lg mb-2">Select Rental Period</h3>

      <DateRange
        ranges={range}
        onChange={(item) => setRange([item.selection])}
        rangeColors={["#4F46E5"]}
      />

      {days > 0 ? (
        <div className="mt-3 text-sm text-gray-700">
          <p>Duration: {days} day{days > 1 ? "s" : ""}</p>
          <p> Rent Rate: $20/day</p>
          <p> Rent Fee: ${rentFee.toFixed(2)}</p>
          <p> Deposit: ${deposit.toFixed(2)}</p>
          <p className="font-semibold text-indigo-600 mt-1">
            Final Total: ${finalTotal.toFixed(2)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-3">
          → Please select rental dates
        </p>
      )}
    </div>
  );
};

export default RentCalendar;
