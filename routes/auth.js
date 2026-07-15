const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const authRateLimiter = require("../middleware/authRateLimiter");
const {
    sendVerificationEmail,
    sendPasswordResetOtpEmail,
} = require("../services/emailService");

const router = express.Router();

const PASSWORD_RESET_OTP_EXPIRY_MS = 10 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_MAX_VERIFY_ATTEMPTS = 5;
const PASSWORD_RESET_ALLOW_RESET_MS = 10 * 60 * 1000;

const forgotPasswordRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many password reset requests. Please try again later.",
    handler: (req, res) => {
        return res.status(429).render(
            "forgot-password",
            getForgotPasswordViewData({
                error: "Too many password reset requests. Please try again later.",
                email: req.body.email || "",
            })
        );
    },
});

const resetOtpVerificationRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many OTP verification attempts. Please try again later.",
    handler: (req, res) => {
        return res.status(429).render(
            "verify-reset-otp",
            getVerifyResetOtpViewData({
                error: "Too many OTP verification attempts. Please try again later.",
                email: req.body.email || "",
            })
        );
    },
});

function getLoginViewData(overrides = {}) {
    return {
        error: null,
        message: null,
        email: "",
        resendEmail: "",
        ...overrides,
    };
}

function getRegisterViewData(overrides = {}) {
    return {
        error: null,
        formData: {},
        ...overrides,
    };
}

function getForgotPasswordViewData(overrides = {}) {
    return {
        error: null,
        message: null,
        email: "",
        ...overrides,
    };
}

function getVerifyResetOtpViewData(overrides = {}) {
    return {
        error: null,
        message: null,
        email: "",
        ...overrides,
    };
}

function getResetPasswordViewData(overrides = {}) {
    return {
        error: null,
        message: null,
        email: "",
        ...overrides,
    };
}

function validatePasswordStrength(password) {
    if (password.length < 8) {
        return "Password must be at least 8 characters long.";
    }

    if (!/[A-Z]/.test(password)) {
        return "Password must include at least one uppercase letter.";
    }

    if (!/[a-z]/.test(password)) {
        return "Password must include at least one lowercase letter.";
    }

    if (!/[0-9]/.test(password)) {
        return "Password must include at least one number.";
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return "Password must include at least one special character.";
    }

    return null;
}

function getJwtRole(role) {
    return role === "provider" ? "Provider" : "User";
}

function issueAuthToken(res, payload) {
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "24h",
    });

    res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
    });
}

function createVerificationToken() {
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    return {
        token,
        hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
}

function createPasswordResetOtp() {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    return {
        otp,
        otpHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_OTP_EXPIRY_MS),
    };
}

function secureOtpMatches(rawOtp, storedOtpHash) {
    const providedOtpHash = crypto
        .createHash("sha256")
        .update(rawOtp)
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(providedOtpHash, "hex"),
        Buffer.from(storedOtpHash, "hex")
    );
}

function clearPasswordResetOtp(user) {
    user.passwordResetOtpHash = null;
    user.passwordResetOtpExpires = null;
    user.passwordResetOtpSentAt = null;
    user.passwordResetOtpAttempts = 0;
}

function clearPasswordResetSession(req) {
    req.session.passwordResetUserId = null;
}

async function sendVerificationEmailToUser(user) {
    const { token, hashedToken, expiresAt } = createVerificationToken();

    user.verificationToken = hashedToken;
    user.verificationTokenExpires = expiresAt;
    await user.save();

    const verificationLink = `${process.env.APP_BASE_URL}/verify-email?token=${token}`;

    await sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationLink,
    });
}

async function sendPasswordResetOtpToUser(user) {
    const now = Date.now();

    if (
        user.passwordResetOtpSentAt &&
        now - user.passwordResetOtpSentAt.getTime() <
            PASSWORD_RESET_RESEND_COOLDOWN_MS
    ) {
        const secondsRemaining = Math.ceil(
            (PASSWORD_RESET_RESEND_COOLDOWN_MS -
                (now - user.passwordResetOtpSentAt.getTime())) /
                1000
        );

        return {
            cooldownRemaining: secondsRemaining,
        };
    }

    const { otp, otpHash, expiresAt } = createPasswordResetOtp();

    user.passwordResetOtpHash = otpHash;
    user.passwordResetOtpExpires = expiresAt;
    user.passwordResetOtpSentAt = new Date(now);
    user.passwordResetOtpAttempts = 0;
    user.passwordResetAllowResetUntil = null;
    await user.save();

    await sendPasswordResetOtpEmail({
        to: user.email,
        name: user.name,
        otp,
    });

    return {
        cooldownRemaining: 0,
    };
}

