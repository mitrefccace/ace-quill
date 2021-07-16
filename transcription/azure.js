// Pull in the required packages.
const sdk = require('microsoft-cognitiveservices-speech-sdk');
// const fs = require('fs');
const GrowingFile = require('growing-file');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

function Azure(configs) {
  this.file = configs.file;
  this.key = configs.key;
  this.location = configs.location;
  this.proxy = configs.proxy;
  this.proxy_port = configs.proxy_port;
  this.language = configs.language;
}

Azure.prototype.start = function start(callback) {
  const pushStream = sdk.AudioInputStream.createPushStream();

  const gf = GrowingFile.open(this.file, {
    timeout: 25000,
    interval: 100,
  });

  gf.on('data', (data) => {
    pushStream.write(data);
  }).on('end', () => {
    info.info('AZURE FILE HAS ENDED');
    pushStream.close();
    callback({ end: true });
  });

  // We are done with the setup
  info.info(`Azure now recognizing from: ${this.file}`);

  // Create the audio-config pointing to our stream and
  // the speech config specifying the language.
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const speechConfig = sdk.SpeechConfig.fromSubscription(this.key, this.location);

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

  if (this.proxy) speechConfig.setProxy(this.proxy, this.proxy_port);

  // Setting the recognition language.
  speechConfig.speechRecognitionLanguage = this.language;
  speechConfig.outputFormat = 1; // detailed == 1; give much more data
  speechConfig.requestWordLevelTimestamps();
  speechConfig.setServiceProperty('wordLevelConfidence', true, sdk.UriQueryParameter);
  // peechConfig.setServiceProperty("format", "detailed", sdk.UriQueryParameter);

  // Create the speech recognizer.
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  // Before beginning speech recognition, setup the callbacks to be invoked when an event occurs.

  // The event signals that the service has stopped processing speech.
  // https://docs.microsoft.com/javascript/api/microsoft-cognitiveservices-speech-sdk/speechrecognitioncanceledeventargs?view=azure-node-latest
  // This can happen for two broad classes of reasons.
  // 1. An error is encountered.
  //    In this case the .errorDetails property will contain a textual representation of the error.
  // 2. Speech was detected to have ended.
  //    This can be caused by the end of the specified file being reached,
  // or ~20 seconds of silence from a microphone input.

  recognizer.recognizing = (s, e) => {
    if (e.result.text) {
      const results = {
        id: e.result.privResultId,
        transcript: e.result.text,
        final: false,
        timestamp: new Date(),
        raw: JSON.stringify(e),
        transcriptConfidence: [],
        wordConfidence: [],
      };
      callback(results);
    }
  };

  recognizer.recognized = (s, e) => {
    if (e.result.text) {
      const r = JSON.parse(
        e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult),
      );
      const results = {
        id: e.result.privResultId,
        transcript: e.result.text,
        final: true,
        timestamp: new Date(),
        raw: JSON.stringify(e),
        transcriptConfidence: r.NBest[0].Confidence,
        wordConfidence: [],
      };
      for (let i = 0; i < r.NBest[0].Words.length; i += 1) {
        results.wordConfidence.push(r.NBest[0].Words[i].Confidence);
      }
      callback(results);
    }
  };

  recognizer.canceled = (s, e) => {
    error.error(`CANCELED: Reason=${e.reason}`);

    let CancellationReason;

    if (e.reason === CancellationReason.Error) {
      error.error(`"CANCELED: ErrorCode=${e.errorCode}`);
      error.error(`"CANCELED: ErrorDetails=${e.errorDetails}`);
    }

    recognizer.stopContinuousRecognitionAsync();
    recognizer.close();
  };

  recognizer.sessionStopped = () => {
    info.info('\n    Session stopped event.');
    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync();
};

module.exports = Azure;
