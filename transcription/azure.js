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

const sdk = require('microsoft-cognitiveservices-speech-sdk');
const GrowingFile = require('growing-file');

// Max size of a single wav file byte buffer
// One of these packets is 32,768 bytes, i.e. 16,384 samples in pc16 mono wav
const MAX_BUFFER_LENGTH = 32768;

function Azure(configs) {
  this.file = configs.file;
  this.key = configs.key;
  this.location = configs.location;
  this.proxy = configs.proxy;
  this.proxy_port = configs.proxy_port;
  this.language = configs.language;

  this.enableDropoutSimulation = configs.stt_dropout_enabled && configs.stt_dropout_interval && configs.stt_dropout_length_min && configs.stt_dropout_length_min;
  if(this.enableDropoutSimulation){
    // Dropout interval in whole seconds, dropout length in whole milliseconds, where 100 < x < 1000
    this.dropoutIntervalSecs = configs.stt_dropout_interval;
    // Assuming pc16 mono wav at 16000hz sample rate, one packet is 1.024 seconds.
    // To make things easier, we will assume 2 bytes = 1 sample, and 16 samples == 1 ms, and 1 packet == 1 second
    this.dropoutLengthMinBytes = configs.stt_dropout_length_min * 16 * 2;
    this.dropoutLengthMaxBytes = configs.stt_dropout_length_max * 16 * 2;
    this.dropoutLengthRangeBytes = this.dropoutLengthMaxBytes - this.dropoutLengthMinBytes;
    this.dropoutMaxOffset = MAX_BUFFER_LENGTH - this.dropoutLengthMaxBytes;
  }
}

Azure.prototype.start = function start(callback) {
  const pushStream = sdk.AudioInputStream.createPushStream();
  const gf = GrowingFile.open(this.file, {
    timeout: 25000,
    interval: 100,
  });

  if(!this.enableDropoutSimulation) {
    gf.on('data', (data) => {
      pushStream.write(data);
    }).on('end', () => {
      console.info('AZURE TRANSCRIPTION FILE HAS ENDED');
      pushStream.close();
      callback({ end: true });
    });
  }
  else {
    var dataBufferCount = 0;
    gf.on('data', (data) => {
      dataBufferCount++;
      // Avoid first couple of buffers which contain the header
      if (dataBufferCount > 2){
        // Again, assuming the number of buffers == number of seconds elapsed
        // Also, ignore buffers smaller than 32,768, which is probably only the first and last buffer of the call anyway
        if((dataBufferCount % this.dropoutIntervalSecs == 0) && data.length === MAX_BUFFER_LENGTH){
          // Fill with zeros from a random start to (start + min length + random(0...(max-min)) bytes
          var start = Math.floor(Math.random() * this.dropoutMaxOffset);
          var end = start + this.dropoutLengthMinBytes + Math.floor(Math.random() * this.dropoutLengthRangeBytes);
          data.fill(0, start, end);
        }
      }
      pushStream.write(data);
    }).on('end', () => {
      console.info('AZURE TRANSCRIPTION FILE HAS ENDED');
      pushStream.close();
      callback({ end: true });
    });
  }

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
    console.info('Azure session stopped');
    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync();
};

module.exports = Azure;
