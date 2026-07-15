const sanitizeHtml = require("sanitize-html");

const EXCLUDED_FIELDS = new Set([
    "password",
    "confirmPassword",
    "otp",
]);

function sanitizeString(value) {
    return sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: "discard",
    });
}

function sanitizeValue(value, key = "") {
    if (typeof value === "string") {
        if (EXCLUDED_FIELDS.has(key)) {
            return value;
        }

        return sanitizeString(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, key));
    }

    if (value && typeof value === "object") {
        for (const nestedKey of Object.keys(value)) {
            value[nestedKey] = sanitizeValue(value[nestedKey], nestedKey);
        }
    }

    return value;
}

function xssSanitizer(req, res, next) {
    req.body = sanitizeValue(req.body);
    req.query = sanitizeValue(req.query);
    req.params = sanitizeValue(req.params);
    next();
}

module.exports = xssSanitizer;
