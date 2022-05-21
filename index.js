const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const port = process.env.PORT || 5000;
const app = express(); 


//middlewares 
app.use(cors()); 
app.use(express.json()); 


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://ignition:${process.env.DB_PASS}@cluster0.kfnt4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const run = async() =>{


    try{

        await client.connect();
        const database = client.db('ignition');
        const productCollection = database.collection('products');


        app.get('/products', async(req, res)=>{
            const query = {}
            const result = await productCollection.find(query).toArray();
            res.send(result);

        })



    }

    finally{



    }




}




run().catch(console.dir);






app.listen(port, ()=>{
    console.log('listening on port', port)
})