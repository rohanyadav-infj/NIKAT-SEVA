const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");

const router = express.Router();

/* =====================
    ADMIN LOGIN
===================== */

// Admin login page
router.get("/login", (req, res) => {
    res.render("admin/login");
});

// Admin login logic
router.post("/login", (req, res) => {
    if (req.body.username === "admin" && req.body.password === "admin") {
        req.session.admin = true;
        res.redirect("/admin/dashboard");
    } else {
        res.send("Invalid credentials");
    }
});

/* =====================
    ADMIN DASHBOARD
===================== */

router.get("/dashboard", async (req, res) => {
    if (!req.session.admin) return res.redirect("/admin/login");

    const users = await User.find({ role: "user" });
    const providers = await User.find({ role: "provider" });
    const bookings = await Booking.find();

    res.render("admin/dashboard", {
        users,
        providers,
        bookings,
    });
});

/* =====================
    DELETE USER
===================== */

router.get("/delete/user/:id", async (req, res) => {
    if (!req.session.admin) return res.redirect("/admin/login");

    await User.findByIdAndDelete(req.params.id);
    await Booking.deleteMany({ userId: req.params.id });

    res.redirect("/admin/dashboard");
});

/* =====================
    DELETE PROVIDER
===================== */

router.get("/delete/provider/:id", async (req, res) => {
    if (!req.session.admin) return res.redirect("/admin/login");

    await User.findByIdAndDelete(req.params.id);
    await Booking.deleteMany({ providerId: req.params.id });

    res.redirect("/admin/dashboard");
});

/* =====================
    DELETE BOOKING
===================== */

router.get("/delete/booking/:id", async (req, res) => {
    if (!req.session.admin) return res.redirect("/admin/login");

    await Booking.findByIdAndDelete(req.params.id);

    res.redirect("/admin/dashboard");
});

/* =====================
    ADMIN LOGOUT
===================== */

module.exports = router;
