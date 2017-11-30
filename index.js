'use strict';

const
    express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js'),
    natural_language_understanding = new NaturalLanguageUnderstandingV1({
        'username': 'a3774ef0-e8f3-4792-89a3-db50c3109b57',
        'password': 'mKRMFUpsqC4q',
        'version_date': '2017-11-29'
    }),
    app = express().use(bodyParser.json()); // creates express http server
    app.use(bodyParser.json());

let analyzeDone = false;

app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

app.post('/webhook', (req, res) => {

    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(function(entry) {

            // Gets the message. entry.messaging is an array, but will only ever contain one message, so we get index 0
            let webhookEvent = entry.messaging[0];

            let senderPSID = webhookEvent.sender.id;

            if (webhookEvent.message) {
                handleMessage(senderPSID, webhookEvent.message);
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }

});

app.get('/webhook', (req, res) => {

    let VERIFY_TOKEN = "myverifytoken";

    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            console.log('WEBHOOK_VERIFIED');

        } else {
            res.sendStatus(403);
        }
    }
});

function handleMessage(senderPSID, receivedMessage) {
    let responseMessage = "something gone wrong";

    if (receivedMessage.text) {
        let parameters = {
            'text': receivedMessage.text,
            'features': {
                'emotion': {
                    'targets': [
                        'day',
                        'mood',
                        'feel',
                        'life',
                        'everything',
                        'everyone',
                        'all',
                        'world'
                    ]
                }
            }
        };

        let emotions = [];
        if (!analyzeDone) {

            natural_language_understanding.analyze(parameters, function (err, response) {
                if (err) {
                    responseMessage = {"text": err.error};
                    callSendAPI(senderPSID, responseMessage);
                }
                else {
                    analyzeDone = true;

                    emotions = response.emotion.document.emotion;

                    let maxEmotionValue = Math.max.apply(null, Object.keys(emotions).map(function (em) {
                        return emotions[em]
                    }));
                    let maxEmotion = Object.keys(emotions).filter(function (x) {
                        return emotions[x] == maxEmotionValue;
                    })[0];

                    responseMessage = {"text": "I think you feel " + maxEmotion + " now, am I right?"};
                    callSendAPI(senderPSID, responseMessage);
                }

            });
        }
        else {
            analyzeDone = false;

            responseMessage = {"text": "Please tell me about your day again"};
            callSendAPI(senderPSID, responseMessage);
            }
        }
}

function callSendAPI(senderPSID, response) {
    let requestBody = {
        "recipient": {
            "id": senderPSID
        },
        "message": response
    };

    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": requestBody
    }, (err) => {
        if (!err) {
            console.log('message sent!')
        }
        else {
            console.error("Unable to send message:" + err);
        }
    });
}
