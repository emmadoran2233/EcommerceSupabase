import React, { useContext, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import { supabase } from "../supabaseClient";

const Profile = () => {
  const { user, navigate, logout } = useContext(ShopContext);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");

  const handleSave = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: { name: newName },
    });
    if (error) {
      alert("Failed to update name: " + error.message);
    } else {
      alert("Name updated!");
      setEditing(false);
      // refresh page or refetch session so context updates user
      window.location.reload();
    }
  };

  // const handleLogout = async () => {
  //   await supabase.auth.signOut();
  //   navigate("/login");
  // };

  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">You are not logged in</h1>
        <p className="text-gray-600 mt-2">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Name row */}
      <div className="mb-4">
        {!editing ? (
          <div className="flex items-center justify-between">
            <p>
              <b>Name:</b> {user.name}
            </p>
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border p-1 flex-1"
            />
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-3 py-1 text-sm rounded"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="bg-gray-300 px-3 py-1 text-sm rounded"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Email row */}
      <div className="mb-4">
        <p>
          <b>Email:</b> {user.email}
        </p>
      </div>

      {/* Logout button */}
      <button
        onClick={()=>logout(navigate)}
        className="mt-6 bg-red-600 text-white px-4 py-2 rounded"
      >
        Logout
      </button>
    </div>
  );
};

export default Profile;
