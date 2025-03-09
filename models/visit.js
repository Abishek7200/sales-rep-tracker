const mongoose = require("mongoose");

const VisitSchema = new mongoose.Schema({
  place: String,
  customer: String,
  mobile: String,
  comments: String,
  location: Object,
  file: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Visit", VisitSchema);