async function getResetEligibleUserFromSession(req) {
    if (!req.session.passwordResetUserId) {
        return null;
    }

    const user = await User.findById(req.session.passwordResetUserId);

    if (!user) {
        clearPasswordResetSession(req);
        return null;
    }

    if (
        !user.passwordResetAllowResetUntil ||
        user.passwordResetAllowResetUntil < new Date()
    ) {
        user.passwordResetAllowResetUntil = null;
        await user.save();
        clearPasswordResetSession(req);
        return null;
    }

    return user;
}

/* =====================
   LOGIN PAGE
===================== */
router.get("/login", (req, res) => {
    res.render("login", getLoginViewData());
});

/* =====================
   LOGIN LOGIC
===================== */
router.post("/login", authRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render(
                "login",
                getLoginViewData({
                    error: "Email and password are required.",
                    email,
                })
            );
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).render(
                "login",
                getLoginViewData({
                    error: "Invalid credentials.",
                    email,
                })
            );
        }

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
            return res.status(401).render(
                "login",
                getLoginViewData({
                    error: "Invalid credentials.",
                    email,
                })
            );
        }

        if (!user.isVerified) {
            return res.status(403).render(
                "login",
                getLoginViewData({
                    error: "Please verify your email before logging in.",
                    email,
                    resendEmail: user.email,
                })
            );
        }

        issueAuthToken(res, {
            userId: user._id.toString(),
            role: getJwtRole(user.role),
        });

        req.session.user = user;
        res.redirect("/dashboard");
    } catch (err) {
        console.error(err);
        res.status(500).render(
            "login",
            getLoginViewData({
                error: "Login failed. Please try again.",
                email: req.body.email || "",
            })
        );
    }
});

/* =====================
   REGISTER PAGE
===================== */
router.get("/register", (req, res) => {
    res.render("register", getRegisterViewData());
});

/* =====================
   REGISTER LOGIC
===================== */
router.post("/register", async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            password,
            role,
            service,
            location,
            address,
        } = req.body;

        if (!name || !phone || !email || !password || !role) {
            return res.status(400).render(
                "register",
                getRegisterViewData({
                    error: "All fields are required.",
                    formData: {
                        name,
                        phone,
                        email,
                        role,
                        service,
                        location,
                        address,
                    },
                })
            );
        }

        const passwordValidationError = validatePasswordStrength(password);

        if (passwordValidationError) {
            return res.status(400).render("register", {
                error: passwordValidationError,
                formData: {
                    name,
                    phone,
                    email,
                    role,
                    service,
                    location,
                    address,
                },
            });
        }

        const userData = {
            name,
            phone,
            email,
            password,
            role,
        };

        if (role === "provider") {
            if (!service || !location) {
                return res.status(400).render(
                    "register",
                    getRegisterViewData({
                        error: "Service and Location are required.",
                        formData: {
                            name,
                            phone,
                            email,
                            role,
                            service,
                            location,
                            address,
                        },
                    })
                );
            }
            userData.service = service;
            userData.location = location;
        } else {
            if (!address) {
                return res.status(400).render(
                    "register",
                    getRegisterViewData({
                        error: "Address is required.",
                        formData: {
                            name,
                            phone,
                            email,
                            role,
                            service,
                            location,
                            address,
                        },
                    })
                );
            }
            userData.address = address;
        }

        const user = new User(userData);
        await user.save();

        try {
            await sendVerificationEmailToUser(user);
        } catch (emailError) {
            console.error(emailError);
            return res.status(500).render(
                "login",
                getLoginViewData({
                    error: "Your account was created, but we could not send the verification email. Please use resend verification email.",
                    email: user.email,
                    resendEmail: user.email,
                })
            );
        }

        return res.render(
            "login",
            getLoginViewData({
                message: "Registration successful. Please check your email to verify your account before logging in.",
                email: user.email,
                resendEmail: user.email,
            })
        );
    } catch (err) {
        console.error(err);
        const errorMessage =
            err.code === 11000
                ? "An account with this email already exists."
                : "Registration failed. Please try again.";
        const statusCode = err.code === 11000 ? 400 : 500;

        res.status(statusCode).render(
            "register",
            getRegisterViewData({
                error: errorMessage,
                formData: {
                    name: req.body.name,
                    phone: req.body.phone,
                    email: req.body.email,
                    role: req.body.role,
                    service: req.body.service,
                    location: req.body.location,
                    address: req.body.address,
                },
            })
        );
    }
});

