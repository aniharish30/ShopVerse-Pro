const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/Wishlist");

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate("products", "name images price rating stock");
  res.json({ success: true, wishlist: wishlist || { products: [] } });
});

const toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) wishlist = new Wishlist({ user: req.user._id, products: [] });

  const idx = wishlist.products.indexOf(productId);
  let action;
  if (idx > -1) {
    wishlist.products.splice(idx, 1);
    action = "removed";
  } else {
    wishlist.products.push(productId);
    action = "added";
  }

  await wishlist.save();
  const populated = await Wishlist.findById(wishlist._id).populate("products", "name images price rating stock");
  res.json({ success: true, message: `Product ${action} from wishlist`, wishlist: populated, action });
});

module.exports = { getWishlist, toggleWishlist };
