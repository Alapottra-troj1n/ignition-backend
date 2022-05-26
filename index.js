const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_KEY);

//middlewares 
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://ignition:${process.env.DB_PASS}@cluster0.kfnt4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//JWT Verify
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
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
        const paymentCollection = database.collection('payments');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            console.log(requester);
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.isAdmin === true) {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }





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
            const query = { _id: ObjectId(id) }
            const results = await productCollection.findOne(query);
            res.send(results);

        })

        //order 
        app.post('/addorder', async (req, res) => {
            const order = req.body;
            const productName = order.product;
            const filter = { name: productName }
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
        app.get('/myorders', verifyJWT, async (req, res) => {
            const decoded = req.decoded.email;
            const email = req.query.email;
            if (decoded !== email) {
                return res.status(401).send({ message: 'forbidden access' })
            }

            const query = { email: email }
            const result = await orderCollection.find(query).toArray();
            res.send(result);

        })

        //delete a order 
        app.delete('/order/:id', async (req, res) => {
            const orderId = req.params.id;
            console.log(orderId);
            const query = { _id: ObjectId(orderId) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })

        //add a review
        app.post('/addreview', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })
        //get user
        app.get('/getuser', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decoded = req.decoded.email;

            if (email !== decoded) {
                return res.status(401).send({ message: 'access denied' })

            } else {
                const query = { email: email };
                const result = await userCollection.findOne(query);
                res.send(result);
            }

        })


        app.put('/updateprofile', verifyJWT, async (req, res) => {

            const email = req.query.email;
            const decoded = req.decoded.email;
            const moreDetails = req.body;

            if (email !== decoded) {
                return res.status(401).send({ message: 'forbidden access' })
            } else {

                const filter = { email: email };
                const options = { upsert: false };

                const updatedDoc = {
                    $set: {
                        moreDetails
                    }
                };

                const result = await userCollection.updateOne(filter, updatedDoc, options);
                res.send(result);

            }



        })

        //admin routes 


        //manage all orders
        app.get('/allorders', verifyJWT, verifyAdmin, async (req, res) => {

            const email = req.query.email;
            const decoded = req.decoded.email;
            if (email !== decoded) {
                return res.status(401).send({ message: 'access denied' })
            } else {

                const query = {};
                const result = await orderCollection.find(query).toArray();
                res.send(result);

            }

        })

        //add a product
        app.post('/addproduct', verifyJWT, verifyAdmin, async (req, res) => {

            const email = req.query.email;

            const decoded = req.decoded.email;
            if (email !== decoded) {
                return res.status(401).send({ message: 'access denied' })
            } else {

                const product = req.body;
                const result = await productCollection.insertOne(product);
                res.send(result);

            }

        })

        //get all users
        app.get('/allusers', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const decoded = req.decoded.email;
            if (email !== decoded) {
                return res.status(401).send({ message: 'access denied' })
            } else {
                const query = { isAdmin: undefined }
                const result = await userCollection.find(query).toArray();
                res.send(result);



            }



        })

        //make admin
        app.put('/makeadmin', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const decoded = req.decoded.email;
            const adminEmail = req.body.adminEmail;
            if (adminEmail !== decoded) {
                return res.status(401).send({ message: 'access denied' })
            } else {


                const filter = { email: email };
                const options = { upsert: false };

                const updatedDoc = {
                    $set: {
                        isAdmin:true
                    }
                };

                const result = await userCollection.updateOne(filter, updatedDoc, options);
                res.send(result);

            }


        })

        //get all products 
        app.get('/allproducts', verifyJWT, verifyAdmin, async (req, res) =>{
            const email = req.query.email;
            const decoded = req.decoded.email;
            if(email !== decoded){
                return res.status(401).send({ message: 'access denied' })
            }else{

                const query = {}
                const result = await productCollection.find(query).toArray();
                res.send(result);

            }

        })

        //get a specific order 
        app.get('/order/payment/:id',async(req, res) =>{
            const id = req.params.id;
            const query = { _id: ObjectId(id)};
            const result = await orderCollection.findOne(query);
            res.send(result);


        })



        //stripe
        app.post('/create-payment-intent',verifyJWT, async (req, res)=>{
            const price = req.body.price;
            const amount = price * 100;
            if(amount){
                const paymentIntent = await stripe.paymentIntents.create({
                    amount : parseInt(amount),
                    currency : 'usd',
                    payment_method_types:['card']
                });
                res.send({clientSecret : paymentIntent.client_secret})

            }
          


        })


        app.patch('/order/:id',verifyJWT, async (req, res)=>{
            const id = req.params.id;
            const payment = req.body;
            const query = { _id: ObjectId(id)};
            const updatedDoc = {
                $set:{
                    paid:true,
                    transactionId: payment.transactionId
                }
            }
            const updatedOrder = await orderCollection.updateOne(query, updatedDoc)
            const result = await paymentCollection.insertOne(payment);
            res.send(updatedOrder);


        })

        //delete a product 
        app.delete('/product/:id',verifyJWT, verifyAdmin, async(req, res)=>{
            const id = req.params.id;
            const query = { _id: ObjectId(id)}
            const result = await productCollection.deleteOne(query);
            res.send(result)


        })

        //ship
        app.put('/ship/:id', verifyJWT, async(req, res)=>{

            const id = req.params.id;
            const status = req.body.status;
            console.log(status)
            const query = {_id: ObjectId(id)}
            const updatedDoc = {
                $set:{
                   status
                }
            }
            const updatedOrder = await orderCollection.updateOne(query, updatedDoc)
            res.send(updatedOrder);


        })
        










    }

    finally {



    }




}




run().catch(console.dir);






app.listen(port, () => {
    console.log('listening on port', port)
})