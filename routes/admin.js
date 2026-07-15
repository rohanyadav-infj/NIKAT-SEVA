const express = require("express");
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const User = require("../models/User");
const authRateLimiter = require("../middleware/authRateLimiter");
const {
    authenticateToken,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

/* =====================
    ADMIN LOGIN
===================== */

router.get("/login", (req, res) => {
    res.render("admin/login");
});

router.post("/login", authRateLimiter, (req, res) => {
    if (req.body.username === "admin" && req.body.password === "admin") {
        const token = jwt.sign(
            {
                userId: req.body.username,
                role: "Admin",
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000,
        });

        req.session.admin = true;
        return res.redirect("/admin/dashboard");
    }

    return res.status(401).send("Invalid credentials");
});

/* =====================
    ADMIN DASHBOARD
===================== */

router.get(
    "/dashboard",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        const users = await User.find({ role: "user" });
        const providers = await User.find({ role: "provider" });
        const bookings = await Booking.find();

        res.render("admin/dashboard", {
            users,
            providers,
            bookings,
        });
    }
);

/* =====================
    DELETE USER
===================== */

router.get(
    "/delete/user/:id",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        await User.findByIdAndDelete(req.params.id);
        await Booking.deleteMany({ userId: req.params.id });

        res.redirect("/admin/dashboard");
    }
);

/* =====================
    DELETE PROVIDER
===================== */

router.get(
    "/delete/provider/:id",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        await User.findByIdAndDelete(req.params.id);
        await Booking.deleteMany({ providerId: req.params.id });

        res.redirect("/admin/dashboard");
    }
);

/* =====================
    DELETE BOOKING
===================== */

router.get(
    "/delete/booking/:id",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        await Booking.findByIdAndDelete(req.params.id);

        res.redirect("/admin/dashboard");
    }
);

module.exports = router;
