const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String,
            default: null,
        },
        verificationTokenExpires: {
            type: Date,
            default: null,
        },
        passwordResetOtpHash: {
            type: String,
            default: null,
        },
        passwordResetOtpExpires: {
            type: Date,
            default: null,
        },
        passwordResetOtpSentAt: {
            type: Date,
            default: null,
        },
        passwordResetOtpAttempts: {
            type: Number,
            default: 0,
        },
        passwordResetAllowResetUntil: {
            type: Date,
            default: null,
        },

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

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model("User", userSchema);
