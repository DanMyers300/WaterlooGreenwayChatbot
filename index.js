"use strict";

const AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.Region
});
const pinpoint = new AWS.Pinpoint();
const lexV2 = new AWS.LexRuntimeV2();

var AppId = process.env.PinpointApplicationId;
var BotId = process.env.BotId;
var BotAliasId = process.env.AliasId;
var BotLocale = process.env.Locale;

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

exports.handler = (event, context)  => {
    /*
    * Event info is sent via the SNS subscription: https://console.aws.amazon.com/sns/home
    * 
    * - PinpointApplicationId is your Pinpoint Project ID.
    * - BotId: is your ID of you Bot.
    * - BotAliasId: is your Lex Bot alias ID.
    * - LocaleId: is your Lex Bot locale.
    * - SessionId: is the customer phone number.
    */
    console.log('Received event message: ' + event.Records[0].Sns.Message);
    var message = JSON.parse(event.Records[0].Sns.Message);
    var customerPhoneNumber = message.originationNumber;
    var chatbotPhoneNumber = message.destinationNumber;
    var request = message.messageBody.toLowerCase();
    var sessionId = customerPhoneNumber.replace("+", "");

    var params = {
        botId: BotId,
        botAliasId: BotAliasId,
        localeId: BotLocale,
        sessionId: sessionId,
        text: request
    };
    
    console.log('Params: ' + JSON.stringify(params, null, 2));
    
    
    var response = lexV2.recognizeText(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
        }
        else if (data != null) {
            console.log('Number of messages returned', data.messages.length)
            for (let i=1; i<=data.messages.length; i++) {
                const messageIndex = i-1;
                const message = data.messages[messageIndex].content;
                console.log("Lex response: " + message);
                
                sendResponse(customerPhoneNumber, chatbotPhoneNumber, message)
                // sleep(3500)
            }
        }
        else {
            console.log("Lex did not send a message back!");
        }
    });
}

function sendResponse(custPhone, botPhone, response) {
    var paramsSMS = {
        ApplicationId: AppId,
        MessageRequest: {
            Addresses: {
                [custPhone]: {
                    ChannelType: 'SMS'
                }
            },
            MessageConfiguration: {
                SMSMessage: {
                    Body: response,
                    MessageType: "TRANSACTIONAL",
                    OriginationNumber: botPhone
                }
            }
        }
    };
    pinpoint.sendMessages(paramsSMS, function (err, data) {
        if (err) {
            console.log("An error occurred.\n");
            console.log(err, err.stack);
        }
        else if (data['MessageResponse']['Result'][custPhone]['DeliveryStatus'] != "SUCCESSFUL") {
            console.log("Failed to send SMS response:");
            console.log(data['MessageResponse']['Result']);
        }
        else {
            console.log("Successfully sent response via SMS from " + botPhone + " to " + custPhone);
        }
    });
}
