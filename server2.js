const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const mongo = require("mongodb");
const sgMail = require('@sendgrid/mail')
const app = express();
const port = 3000;
let realDB;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

const mongo_uri = "mongodb://127.0.0.1:27017";

MongoClient.connect(mongo_uri, { useNewUrlParser: true, useUnifiedTopology: true, poolSize: 10 })
    .then(async(client) => {
        const db = client.db('db');
        realDB = db.collection('real');
        app.listen(port, console.log(`Server running on port ${port}`));
        sendMails();
    }).catch(error => console.error(error));

app.get("/read", async(req, res) => {
    try {
        const result = await realDB.find().toArray();
        console.log(result)
        return res.json(result);
    } catch (err) {
        console.log(err);
        return res.status(404);
    }
})

app.post("/create", async(req, res) => {
    let body = req.body;
    req.body.sent = 'notyet'
    body.time = new Date(body.time)
    try {
        const result = await realDB.insertOne(body);
        console.log(result.ops)
        return res.json(result.ops);
    } catch (err) {
        console.log(err);
        return res.status(404);
    }
})

app.put("/update", async(req, res) => {
    let body = req.body;
    req.body.sent = 'notyet'
        //console.log(body)
    let update = {
        $set: {
            time: new Date(body.time),
            email: body.email,
            content: body.content
        }
    }
    let query = { "_id": mongo.ObjectID(body._id) }
    try {
        const result = await realDB.updateOne(query, update);
        console.log(result)
        return res.json({ "Modified": result.result.nModified });
    } catch (err) {
        console.log(err);
        return res.status(404);
    }
})

app.delete("/delete", async(req, res) => {
    let id = req.body._id;
    let query = { "_id": mongo.ObjectID(id) }
    try {
        const result = await realDB.deleteOne(query);
        return res.json(result.ops);
    } catch (err) {
        console.log(err);
        return res.status(404);
    }
})

app.get("/failed", async(req, res) => {
    try {
        const result = await realDB.find({ sent: 'failed' }).toArray();
        return res.json(result);
    } catch (err) {
        console.log(err);
        return res.status(404);
    }
})

app.get("/unsent", async(req, res) => {
    let unsent = []
    try {
        const result = await realDB.find().toArray();
        for (let i in result) {
            let eTime = new Date(result[i].time)
            let now = new Date();
            now = now.getTime() / 60000 | 0
            eTime = eTime.getTime() / 60000 | 0
            if (now < eTime) {
                unsent.push(result[i])
            }
        }
        return res.json(unsent);
    } catch (err) {
        console.log(err);
        return res.status(404);
    }
})

async function sendMails() {
    let result;
    try {
        result = await realDB.find().toArray();
        for (let i in result) {
            let eTime = new Date(result[i].time)
            console.log(eTime.getDate())

            let content = result[i].content
            let now = new Date();

            now = now.getTime() / 60000 | 0
            eTime = eTime.getTime() / 60000 | 0

            if (now == eTime) {
                sgMail.setApiKey('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')

                const msg = {
                    to: result[i].email,
                    from: 'boddu.manikanta.raju@gmail.com',
                    subject: 'Sending mail with SendGrid',
                    text: JSON.stringify(result[i].content),
                    html: '<strong>Node.js Test</strong>',
                }
                sgMail
                    .send(msg)
                    .then(() => {
                        console.log('Email sent')
                        result[i].sent = 'sent'
                        console.log(result[i])
                    })
                    .catch(async(error) => {
                        let email = result[i].email
                            //result[i].sent = 'failed'
                        const body = { "time": eTime, "content": content, "email": email, "sent": "failed" }
                        try {
                            await realDB.insertOne(body);
                        } catch (err) {
                            console.log(err);
                        }
                        console.log(error)
                    })
            }
        }
    } catch (err) {
        console.log(err);
    }
    setTimeout(sendMails, 60000)
}
