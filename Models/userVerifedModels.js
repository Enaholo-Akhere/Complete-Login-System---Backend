const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userVerifiedSchema = new Schema({
  userId: {
    type: String,
  },
  uniqueString: {
    type: String,
  },
  createdAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
});

const verifiedUser = mongoose.model('userverification', userVerifiedSchema);

module.exports = verifiedUser;
