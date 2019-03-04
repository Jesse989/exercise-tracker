const express = require('express');
const app = express();
const logger = require('morgan');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
// use .env file
require('dotenv').config();


// connect mongoose to mlab:
mongoose.connect(process.env.MONGO_URI);


// setup middleware:
app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: 'false'}));
app.use(bodyParser.json());


// mongoose setup
const Schema = mongoose.Schema;
const exerciseSchema = new Schema({
  description: String,
  duration: Number,
  date: {
    type: Date,
    default: Date.now()
  }
})
const personSchema = new Schema({
  username: String,
  exerciseLog: [Schema.ObjectId]
})

const Exercise = mongoose.model('Exercise', exerciseSchema);
const Person = mongoose.model('Person', personSchema);


// interact with db:
const addUser = async (username, done) => {
  const user = new Person({username});
  try {
    const savedUser = await user.save();
    done(null, savedUser);
  } catch (err) {
    done(err);
  }
}

// get userById:
const getUser = async (userId, done) => {
  try {
    const user = await Person.findById(userId);
    done(null, user);
  } catch (err) {
    done(err);
  }
}

//
const allUsers = async (done) => {
  try {
    const users = await Person.find();
    done(null, users);
  } catch (err) {
    done(err);
  }
}

//
const getUserAndLog = async (query) => {
  try {
    const user = await Person.findById(query.userId)
      .populate({
        path: 'exerciseLog',
        model: 'Exercise',
        match: {
          date: {
            $gt: query.from,
            $lt: query.to
          }
        },
        options: { limit: query.limit }
      });
    return user;
  } catch (err) {
    return err;
  }
}

//
const addExerciseToUser = async (config, userId, done) => {
  try {
    const entry = new Exercise(config);
    const savedEntry = await entry.save();
    await Person.findById(userId, (err, user) => {
      user.exerciseLog.push(savedEntry._id);
      user.save((err, updatedUser) => {
        if (err) return console.log("unables to save updated user: ", err);
        done(null, updatedUser)
      })
    });
  } catch (err) {
    done(err);
  }
}


// endpoints:
// create new user:
app.post('/api/exercise/new-user', (req, res) => {
  const username = req.body.username;
  const re = /[^A-Za-z0-9]+/g
  const notValid = username.match(re);
  if (notValid) return res.status(500).send({msg: "error, name not valid"});
  if (!username) return res.status(500).send('username invalid');
  // add user. throw error if unsuccesful.
  addUser(username, (err, data) => {
    if (err) return res.status(500).send(err);
    res.status(200).json({"username" : username, "_id": data._id})
  })
})

// fetch all users:
app.get('/api/exercise/users', (req, res) => {
  allUsers(function(err, users) {
    if (err) return console.error("error fetching users: ", err);
    res.status(200).json(users)
  })
})

// add exercise entry to log:
app.post('/api/exercise/add', (req, res) => {
  const description = req.body.description;
  const duration = req.body.duration;
  const date = (req.body.date) ? req.body.date : Date.now();
  // create entry:
  const config = {
    description,
    duration,
    date
  }

  const userId = req.body.userId;

  addExerciseToUser(config, userId, (err, updatedUser) => {
    if (err) return console.log("couldn't add exercise: ", err);
    res.status(200).json(updatedUser);
  })

})

// get exercise log for given user:
app.get('/api/exercise/log', async (req, res) => {
  try {
    const userAndLog = await getUserAndLog(req.query);
    const count = userAndLog.exerciseLog.length;
    return res.status(200).json({"user": userAndLog, "count": count});
  } catch (err) {
    return console.error("error fetching exercise log: ", err);
  }
})


app.get('/',  function (req, res) {
  res.sendFile(__dirusername + '/views/index.html');
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening to traffic on port ${listener.address().port}...`)
})
