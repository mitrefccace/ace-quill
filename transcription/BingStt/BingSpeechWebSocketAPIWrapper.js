/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive, 
McLean, VA 22102-7539, (703) 983-6000.

                        ©2018 The MITRE Corporation.
*/

var socket = require('ws');
var uuid = require('uuid');
var events = require('events');
var util = require('util');

var nconf = require('nconf');
var decode = require('./../../utils/decode');



var WSHeader = require('./WebSocketHeader.js');
var wsHeader = new WSHeader();
var bingResp = require('./BingResponseMessageParser.js');

var defaultOptions = {
    format: 'simple',
    language: 'en-US'
};

var telemetry = {
    Metrics: [],
    ReceivedMessages: {
        turn__start: [],
        speech__startDetected: [],
        speech__hypothesis: [],
        speech__endDetected: [],
        speech__phrase: [],
        turn__end: []
    }
};

function InitializeTelemetry() {
    telemetry = {
        Metrics: [],
        ReceivedMessages: {
            turn__start: [],
            speech__startDetected: [],
            speech__hypothesis: [],
            speech__endDetected: [],
            speech__phrase: [],
            turn__end: []
        }
    };
}

function toArray(buffer) {
    return Array.prototype.slice.call(buffer);
}



class ApiWrapper {
    constructor(apimKey, options) {
        this.subscriptionKey = apimKey;
        Object.assign(options, defaultOptions);

        events.EventEmitter.call(this);
        this.inputStream = null;
        this.guid = '';
        this.countConn = 0;
        this.countChunk = 0;
        this.getFirstChunk = true;
        this.paused = true;
        this.wavHeader = null;
        this.io = null;

    };

    sendToSocketServer(item, isBinary, log) {
        if (log === true)
            console.log('[SendToSocketServer]' + item);
        this.io.send(item, {binary:isBinary}, (err) => {
            if (err) {
                console.log('[Exception][Send]' + err);
                this.paused = true;

                this.io.close();
                this.open();
            }
        });
    }



    recognize(inputBuffer) {
        telemetry.Metrics.push({
            Start: new Date().toISOString(),
            Name: 'Microphone',
            End: new Date().toISOString()
        });
        var header = wsHeader.StartSendingChunk(this.guid);
        var headerBuffer = new Buffer(header, 'binary');
        var dataBuffer = new Buffer(inputBuffer, 'binary');

        var dataToSendBuffer = Buffer.concat([new Buffer([header.length / 256, header.length % 256]), headerBuffer, dataBuffer]);
        var dataToSend = toArray(dataToSendBuffer);

        this.sendToSocketServer(dataToSend, true, false);

    }

    startDetection(inputStream) {
        this.inputStream = inputStream;
        var that = this;
        telemetry.Metrics.push({
            Start: new Date().toISOString(),
            Name: 'Microphone',
            End: new Date().toISOString()
        });

        this.inputStream.on('data', (audioBuffer) => {
            this.countChunk++;

            var msgHeader = wsHeader.StartSendingChunk(this.guid);
            var headerBuffer = new Buffer(msgHeader, 'binary');
            var headerSizeBuffer = new Buffer([msgHeader.length / 256, msgHeader.length % 256]);


            if (this.wavHeader === null) {
                this.wavHeader = Buffer.allocUnsafe(44);
                audioBuffer.copy(this.wavHeader, 0, 0, 44);
                var dataToSend = Buffer.concat([headerSizeBuffer, headerBuffer, audioBuffer]);
            } else {
                var dataToSend = Buffer.concat([headerSizeBuffer, headerBuffer, this.wavHeader, audioBuffer]);
            }
            
            if (!this.paused) {
                if (this.io.readyState !== this.io.OPEN) {
                    console.log("io.OPEN = " + this.io.OPEN);
                    this.getFirstChunk = true;
                } else {
                    this.getFirstChunk = false;            
                }
                that.sendToSocketServer(dataToSend, true, false);
            }
        });
        this.inputStream.on('end', function () {
            console.log('end');
        });
    }

    open() {
        var that = this;
        this.countConn++;

        console.log("ApiWrapper.prototype.open() " + this.countConn);

        this.guid = uuid.v4().replace(/-/g, '');
        //guid = guid.replace(/-/g, '');
        //conversation interactive dictation 
        var url = 'wss://speech.platform.bing.com/speech/recognition/conversation/cognitiveservices/v1?format=' + defaultOptions.format + '&language=' + defaultOptions.language + '&Ocp-Apim-Subscription-Key=' + this.subscriptionKey + '&X-ConnectionId=' + this.guid;

        const ProxyAgent = require('proxy-agent');

        let requestOptions = {};
        if(nconf.get('proxy') !== "undefined")        
            requestOptions.agent = new ProxyAgent(decode(nconf.get('proxy')))

        this.io = new socket(url, [], requestOptions);
        telemetry.Metrics.push({
            End: '',
            Id: this.guid,
            Name: "Connection",
            Start: new Date().toISOString()
        });

        this.io.on('message', (data) => {
            var msg = new bingResp();
            msg.parse(data);

            switch (msg.item('path')) {
                case 'turn.start':
                    telemetry.ReceivedMessages.turn__start.push(new Date().toISOString());
                    break;
                case 'speech.startDetected':
                    telemetry.ReceivedMessages.speech__startDetected.push(new Date().toISOString());
                    break;
                case 'speech.hypothesis': //result
                    telemetry.ReceivedMessages.speech__hypothesis.push(new Date().toISOString());
                    break;
                case 'speech.endDetected':
                    telemetry.ReceivedMessages.speech__endDetected.push(new Date().toISOString());
                    break;
                case 'speech.phrase':
                    telemetry.ReceivedMessages.speech__phrase.push(new Date().toISOString());
                    var body = JSON.parse(msg.item('body'));
                    this.emit('recognized', {
                        RecognitionStatus: body.RecognitionStatus,
                        DisplayText: body.DisplayText,
                        Guid: this.guid
                    });
                    break;
                case 'turn.end':
                    /*
                     * Connection has been closed. Rebuild the telemetry information and create a new guid.
                     * Failure to create a new guid causes the application to stop transcription.
                     * Guids must be unique for each connection.
                     */
                    telemetry.ReceivedMessages.turn__end.push(new Date().toISOString());
                    //respond with telemetry message
                    var ack = wsHeader.Telemetry(this.guid) + JSON.stringify(telemetry).replace(/__/g, '.');
                    this.guid = uuid.v4().replace(/-/g, ''); //Create new guid for future messages.
                    console.log("ack: " + ack);
                    this.sendToSocketServer(ack, false, false);
                    InitializeTelemetry();                    
                    break;
                default:
                    console.debug("message path: " + msg.item('path'))
                    break;
            }

            this.emit('data', data);
        });

        this.io.on('error', (err) => {
            console.log(err);
        });

        this.io.on('disconnect', () => {
            console.log("disconnect");
            this.emit('disconnect');
        });

        this.io.on('close', (code, reason) => {
            console.log("close code: " + code);
            console.log("close reason: " + reason);
            //self.emit('pauseStream');;
        });

        this.io.on('open', () => {
            try {
                var headers = wsHeader.SpeechConfig(this.guid);
                telemetry.Metrics[0].End = new Date().toISOString();
                that.sendToSocketServer(headers, false, true);
                this.emit('connect');
                this.paused = false;
                this.countChunk = 0;
            } catch (e) {
                console.log('-----------------');
                console.log('[Exception] ' + e);
                console.log('-----------------');
            }
        });

    };
}
util.inherits(ApiWrapper, events.EventEmitter);
module.exports = ApiWrapper;
