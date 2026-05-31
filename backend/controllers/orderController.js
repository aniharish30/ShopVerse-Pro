const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

const placeOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, notes } = req.body;

  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("Your cart is empty");
  }

  for (const item of cart.items) {
    if (!item.product || item.product.stock < item.quantity) {
      res.status(400);
      throw new Error(`Insufficient stock for ${item.product?.name || "a product"}`);
    }
  }

  const itemsPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0);
  const shippingPrice = itemsPrice > 100 ? 0 : 9.99;
  const taxPrice = itemsPrice * 0.1;
  const totalPrice = itemsPrice + shippingPrice + taxPrice;

  const order = await Order.create({
    user: req.user._id,
    items: cart.items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      image: item.product.images[0] || "",
      price: item.price,
      quantity: item.quantity,
    })),
    shippingAddress,
    paymentMethod: paymentMethod || "card",
    itemsPrice: +itemsPrice.toFixed(2),
    shippingPrice: +shippingPrice.toFixed(2),
    taxPrice: +taxPrice.toFixed(2),
    totalPrice: +totalPrice.toFixed(2),
    notes,
  });

  // Simulate payment success
  order.isPaid = true;
  order.paidAt = Date.now();
  order.status = "processing";
  order.paymentResult = {
    id: `PAY-${Date.now()}`,
    status: "COMPLETED",
    updateTime: new Date().toISOString(),
    emailAddress: req.user.email,
  };
  await order.save();

  // Decrement stock
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } });
  }

  // Clear cart
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

  res.status(201).json({ success: true, message: "Order placed successfully!", order });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Access denied");
  }
  res.json({ success: true, order });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { status } : {};
  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  res.json({ success: true, orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.status = status;
  if (status === "delivered") {
    order.isDelivered = true;
    order.deliveredAt = Date.now();
  }
  await order.save();
  res.json({ success: true, message: "Order status updated", order });
});

const getAdminOrderStats = asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const pending = await Order.countDocuments({ status: "pending" });
  const delivered = await Order.countDocuments({ status: "delivered" });
  const revenue = await Order.aggregate([
    { $match: { isPaid: true } },
    { $group: { _id: null, total: { $sum: "$totalPrice" } } },
  ]);

  res.json({
    success: true,
    stats: {
      totalOrders,
      pending,
      delivered,
      revenue: revenue[0]?.total || 0,
    },
  });
});

module.exports = { placeOrder, getMyOrders, getOrderById, getAllOrders, updateOrderStatus, getAdminOrderStats };