router.get("/verify-email", async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).render(
                "login",
                getLoginViewData({
                    error: "Invalid verification link.",
                })
            );
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            verificationToken: hashedToken,
        });

        if (!user) {
            return res.status(400).render(
                "login",
                getLoginViewData({
                    error: "Invalid verification link.",
                })
            );
        }

        if (
            !user.verificationTokenExpires ||
            user.verificationTokenExpires < new Date()
        ) {
            return res.status(400).render(
                "login",
                getLoginViewData({
                    error: "This verification link has expired. Please request a new one.",
                    email: user.email,
                    resendEmail: user.email,
                })
            );
        }

        user.isVerified = true;
        user.verificationToken = null;
        user.verificationTokenExpires = null;
        await user.save();

        return res.render(
            "login",
            getLoginViewData({
                message: "Your email has been verified. You can now log in.",
                email: user.email,
            })
        );
    } catch (err) {
        console.error(err);
        return res.status(500).render(
            "login",
            getLoginViewData({
                error: "Email verification failed. Please try again.",
            })
        );
    }
});

router.get("/resend-verification", (req, res) => {
    res.render("resend-verification", {
        error: null,
        message: null,
        email: req.query.email || "",
    });
});

router.post("/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).render("resend-verification", {
                error: "Email is required.",
                message: null,
                email: "",
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).render("resend-verification", {
                error: "No account found with that email address.",
                message: null,
                email,
            });
        }

        if (user.isVerified) {
            return res.render(
                "login",
                getLoginViewData({
                    message: "This account is already verified. You can log in now.",
                    email: user.email,
                })
            );
        }

        await sendVerificationEmailToUser(user);

        return res.render("resend-verification", {
            error: null,
            message: "A new verification email has been sent. Please check your inbox.",
            email: user.email,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).render("resend-verification", {
            error: "We could not resend the verification email. Please try again.",
            message: null,
            email: req.body.email || "",
        });
    }
});

/* =====================
   FORGOT PASSWORD
===================== */
router.get("/forgot-password", (req, res) => {
    clearPasswordResetSession(req);
    res.render("forgot-password", getForgotPasswordViewData());
});

router.post(
    "/forgot-password",
    forgotPasswordRateLimiter,
    async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).render(
                    "forgot-password",
                    getForgotPasswordViewData({
                        error: "Email is required.",
                    })
                );
            }

            const user = await User.findOne({ email });

            if (user) {
                const { cooldownRemaining } =
                    await sendPasswordResetOtpToUser(user);

                if (cooldownRemaining > 0) {
                    return res.status(429).render(
                        "forgot-password",
                        getForgotPasswordViewData({
                            error: `Please wait ${cooldownRemaining} seconds before requesting another OTP.`,
                            email,
                        })
                    );
                }
            }

            return res.render(
                "verify-reset-otp",
                getVerifyResetOtpViewData({
                    message:
                        "If an account with that email exists, a password reset OTP has been sent.",
                    email,
                })
            );
        } catch (err) {
            console.error(err);
            return res.status(500).render(
                "forgot-password",
                getForgotPasswordViewData({
                    error: "We could not process your request. Please try again.",
                    email: req.body.email || "",
                })
            );
        }
    }
);

router.post(
    "/forgot-password/resend-otp",
    forgotPasswordRateLimiter,
    async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).render(
                    "verify-reset-otp",
                    getVerifyResetOtpViewData({
                        error: "Email is required.",
                    })
                );
            }

            const user = await User.findOne({ email });

            if (user) {
                const { cooldownRemaining } =
                    await sendPasswordResetOtpToUser(user);

                if (cooldownRemaining > 0) {
                    return res.status(429).render(
                        "verify-reset-otp",
                        getVerifyResetOtpViewData({
                            error: `Please wait ${cooldownRemaining} seconds before requesting another OTP.`,
                            email,
                        })
                    );
                }
            }

            return res.render(
                "verify-reset-otp",
                getVerifyResetOtpViewData({
                    message:
                        "If an account with that email exists, a new OTP has been sent.",
                    email,
                })
            );
        } catch (err) {
            console.error(err);
            return res.status(500).render(
                "verify-reset-otp",
                getVerifyResetOtpViewData({
                    error: "We could not resend the OTP. Please try again.",
                    email: req.body.email || "",
                })
            );
        }
    }
);

