const User = require('../Models/UserModels');
const userVerification = require('../Models/userVerifedModels');
const PasswordReset = require('../Models/passwordReset');
const bcrypt = require('bcrypt');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

//creating nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASSWORD,
  },
});

// testing the transporter
transporter.verify((err, success) => {
  if (err) {
    console.log(err);
  } else {
    console.log(success);
  }
});

const signup = (req, res) => {
  const { name, password, email, dateOfBirth } = req.body;

  if (name === '' || password === '' || email === '' || dateOfBirth === '') {
    res.json({ status: 'FAILED', message: 'empty input fields' });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    res.json({ status: 'FAILED', message: 'Invalid email entered' });
  } else if (!new Date(dateOfBirth).getTime()) {
    res.json({ status: 'FAILED', message: 'invalid date of birth entered' });
  } else if (!/^[a-zA-Z,' ']*$/.test(name)) {
    res.json({ status: 'FAILED', message: 'Invalid name entered' });
  } else if (password.length < 8) {
    res.json({ status: 'FAILED', message: 'password is too short' });
  } else {
    User.find({ email })
      .then((result) => {
        if (result.length > 0) {
          res.json({ status: 'FAILED', message: 'email already exist' });
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
                verified: false,
              });
              newUser
                .save()
                .then((data) => {
                  //handle account verification
                  sendVerificationEmail(data, res);
                })
                .catch((err) => {
                  res.json({
                    status: 'FAILED',
                    message: 'an error occurred while saving user account',
                  });
                });
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: 'FAILED',
                message: 'an error occurred while hashing password',
              });
            });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: 'FAILED',
          message: 'An error occurred while checking for existing user',
        });
      });
  }
};

//send verification email
const sendVerificationEmail = ({ _id, email }, res) => {
  //url to used in the email

  const currentUrl = process.env.URL_ENDPOINT_PROD;
  const uniqueString = uuidv4() + _id;

  //mail options
  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: 'verify your Email',
    html: `<p>Verify your email address to complete the signup and login into your account.</p><p>This link <b>expires in 6 hours</b>.</p><p>Press <a href=${
      currentUrl + _id + '/' + uniqueString
    }>Here </a> to proceed.</p>`,
  };
  //hash the uniqueString
  const salt = 10;
  bcrypt
    .hash(uniqueString, salt)
    .then((hashedUniqueStrings) => {
      //set value in user verification record
      const newVerification = new userVerification({
        userId: _id,
        uniqueString: hashedUniqueStrings,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });
      newVerification
        .save()
        .then(() => {
          transporter
            .sendMail(mailOptions)
            .then(() => {
              res.json({
                status: 'PENDING',
                message: 'Verification email sent!',
                email: email,
              });
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: 'FAILED',
                message: 'Verification email failed!',
              });
            });
        })
        .catch((err) => {
          console.log(err);
          res.json({
            status: 'FAILED',
            message: 'Could not save user verification email data!',
          });
        });
    })
    .catch((error) => {
      res.json({
        status: 'FAILED',
        message: 'An error occurred while hashing the email data!',
      });
    });
};
//verify email
const verifyEmail = (req, res) => {
  let { userId, uniqueString } = req.params;
  userVerification
    .find({ userId })
    .then((result) => {
      if (result.length > 0) {
        //user verification records exist we proceed
        const { expiresAt } = result[0];
        const hashedUniqueString = result[0].uniqueString;
        //check if unique string has expired
        if (expiresAt < Date.now()) {
          //record is expired so will delete it
          userVerification
            .deleteOne({ userId })
            .then((result) => {
              User.deleteOne({ _id: userId })
                .then(() => {
                  let message = 'Link has expired please signup again ';
                  res.redirect(
                    `/users/verified/?error=true&message=${message}`
                  );
                })
                .catch((error) => {
                  console.log(error);

                  let message =
                    'Clearing user with expired unique string failed';
                  res.redirect(
                    `/users/verified/?error=true&message=${message}`
                  );
                });
            })
            .catch((error) => {
              console.log(error);

              let message =
                'An error occurred while clearing user verification records';
              res.redirect(`/users/verified/?error=true&message=${message}`);
            });
        } else {
          //valid records exists so we validate the user string
          //first compare the hashed unique string
          bcrypt
            .compare(uniqueString, hashedUniqueString)
            .then((result) => {
              if (result) {
                User.updateOne({ _id: userId }, { verified: true })
                  .then(() => {
                    userVerification
                      .deleteOne({ userId })
                      .then(() => {
                        res.sendFile(
                          path.join(__dirname, '../views/verified.html')
                        );
                      })
                      .catch((error) => {
                        let message =
                          'An error occurred while finalizing successful verification';
                        res.redirect(
                          `/users/verified/error=true&message=${message}`
                        );
                      });
                  })
                  .catch((error) => {
                    console.log(error);

                    let message =
                      'An error occurred while updating user records to show verified';
                    res.redirect(
                      `/users/verified/error=true&message=${message}`
                    );
                  });
              } else {
                // existing records but incorrect verification
                let message =
                  'Invalid verification details passed please check your inbox';
                res.redirect(`/users/verified/error=true&message=${message}`);
              }
            })
            .catch((error) => {
              console.log(error);

              let message = 'An error occurred while comparing unique strings.';
              res.redirect(`/users/verified/error=true&message=${message}`);
            });
        }
      } else {
        //user records does not exist
        let message =
          'Account record does not exist or has been verified already, Please sign up or login';
        res.redirect(`/users/verified/error=true&message=${message}`);
      }
    })
    .catch((err) => {
      console.log(err);
      let message =
        'An error occurred while checking for existing user verification records';
      res.redirect(`/users/verified/error=true&message=${message}`);
    });
};

