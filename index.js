require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const cors = require("cors");

const admin = require("firebase-admin");

const serviceAccount = require("./smart-deals-firebase-admi-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// console.log(process.env)

const logger = (req, res, next) => {
  console.log("logging information");
  next();
};

const verifyFireBaseToken = async(req, res, next) => {
  console.log("in the verify middlewear", req.headers.authorization);

  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorised access" });
  }

  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorised access" });
  }

  try {
   const userInfo= await admin.auth()  .verifyIdToken(token) 
   req.token_email=userInfo.email;
   console.log('after token validation',userInfo)
      next(); 
  } catch  {
        return res.status(401).send({ message: "unauthorised access" });

    
  }



  //verify id token


};

//MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(logger);

// const uri =
//   "mongodb+srv://smartdbUser:JdCAvdc3VFO3NlGV@cluster0.bsfywqv.mongodb.net/?appName=Cluster0";

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bsfywqv.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("smart server is running");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("smart_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");
    const usersCollection = db.collection("users");

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    //////////////////////////
    // products related apis
    /////////////////////////

    app.get("/products", async (req, res) => {
      try {
        // const projectFields={title:1}
        // const cursor = productsCollection.find().sort({price_min:1}).skip(2).limit(5).project(projectFields);
        console.log(req.query);
        const email = req.query.email;
        const query = {};
        if (email) {
          query.email = email;
        }

        const cursor = productsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).send("Failed to fetch products");
      }
    });

    //latest products api
    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const product = await productsCollection.findOne(query);

      res.send(product);
    });

    app.post("/products", async (req, res) => {
      try {
        const newProduct = req.body;
        const result = await productsCollection.insertOne(newProduct);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Failed to insert product");
      }
    });

    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      };

      const result = await productsCollection.updateOne(query, update);

      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    //bid by product
    app.get("/products/bids/:productId", verifyFireBaseToken,async (req, res) => {
      const productId = req.params.productId;
      const query = { product: productId };
      const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    //bid by user
    // app.get("/bids", async (req, res) => {
    //   const query = {};
    //   if (query.email) {
    //     query.buyer_email = email;
    //   }
    //   const cursor = bidsCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    //////////////////////////
    // bids related apis
    /////////////////////////

    //GET a bid or all bid
    app.get("/bids", logger, verifyFireBaseToken, async (req, res) => {
      console.log("headers:", req.headers); // should now show Authorization
      const email = req.query.email; // match frontend
      const query = {};
      console.log(`query`,query)

      if (email) {
        if (email!==req.token_email) {
          return res.status(403).send({message:'forbidden'})
          
        }
        query.buyer_email = email; // match your DB field
      }

      const cursor = bidsCollection.find(query);
      const result = await cursor.toArray();
      console.log(result)
      res.send(result);
    });

    // POST a new bid
    app.post("/bids", async (req, res) => {
      try {
        const newBid = req.body;
        const result = await bidsCollection.insertOne(newBid);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Failed to insert bid");
      }
    });

    // PATCH (update) a bid
    app.patch("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const updatedBid = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          bid_price: updatedBid.bid_price,
          status: updatedBid.status,
        },
      };

      const result = await bidsCollection.updateOne(query, update);
      res.send(result);
    });

    // DELETE a bid
    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.listen(port, () => {
      console.log(`smaert server is running on port ${port}`);
    });
  } catch (err) {
    console.error("Error in run():", err);
  } finally {
  }
}
run().catch(console.dir);
