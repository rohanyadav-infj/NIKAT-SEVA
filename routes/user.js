const express = require("express");
const Booking = require("../models/Booking");
const User = require("../models/User");

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
router.post("/book/:providerId", async (req, res) => {
    // Must be logged in
    if (!req.session.user) {
        return res.redirect("/login");
    }

    // Fetch provider
    const provider = await User.findById(req.params.providerId);
    if (!provider) {
        return res.send("Provider not found");
    }

    // 🔥 CRITICAL FIX: ADDRESS CHECK
    if (!req.session.user.address) {
        return res.send("Please update your address before booking a service.");
    }

    // CREATE BOOKING WITH ADDRESS
    await Booking.create({
        service: provider.service,

        // USER INFO
        userId: req.session.user._id,
        userName: req.session.user.name,
        userPhone: req.session.user.phone,
        userAddress: req.session.user.address, // ✅ FIXED

        // PROVIDER INFO
        providerId: provider._id,
        providerName: provider.name,
        providerPhone: provider.phone,

        status: "pending",
    });

    res.redirect("/dashboard");
});

/* =========================
   CANCEL BOOKING
========================= */
router.get("/cancel/:id", async (req, res) => {
    await Booking.findByIdAndUpdate(req.params.id, {
        status: "cancelled",
    });

    res.redirect("/dashboard");
});

module.exports = router;
