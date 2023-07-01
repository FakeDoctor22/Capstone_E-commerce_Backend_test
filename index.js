const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Stripe = require("stripe");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

dotenv.config();
const PORT = process.env.PORT || 8080;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// MongoDB connection
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.log(err));

// Schema
const userSchema = mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: {
      type: String,
      unique: true,
    },
    password: String,
    confirmPassword: String,
  },
  { timestamps: true }
);

const userModel = mongoose.model("user", userSchema);

// API routes
app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/api/users", (_req, res) => {
  userModel.find({}, (err, users) => {
    if (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
    return res.json(users);
  });
});

app.post("/signup", async (req, res) => {
  const { email } = req.body;

  userModel.findOne({ email }, (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Internal server error", alert: false });
    }

    if (result) {
      return res.json({ message: "Email id is already registered", alert: false });
    } else {
      const data = userModel(req.body);
      data.save();
      return res.json({ message: "Successfully signed up", alert: true });
    }
  });
});

app.post("/login", (req, res) => {
  const { email } = req.body;

  userModel.findOne({ email }, (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Internal server error", alert: false });
    }

    if (result) {
      const { _id, firstName, lastName, email } = result;
      const dataSend = { _id, firstName, lastName, email };

      return res.json({ message: "Successfully logged in", alert: true, data: dataSend });
    } else {
      return res.json({ message: "Email is not available, please sign up", alert: false });
    }
  });
});

// Product section
const schemaProduct = mongoose.Schema({
  name: String,
  category: String,
  image: String,
  price: String,
  description: String,
});
const productModel = mongoose.model("product", schemaProduct);

app.post("/uploadProduct", async (req, res) => {
  const data = await productModel(req.body);
  data.save();
  res.send({ message: "Upload successful" });
});

app.get("/product", async (_req, res) => {
  const data = await productModel.find({});
  res.send(JSON.stringify(data));
});

// Payment gateway
app.post("/create-checkout-session", async (req, res) => {
  try {
    const params = {
      submit_type: "pay",
      mode: "payment",
      payment_method_types: ["card"],
      billing_address_collection: "auto",
      shipping_options: [{ shipping_rate: "shr_1N0qDnSAq8kJSdzMvlVkJdua" }],
      line_items: req.body.map((item) => {
        return {
          price_data: {
            currency: "inr",
            product_data: {
              name: item.name,
            },
            unit_amount: item.price * 100,
          },
          adjustable_quantity: {
            enabled: true,
            minimum: 1,
          },
          quantity: item.qty,
        };
      }),
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    };

    const session = await stripe.checkout.sessions.create(params);
    res.status(200).json(session.id);
  } catch (err) {
    res.status(err.statusCode || 500).json(err.message);
  }
});

// Server is running
app.listen(PORT, () => console.log("Server is running at port: " + PORT));
