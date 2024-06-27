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
const uuid  = require('uuid');
const { getAWSConfigWithProxy }  = require('../utils/aws-config');
const { Readable } = require('stream');
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

function Amazon() {
  this.pollyConfig = getAWSConfigWithProxy();
  this.Polly = new PollyClient(this.pollyConfig);
  console.info('Amazon TTS config: ', this.pollyConfig);
}

Amazon.prototype.textToSpeech = function texttospeech(text, language, voice, callback) {
  const audiofilename = `${uuid.v4()}.mp3`;
  var voiceid;
  if (voice == "Male"){
    voiceid = language == 'es' ? 'Miguel' :'Matthew'
  }
  else{
    voiceid = language == 'es' ? 'Penelope' :'Joanna'
  }
  const command = new SynthesizeSpeechCommand({ Text: text,
                                                OutputFormat: 'mp3',
                                                VoiceId: voiceid });
  this.Polly.send(command).then(
    (data) => {
      if (data.AudioStream instanceof Readable) {
        const writeStream = fs.createWriteStream(`./texttospeech/audiofiles/${audiofilename}`);
        writeStream.on('finish', ()=>{
            console.info(`TTS file saved: ./texttospeech/audiofiles/${audiofilename}`);
            callback(null, audiofilename);
          }).on('error', (err2)=>{
            console.error(`ERROR: TTS file save fail: ./texttospeech/audiofiles/${audiofilename}`);
            console.error(err2);
            callback(null, audiofilename);
          });
        data.AudioStream.pipe(writeStream);
      }
    },
    (err) => {
      console.error(err, err.message);
    }
  );
};

module.exports = Amazon;
