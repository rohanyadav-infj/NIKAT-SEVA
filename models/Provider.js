const mongoose = require("mongoose");

const providerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    service: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    location: {
        type: String,
        required: true,
    },
});

module.exports = mongoose.model("Provider", providerSchema);
