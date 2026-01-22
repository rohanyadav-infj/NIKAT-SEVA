const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        // Service booked
        service: {
            type: String,
            required: true,
        },

        // Provider info
        providerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // User info (snapshot at booking time)
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        userName: {
            type: String,
            required: true,
        },

        userPhone: {
            type: String,
            required: true,
        },

        
        userAddress: {
            type: String,
            required: true,
        },

        // Booking status
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Booking", bookingSchema);
