const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select("-password").sort({ createdAt: -1 });
  res.json({ success: true, users, total: users.length });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json({ success: true, user });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.role = req.body.role || user.role;
  user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;

  const updated = await user.save();
  res.json({ success: true, message: "User updated", user: updated });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  user.isActive = false;
  await user.save();
  res.json({ success: true, message: "User deactivated" });
});

const getAdminUserStats = asyncHandler(async (req, res) => {
  const total = await User.countDocuments({ isActive: true });
  const admins = await User.countDocuments({ role: "admin", isActive: true });
  const newThisMonth = await User.countDocuments({
    createdAt: { $gte: new Date(new Date().setDate(1)) },
    isActive: true,
  });
  res.json({ success: true, stats: { total, admins, newThisMonth } });
});

module.exports = { getAllUsers, getUserById, updateUser, deleteUser, getAdminUserStats };
