// server.js
require("dotenv").config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());
const mongoose = require('mongoose');
const bcrypt = require("bcrypt")
const saltRounds = 10
mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const Users = mongoose.model('users', {
    email: String,
    password: String,
    uid:String,
    name:String,
    dob:String,
    gender:String,
    address:String,
    userType:String,
});
app.use(cors()); // Allow Cross-Origin Resource Sharing


  hashPass =(pass,cb) => {
    bcrypt
    .genSalt(saltRounds)
    .then(salt => {
      return bcrypt.hash(pass, salt)
    })
    .then(hash => { 
      return cb(null, hash);
    })
    .catch(err => console.error(err.message))
}

// const pass = hashPass('admin@123',(err,password)=>{
//     console.log(password)
// })


const JWT_SECRET = 'b8e8709ef9c3289c758a6cffe423c77b7ff00bbf8c00d0a20e479ac4a7f7c791'; // Replace with a secure secret key

// Login route
app.post('/login',async (req, res) => {
    const { username, password } = req.body;
    try{
    console.log(username,'username')
    const user = await Users.findOne({"email":username});
    console.log(user['uid'])
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid password' });
      }
      const token = jwt.sign({ userId: user.uid }, JWT_SECRET, { expiresIn: '1h' });
      const UserData = {'token':token,"uid":user.uid,type:user.userType} 
      res.json(UserData);
    }
     catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Protected route
app.get('/getUser/:userId', authenticateToken , async (req, res) => {
    const userId = req.params.userId;
    const user = await Users.findOne({"uid":userId});
    const userdata = {
        name:user.name,
        gender:user.gender,
        email:user.email,
        add:user.address,
        type:user.userType,
        dob:user.dob,
        uid:user.uid
    }
    res.json(userdata);

});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, userId) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = userId;
        next();
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
