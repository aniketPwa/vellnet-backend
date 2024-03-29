require("dotenv").config();
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const JWT_SECRET =
  "b8e8709ef9c3289c758a6cffe423c77b7ff00bbf8c00d0a20e479ac4a7f7c791"; // Replace with a secure secret key

app.use(express.json());
app.use(cors());
let dbUrl = "mongodb://admin:your_DB_password@ec2-3-133-111-105.us-east-2.compute.amazonaws.com:27017/vellnet"
// let dbUrl = "mongodb://localhost:27017/vellnet";
mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// bcrypt.hash("admin@123", 10).then((p) => {
//   console.log(p);
// });
const userSchema = new mongoose.Schema({
  fullName: { type: String },
  email: { type: String },
  dob: { type: String },
  mobile: { type: Number },
  gender: { type: String },
  password: { type: String },
  city: { type: String },
  address: { type: String },
  zipcode: { type: Number },
  uid: { type: String },
  userType: { type: String },
  userImg: { type: String },
  certificates: { type: String },
  status: { type: String },
});

userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
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

const medicalSchema = new mongoose.Schema({
  uid: { type: String },
  medicaldata: {
    bloodPressure: { type: Array },
    weight: { type: Array },
    height: { type: Array },
    steps: { type: Array },
    diet: { type: Array },
  },
});
const medicalRecords = mongoose.model("medicalrecords", medicalSchema);
function generateUserId() {
  const date = new Date();
  const dateString = date.toISOString().replace(/[-T:]/g, "").substring(0, 14);
  return `uid${dateString}`;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Specify upload directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname); // Use original filename
  },
});
const upload = multer({ storage: storage });

// Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await Users.findOne({ email: username });
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
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// get User
app.get("/getuserMedicalData/:userId", authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await medicalRecords.findOne({ uid: userId });
    // const userdata = {
    //   name: user.fullName,
    //   gender: user.gender,
    //   email: user.email,
    //   add: user.address,
    //   type: user.userType,
    //   dob: user.dob,
    //   uid: user.uid,
    // };
    res.json(user.medicaldata);
  } catch (error) {
    res.send({ message: "something went wrong" });
  }
});

app.get("/getUser/:userId", authenticateToken, async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await Users.findOne({ uid: userId });
    // const userdata = {
    //   name: user.fullName,
    //   gender: user.gender,
    //   email: user.email,
    //   add: user.address,
    //   type: user.userType,
    //   dob: user.dob,
    //   uid: user.uid,
    // };
    res.json(user);
  } catch (error) {
    res.send({ message: "something went wrong" });
  }
});
app.use("/uploads", express.static("uploads"));

//add user
app.post(
  "/addUser",
  authenticateToken,
  upload.single("userImage"),
  async (req, res) => {
    const document = req.body;
    const file = req.file;
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      if (!document.dob) {
        document.dob = null;
      }
      document.status = "active";
      const userId = generateUserId();
      document.uid = userId; // Example usage
      if (file) {
        const fileLink = `uploads/${file.filename}`;
        document.userImg = fileLink;
      } else {
        document.userImg = null;
      }
      const query = { email: document.email };
      Users.findOne(query)
        .then((existingUser) => {
          if (existingUser) {
            console.log("Document already exists:");
          } else {
            const newUser = new Users(document);
            return newUser.save();
          }
        })
        .then((newlyInsertedUser) => {
          if (newlyInsertedUser) {
            res.send({ success: true });
            console.log("New document inserted:");
          }
        })
        .catch((error) => {
          console.error("Error checking or inserting document:", error);
        });
    } catch (error) {
      console.error("Error inserting document:", error);
      next(error); // Pass the error to the error handling middleware
    }
  }
);

//get all users by type

