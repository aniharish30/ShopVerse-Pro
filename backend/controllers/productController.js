const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");

// @desc    Get all products with search, filter, pagination
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const { keyword, category, minPrice, maxPrice, sort, page = 1, limit = 12, featured } = req.query;

  const query = { isActive: true };

  if (keyword) {
    query.$or = [
      { name: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
      { tags: { $in: [new RegExp(keyword, "i")] } },
      { brand: { $regex: keyword, $options: "i" } },
    ];
  }

  if (category && category !== "all") query.category = category;
  if (featured === "true") query.featured = true;
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    "price-low": { price: 1 },
    "price-high": { price: -1 },
    rating: { rating: -1 },
    popular: { numReviews: -1 },
  };
  const sortBy = sortOptions[sort] || { createdAt: -1 };

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Product.countDocuments(query);
  const products = await Product.find(query).sort(sortBy).skip(skip).limit(Number(limit));

  res.json({
    success: true,
    products,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    total,
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("reviews.user", "name avatar");
  if (!product || !product.isActive) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json({ success: true, product });
});

// @desc    Create product (Admin)
// @route   POST /api/products
// @access  Admin
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, originalPrice, category, brand, stock, images, featured, tags } = req.body;

  const product = await Product.create({
    name, description, price, originalPrice, category, brand, stock,
    images: images || [],
    featured: featured || false,
    tags: tags || [],
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, message: "Product created", product });
});

// @desc    Update product (Admin)
// @route   PUT /api/products/:id
// @access  Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const fields = ["name", "description", "price", "originalPrice", "category", "brand", "stock", "images", "featured", "tags", "isActive"];
  fields.forEach((f) => { if (req.body[f] !== undefined) product[f] = req.body[f]; });

  const updated = await product.save();
  res.json({ success: true, message: "Product updated", product: updated });
});

// @desc    Delete product (Admin)
// @route   DELETE /api/products/:id
// @access  Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  product.isActive = false;
  await product.save();
  res.json({ success: true, message: "Product removed" });
});

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
const addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const already = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
  if (already) {
    res.status(400);
    throw new Error("You already reviewed this product");
  }

  product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
  product.numReviews = product.reviews.length;
  product.rating = product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length;

  await product.save();
  res.status(201).json({ success: true, message: "Review added" });
});

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct("category", { isActive: true });
  res.json({ success: true, categories });
});

// @desc    Get admin dashboard stats
// @route   GET /api/products/admin/stats
// @access  Admin
const getAdminStats = asyncHandler(async (req, res) => {
  const total = await Product.countDocuments({ isActive: true });
  const outOfStock = await Product.countDocuments({ stock: 0, isActive: true });
  const featured = await Product.countDocuments({ featured: true, isActive: true });
  const categories = await Product.distinct("category", { isActive: true });

  res.json({ success: true, stats: { total, outOfStock, featured, categories: categories.length } });
});

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, addReview, getCategories, getAdminStats };
