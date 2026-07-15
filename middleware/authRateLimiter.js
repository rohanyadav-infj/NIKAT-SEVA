const rateLimit = require("express-rate-limit");

const authRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: "Too many login attempts. Please try again after 15 minutes.",
    handler: (req, res) => {
        res.status(429).send(
            "Too many login attempts. Please try again after 15 minutes."
        );
    },
});

module.exports = authRateLimiter;
