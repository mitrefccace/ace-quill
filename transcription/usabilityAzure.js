/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number 75FCMC18D0047/75FCMC23D0004, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

                        ©2024 The MITRE Corporation.
*/

const fs = require('fs');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const GrowingFile = require('growing-file');

function UsabilityAzure(configs, docLocation) {
  this.file = configs.file;
  this.key = configs.key;
  this.location = configs.location;
  this.proxy = configs.proxy;
  this.proxy_port = configs.proxy_port;
  this.language = configs.language;
  this.docLocation = docLocation;
}

UsabilityAzure.prototype.start = function start(callback) {
  const pushStream = sdk.AudioInputStream.createPushStream();

  const gf = GrowingFile.open(this.file, {
    timeout: 25000,
    interval: 100,
  });

  gf.on('data', (data) => {
    pushStream.write(data);
  }).on('end', () => {
    console.info('AZURE FILE HAS ENDED');
    pushStream.close();
    callback({ end: true });
  });

  // We are done with the setup
  console.info(`Azure now recognizing from: ${this.file}`);

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
  speechConfig.setProfanity(sdk.ProfanityOption.Raw);

  // Create the speech recognizer.
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  recognizer.recognized = (s, e) => {
    if (e.result.text) {
      const r = JSON.parse(
        e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult),
      );
      const confidence = Math.trunc(r.NBest[0].Confidence * 100) 
      const text = e.result.text;
      const time = new Date(e.result.offset / 10000).toISOString().slice(11, 19);
      fs.appendFileSync(this.docLocation, `${time} - ${text}(${confidence}%)\n` + `-----------------\n` );
    }
  };

  recognizer.canceled = (s, e) => {
    console.error(`Azure Transcription CANCELED: Reason=${e.reason}`);
    // ERROR is 0, EndOfStream is 1
    if (e.reason === 0) {
      console.error(`"CANCELED: ErrorCode=${e.errorCode}`);
      console.error(`"CANCELED: ErrorDetails=${e.errorDetails}`);
    }
    recognizer.stopContinuousRecognitionAsync();
    recognizer.close();
  };

  recognizer.sessionStopped = () => {
    console.info('\n    Session stopped event.');
    recognizer.stopContinuousRecognitionAsync();
    callback({ end: true });
  };

  recognizer.startContinuousRecognitionAsync();
};

module.exports = UsabilityAzure;
