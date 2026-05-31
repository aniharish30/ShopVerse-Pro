const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product", "name images price stock");
  res.json({ success: true, cart: cart || { items: [] } });
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    res.status(404);
    throw new Error("Product not found");
  }
  if (product.stock < quantity) {
    res.status(400);
    throw new Error(`Only ${product.stock} items in stock`);
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = new Cart({ user: req.user._id, items: [] });

  const existingItem = cart.items.find((i) => i.product.toString() === productId);
  if (existingItem) {
    const newQty = existingItem.quantity + Number(quantity);
    if (newQty > product.stock) {
      res.status(400);
      throw new Error(`Cannot add more than ${product.stock} items`);
    }
    existingItem.quantity = newQty;
    existingItem.price = product.price;
  } else {
    cart.items.push({ product: productId, quantity: Number(quantity), price: product.price });
  }

  await cart.save();
  const populated = await Cart.findById(cart._id).populate("items.product", "name images price stock");
  res.json({ success: true, message: "Added to cart", cart: populated });
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  const item = cart.items.find((i) => i._id.toString() === req.params.itemId);
  if (!item) {
    res.status(404);
    throw new Error("Cart item not found");
  }

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
  } else {
    item.quantity = Number(quantity);
  }

  await cart.save();
  const populated = await Cart.findById(cart._id).populate("items.product", "name images price stock");
  res.json({ success: true, message: "Cart updated", cart: populated });
});

const removeFromCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
  await cart.save();
  const populated = await Cart.findById(cart._id).populate("items.product", "name images price stock");
  res.json({ success: true, message: "Item removed", cart: populated });
});

const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
  res.json({ success: true, message: "Cart cleared" });
});

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
