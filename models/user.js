const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, match: /^\d{10}$/ }, // Ensures it's exactly 10 digits
  email: { type: String, required: true, unique: true },
  orgname: { type: String, required: true },
  password: { type: String, required: true },
});

module.exports = mongoose.model("User", UserSchema);
