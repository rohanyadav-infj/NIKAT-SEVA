const express = require("express");
const Booking = require("../models/Booking");
const {
    authenticateToken,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/accept/:id",
    authenticateToken,
    authorizeRoles("provider"),
    async (req, res) => {
        await Booking.findOneAndUpdate(
            { _id: req.params.id, providerId: req.user.userId },
            {
                status: "accepted",
            }
        );
        res.redirect("/dashboard");
    }
);

router.get(
    "/reject/:id",
    authenticateToken,
    authorizeRoles("provider"),
    async (req, res) => {
        await Booking.findOneAndUpdate(
            { _id: req.params.id, providerId: req.user.userId },
            {
                status: "rejected",
            }
        );
        res.redirect("/dashboard");
    }
);

module.exports = router;
