const Speech = require('@google-cloud/speech');
const GrowingFile = require('growing-file');
const unpipe = require('unpipe');

const speech = new Speech.SpeechClient();
const maxTimeoutForReconnect = 45000;
const growingFileOffset = -5000;

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

function Google(file, languageCode, liveFile = true) {
  this.file = file;
  this.gfWavPolling = null;
  this.growingWav = null;
  this.lastResults = {};
  this.liveFile = liveFile;
  this.request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode,
      useEnhanced: true,
      model: 'phone_call',
      enableWordTimeOffsets: true,
      enableWordConfidence: true,
    },
    interimResults: true,
    verbose: true,
  };
}

Google.prototype.start = function start(callback) {
  this.done = false;
  this.growingWav = GrowingFile.open(this.file,
    {
      timeout: maxTimeoutForReconnect + growingFileOffset,
      interval: 100,
    });
  this.growingWav.pipe(this.speechStream(callback));
  this.gfWavPolling = setTimeout(this.reconnectStreams, maxTimeoutForReconnect, this,
    'timeout', callback);

  this.growingWav.on('end', () => {
    info.info('clearing reconnection timer');
    clearTimeout(this.gfWavPolling);
    this.done = true;
    callback({ end: true });
  });
};

Google.prototype.reconnectStreams = function reconnectstreams(that, reason, callback) {
  const that2 = that;
  clearTimeout(that.gfWavPolling);
  unpipe(that.growingWav);
  if (!that2.done) {
    info.info(`google started new stream because of ${reason}`);
    const gstream = that2.speechStream.call(that2, callback);
    that2.growingWav.pipe(gstream);
    that2.gfWavPolling = setTimeout(that2.reconnectStreams, maxTimeoutForReconnect,
      that2, 'timeout', callback);
  }
};

Google.prototype.speechStream = function speechstream(callback) {
  return speech.streamingRecognize(this.request)
    .on('error', (error) => {
      debug.debug(`Google Error: ${error}`);
      debug.debug('What should I do?');
    })
    .on('data', (data) => {
      if (!data.error) {
        clearTimeout(this.gfWavPolling);
        if (data.results[0]) {
          const results = {
            transcript: data.results[0].alternatives[0].transcript,
            final: data.results[0].isFinal,
            timestamp: new Date(),
            raw: JSON.stringify(data),
            wordConfidence: [],
            transcriptConfidence: [],
          };

          // console.log("transcript:",data.results[0].alternatives[0].transcript)
          // console.log("stability: ",data.results[0].stability)
          if (results.final) {
            info.info(JSON.stringify(data, null, 2));
            results.transcriptConfidence = data.results[0].alternatives[0].confidence;
            if (this.liveFile) this.reconnectStreams(this, 'final', callback);
          }
          this.lastResults = results;
          callback(results);
        }
      } else {
        error.error(`Error: ${JSON.stringify(data)}`);
        error.error('Stopping Google STT due to error');
        if (data.error.code === 11) {
          if (this.lastResults.final === false) {
            info.info('a FORCED final');
            this.lastResults.final = true;
            callback(this.lastResults);
          }
          if (this.liveFile) this.reconnectStreams(this, 'Restartable Error', callback);
        } else {
          this.done = true;
        }
      }
    });
};

module.exports = Google;
/*
process.env.GOOGLE_APPLICATION_CREDENTIALS=process.cwd() + "/../configs/google/google.json";
var test1 = new Google('../public/sounds/rain_in_spain.wav', "en-US");
//var test1 = new Google('./../../../../../../Desktop/onesideConvoSpanish.wav', "es-US");
test1.start(function(data){
    console.log(data.transcript)
});
*/
