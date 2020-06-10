// !Packages and Dependencies Init
const express = require("express"),
  bodyParser = require("body-parser"),
  mongoose = require("mongoose"),
  passport = require("passport"),
  localStrategy = require("passport-local"),
  passportLocalMongoose = require("passport-local-mongoose"),
  methodOverride = require("method-override"),
  app = express();

// !App Setup
// *Mongoose:
// Make Mongoose use `findOneAndUpdate()`. Note that this option is `true`
// by default, you need to set it to false.
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);

// mongoose.connect("mongodb://localhost/u_notes");
const url = process.env.DATABASEURL || "mongodb://localhost/u_notes";
mongoose.connect(url);

// *App:
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));

// !Mongoose Models
// User:
var userSchema = new mongoose.Schema({
  username: String,
  password: String
});
userSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User", userSchema);

// Notes:
var noteSchema = new mongoose.Schema({
  title: String,
  content: String,
  dateCreated: { type: Date, default: Date.now },
  author: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    username: String
  }
});
var Note = mongoose.model("Note", noteSchema);

// Note.create({ title: "1st", content: "for narnia" }, (err, note) => {});

// !Passport Config
app.use(
  require("express-session")({
    secret: "uNotes is bae",
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// !req.user and message for all routes
// *Adds currentUser and message on all routes:
app.use(function(req, res, next) {
  res.locals.currentUser = req.user;
  // res.locals.error = req.flash("error");
  // res.locals.success = req.flash("success");
  next();
});

// !Routes
// !Landing
app.get("/", (req, res) => {
  res.render("landing");
});

// !Register
// Show register form
app.get("/register", (req, res) => {
  res.render("register");
});
// Registration Logic
app.post("/register", (req, res) => {
  var newUser = new User({ username: req.body.username });
  User.register(newUser, req.body.password, (err, user) => {
    if (err) {
      console.log(err);
      console.log(err.message);
      return res.render("register");
    }

    passport.authenticate("local")(req, res, () => {
      res.redirect("/notes");
    });
  });
});

// !Login
// Show login form
app.get("/login", (req, res) => {
  res.render("login");
});
// Login Logic
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/notes",
    failureRedirect: "/login"
  }),
  (req, res) => {}
);

// !Logout
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

// !Index
app.get("/notes", isLoggedIn, (req, res) => {
  // Get all notes from db
  Note.find({ "author.id": req.user._id }, (err, allNotes) => {
    if (err) {
      console.log(err);
      console.log(err.message);
    } else {
      res.render("index", { notes: allNotes });
    }
  });
});

// !New Note
// Shows the form for note creation
app.get("/notes/new", isLoggedIn, (req, res) => {
  res.render("new");
});

// !Create Note
app.post("/notes", isLoggedIn, (req, res) => {
  var title = req.body.title,
    content = req.body.content,
    dateCreated = req.body.dateCreated,
    author = {
      id: req.user._id,
      username: req.user.username
    };

  var newNote = {
    title: title,
    content: content,
    dateCreated: dateCreated,
    author: author
  };

  // Create note and save to db
  Note.create(newNote, (err, newlyCreatedNote) => {
    if (err) {
      console.log(err);
      console.log(err.message);
    } else {
      res.redirect("/notes"); //get route
    }
  });
});

// !Edit Note
app.get("/notes/:noteId/edit", (req, res) => {
  Note.findById(req.params.noteId, (err, foundNote) => {
    res.render("edit", { note: foundNote });
  });
});

// !Update Note
app.put("/notes/:noteId", (req, res) => {
  Note.findByIdAndUpdate(
    req.params.noteId,
    req.body.note,
    (err, updatedNote) => {
      if (err) {
        console.log(err);
        console.log(err.message);
        res.redirect("/notes");
      } else {
        // redirect to index (notes page)
        res.redirect("/notes");
      }
    }
  );
});

// !Destroy Note
app.delete("/notes/:noteId", (req, res) => {
  Note.findByIdAndRemove(req.params.noteId, err => {
    if (err) {
      console.log(err);
      console.log(err.message);
      res.redirect("/notes");
    } else {
      res.redirect("/notes");
    }
  });
});
 
// !Server Port
var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Server Has Started!");
});

// !Middleware
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect("/login");
}

function checkNoteOwnership(req, res, next) {
  // if user logged in
  if (req.isAuthenticated()) {
    Note.findById(req.params.id, function(err, foundNote) {
      if (err) {
        console.log(err);
        res.redirect("back");
      } else {
        // does user own Note?
        if (foundNote.author.id.equals(req.user._id)) {
          next();
        } else {
          res.redirect("back");
        }
      }
    });
  } else {
    // if not, redirect
    res.redirect("back");
  }
}
