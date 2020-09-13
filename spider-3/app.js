//jshint esversion:6

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const fs = require('fs');
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

// const bcrypt = require("bcrypt");
// const saltRounds = 10;
// const md5 = require("md5");
// const encrypt = require("mongoose-encryption");

const app = express();

// console.log(process.env.API_KEY);

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);
mongoose.set('useFindAndModify', false);

const itemSchema = new mongoose.Schema({
  itemName: String,
  description: String,
  image: { data: Buffer, contentType: String },
  price: Number,
  quantity: Number,
  itemCategory: String,
  creatorId: String
});


const userSchema = new mongoose.Schema({
  name: String,
  category: String,
  email: String,
  password: String,
  googleId: String,
  secret: String,
  history: Array,
  cartItems: Array
});


userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"]});

const User = new mongoose.model("User", userSchema);
const Item = new mongoose.model("Item", itemSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileUrl: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', {
    scope: ["profile"]
  }));

app.get('/auth/google/secrets',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});


app.get("/:userId/itemUpdate/:itemId", function(req, res) {

  const userLinkId = req.params.userId;
  const updateItemID = req.params.itemId;
  const itemUpdate = "/" + userLinkId + "/itemUpdate/" + updateItemID;

  Item.findById(updateItemID, function(err, item) {
    if (err) {
      console.log(err);
    } else {
      console.log(item);
      res.render("itemUpdate", {
        itemUpdatelink: itemUpdate,
        sellerHome: "/" + userLinkId + "/sellerDash",
        sellerCust: "/" + userLinkId + "/Customer",
        updateItem: item
      });
    }
  });

});



app.get("/:userId/Customer", function(req, res) {
  const userID = req.params.userId;

  User.find({
    category: "Customer"
  }, function(err, customers) {
    if (err) {
      console.log(err);
    } else {
      // console.log(customers);
      res.render("customer", {
        sellerHome: "/" + userID + "/sellerDash",
        sellerCust: "/" + userID + "/Customer",
        customers: customers
      });
    }
  });

});

app.get("/:userId/category", function(req, res) {

  const userId = req.body.userId;

  Item.find({}, function(err, items) {
    if (err) {
      console.log(err);
    } else {
      // console.log(items);
      res.render("category", {
        items: items,
        custHome: "/" + userId + "/custDash",
        custCategory: "/" + userId + "/category",
        custCart: "/" + userId + "/cart",
      });
    }
  });

});

app.get("/:userId/cart", function(req, res) {

  const userId = req.params.userId

  User.findById(userId, function(err, user) {
    if (err) {
      console.log(err);
    } else {
      console.log(user);
      res.render("cart", {
        cartItems: user.cartItems,
        custHome: "/" + userId + "/custDash",
        custCategory: "/" + userId + "/category",
        custCart: "/" + userId + "/cart"
      });
    }
  });

});

app.get("/:userId/itemCreate", function(req, res) {
  // console.log(req.params.userId);
  res.render("itemCreate", {
    userItemCreatelink: "/" + req.params.userId + "/itemCreate",
    sellerHome: "/" + req.params.userId + "/sellerDash",
    sellerCust: "/" + req.params.userId + "/Customer",
  });

});



app.get("/:userId/sellerDash", function(req, res) {
  const userId = req.params.userId;

  User.findOne({
    _id: userId
  }, function(err, seller) {
    // console.log(seller);
    res.render("sellerDash", {
      sellerName: seller.name,
      addedItems: seller.cartItems,
      sellerHome: "/" + seller._id + "/sellerDash",
      sellerCust: "/" + seller._id + "/Customer",
      sellerIDlink: "/" + seller._id + "/itemCreate",
      updateLink: "/" + seller._id + "/itemUpdate"
    });
  });

});

app.get("/:userId/custDash", function(req, res) {
  const userId = req.params.userId;

  User.findOne({
    _id: userId
  }, function(err, customer) {
    res.render("custDash", {
      custName: customer.name,
      custHome: "/" + userId + "/custDash",
      custCategory: "/" + userId + "/category",
      custCart: "/" + userId + "/cart",
      purchasedItems: customer.history
    });
  });

});


app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});


app.post("/register", function(req, res) {
  // console.log(req.body.exampleRadios);
  User.register({
    username: req.body.username,
    category: req.body.exampleRadios,
    name: req.body.name
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/");
      });
    }
  });
});


app.post("/login", function(req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        // res.redirect("/secrets");
        User.find({
          username: user.username
        }, function(err, userProfile) {
          if (err) {
            console.log(err);
          } else {
            console.log(userProfile[0]._id);
            if (userProfile[0].category == "Seller") {
              res.redirect("/" + userProfile[0]._id + "/sellerDash");
            } else if (userProfile[0].category == "Customer") {
              res.redirect("/" + userProfile[0]._id + "/custDash");
            }
          }
        });
      });
    }
  });
});


app.post("/:userId/itemCreate", function(req, res) {

  const linkId = req.params.userId;

  const item = new Item({
    itemName: req.body.itemName,
    description: req.body.itemDescription,
    // image: String,
    price: req.body.itemPrice,
    quantity: req.body.itemQuantity,
    itemCategory: req.body.itemCategory,
    creatorId: linkId
  });

  item.save(function(err) {
    if (err) {
      console.log(err);
    } else {
      // console.log("Successfully saved the item");
      User.findByIdAndUpdate(linkId, {
        $push: {
          cartItems: item
        }
      }, function(err) {
        console.log(err);
      });
      res.redirect("/" + linkId + "/sellerDash");

    }
  });

});



app.post("/:userId/itemUpdate/:itemId", function(req, res) {

  const userID = req.params.userId;
  const itemId = req.params.itemId;
  const updateName = req.body.itemName;
  const updateDescription = req.body.itemDescription;
  const updatePrice = req.body.itemPrice;
  const updateQuantity = req.body.itemQuantity;
  const updateCategory = req.body.itemCategory;

  User.findByIdAndUpdate(userID, {
    $pull: {
      cartItems: {_id: itemId}
    }
  }, { multi: true }, function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("removed from cart");
    }
  });


  const updateItem = new Item({
    itemName: updateName,
    description: updateDescription,
    price: updatePrice,
    quantity: updateQuantity,
    itemCategory: updateCategory,
    creatorId: userID
  });

  updateItem.save(function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("Successfully saved the item");
    }
  });

  Item.deleteOne({
    _id: req.params.itemId
  }, function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("deleted previous item");
    }
  });

  User.findByIdAndUpdate(userID, {
    $push: {
      cartItems: updateItem
    }
  }, function(err) {
    console.log(err);
  });

res.redirect("/" + userID + "/sellerDash");

});



app.listen(3000, function() {
  console.log("Successfully set the server at port 3000");
});
