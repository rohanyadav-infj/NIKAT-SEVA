const express = require("express");
const User = require("../models/User");

const router = express.Router();

/* =====================
   LOGIN PAGE
===================== */
router.get("/login", (req, res) => {
    res.render("login");
});

/* =====================
   LOGIN LOGIC
===================== */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.send("Email and password required");
        }

        const user = await User.findOne({ email, password });

        if (!user) {
            return res.send("Invalid credentials");
        }

        req.session.user = user;
        res.redirect("/dashboard");
    } catch (err) {
        console.error(err);
        res.send("Login failed");
    }
});

/* =====================
   REGISTER PAGE
===================== */
router.get("/register", (req, res) => {
    res.render("register");
});

/* =====================
   REGISTER LOGIC
===================== */
router.post("/register", async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            password,
            role,
            service,
            location,
            address,
        } = req.body;

        if (!name || !phone || !email || !password || !role) {
            return res.send("All fields are required");
        }

        const userData = {
            name,
            phone,
            email,
            password,
            role,
        };

        if (role === "provider") {
            if (!service || !location) {
                return res.send("Service and Location required");
            }
            userData.service = service;
            userData.location = location;
        } else {
            if (!address) {
                return res.send("Address required");
            }
            userData.address = address;
        }

        const user = new User(userData);
        await user.save();

        req.session.user = user;
        res.redirect("/dashboard");
    } catch (err) {
        console.error(err);
        res.send("Registration failed");
    }
});

/* =====================
   LOGOUT
===================== */
router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

module.exports = router;
