const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");
const {
    authenticateToken,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

/* =========================
   SHOW SERVICE PROVIDERS
========================= */
router.get("/providers", async (req, res) => {
    const { q } = req.query;

    let filter = { role: "provider" };

    if (q) {
        filter.$or = [
            { name: { $regex: q, $options: "i" } },
            { service: { $regex: q, $options: "i" } },
            { location: { $regex: q, $options: "i" } },
        ];
    }

    const providers = await User.find(filter);

    res.render("providers", {
        providers,
        searchQuery: q || "",
    });
});

/* =========================
   BOOK A PROVIDER
========================= */
router.post(
    "/book/:providerId",
    authenticateToken,
    authorizeRoles("user"),
    async (req, res) => {
        const currentUser = await User.findById(req.user.userId);

        if (!currentUser) {
            res.clearCookie("token");
            return res.redirect("/login");
        }

        const provider = await User.findById(req.params.providerId);
        if (!provider) {
            return res.send("Provider not found");
        }

        if (!currentUser.address) {
            return res.send("Please update your address before booking a service.");
        }

        await Booking.create({
            service: provider.service,
            userId: currentUser._id,
            userName: currentUser.name,
            userPhone: currentUser.phone,
            userAddress: currentUser.address,
            providerId: provider._id,
            providerName: provider.name,
            providerPhone: provider.phone,
            status: "pending",
        });

        return res.redirect("/dashboard");
    }
);

/* =========================
   CANCEL BOOKING
========================= */
router.get(
    "/cancel/:id",
    authenticateToken,
    authorizeRoles("user"),
    async (req, res) => {
        await Booking.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            {
                status: "cancelled",
            }
        );

        res.redirect("/dashboard");
    }
);

module.exports = router;