app.post("/getUsers", authenticateToken, async (req, res) => {
  const { type } = req.body;
  try {
    let allUsers;
    if (type == "all") {
      allUsers = await Users.find({
        userType: { $ne: "admin" },
        status: { $ne: "deleted" },
      });
    } else {
      allUsers = await Users.find({
        userType: type,
        status: { $ne: "deleted" },
      });
    }
    if (allUsers) {
      res.send(allUsers);
    }
  } catch (error) {
    res.send({ message: "something went wrong" });
  }
});
app.post("/deleteUser", authenticateToken, async (req, res) => {
  const { uid } = req.body; 
  await Users
      .findOneAndUpdate({ uid: uid }, 
        { 
          $set: {
            "status": "deleted",
          },
         }, 
        {new:true })
      .then((updatedDocument) => {
        if (updatedDocument) {
          res.send({success:true})
        } else {
          res.send({success:false})
          console.log("Document not found");
        }
      })
})
app.post("/updateMedicalRecords", authenticateToken, async (req, res) => {
  const { uid, data, type } = req.body;
  const time = new Date();
  let today =
    time.getDate() + "/" + (time.getMonth() + 1) + "/" + time.getFullYear();
  async function updateRecords(action) {
    let newValues;
    let options = {};

    if (action == "update") {
      switch (type) {
        case "bp":
          newValues = {
            $set: {
              "medicaldata.bloodPressure.$[element].bp": data,
            },
          };
          break;
        case "dbp":
          newValues = {
            $set: {
              "medicaldata.bloodPressure.$[element].dbp": data,
            },
          };
          break;
        case "weight":
          newValues = {
            $set: {
              "medicaldata.weight.$[element].data": data,
            },
          };
          break;
        case "height":
          newValues = {
            $set: {
              "medicaldata.height.$[element].data": data,
            },
          };
          break;
        case "steps":
          newValues = {
            $set: {
              "medicaldata.steps.$[element].data": data,
            },
          };
          break;
        case "diet":
          newValues = {
            $set: {
              "medicaldata.diet.$[element].data": data,
            },
          };
          break;
      }
      options = {
        arrayFilters: [{ "element.updatedOn": today }],
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      };
    } else {
      options = { upsert: true, new: true, setDefaultsOnInsert: true };
      let pushData = {};
      switch (type) {
        case "bp":
          pushData = {
            "medicaldata.bloodPressure": {
              bp: data,
              updatedOn: today,
            },
          };

          break;
        case "dbp":
          pushData = {
            "medicaldata.bloodPressure": {
              dbp: data,
              updatedOn: today,
            },
          };
          break;
        case "weight":
          pushData = {
            "medicaldata.weight": {
              data: data,
              updatedOn: today,
            },
          };
          break;
        case "height":
          pushData = {
            "medicaldata.height": {
              data: data,
              updatedOn: today,
            },
          };
          break;
        case "steps":
          pushData = {
            "medicaldata.steps": {
              data: data,
              updatedOn: today,
            },
          };
          break;
        case "diet":
          pushData = {
            "medicaldata.diet": {
              data: data,
              updatedOn: today,
            },
          };
          break;
      }

      newValues = {
        $push: pushData,
      };
    }

   let updatedData = await medicalRecords
      .findOneAndUpdate({ uid: uid }, { ...newValues }, { ...options })
      .then((updatedDocument) => {
        if (updatedDocument) {
          return updatedDocument;
        } else {
          console.log("Document not found");
        }
      })
      .catch((error) => {
        console.error(error);
      });
    return updatedData;
  }
  try {
    let variable;
    let action;
    let usermed;
    switch (type) {
      case "bp":
        variable = "bloodPressure";

        break;
      case "dbp":
        variable = "bloodPressure";

        break;
      case "weight":
        variable = "weight";
        break;
      case "height":
        variable = "height";
        break;
      case "steps":
        variable = "steps";
        break;
      case "diet":
        variable = "diet";
        break;
    }
    const user = await Users.findOne({ uid: uid });
    if (user) {
      usermed = medicalRecords.findOne({ uid: uid }).then(async (m) => {
        if (m) {
          if (
            m.medicaldata[variable] &&
            m.medicaldata[variable].length &&
            m.medicaldata[variable][m.medicaldata[variable].length - 1]
              .updatedOn == today
          ) {
            action = "update";
          } else {
            action = "insert";
          }
        } else {
          action = "insert";
        }
        return await updateRecords(action);
      });
    }

    usermed
      .then((u) => {
        res.send({ success: true, data: u.medicaldata, type });
      })
      .catch((error) => {
        res.send({ message: error });
      });
  } catch (error) {
    res.send({ message: error });
  }
});

//get
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
