const express = require('express');
const {
  signup,
  login,
  resetPassword,
  resetPasswordRequest,
  verifyEmail,
} = require('../api/User');

const router = express.Router();

router.post('/signup', signup);

router.get('/verify/:userId/:uniqueString', verifyEmail);

router.post('/signin', login);

router.post('/requestpasswordreset', resetPasswordRequest);

router.post('/resetpassword', resetPassword);

module.exports = router;
