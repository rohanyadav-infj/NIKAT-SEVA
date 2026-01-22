const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },

        role: {
            type: String,
            enum: ["user", "provider"],
            required: true,
        },

        // USER ADDRESS
        address: {
            type: String,
            default: null,
        },

        // PROVIDER ONLY
        service: {
            type: String,
            default: null,
        },

        location: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
