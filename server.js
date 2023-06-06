const express = require('express');
const mongoose = require('mongoose');
const app = express();
const dotenv = require('dotenv');
const userRouter = require('./controllers/userControllers');
const cors = require('cors');

dotenv.config();

//middlewares
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://enas-tech-savvy.netlify.app'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//port number
const PORT = process.env.PORT || 8000;

//connecting the database
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server started and running ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
app.get('/', (req, res) => {
  return res.send('send');
});
app.use('/users', userRouter);
