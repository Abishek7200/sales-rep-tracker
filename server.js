// Imports and Setup
const express = require('express');
const http = require('http');
const os = require('os');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./db'); // Import database functions
const { deleteSong, getSongs } = require('./db');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);

// Middleware to get the username before file upload
const fetchUsername = async (req, res, next) => {
    try {
        const { mobileNumber } = req.body;
        if (!mobileNumber) return res.status(400).json({ error: "Mobile number is required" });

        const database = await db.connectDB();
        const usersCollection = database.collection("users");

        // Fetch user by mobileNumber
        const user = await usersCollection.findOne({ mobile: mobileNumber });
        if (!user) return res.status(404).json({ error: "User not found" });

        req.username = user.name || "unknown_user"; // Attach username to request
        next();
    } catch (error) {
        console.error("Error fetching username:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const username = req.username || "unknown_user"; // Use the username from middleware
            const uploadPath = path.join(__dirname, "files", username);

            await fs.ensureDir(uploadPath); // Ensure directory exists
            cb(null, uploadPath);
        } catch (error) {
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname); // Unique filename
    },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit


// Serve static files
app.use("/files", express.static(path.join(__dirname, "files")));



// Constants
const TOKEN_EXPIRATION = '30d'; // 30 days

// Globals
const generatedNumbers = new Set(); // Set to store unique 10-digit numbers

// Middleware
app.use(express.urlencoded({ extended: true })); // ✅ Required for form data
app.use(express.json());

// Serve static files from the public directory (or the directory where your HTML files are stored)
app.use(express.static(path.join(__dirname, 'client')));

// Redirect root URL to welcome.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.get("/welcome", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "index.html"));
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "signup.html"));
});

app.get("/sales", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "sales.html"));
});


