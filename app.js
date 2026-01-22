const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();

// -------------------
// VIEW ENGINE
// -------------------
app.set("view engine", "ejs");

// -------------------
// MIDDLEWARE
// -------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "nikatseva_secret",
        resave: false,
        saveUninitialized: true,
    })
);

// Make user/admin available in ALL views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.admin = req.session.admin || null;
    next();
});

// -------------------
// DATABASE
// -------------------
mongoose
    .connect("mongodb://127.0.0.1:27017/nikatsevaDB")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));

// -------------------
// ROUTES
// -------------------
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const providerRoutes = require("./routes/provider");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");

// HOME
app.get("/", (req, res) => {
    res.render("home");
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});


app.use("/", authRoutes);
app.use("/", dashboardRoutes);
app.use("/", providerRoutes);
app.use("/", userRoutes);
app.use("/admin", adminRoutes);

// -------------------
// SERVER
// -------------------
app.listen(3000, () => {
    console.log("Server started on http://localhost:3000");
});
