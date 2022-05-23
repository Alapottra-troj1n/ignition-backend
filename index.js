const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');

//middlewares 
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://ignition:${process.env.DB_PASS}@cluster0.kfnt4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//JWT Verify
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message : 'unauthorized access'});
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message : 'forbidden access'})
        }
        req.decoded = decoded;
        next();


    });
}




const run = async () => {


    try {

        await client.connect();
        const database = client.db('ignition');
        const productCollection = database.collection('products');
        const userCollection = database.collection('users');
        const reviewCollection = database.collection('reviews');
        const orderCollection = database.collection('orders');

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });

        })


        app.get('/products', async (req, res) => {
            const query = {};
            const result = await productCollection.find(query).toArray();
            res.send(result);

        })
        app.get('/reviews', async (req, res) => {
            const query = {};
            const result = await reviewCollection.find(query).toArray();
            res.send(result);

        })
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id:ObjectId(id)}
            const results = await productCollection.findOne(query);
            res.send(results);

        })

        //order 
        app.post('/addorder', async (req, res) => {
            const order = req.body;
            const productName = order.product;
            const filter = {name:productName}
            const orderProduct = await productCollection.findOne(filter);
            const updatedQuantity = orderProduct.availableQuantity - order.quantity;
            const updatedDoc = {
                $set: {
                    availableQuantity: updatedQuantity
                }
            };
            const updatedResult = await productCollection.updateOne(filter, updatedDoc);

            const result = await orderCollection.insertOne(order);
            res.send(result);

        })
        app.get('/myorders',verifyJWT, async (req, res) => {
            const decoded = req.decoded.email;
            const email = req.query.email;
            if(decoded !== email){
                return res.status(401).send({message: 'forbidden access'})
            }
            
            const query = {email : email}
            const result = await orderCollection.find(query).toArray();
            res.send(result);

        })
        
        //delete a order 
        app.delete('/order/:id',async(req,res) => {
            const orderId = req.params.id;
            console.log(orderId);
            const query = {_id: ObjectId(orderId)};
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })

        //add a review
        app.post('/addreview', async(req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })



    }

    finally {



    }




}




run().catch(console.dir);






app.listen(port, () => {
    console.log('listening on port', port)
})