const express = require("express");
const Booking = require("../models/Booking");

const router = express.Router();

router.get("/accept/:id", async (req, res) => {
    await Booking.findByIdAndUpdate(req.params.id, {
        status: "accepted",
    });
    res.redirect("/dashboard");
});

router.get("/reject/:id", async (req, res) => {
    await Booking.findByIdAndUpdate(req.params.id, {
        status: "rejected",
    });
    res.redirect("/dashboard");
});

module.exports = router;
