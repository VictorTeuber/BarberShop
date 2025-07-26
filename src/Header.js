import React from 'react';
import './Header.css';

const Header = ({ userEmail, onLogout }) => {
  return (
    <header className="w-full bg-gradient-to-r from-green-600 to-green-700 py-4 mb-8 shadow-lg">
      <div className="container mx-auto flex justify-between items-center px-4">
        <div className="text-3xl font-extrabold text-white tracking-wide">Victor's Barber Studio</div>
        <div className="flex space-x-4">
          {userEmail ? (
            <div className="flex space-x-4">
              <span className="bg-white text-green-600 font-bold py-2 px-6 rounded-full shadow">{userEmail}</span>
              <button
                onClick={onLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full shadow transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <button
                className="login-btn bg-white text-green-600 font-bold py-2 px-6 rounded-full shadow hover:bg-green-100 transition"
                onClick={typeof window.onHeaderLoginClick === 'function' ? window.onHeaderLoginClick : undefined}
              >
                Log In
              </button>
              <button
                className="signup-btn bg-white text-green-600 font-bold py-2 px-6 rounded-full shadow hover:bg-green-100 transition"
                onClick={typeof window.onHeaderSignupClick === 'function' ? window.onHeaderSignupClick : undefined}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;