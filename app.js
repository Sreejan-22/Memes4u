const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { render } = require("ejs");
const fs = require("fs");
const mongoose = require("mongoose");
const mongo = require("mongodb").MongoClient;
const Meme = require("./models/memeModel");
const User = require("./models/user");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();

// console.log(process.env.MONGODB_URI);

const dbURI = "mongodb://localhost:27017/memedb";
// process.env.MONGODB_URI ||
mongoose
  .connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  })
  .then(() => {
    console.log("Connected to db");
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log("App is running on port ", port);
    });
  })
  .catch((err) => console.log(err));

// setting the views directory(where the template files are located) and the view engine we'll use
app.set("views", "./views");
app.set("view engine", "ejs");

// public folder contains static file(s) like styles.css
/* 
To serve static files such as images, CSS files, and JavaScript files, 
we use the express.static built-in middleware function in Express.
*/
app.use(express.static("public"));

app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.redirect("/memes");
});

// displays memes
app.get("/memes", (req, res) => {
  // get all memes posted by all users with the most recent memes appearing first
  Meme.find()
    .sort({ createdAt: -1 }) // sorts the blogs from newest to oldest
    .then((result) => {
      res.render("index", { title: "Memes4u", memes: result });
      // res.status(200);
    })
    .catch((err) => {
      // console.log(err);
      res.status(500).send();
    });
});

// sign up page
app.get("/signup", (req, res) => {
  res.render("signup", { title: "Memes4u | Sign Up", alertData: "" });
});

// login page
app.get("/login", (req, res) => {
  res.render("login", { title: "Memes4u | Login", alertData: "" });
});

// web page to create new meme
app.get("/create", (req, res) => {
  res.render("create", { title: "Memes4u | Create" });
});

// creates a new meme
app.post("/memes", async (req, res) => {
  const { username, caption, url } = req.body;
  if (!caption || !url) {
    return res.status(400).json({
      status: "error",
      error: "Please enter valid caption and image url",
    });
  }
  User.findOne({ username }, (err, data) => {
    if (err) {
      // console.log(err);
      return res.status(500).send();
    } else {
      const name = data.name;
      const memeData = {
        name,
        username,
        caption,
        url,
      };
      // add data to database
      Meme.create(memeData, (err, newlyCreatedMeme) => {
        if (err) {
          // console.log(err);
          return res.status(500).send();
        } else {
          // console.log("New Meme: ", newlyCreatedMeme);
          return res.status(201).json({ status: "ok" });
        }
      });
    }
  });
});

// get the memes posted by a particular user
app.get("/mymemes/:username", (req, res) => {
  const username = req.params.username;
  if (username !== undefined) {
    User.findOne({ username }, (err, user) => {
      if (err) {
        // console.log(err);
        return res.status(500).send();
      } else {
        Meme.find({ username })
          .sort({ createdAt: -1 })
          .then((result) => {
            return res.render("mymemes", {
              title: "Memes4u | My Memes",
              memes: result,
            });
          })
          .catch((err) => {
            // console.log(err);
            res.status(500).send();
          });
      }
    });
  }
});

// search memes by id
app.get("/memes/:id", (req, res) => {
  const id = req.params.id;

  Meme.findById(id, (err, matchedMeme) => {
    if (err) {
      // console.log(err);
      res.status(500).send();
    } else if (matchedMeme == null) {
      res.status(404).send();
    } else {
      res.render("onememe", { title: "Memes4u", meme: matchedMeme });
    }
  });
});

// login
app.post("/login", async (req, res) => {
  User.findOne({ username: req.body.username }, (err, data) => {
    if (err) {
      return res.status(500).send();
    } else {
      if (!data) {
        // username does not exist
        return res
          .status(400)
          .json({ status: "error", error: "Invalid username/password" });
      }

      bcryptjs.compare(req.body.password, data.password, (err, result) => {
        if (err) {
          return res.status(500).send();
        } else {
          if (result) {
            // if result is true it would mean that the correct password was entered
            const token = jwt.sign(
              {
                id: data._id,
                username: data.username,
              },
              JWT_SECRET
            );
            return res.json({ status: "ok", username: data.username, token });
          } else {
            // incorrect password entered
            return res
              .status(400)
              .json({ status: "error", error: "Invalid username/password" });
          }
        }
      });
    }
  });
});

// sign up for a new user
app.post("/signup", async (req, res) => {
  const { name, username, password: plaintextPassword } = req.body;
  // console.log(req.body);

  if (!name || typeof name !== "string") {
    return res.status(400).json({ status: "error", error: "Invalid name" });
  }

  if (!username || typeof username !== "string") {
    return res.status(400).json({ status: "error", error: "Invalid username" });
  }

  if (!plaintextPassword || typeof plaintextPassword !== "string") {
    return res.status(400).json({ status: "error", error: "Invalid password" });
  }

  if (plaintextPassword.length < 6) {
    return res.status(400).json({
      status: "error",
      error: "Password must contain atleast 6 characters",
    });
  }

  if (plaintextPassword.length > 32) {
    return res.status(400).json({
      status: "error",
      error: "Password cannot have more than 32 characters",
    });
  }

  // saving the hash of the entered password
  const password = await bcryptjs.hash(plaintextPassword, 10);

  const userData = {
    name,
    username,
    password,
  };

  // create a new user
  // first check if user already exists
  User.exists({ username: userData.username }, (err, result) => {
    if (err) {
      return res
        .status(500)
        .json({ status: "error", error: "Sign up failed!!" });
    } else {
      if (result) {
        return res
          .status(409)
          .json({ status: "error", error: "Username already exists" });
      } else {
        User.create(userData, (err, data) => {
          if (err) {
            // console.log(err);
            return res.status(500).send();
          } else {
            // console.log("User: ", data);
            return res.status(201).json({ status: "ok" });
          }
        });
      }
    }
  });
});

// delete a meme
app.delete("/delete/:id", (req, res) => {
  const id = req.params.id;
  Meme.findByIdAndDelete(id, (err, meme) => {
    if (err) {
      // console.log(err);
      res.status(500).json({ status: "error" });
    } else {
      // console.log("Meme deleted");
      res.status(200).json({ status: "ok" });
    }
  });
});

app.use((req, res) => {
  res.status(404).render("404", { title: "404 Not Found" });
});

// // listen for requests port 3000 for connections
// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//   console.log("App is running on port ", port);
// });