router.post(
    "/forgot-password/verify-otp",
    resetOtpVerificationRateLimiter,
    async (req, res) => {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return res.status(400).render(
                    "verify-reset-otp",
                    getVerifyResetOtpViewData({
                        error: "Email and OTP are required.",
                        email,
                    })
                );
            }

            const user = await User.findOne({ email });

            if (
                !user ||
                !user.passwordResetOtpHash ||
                !user.passwordResetOtpExpires
            ) {
                return res.status(400).render(
                    "verify-reset-otp",
                    getVerifyResetOtpViewData({
                        error: "Invalid or expired OTP.",
                        email,
                    })
                );
            }

            if (user.passwordResetOtpExpires < new Date()) {
                clearPasswordResetOtp(user);
                await user.save();

                return res.status(400).render(
                    "verify-reset-otp",
                    getVerifyResetOtpViewData({
                        error: "This OTP has expired. Please request a new one.",
                        email,
                    })
                );
            }

            if (
                user.passwordResetOtpAttempts >=
                PASSWORD_RESET_MAX_VERIFY_ATTEMPTS
            ) {
                clearPasswordResetOtp(user);
                await user.save();

                return res.status(429).render(
                    "verify-reset-otp",
                    getVerifyResetOtpViewData({
                        error: "Too many invalid OTP attempts. Please request a new OTP.",
                        email,
                    })
                );
            }

            const otpMatches = secureOtpMatches(
                otp.trim(),
                user.passwordResetOtpHash
            );

            if (!otpMatches) {
                user.passwordResetOtpAttempts += 1;
                await user.save();

                return res.status(400).render(
                    "verify-reset-otp",
                    getVerifyResetOtpViewData({
                        error: "Invalid or expired OTP.",
                        email,
                    })
                );
            }

            clearPasswordResetOtp(user);
            user.passwordResetAllowResetUntil = new Date(
                Date.now() + PASSWORD_RESET_ALLOW_RESET_MS
            );
            await user.save();

            req.session.passwordResetUserId = user._id.toString();

            return res.render(
                "reset-password",
                getResetPasswordViewData({
                    email: user.email,
                    message: "OTP verified. Please set your new password.",
                })
            );
        } catch (err) {
            console.error(err);
            return res.status(500).render(
                "verify-reset-otp",
                getVerifyResetOtpViewData({
                    error: "OTP verification failed. Please try again.",
                    email: req.body.email || "",
                })
            );
        }
    }
);

router.get("/reset-password", async (req, res) => {
    try {
        const user = await getResetEligibleUserFromSession(req);

        if (!user) {
            return res.redirect("/forgot-password");
        }

        return res.render(
            "reset-password",
            getResetPasswordViewData({
                email: user.email,
            })
        );
    } catch (err) {
        console.error(err);
        return res.redirect("/forgot-password");
    }
});

router.post("/reset-password", async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const user = await getResetEligibleUserFromSession(req);

        if (!user) {
            return res.status(400).render(
                "forgot-password",
                getForgotPasswordViewData({
                    error: "Your password reset session has expired. Please start again.",
                })
            );
        }

        if (!password || !confirmPassword) {
            return res.status(400).render(
                "reset-password",
                getResetPasswordViewData({
                    error: "Please enter and confirm your new password.",
                    email: user.email,
                })
            );
        }

        if (password !== confirmPassword) {
            return res.status(400).render(
                "reset-password",
                getResetPasswordViewData({
                    error: "Passwords do not match.",
                    email: user.email,
                })
            );
        }

        const passwordValidationError = validatePasswordStrength(password);

        if (passwordValidationError) {
            return res.status(400).render(
                "reset-password",
                getResetPasswordViewData({
                    error: passwordValidationError,
                    email: user.email,
                })
            );
        }

        user.password = password;
        user.passwordResetAllowResetUntil = null;
        await user.save();

        clearPasswordResetSession(req);

        return res.render(
            "login",
            getLoginViewData({
                message:
                    "Your password has been reset successfully. Please log in with your new password.",
                email: user.email,
            })
        );
    } catch (err) {
        console.error(err);
        return res.status(500).render(
            "forgot-password",
            getForgotPasswordViewData({
                error: "We could not reset your password. Please try again.",
            })
        );
    }
});

/* =====================
   LOGOUT
===================== */
router.get("/logout", (req, res) => {
    res.clearCookie("token");
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

module.exports = router;
