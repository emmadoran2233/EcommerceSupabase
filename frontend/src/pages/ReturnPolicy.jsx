import { useState } from "react";

export default function ReturnPolicyModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white max-w-2xl w-full rounded-xl p-6 overflow-y-auto max-h-[80vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Return Policy</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>
      <h2 className="text-xl font-medium mt-8 mb-2">Eligibility</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li className="text-xl">Items must be unused, unworn, and in their original packaging.</li>
        <li className="text-xl">Proof of purchase (order number or receipt) is required.</li>
        <li className="text-xl">Certain items (e.g., clearance, personalized, or final-sale products) are not returnable.</li>
      </ul>

      <h2 className="text-xl font-medium mt-8 mb-2">Return Shipping</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li className="text-xl">Buyers are responsible for return shipping costs unless the article sent is defect or wrong item sent.</li>
        <li className="text-xl">Use a trackable service or insurance; we can’t guarantee receipt without it.</li>
        <li className="text-xl">Original shipping costs are non-refundable.</li>
      </ul>

      <h2 className="text-xl font-medium mt-8 mb-2">Refunds</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li className="text-xl">We’ll inspect your return and notify you of approval/rejection.</li>
        <li className="text-xl">Approved refunds are issued to the original payment method within <strong>5–10 business days</strong>.</li>
      </ul>

      <h2 className="text-xl font-medium mt-8 mb-2">Exchanges</h2>
      <p className="text-xl">Exchanges may be offered if stock is available. Buyers are responsible for shipping both ways.</p>

      <h2 className="text-xl font-medium mt-8 mb-2">Damaged or Incorrect Items</h2>
      <p className="text-xl">
        If you receive a <strong>defective or incorrect</strong> item, contact us within <strong>7 days</strong> of delivery at
        {" "}<a className="underline" href="mailto:support@email.com">contact@reliablecraft.com</a>.
        We’ll cover return shipping for replacements.
      </p>  
      </div>
    </div>
  );
}
