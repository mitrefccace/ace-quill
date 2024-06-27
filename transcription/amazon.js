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
const { PassThrough } = require('stream');
const { getAWSConfig } = require('../utils/aws-config');
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require("@aws-sdk/client-transcribe-streaming");

const eventStreamConsume = async function(stream, callback, that){
  try{
    for await (const event of stream) {
      if (event.TranscriptEvent) {
        const results = event.TranscriptEvent.Transcript.Results;
        for(var result of results){
          for(var alternative of result.Alternatives){
            const response = {
              transcript: alternative.Transcript,
              final: !result.IsPartial,
              timestamp: new Date(),
              raw: JSON.stringify(result),
              wordConfidence: []
            };
            // 'Items' is the individual words and confidences
            if(alternative.Items){
              for (let i = 0; i < alternative.Items.length; i += 1) {
                if(alternative.Items[i].Type != "punctuation") {
                  response.wordConfidence.push((alternative.Items[i].Confidence  || 1 ));
                }
              }
            }
            callback(response);
          }
        }
      }
    }
  }
  catch(err){
    // The connection will time out if it receives no data for 15 seconds
    console.info('Connection to AWS STT has timed out');
    that.timedOut = true;
  }
}

function Amazon(config) {
  console.log('AMAZON STT ACTIVE');
  // Using a custom proxy is currently broken ( @aws-sdk/client-transcribe-streaming version 3.342.0 ), probably because this is a websocket based streaming service
  // Hopefully this is fixed one day, and this code can be uncommented
  // let transcribeConfig = getAWSConfigWithProxy();
  let transcribeConfig = getAWSConfig();
  this.Transcribe = new TranscribeStreamingClient(transcribeConfig);
  this.file = config.file;
  this.language = config.language;
  this.sampleRate = 16000;
  this.commandInput = {
    LanguageCode: this.language,
    MediaSampleRateHertz: this.sampleRate,
    MediaEncoding: "pcm",
    EnablePartialResultsStabilization: true, // Enabling to make transcription faster
    PartialResultsStability:  "medium", // Set this to 'medium' or 'low' for worse results a little faster
    AudioStream: audioStream(),
    // Specifying 1 channel caused an error for some reason, maybe will be fixed in the future
    // NumberOfChannels: 1
  };
  this.timedOut = false;
}

const audioPayloadStream = new PassThrough();
const audioStream = async function* () {
  const chunkSize = 1024 // The service errors out if this is too big
  for await (const payloadChunk of audioPayloadStream) {
    const length = payloadChunk.length;
    var start = 0;
    var end = chunkSize;
    yield { AudioEvent: { AudioChunk: payloadChunk.subarray(start, end) } };
    while(end < length) {
      start = start + chunkSize;
      end = end + chunkSize;
      yield { AudioEvent: { AudioChunk: payloadChunk.subarray(start, end) } };
    }
  }
};

Amazon.prototype.checkStreamingConnection = function checkStreamingConnection(that, callback){
  clearTimeout(that.connectionPoll);
  if(that.timedOut){
    that.timedOut = false;
    that.Transcribe.send(new StartStreamTranscriptionCommand(that.commandInput)).then(
      (data) => {
        eventStreamConsume(data.TranscriptResultStream, callback, that);
      },
      (err) => {
        console.error(`AWS STT Error: ${JSON.stringify(err)}`);
      }
    );
  }
  this.connectionPoll = setTimeout(that.checkStreamingConnection, 15000, that, callback);
}

Amazon.prototype.start = function start(callback) {
  this.Transcribe.send(new StartStreamTranscriptionCommand(this.commandInput)).then(
    (data) => {
      eventStreamConsume(data.TranscriptResultStream, callback, this);
      this.growingPCM = GrowingFile.open(this.file, {
        timeout: 30000,
        interval: 100,
      });
      this.growingPCM.pipe(audioPayloadStream);
    },
    (err) => {
      console.error(`AWS STT Error: ${JSON.stringify(err)}`);
    }
  );
  // If the socket doesn't get any data for 15 seconds it times out. Probably not a problem during a normal call,
  // but check every 15 seconds and reconnect if necessary
  this.connectionPoll = setTimeout(this.checkStreamingConnection, 15000, this);
};

module.exports = Amazon;
