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

const GrowingFile = require('growing-file');
const unpipe = require('unpipe');

const maxTimeoutForReconnect = 45000;
const growingFileOffset = -5000;
let speech = null;
let Speech = null;

function Google(file, languageCode, punctuation, v2, liveFile = true) {
  if(v2) {
    Speech = require('@google-cloud/speech').v2;
  } else {
    Speech = require('@google-cloud/speech');
  }
  speech = new Speech.SpeechClient();
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
      enableAutomaticPunctuation: punctuation,
      profanityFilter: false
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
    console.info('Clearing Google reconnection timer');
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
    console.info(`google started new stream because of ${reason}`);
    const gstream = that2.speechStream.call(that2, callback);
    that2.growingWav.pipe(gstream);
    that2.gfWavPolling = setTimeout(that2.reconnectStreams, maxTimeoutForReconnect,
      that2, 'timeout', callback);
  }
};

Google.prototype.speechStream = function speechstream(callback) {
  return speech.streamingRecognize(this.request)
    .on('error', (error) => {
      console.debug(`Google streaming recognize error: ${error}`);
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

          if (results.final) {
            console.info(JSON.stringify(data, null, 2));
            results.transcriptConfidence = data.results[0].alternatives[0].confidence;
            if(data.results[0].alternatives[0].words){
              for (let i = 0; i < data.results[0].alternatives[0].words.length; i += 1) {
                results.wordConfidence.push(data.results[0].alternatives[0].words[i].confidence);
              }
            }
            if (this.liveFile) this.reconnectStreams(this, 'final', callback);
          }
          this.lastResults = results;
          callback(results);
        }
      } else {
        console.error(`Error: ${JSON.stringify(data)}`);
        console.error('Stopping Google STT due to error');
        if (data.error.code === 11) {
          if (this.lastResults.final === false) {
            console.info('a FORCED final');
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