// login route
const login = (req, res) => {
  const { password, email } = req.body;
  if (password === '' || email === '') {
    res.json({ status: 'FAILED', message: 'Empty credentials supplied' });
  } else {
    //check if email exist
    User.find({ email })
      .then((data) => {
        if (data.length) {
          //user exists

          //check if user is verified
          if (!data[0].verified) {
            res.json({
              status: 'FAILED',
              message: 'Email has not been verified check inbox',
            });
          } else {
            const hashedPassword = data[0].password;
            bcrypt
              .compare(password, hashedPassword)
              .then((result) => {
                const { name, dateOfBirth, email } = data[0];
                if (result) {
                  //password matched
                  res.status(200).json({
                    status: 'SUCCESS',
                    message: 'signin successful',
                    data: { name, dateOfBirth, email },
                  });
                } else {
                  res.json({
                    status: 'FAILED',
                    message: 'Invalid password entered!',
                  });
                }
              })
              .catch((err) => {
                res.json({
                  status: 'FAILED',
                  message: 'An error occurred while comparing passwords',
                });
              });
          }
        } else {
          res.json({
            status: 'FAILED',
            message: 'Invalid credentials entered',
          });
        }
      })
      .catch((err) => {
        res.json({
          status: 'FAILED',
          message: 'An error occurred while checking for existing user',
        });
      });
  }
};

// password reset request rout
const resetPasswordRequest = (req, res) => {
  const { email, redirectUrl } = req.body;

  // check if user exist
  User.find({ email })
    .then((data) => {
      if (data.length) {
        //check if user is verified
        if (!data[0].verified) {
          res.json({
            status: 'FAILED',
            message: 'Email has not been verified yet check your inbox',
          });
        } else {
          //proceed with email to reset the password
          sendResetEmail(data[0], redirectUrl, res);
        }
      } else {
        res.json({
          status: 'FAILED',
          message: 'Account with this email does not exist',
        });
      }
    })
    .catch((error) => {
      console.log(error);
      res.json({
        status: 'FAILED',
        message: 'An error occurred while checking for existing user',
      });
    });
};

