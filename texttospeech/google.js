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

const tts = require('@google-cloud/text-to-speech');

const client = new tts.TextToSpeechClient();
const fs = require('fs');
const uuid = require('uuid');

function Google(configs) {
  // this.langCd = 'en-US';
  // this.ssmlGender = 'NEUTRAL';
  console.info(`Google configs: ${JSON.stringify(configs)}`);
}

Google.prototype.textToSpeech = function texttospeech(text, language, voice, callback) {
  if (voice == "Male"){
    voiceid = language == 'es' ? 'es-US-Standard-B' :'en-US-Standard-B'
  }
  else{
    voiceid = language == 'es' ? "es-US-Standard-A" : "en-US-Standard-C";
  }

  const request = {
    input: { text },
    voice: {
      languageCode: language,
      name: voiceid
      // ssmlGender: this.ssmlGender,
    },
    audioConfig: { audioEncoding: 'LINEAR16' },
  };
  client.synthesizeSpeech(request, (err, data) => {
    if (err) {
      console.error(`Error: Google Text to Speech ${JSON.stringify(err)}`);
      callback(err);
    } else {
      const audiofilename = `${uuid.v4()}.mp3`;
      fs.writeFile(`./texttospeech/audiofiles/${audiofilename}`, data.audioContent, (err2) => {
        if (err2) {
          console.error(`Error: Google Text to Speech file save ${JSON.stringify(err2)}`);
        } else {
          callback(null, audiofilename);
        }
      });
    }
  });
};

module.exports = Google;
