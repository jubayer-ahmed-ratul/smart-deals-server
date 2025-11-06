const { MongoClient, ObjectId } = require("mongodb");

const uri =
  "mongodb+srv://smartdbUser:JdCAvdc3VFO3NlGV@cluster0.bsfywqv.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri);

async function migrate() {
  try {
    await client.connect();
    const db = client.db("smart_db");
    const productsCollection = db.collection("products");

    const products = await productsCollection.find().toArray();

    for (const product of products) {
      // Skip if _id is already ObjectId
      if (ObjectId.isValid(product._id) && product._id.length === 24) continue;

      const newId = new ObjectId(); // generate new ObjectId
      const {_id, ...rest} = product;

      // Insert a new document with new ObjectId
      await productsCollection.insertOne({ _id: newId, ...rest });

      // Remove old document
      await productsCollection.deleteOne({ _id });
      console.log(`Migrated product ${_id} -> ${newId}`);
    }

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.close();
  }
}

migrate();
