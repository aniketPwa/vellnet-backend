require("dotenv").config();
const { body, validationResult } = require("express-validator");
const multer = require('multer');
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

mongoose.connect(process.env.DB_URI + `/vellnet`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const userSchema = new mongoose.Schema({
  fullName: {type:String},
  email: {type:String},
  dob: {type:String},
  mobile: {type:Number},
  gender: {type:String},
  password: {type:String},
  city: {type:String},
  address: {type:String},
  zipcode: {type:Number},
  uid: {type:String},
  userType: {type:String},
});
userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) {
      return next(); // If password not modified, move to the next middleware
    }
    const hashedPassword = await bcrypt.hash(this.password, 10); // Hash password with bcrypt
    this.password = hashedPassword; // Replace plain password with hashed password
    next();
  } catch (error) {
    next(error); // Pass error to the next middleware
  }
});
const Users = mongoose.model("users", userSchema);


function generateUserId() {
  const date = new Date();
  const dateString = date.toISOString().replace(/[-T:]/g, '').substring(0, 14);
  return `uid${dateString}`;
}


app.use(cors()); // Allow Cross-Origin Resource Sharing


const JWT_SECRET = "b8e8709ef9c3289c758a6cffe423c77b7ff00bbf8c00d0a20e479ac4a7f7c791"; // Replace with a secure secret key


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Specify upload directory
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname) // Use original filename
  }
});
const upload = multer({ storage: storage });


// Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    console.log(username, "username");
    const user = await Users.findOne({ email: username });
    console.log(user["uid"]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }
    const token = jwt.sign({ userId: user.uid }, JWT_SECRET, {
      expiresIn: "1h",
    });
    const UserData = { token: token, uid: user.uid, type: user.userType };
    res.json(UserData);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// get User
app.get("/getUser/:userId", authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  const user = await Users.findOne({ uid: userId });
  const userdata = {
    name: user.fullName,
    gender: user.gender,
    email: user.email,
    add: user.address,
    type: user.userType,
    dob: user.dob,
    uid: user.uid,
  };
  res.json(userdata);
});
app.use('/uploads', authenticateToken , express.static('uploads'));
//add patient
app.post("/addUser", upload.single('userImage') ,async (req, res) => {
  const document = req.body;
  const file = req.file;

  const userId = generateUserId();
  document.uid = userId// Example usage
  const fileLink = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  console.log('document',document)
  console.log('file',fileLink)
  // try {
  //   //   // Check for validation errors
  //   const errors = validationResult(req);
  //   if (!errors.isEmpty()) {
  //     return res.status(400).json({ errors: errors.array() });
  //   }

  //   const document = req.body;

  //   const query = { email: document.email };
  //   Users.findOne(query)
  //     .then((existingUser) => {
  //       if (existingUser) {
  //         console.log("Document already exists:");
  //       } else {
         
  //         const newUser = new Users(document);

  //         return newUser.save();
  //       }
  //     })
  //     .then((newlyInsertedUser) => {
  //       if (newlyInsertedUser) {
  //         console.log("New document inserted:");
  //       }
  //     })
  //     .catch((error) => {
  //       console.error("Error checking or inserting document:", error);
  //     });
  // } catch (error) {
  //   console.error("Error inserting document:", error);
  //   next(error); // Pass the error to the error handling middleware
  // }
});
//
// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

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