const sendResetEmail = ({ _id, email }, redirectUrl, res) => {
  const resetString = uuidv4() + _id;
  // first we clear all existing requests
  PasswordReset.deleteMany({ userId: _id })
    .then((result) => {
      //after deleting all existing records we can now send the reset email
      //mail options
      const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: 'Password reset',
        html: `<p>We heard you lost your password.</p><p>Use the link below to reset it.</p><p>This link <b>expires in 60 mins</b>.</p><p>Press <a href=${
          'https://enas-tech-savvy.netlify.app/' +
          redirectUrl +
          '/' +
          _id +
          '/' +
          resetString
        }>Here </a> to proceed.</p>`,
      };

      //hash the resetString before saving to database
      const saltGen = 10;
      bcrypt
        .hash(resetString, saltGen)
        .then((hashedResetString) => {
          //Save the reset string in resetpassword model
          const newPasswordReset = new PasswordReset({
            userId: _id,
            resetString: hashedResetString,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          });
          newPasswordReset
            .save()
            .then(() => {
              transporter
                .sendMail(mailOptions)
                .then(() => {
                  res.json({
                    status: 'PENDING',
                    message: 'Password reset strings sent to your email',
                    data: email,
                  });
                })
                .catch((error) => {
                  console.log(error);
                  res.json({
                    status: 'FAILED',
                    message: 'Unable to save new reset password',
                  });
                });
            })
            .catch((error) => {
              console.log(error);
              res.json({
                status: 'FAILED',
                message: 'Unable to save new reset password',
              });
            });
        })
        .catch((error) => {
          console.log(error);
          res.json({
            status: 'FAILED',
            message: 'Failed to hash password',
          });
        });
    })
    .catch((error) => {
      console.log(error);
      res.json({
        status: 'FAILED',
        message: 'Clearing existing password records failed',
      });
    });
};

//reset password route
const resetPassword = (req, res) => {
  let { userId, resetString, newPassword } = req.body;
  console.log(userId);
  PasswordReset.find({ userId })
    .then((result) => {
      if (result.length) {
        // password reset record exist so we proceed
        const { expiresAt, resetString: hashedResetString } = result[0];

        //check for expired reset string
        if (expiresAt < Date.now()) {
          PasswordReset.deleteOne({ userId })
            .then(() => {
              res.json({
                status: 'FAILED',
                message: 'Password reset link has expired',
              });
            })
            .catch((error) => {
              console.log(error);
              res.json({
                status: 'FAILED',
                message: 'Clearing password reset recovery failed',
              });
            });
        } else {
          //valid reset strings exist
          //first compare the strings
          bcrypt
            .compare(resetString, hashedResetString)
            .then((result) => {
              if (result) {
                // string matched
                //hash password again
                const saltGen = 10;
                bcrypt
                  .hash(newPassword, saltGen)
                  .then((hashedNewPassword) => {
                    //update user password
                    User.updateOne(
                      { _id: userId },
                      { password: hashedNewPassword }
                    )
                      .then(() => {
                        PasswordReset.deleteOne({ userId })
                          .then(() => {
                            //both user and reset recorded updated
                            res.json({
                              status: 'SUCCESS',
                              message: 'Password has been reset successfully.',
                            });
                          })
                          .catch((error) => {
                            console.log(error);
                            res.json({
                              status: 'FAILED',
                              message:
                                'An error occurred while finalizing password reset',
                            });
                          });
                      })
                      .catch((error) => {
                        console.log(error);
                        res.json({
                          status: 'FAILED',
                          message: 'Updating user password failed',
                        });
                      });
                  })
                  .catch((error) => {
                    console.log(error);
                    res.json({
                      status: 'FAILED',
                      message: 'An error occurred while hashing new password',
                    });
                  });
              } else {
                res.json({
                  status: 'FAILED',
                  message: 'Invalid reset password details passed',
                });
              }
            })
            .catch((error) => {
              console.log(error);
              res.json({
                status: 'FAILED',
                message: 'Comparing password reset string failed',
              });
            });
        }
      } else {
        res.json({
          status: 'FAILED',
          message: 'Password reset request not found',
        });
      }
    })
    .catch((error) => {
      console.log(error);
      res.json({
        status: 'FAILED',
        message: 'Checking for existing password reset failed',
      });
    });
};

const deleteAccount = (req, res) => {
  let { email } = req.body;

  // check if user exit on database
  User.find({ email })
    .then((result) => {
      User.findByIdAndDelete({ _id: result[0]._id })
        .then(() => {
          res.json({
            status: 'SUCCESS',
            message: 'user successfully deleted',
          });
        })
        .catch((error) => {
          console.log(error);
          res.json({
            status: 'FAILED',
            message: 'unsuccessful, check your network',
          });
        });
    })
    .catch((error) => {
      console.log(error);
      res.json({
        status: 'FAILED',
        message: 'no user with this email',
      });
    });
};
module.exports = {
  signup,
  login,
  resetPassword,
  resetPasswordRequest,
  verifyEmail,
  deleteAccount,
};
