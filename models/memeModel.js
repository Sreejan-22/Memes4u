const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// schema
const memeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// model
const Meme = mongoose.model("Meme", memeSchema);

module.exports = Meme;
