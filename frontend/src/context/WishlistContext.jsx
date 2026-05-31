import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState({ products: [] });

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) { setWishlist({ products: [] }); return; }
    try {
      const { data } = await api.get("/wishlist");
      setWishlist(data.wishlist || { products: [] });
    } catch { setWishlist({ products: [] }); }
  }, [isAuthenticated]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  const toggleWishlist = async (productId) => {
    try {
      const { data } = await api.post("/wishlist/toggle", { productId });
      setWishlist(data.wishlist);
      return data.action;
    } catch (err) { console.error(err); }
  };

  const isWishlisted = (productId) =>
    wishlist.products?.some((p) => (p._id || p) === productId);

  const wishlistCount = wishlist.products?.length || 0;

  return (
    <WishlistContext.Provider value={{ wishlist, wishlistCount, toggleWishlist, isWishlisted, fetchWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
};
