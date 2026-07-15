const jwt = require("jsonwebtoken");

function getTokenFromRequest(req) {
    return req.cookies?.token || null;
}

function decodeToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
        userId: decoded.userId,
        role: decoded.role.toLowerCase(),
    };
}

function attachUserIfPresent(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return next();
    }

    try {
        req.user = decodeToken(token);
    } catch (error) {
        res.clearCookie("token");
    }

    return next();
}

function authenticateToken(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        const loginPath = req.originalUrl.startsWith("/admin")
            ? "/admin/login"
            : "/login";
        return res.redirect(loginPath);
    }

    try {
        req.user = decodeToken(token);
        return next();
    } catch (error) {
        res.clearCookie("token");
        return res.status(401).send("Unauthorized");
    }
}

function authorizeRoles(...allowedRoles) {
    const normalizedRoles = allowedRoles.map((role) => role.toLowerCase());

    return (req, res, next) => {
        if (!req.user || !normalizedRoles.includes(req.user.role)) {
            return res.status(401).send("Unauthorized");
        }

        return next();
    };
}

module.exports = {
    attachUserIfPresent,
    authenticateToken,
    authorizeRoles,
};
