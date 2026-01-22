const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");

const router = express.Router();

router.get("/dashboard", async (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const user = req.session.user;

    // USER DASHBOARD
    if (user.role === "user") {
        const bookings = await Booking.find({ userId: user._id }).populate(
            "providerId"
        );

        const providers = await User.find({ role: "provider" });

        return res.render("user-dashboard", {
            user,
            bookings,
            providers, // ✅ THIS WAS MISSING
        });
    }

    // PROVIDER DASHBOARD
    if (user.role === "provider") {
        const bookings = await Booking.find({ providerId: user._id });

        return res.render("provider-dashboard", {
            user,
            bookings,
        });
    }

    res.send("Invalid role");
});

module.exports = router;
