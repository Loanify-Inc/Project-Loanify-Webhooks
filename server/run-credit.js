const mongoose = require('mongoose');
const User = require("./auth/auth.model");
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

exports.handler = async (event, context) => {
  await mongoose
    .connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => {
      console.log("Successfully connected to MongoDB.");
    })
    .catch(err => {
      console.error("Connection error", err);
      process.exit();
    });

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        message: "Method not allowed"
      }),
      headers: { "Access-Control-Allow-Origin": "*" }
    };
  }

  const body = JSON.parse(event.body)

  try {
    const user = await User.findOne({ email: body.email });

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "User Not found."
        }),
        headers: { "Access-Control-Allow-Origin": "*" }
      };
    }

    const passwordIsValid = bcrypt.compareSync(
      body.password,
      user.password
    );

    if (!passwordIsValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          accessToken: null,
          message: "Invalid Password!"
        }),
        headers: { "Access-Control-Allow-Origin": "*" }
      };
    }

    var token = jwt.sign({ id: user.id }, process.env.SECRET, {});

    return {
      statusCode: 200,
      body: JSON.stringify({
        _id: user._id,
        email: user.email,
        accessToken: token
      }),
      headers: { "Access-Control-Allow-Origin": "*" }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      }),
      headers: { "Access-Control-Allow-Origin": "*" }
    }
  }
}