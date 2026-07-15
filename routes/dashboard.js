const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const {
    authenticateToken,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/dashboard",
    authenticateToken,
    authorizeRoles("user", "provider"),
    async (req, res) => {
        const user = await User.findById(req.user.userId);

        if (!user) {
            res.clearCookie("token");
            return res.redirect("/login");
        }

        if (user.role === "user") {
            const bookings = await Booking.find({ userId: user._id }).populate(
                "providerId"
            );
            const providers = await User.find({ role: "provider" });

            return res.render("user-dashboard", {
                user,
                bookings,
                providers,
            });
        }

        if (user.role === "provider") {
            const bookings = await Booking.find({ providerId: user._id });

            return res.render("provider-dashboard", {
                user,
                bookings,
            });
        }

        return res.status(401).send("Unauthorized");
    }
);

module.exports = router;