// Function to get the local network IP address
function getLocalIP() {
    const networkInterfaces = os.networkInterfaces();
    for (let iface in networkInterfaces) {
        for (let alias of networkInterfaces[iface]) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

// Generate a token for a user
function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
}

// Function to generate a unique 10-digit random number
function generateUnique6DigitNumber() {
    let random6DigitNumber;

    // Keep generating until we get a unique number
    do {
        random6DigitNumber = Math.floor(Math.random() * 900000) + 100000;
    } while (generatedNumbers.has(random6DigitNumber));

    // Add the new number to the set of generated numbers
    generatedNumbers.add(random6DigitNumber);
    return random6DigitNumber;
}

// Register
app.post("/signup", async (req, res) => {
    // console.log("Received Data:", req.body); // Debugging log

    const { name, mobile, email, company, password } = req.body;

    if (!mobile || !password) {
        return res.status(400).json({ error: "Mobile number and password are required" });
    }

    try {
        const database = await db.connectDB();
        const usersCollection = database.collection('users');

        // Check if the user already exists
        const existingUser = await usersCollection.findOne({ mobile });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this mobile number" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the user into the 'users' collection
        const newUser = {
            name,
            mobile,
            email,
            company,
            password: hashedPassword,
            createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);

        res.json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { mobileNumber, password } = req.body;

        // Validate input
        if (!mobileNumber || !password) {
            return res.status(400).json({ error: "Mobile number and password are required." });
        }

        const database = await db.connectDB();
        const usersCollection = database.collection("users");

        // Find user by mobile number
        const user = await usersCollection.findOne({ mobile: mobileNumber.trim() });
        if (!user) {
            return res.status(400).json({ error: "Invalid mobile number or password." });
        }

        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid mobile number or password." });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                mobile: user.mobile,
                name: user.name, // Include more fields if needed
            },
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

app.get("/user/:mobile", async (req, res) => {
    try {
        const database = await db.connectDB();
        const usersCollection = database.collection("users");

        // Use projection to fetch only specific fields
        const user = await usersCollection.findOne(
            { mobile: req.params.mobile },
            { projection: { name: 1, email: 1, company: 1, _id: 0 } } // Exclude _id
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/sales-visit", fetchUsername, upload.single("file"), async (req, res) => {
    try {
        const { customer, mobile, address, place, comments, latitude, longitude, mobileNumber } = req.body;

        if (!customer || !address || !place || !mobileNumber) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        const database = await db.connectDB();
        const usersCollection = database.collection("users");

        // Find user by mobile number
        const user = await usersCollection.findOne({ mobile: mobileNumber });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // File URL (if uploaded)
        const fileUrl = req.file ? `/files/${req.username}/${req.file.filename}` : null;

        // Create visit entry
        const visitEntry = {
            customer,
            mobile: mobile || null,
            address,
            place,
            comments,
            fileUrl, // Store file path in DB
            latitude,
            longitude,
            date: new Date(),
        };

        // Update user document by pushing sales visit entry
        await usersCollection.updateOne(
            { mobile: mobileNumber },
            { $push: { salesVisits: visitEntry } }
        );

        res.status(200).json({
            message: "Sales visit information updated successfully",
            fileUrl, // Return file URL
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.get("/get-visits", async (req, res) => {
    try {
        const { username, date } = req.query;

        if (!username || !date) {
            return res.status(400).json({ error: "Username and date are required" });
        }

        const database = await db.connectDB();
        const usersCollection = database.collection("users");

        // Find user by username
        const user = await usersCollection.findOne({ name: username });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Convert date to start and end of the day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        // Filter sales visits by date
        const filteredVisits = (user.salesVisits || []).filter(visit => {
            const visitDate = new Date(visit.date);
            return visitDate >= startDate && visitDate <= endDate;
        });

        res.status(200).json(filteredVisits);
    } catch (error) {
        console.error("Error fetching visits:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



// Create a password reset request
app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const database = await db.connectDB();

        // Check if user exists
        const user = await database.collection('users').findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Generate a unique reset token
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Update the user's record with the reset token and expiry time
        await database.collection('users').updateOne(
            { email },
            { $set: { resetToken, resetTokenExpiry: Date.now() + 3600000 } }
        );

        // Generate reset link
        const resetLink = `https://wfjpresenter.onrender.com/api/reset-password?token=${resetToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset Request",
            html: `<p>Click the link below to reset your password:</p>
                   <a href="${resetLink}">${resetLink}</a>
                   <p>If you didn't request this, please ignore it.</p>`,
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: "Password reset link sent to email" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/reset-password", async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: "Invalid or missing token" });
    }

    res.send(`
        <html>
        <head>
            <title>Reset Password</title>
            <style>
    :root {
        --primary-color: #2563eb;
        --primary-hover: #1d4ed8;
        --background: rgba(0, 0, 0, 0.5);
        --text-color: #1f2937;
        --border-color: #e5e7eb;
        --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    body {
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        background: var(--background);
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1rem;
    }

    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: grid;
        place-items: center;
        padding: 1rem;
    }

    .container {
        background: white;
        padding: 2rem;
        border-radius: 1rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 400px;
        position: relative;
        transition: var(--transition);
    }

    .close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 50%;
        width: 2rem;
        height: 2rem;
        display: grid;
        place-items: center;
        transition: var(--transition);
    }

    .close-btn:hover {
        background: #f3f4f6;
    }

    h2 {
        color: var(--text-color);
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
        text-align: center;
    }

    .input-group {
        position: relative;
        margin-bottom: 1rem;
    }

    input {
        width: 100%;
        padding: 0.875rem;
        border: 2px solid var(--border-color);
        border-radius: 0.5rem;
        font-size: 1rem;
        transition: var(--transition);
    }

    input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    #togglePassword {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.25rem;
        display: grid;
        place-items: center;
    }

    #togglePassword:hover {
        background: #f3f4f6;
    }

    button[type="submit"] {
        width: 100%;
        padding: 0.875rem;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: var(--transition);
        margin-top: 1rem;
    }

    button[type="submit"]:hover {
        background: var(--primary-hover);
    }

    @media (max-width: 480px) {
        .container {
            padding: 1.5rem;
            border-radius: 0.75rem;
        }

        h2 {
            font-size: 1.25rem;
        }

        input {
            padding: 0.75rem;
        }
    }
</style>
        </head>
        <body>
            <div class="overlay">
                <div class="container">
                    <span class="close-btn" onclick="closePopup()">✖</span>
                    <h2>Reset Your Password</h2>
                    <form id="resetPasswordForm">
                        <input type="hidden" name="token" value="${token}" />
                        <label for="password">New Password:</label>
                        <div class="input-group">
                            <input type="password" id="password" name="password" placeholder="Enter new password" required>
                            <span id="togglePassword">👁️</span>
                        </div>
                        <button type="submit">Reset Password</button>
                    </form>
                </div>
            </div>
            <script>
                document.getElementById("togglePassword").addEventListener("click", function () {
                    const passwordField = document.getElementById("password");
                    passwordField.type = passwordField.type === "password" ? "text" : "password";
                    this.textContent = passwordField.type === "password" ? "👁️" : "🙈";
                });

                function closePopup() {
                    document.querySelector(".overlay").style.display = "none";
                }

                document.getElementById("resetPasswordForm").addEventListener("submit", async function (e) {
                    e.preventDefault();
                    
                    const password = document.getElementById("password").value;
                    const token = document.querySelector("input[name='token']").value;
                    
                    const response = await fetch('/api/resetpassword', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, password }),
                    });

                    const data = await response.json();
                    if (response.ok && data.redirect) {
                        window.location.href = data.redirect; // Redirect manually
                        alert("Password reset successful! You can now log in.");
                        closePopup();
                    } else {
                        alert(data.error || "Failed to reset password. Try again.");
                    }
                });
            </script>
        </body>
        </html>
    `);
});


app.post("/resetpassword", async (req, res) => {
    const { token, password } = req.body;

    // console.log("Received Headers:", req.headers);
    // console.log("Received Body:", req.body);

    if (!req.body.password) {
        console.log("❌ Password is missing!");
        return res.status(400).json({ error: "Password is required" });
    }

    try {
        const database = await db.connectDB();
        const user = await database.collection('users').findOne({ resetToken: token });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired token" });
        }

        if (user.resetTokenExpiry < Date.now()) {
            return res.status(400).json({ error: "Reset token has expired" });
        }

        // console.log("Password before hashing:", password); // Debugging

        const hashedPassword = await bcrypt.hash(password, 10);

        await database.collection('users').updateOne(
            { resetToken: token },
            {
                $set: { password: hashedPassword },
                $unset: { resetToken: "", resetTokenExpiry: "" }
            }
        );

        // res.json({ message: "Password has been reset successfully" });
        res.status(200).json({ success: true, redirect: "/login?message=Password reset successfully" });

    } catch (error) {
        console.error("Error in reset-password:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('token', 'hideBanner', { httpOnly: true, secure: true, sameSite: 'Strict' }); // Remove token cookie
    res.status(200).json({ message: "Logged out successfully" });
});

const nodemailer = require('nodemailer');

// Configure nodemailer transport
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services like SendGrid, Mailgun, etc.
    auth: {
        user: 'vabishekkumar@gmail.com', // Replace with your email
        pass: 'guin nomb dmgl cvyn'
    }
});

// Send welcome email function
function sendWelcomeEmail(userEmail, username) {
    const appUrl = 'https://wfjpresenter.onrender.com';

    const mailOptions = {
        from: 'vabishekkumar@gmail.com',
        to: userEmail,
        subject: `Welcome to WFJ Presenter, ${username}!`,
        html: `
            <div style="text-align: center;">
                <h2>Welcome to WFJ Presenter, ${username}!</h2>
                <p>Hello ${username},</p>
                <p>We're thrilled to have you with us! Click the button below to get started.</p>
                <a href="${appUrl}" style="display: inline-block; padding: 6px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Get Started</a><br>
                <p>Best regards,</p>
                <p><strong>WFJ Presenter Team</strong></p>
            </div>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}


// Start the server and initialize the cache
server.listen(5000, () => {
    const localIp = getLocalIP();
    console.log(`http://${localIp}:5000`);
});
