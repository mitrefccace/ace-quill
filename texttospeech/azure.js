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
const uuid = require('uuid');


function Azure(configs) {
  this.key = configs.key;
  this.location = configs.location;
  this.proxy = configs.proxy;
  this.proxy_port = configs.proxy_port;
}

Azure.prototype.textToSpeech = function texttospeech(text, language, voice, callback) {
  const audiofilename = `${uuid.v4()}.mp3`;
  const speechConfig = sdk.SpeechConfig.fromSubscription(this.key, this.location);

  if (voice == "Male"){
    voiceid = language == 'es' ? 'es-US-AlonsoNeural' :'en-US-GuyNeural'
  }
  else{
    voiceid = language == 'es' ? 'es-US-PalomaNeural' : 'en-US-AriaNeural';
  }

  speechConfig.speechSynthesisVoiceName = voiceid;
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(`./texttospeech/audiofiles/${audiofilename}`);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  if (this.proxy) speechConfig.setProxy(this.proxy, this.proxy_port);

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
  synthesizer.speakTextAsync(text, (result) => {
      if (result) {
        console.info(JSON.stringify(result));
        callback(null, audiofilename);
      }
      synthesizer.close();
    },
    (err) => {
      console.error(err);
      callback(err);
      synthesizer.close();
    },
  );
};

module.exports = Azure;
