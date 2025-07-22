import React from 'react';
import './Header.css';

const Header = ({ userEmail }) => {
  return (
    <header className="w-full bg-gradient-to-r from-purple-500 to-pink-500 py-4 mb-8 shadow-lg">
      <div className="container mx-auto flex justify-between items-center px-4">
        <div className="text-3xl font-extrabold text-white tracking-wide">Victor's Barber Studio</div>
        <div className="flex space-x-4">
          {userEmail ? (
            <span className="bg-white text-purple-600 font-bold py-2 px-6 rounded-full shadow">{userEmail}</span>
          ) : (
            <button
              className="login-btn bg-white text-purple-600 font-bold py-2 px-6 rounded-full shadow hover:bg-purple-100 transition"
              onClick={typeof window.onHeaderLoginClick === 'function' ? window.onHeaderLoginClick : undefined}
            >
              Log In
            </button>
          )}
          <button className="signup-btn bg-white text-pink-600 font-bold py-2 px-6 rounded-full shadow hover:bg-pink-100 transition">Sign Up</button>
        </div>
      </div>
    </header>
  );
};

export default Header;
