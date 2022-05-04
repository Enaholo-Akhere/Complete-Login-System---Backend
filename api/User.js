const express = require("express");
const User = require("../Models/UserModels");
const router = express.Router();
const bcrypt = require("bcrypt");

router.post("/signup", (req, res) => {
  const { name, password, email, dateOfBirth } = req.body;

  if (name === "" || password === "" || email === "" || dateOfBirth === "") {
    res.status(404).json({ err: "input cannot be empty" });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    res.status(404).json({ err: "invalid email" });
  } else if (!new Date(dateOfBirth).getTime()) {
    res.status(404).json({ err: "invalid date format" });
  } else if (password.length < 8) {
    res.status(404).json({ err: "password too short" });
  } else {
    User.find({ email })
      .then((result) => {
        if (result.length > 0) {
          res.status(404).json({ err: "email already exist" });
        } else {
          const saltGen = 10;
          bcrypt
            .hash(password, saltGen)
            .then((hashedPassword) => {
              const newUser = new User({
                name,
                password: hashedPassword,
                email,
                dateOfBirth,
              });
              newUser
                .save()
                .then((data) => {
                  res.status(200).json({ data });
                })
                .catch((err) => {
                  res.status(400).send({ error: err });
                });
            })
            .catch((err) => {
              console.log(err);
              res.status(404).json({ err: "password not hashed" });
            });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(404).json({ err: err });
      });
  }
});

router.post("/signin", (req, res) => {
  const { password, email } = req.body;
  if (password === "" || email === "") {
    res.status(404).json({ err: "input cannot be empty" });
  } else {
    //check if email exist
    User.find({ email })
      .then((data) => {
        if (data) {
          const hashedPassword = data[0].password;
          bcrypt
            .compare(password, hashedPassword)
            .then((result) => {
              if (result) {
                res.status(200).json({
                  status: "succes",
                  data: { name: data[0].name, email: data[0].email },
                });
              } else {
                res.status(400).json({
                  status: "Failed",
                  message: "password does not match",
                  Error: err.message,
                });
              }
            })
            .catch((err) => {
              res.status(400).json({
                status: "Failed",
                message: "password does not match",
                Error: err.message,
              });
            });
        }
      })
      .catch((err) => {
        console.log(err.message);
        res.status(400).json({ status: "Failed", Error: err.message });
      });
  }
});

module.exports = router;
