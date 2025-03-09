const express = require("express");
const multer = require("multer");
const Visit = require("../models/visit");

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Submit Visit
router.post("/", upload.single("file"), async (req, res) => {
  const { place, customer, mobile, comments, location } = req.body;
  const visit = new Visit({ place, customer, mobile, comments, location, file: req.file?.filename });
  await visit.save();
  res.json({ message: "Visit logged" });
});

module.exports = router;
