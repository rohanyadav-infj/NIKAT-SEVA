const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendVerificationEmail({ to, name, verificationLink }) {
    await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject: "Verify your NikatSeva account",
        html: `
            <p>Hello ${name},</p>
            <p>Thank you for registering with NikatSeva.</p>
            <p>Please verify your email by clicking the link below:</p>
            <p><a href="${verificationLink}">${verificationLink}</a></p>
            <p>This link will expire in 1 hour.</p>
        `,
    });
}

async function sendPasswordResetOtpEmail({ to, name, otp }) {
    await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject: "Your NikatSeva password reset OTP",
        html: `
            <p>Hello ${name},</p>
            <p>We received a request to reset your NikatSeva password.</p>
            <p>Your one-time password is:</p>
            <h2 style="letter-spacing: 4px;">${otp}</h2>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
        `,
    });
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetOtpEmail,
};
