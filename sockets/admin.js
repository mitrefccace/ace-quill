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

// const https = require('https');
const fs = require('fs');

process.env.TF_CPP_MIN_LOG_LEVEL = 2
const mysql = require('mysql2/promise');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const config = require('./../configs/config.js');
const constants = require('../configs/constants');
const awsMFA = require('../utils/aws-mfa');

const Azure = require('../transcription/azure');
const Google = require('../transcription/google');
const Watson = require('../transcription/watson');
const Amazon = require('../transcription/amazon');
const UsabilityAzure = require('../transcription/usabilityAzure');
const UsabilityWatson = require('../transcription/usabilityWatson');
const WatsonT = require('../translation/watson');
const GoogleT = require('../translation/google');
const AzureT = require('../translation/azure');
const AmazonT = require('../translation/amazon');
const GoogleTTS = require('../texttospeech/google');
const WatsonTTS = require('../texttospeech/watson');
const AzureTTS = require('../texttospeech/azure');
const AmazonTTS = require('../texttospeech/amazon');
const ffmpeg = require('../utils/ffmpegUtils');

function openMySqlConnection() {
  const mySqlConnection = mysql.createPool({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    debug: false,
  });
  return mySqlConnection;
}

const mySqlConnection = openMySqlConnection();

let proxy;
if (config.proxy) {
  proxy = new URL(config.proxy);
}

module.exports = function mod(io, nconf) { 
  if (!config.sttServices) {
    console.info('STT Service is currently DISABLED. This allows the ACE Quill web server to be run without including the STT node_modules.');
  }

  console.debug('Entering admin.js');

  io.on('connection', (socket) => {
    console.debug('Incoming Socket.IO:connection');

    function sttResults(engine, language, data) {
      data.engine = engine + language;
      io.to(socket.id).emit('test-stt-engines-results', data);
    }

    function accuracyPageResults(data, timestamp, parseType) {
      console.log("jwer ", data)
      report = 'WER MER WIL \n'
      if (parseType == "whole")
        report += data.finding[0] + ' ' + data.finding[1] + ' ' + data.finding[2]
      else
        for (let i = 0; i < data.finding.length - 1; i++) {
          report += data.finding[i] + '\n'
        }
      fs.writeFileSync('./uploads/accuracy/jiwer_' + timestamp + '.txt', report);
      io.to(socket.id).emit('accuracy-report', { library: 'jiwer', status: 'success', report: report });
    }

    function accuracyResults(data) {
      console.debug('Accuracy Results: ' + data);
      if (data.engine === 'none') io.to(socket.id).emit('test-transcript-accuracy-results', data);
      else io.to(socket.id).emit('test-scenario-accuracy-results', data);
    }

    function translationResults(engine, data) {
      console.debug('translationResults: ' + data);
      io.to(socket.id).emit('test-translation-engine-results', {TranslatedText: data, engine: engine});
      io.to(socket.id).emit('test-translation-engine-results', data);
    }

    function testAccuracy(engine, transcript, groundTruth, parseType, timestamp = null) {
      let gTruth = groundTruth.toLowerCase();
      let transc = transcript.toLowerCase();

      gTruth = gTruth.replace(/\./g, ' ')
                     .replace(/,/g, ' ')
                     .replace(/\?/g, ' ');
      // gTruth = gTruth.replace(/\r?\n|\r/g, ' ');
      transc = transc.replace(/\./g, ' ')
                     .replace(/,/g, ' ')
                     .replace(/\?/g, ' ');

      const reBrackets = /\[(.*?)\]/g;
      const listOfAlternatives = [];
      let found;
      while (true) {
        found = reBrackets.exec(gTruth);
        if (!found) {
          break;
        }
        listOfAlternatives.push(found[1]);
      }

      let scratchText = transc;
      for (let i = 0; i < listOfAlternatives.length; i += 1) {
        const alts = listOfAlternatives[i].split('|');
        for (let j = 0; j < alts.length; j += 1) {
          if (alts[j] === '@') {
            gTruth = gTruth.replace(listOfAlternatives[i], '');
          } else {
            if ('*+?'.includes(alts[j])) alts[j] = `\\${alts[j]}`;
            const re = new RegExp(`\\b${alts[j]}\\b`);
            if (re.test(scratchText)) {
              scratchText = scratchText.replace(re, '');
              gTruth = gTruth.replace(listOfAlternatives[i], alts[j]);
              break;
            } else if (j === (alts.length - 1)) {
              gTruth = gTruth.replace(listOfAlternatives[i], alts[0]);
            }
          }
        }
      }

      gTruth = gTruth.replace(/\[/g, '')
                     .replace(/\]/g, '');

      const py = spawn('python3', [`${__dirname}/research.py`, parseType]);
      const data = [gTruth, transc];
      var dataString = [];

      console.info('transcript  :' + transcript);
      console.info('');
      console.info('groundtruth :' + groundTruth);

      py.stdout.on('data', (data2) => {
        dataString.push(data2.toString().split(/\r?\n/));
      });

      py.stdout.on('end', () => {
        console.info("datastring: |" + dataString.length + "|");
        if (dataString.length > 0) {
          const wrapper = {};
          wrapper.engine = engine;
          wrapper.finding = dataString[0];
          wrapper.translation = transc;
          accuracyResults(wrapper);
          accuracyPageResults(wrapper, timestamp, parseType);
        } else {
          console.info("no datastring");
        }
      });
      py.stdin.write(JSON.stringify(data));
      py.stdin.end();
    }

    function testAsterisk() {
      try {
        exec('service asterisk status', (err, res) => {
          const results = (res.indexOf('Active: active (running)') > 0) ? 'pass' : 'fail';
          io.to(socket.id).emit('test-resources-asterisk-results', results);
        });
      } catch {
        io.to(socket.id).emit('test-resources-asterisk-results', 'fail');
      }
    }

    async function testMySQL() {
      const mySqlConnection = openMySqlConnection();
      try {
        const [result, _fields] = await mySqlConnection.query('show tables;');
        io.to(socket.id).emit('test-resources-mysql-results', 'pass');
      } catch(error) {
        console.error(error);
        io.to(socket.id).emit('test-resources-mysql-results', 'fail');
      }
    }

    function testAce2() {
      try {
        if (config.accuracy.ace2server === 'local'){
          io.to(socket.id).emit('test-resources-ace2-results', 'pass');
        }
        exec("ssh -o StrictHostKeyChecking=no "+config.accuracy.ace2server+" ls", (error, stdout, stderr) => {
          if (error) {
            console.log(`Ace2 ssh error: ${error.message}`);
            io.to(socket.id).emit('test-resources-ace2-results', 'fail');
          }
          io.to(socket.id).emit('test-resources-ace2-results', 'pass');
        });
      } catch {
        io.to(socket.id).emit('test-resources-ace2-results', 'fail');
      }
    }

    socket.on('get-configs-amazon', () => {
      console.debug('Incoming Socket.IO:get-configs-amazon');
      try {
        const amazon = JSON.parse(
          fs.readFileSync('./configs/amazon/amazon.json'),
        );
        io.to(socket.id).emit('load-amazon-configs', amazon);
      } catch (err) {
        console.error('Error parsing configs amazon JSON');
        console.error(err);
      }
    });

    socket.on('get-configs-azure', () => {
      console.debug('Incoming Socket.IO:get-configs-azure');
      try {
        const azureCog = JSON.parse(
          fs.readFileSync('./configs/azure/azure-cognitive.json'),
        );
        io.to(socket.id).emit('load-azure-cognitive-configs', azureCog);
      } catch (err) {
        console.error('Error parsing stt configs azure-cognitive JSON',);
        console.error(err);
      }
      try {
        const azureTranslation = JSON.parse(
          fs.readFileSync('./configs/azure/azure-translation.json'),
        );
        io.to(socket.id).emit('load-azure-translation-configs', azureTranslation);
      } catch (err) {
        console.error('Error parsing stt configs azure-translation JSON',);
        console.error(err);
      }
    });

    socket.on('get-configs-google', () => {
      console.debug('Incoming Socket.IO:get-configs-google');
      try {
        const google = JSON.parse(
          fs.readFileSync('./configs/google/google.json'),
        );
        io.to(socket.id).emit('load-google-configs', google);
      } catch (err) {
        console.error('Error parsing configs google JSON',);
        console.error(err);
      }
    });

    socket.on('get-configs-watson', () => {
      console.debug('Incoming Socket.IO:get-configs-watson');
      try {
        const watsonStt = JSON.parse(
          fs.readFileSync('./configs/watson/watson-stt.json'),
        );
        io.to(socket.id).emit('load-watson-stt-configs', watsonStt);
      } catch (err) {
        console.error('Error parsing  configs watson-stt JSON',);
        console.error(err);
      }
      try {
        const watsonTranslation = JSON.parse(
          fs.readFileSync('./configs/watson/watson-translation.json'),
        );
        io.to(socket.id).emit('load-watson-translation-configs', watsonTranslation);
      } catch (err) {
        console.error('Error parsing  configs watson-translation JSON',);
        console.error(err);
      }
      try {
        const watsonTts = JSON.parse(
          fs.readFileSync('./configs/watson/watson-tts.json'),
        );
        io.to(socket.id).emit('load-watson-tts-configs', watsonTts);
      } catch (err) {
        console.error('Error parsing  configs watson-tts JSON',);
        console.error(err);
      }
    });

    socket.on('update-amazon-configs', (data) => {
      console.debug('Incoming Socket.IO:update-amazon-configs');
      console.debug(JSON.stringify(data));
      const amazon = {};
      amazon.auth_type = data.auth_type;
      amazon.key = data.key;
      amazon.secret = data.secret;
      amazon.region = data.region;
      fs.writeFile(
        './configs/amazon/amazon.json',
        JSON.stringify(amazon, null, 2),
        (err) => {
          if (err) {
            console.error(
              'Error writing ./configs/amazon/amazon.json',
            );
            console.error(err.message);
            return;
          }
          console.debug(
            'Azure config saved to ./configs/amazon/amazon.json',
          );
          if (amazon.auth_type == "mfa") {
            awsMFA.createMFASession(data.token).then((success) => {
              console.log(success)
              if (success) {
                io.to(socket.id).emit('save-stt-success', 'Amazon');
                io.to(socket.id).emit('save-tts-success', 'Amazon');
                io.to(socket.id).emit('save-translation-success', 'Amazon');
              } else {
                io.to(socket.id).emit('save-stt-fail', 'Amazon');
              }
            })
          } else {
            io.to(socket.id).emit('save-stt-success', 'Amazon');
            io.to(socket.id).emit('save-tts-success', 'Amazon');
            io.to(socket.id).emit('save-translation-success', 'Amazon');
          }
        },
      );
    });

    socket.on('check-amazon-mfa', () => {
      awsMFA.validateSession().then((isValid) => {
        if (isValid) {
          io.to(socket.id).emit('amazon-mfa-status', { status: "valid" });
        } else {
          io.to(socket.id).emit('amazon-mfa-status', { status: "unknown" });
        }
      }).catch(() => {
        io.to(socket.id).emit('amazon-mfa-status', { status: "error" });
      })
    });

    socket.on('update-azure-cognitive-configs', (data) => {
      console.debug('Incoming Socket.IO:update-azure-cognitive-configs');
      const azure = {};
      azure.key = data.key;
      azure.url = data.url;
      azure.location = data.location;
      fs.writeFile(
        './configs/azure/azure-cognitive.json',
        JSON.stringify(azure, null, 2),
        (err) => {
          if (err) {
            console.error(
              'Error writing ./configs/azure/azure-cognitive.json',
            );
            console.error(err.message);
            return;
          }
          console.debug(
            'Azure config saved to ./configs/azure/azure-cognitive.json',
          );
          io.to(socket.id).emit('save-success', 'Azure Cognitive');
        },
      );
    });

    socket.on('update-azure-translation-configs', (data) => {
      console.debug('Incoming Socket.IO:update-translation-azure-configs');
      const azure = {};
      azure.key = data.key;
      azure.url = data.url;
      azure.location = data.location;
      fs.writeFile(
        './configs/azure/azure-translation.json',
        JSON.stringify(azure, null, 2),
        (err) => {
          if (err) {
            console.error(
              'Error writing ./configs/azure/azure-translation.json',
            );
            console.error(err.message);
            return;
          }
          console.debug(
            'Azure config saved to ./configs/azure/azure-translation.json',
          );
          io.to(socket.id).emit('save-success', 'Azure Translation');
        },
      );
    });

    //Google uses the same config for tts, stt, and translation
    socket.on('update-google-configs', (data) => {
      console.debug('Incoming Socket.IO:update-google-configs');
      console.debug(JSON.stringify(data));
      const google = {};
      google.type = data.type;
      google.project_id = data.project_id;
      google.private_key_id = data.private_key_id;
      google.private_key = data.private_key;
      google.client_email = data.client_email;
      google.client_id = data.client_id;
      google.auth_uri = data.auth_uri;
      google.token_uri = data.token_uri;
      google.auth_provider_x509_cert_url = data.auth_provider_x509_cert_url;
      google.client_x509_cert_url = data.client_x509_cert_url;

      fs.writeFile(
        './configs/google/google.json',
        JSON.stringify(google, null, 2),
        (err) => {
          if (err) {
            console.error('Error writing ./configs/google/google.json');
            console.error(err.message);
            return;
          }
          console.debug(
            'Google config saved to ./configs/google/google.json',
          );
          io.to(socket.id).emit('save-stt-success', 'Google');
          io.to(socket.id).emit('save-tts-success', 'Google');
          io.to(socket.id).emit('save-translation-success', 'Google');
        },
      );
    });

    socket.on('update-watson-stt-configs', (data) => {
      console.debug('Incoming Socket.IO:update-watson-stt-configs');
      const watson = {};
      watson.authtype = data.authtype;
      watson.apikey = data.apikey;
      watson.url = data.url;
      fs.writeFile(
        './configs/watson/watson-stt.json',
        JSON.stringify(watson, null, 2),
        (err) => {
          if (err) {
            console.error('Error writing ./configs/watson/watson-stt.json');
            console.error(err.message);
            return;
          }
          console.debug('Watson config to ./configs/watson/watson-stt.json');
          io.to(socket.id).emit('save-success', 'Watson Speech to Text');
        },
      );
    });

    socket.on('update-watson-tts-configs', (data) => {
      console.debug('Incoming Socket.IO:update-watson-tts-configs');
      const watson = {};
      watson.authtype = data.authtype;
      watson.apikey = data.apikey;
      watson.url = data.url;
      fs.writeFile(
        './configs/watson/watson-tts.json',
        JSON.stringify(watson, null, 2),
        (err) => {
          if (err) {
            console.error('Error writing ./configs/watson/watson-tts.json');
            console.error(err.message);
            return;
          }
          console.debug('Watson config to ./configs/watson/watson-tts.json');
          io.to(socket.id).emit('save-success', 'Watson Text to Speech');
        },
      );
    });

    socket.on('update-watson-translation-configs', (data) => {
      console.debug('Incoming Socket.IO:update-watson-translation-configs');
      const watson = {};
      watson.authtype = data.authtype;
      watson.apikey = data.apikey;
      watson.url = data.url;
      fs.writeFile(
        './configs/watson/watson-translation.json',
        JSON.stringify(watson, null, 2),
        (err) => {
          if (err) {
            console.error(
              'Error writing ./configs/watson/watson-translation.json',
            );
            console.error(err.message);
            return;
          }
          console.debug(
            'Watson config to ./configs/watson/watson-translation.json',
          );
          io.to(socket.id).emit('save-success', 'Watson Translation');
        },
      );
    });

    socket.on('test-stt-engines', (data) => {
      console.debug('Incoming Socket.IO:test-stt-engines');
      if (!config.sttServices) {
        console.info('STT Engines are disabled');
        return;
      }
      const filepathEnglish = 'public/sounds/rain_in_spain.wav';
      const filepathSpanish = 'public/sounds/rain_in_spain_spanish.wav';
      const language = data.language;
      let filepath;
      if (language === 'english') {
        filepath = filepathEnglish;
      } 
      else if (language === 'spanish') {
        filepath = filepathSpanish;
      }
      else{
        console.error('Invalid language specified: ' + language);
        return;
      }
      // Azure Test block
      try {
        const aconfig = JSON.parse(
          fs.readFileSync('./configs/azure/azure-cognitive.json'),
        );
        aconfig.file = filepath;
        aconfig.language = (language === 'english') ? constants.LANGUAGE_CODES.US_ENGLISH.AZURE : constants.LANGUAGE_CODES.US_SPANISH.AZURE;
        const azure = new Azure(aconfig);
        azure.start((data) => {
          sttResults('azure', language, data);
        });
      } catch(error){
        console.error(`Error transcribing with Azure: ${JSON.stringify(error)}`);
      }
      // AWS
      try {
        const awsConfig = {};
        awsConfig.file = filepath;
        awsConfig.language = (language === 'english') ?  constants.LANGUAGE_CODES.US_ENGLISH.AMAZON : constants.LANGUAGE_CODES.US_SPANISH.AMAZON;
        const amazon = new Amazon(awsConfig);
        amazon.start((data) => {
          sttResults('amazon', language, data);
        });
      } catch(error){
        console.error(`Error transcribing with Amazon: ${JSON.stringify(error)}`);
      }
      // Google
      try {
        let languageCode = (language === 'english') ? constants.LANGUAGE_CODES.US_ENGLISH.GOOGLE :constants.LANGUAGE_CODES.US_SPANISH.GOOGLE;
        const google = new Google(filepath, languageCode);
        google.start((data) => {
          sttResults('google', language, data);
        });
      } catch(error){
        console.error(`Error transcribing with Google: ${JSON.stringify(error)}`);
      }
      // Watson
      try {
        const wconfig = JSON.parse(
          fs.readFileSync('./configs/watson/watson-stt.json'),
        );
        if (proxy) {
          wconfig.proxy = proxy.hostname;
          wconfig.proxy_port = proxy.port;
        }
        let languageCode = (language === 'english') ? constants.LANGUAGE_CODES.US_ENGLISH.WATSON : constants.LANGUAGE_CODES.US_SPANISH.WATSON;
        const watson = new Watson(
          filepath,
          wconfig,
          languageCode
        );
        watson.start((data) => {
          sttResults('watson', language, data);
        });
      } catch(error){
        console.error(`Error transcribing with Watson: ${JSON.stringify(error)}`);
      }
    });

    socket.on('test-translation-engines', async () => {
      console.debug('Incoming Socket.IO:test-translation-engines');
      if (!config.sttServices) {
        console.info('STT Engines are disabled');
        return;
      }
      const text = 'esto fue originalmente en español';
      let en = {};
      let es = {};
      try{
        const [result, _fields] = await mySqlConnection.query('SELECT * FROM language_code');
        en = result[0];
        es = result[1];;
      }
      catch(error){
        console.error(`Error fetching language codes: ${JSON.stringify(error)}`);
        return;
      }
      if (config.proxy) {
        proxy = new URL(config.proxy);
      }
      // Google Test block
      try {
        console.info('test google translate');
        const google = new GoogleT();
        google.translate(text, es.google_translate, en.google_translate, (err, data) => {
          if(err){
            console.error(err);
          }
          else{
            translationResults('google', data);
          }
        });
      } catch(error){
        console.error(`Error translating with Google: ${JSON.stringify(error)}`);
      }
      // Watson
      try {
        console.info('Translating with watson');
        let configs = JSON.parse(
          fs.readFileSync('./configs/watson/watson-translation.json'),
        );
        if (proxy) {
          configs.proxy = proxy.hostname;
          configs.proxy_port = proxy.port;
        }
        const watson = new WatsonT(configs);
        watson.translate(text, es.watson_translate, en.watson_translate, (err, data) => {
          if(err){
            console.error(err);
          }
          else{
            translationResults('watson', data);
          }
        });
      } catch(error){
        console.error(`Error translating with Watson: ${JSON.stringify(error)}`);
      }
      // Azure
      try {
        console.info('Translating with azure');
        configs = JSON.parse(
          fs.readFileSync('./configs/azure/azure-translation.json'),
        );
        if (config.proxy) {
          configs.proxy = proxy;
        }
        const azure = new AzureT(configs);
        azure.translate(text, es.azure_translate, en.azure_translate, (err, data) => {
          if(err){
            console.error(err);
          }
          else{
            translationResults('azure', data);
          }
        });
      } catch(error){
        console.error(`Error translating with Azure: ${JSON.stringify(error)}`);
      }
      // Amazon
      try {
        console.info('Translating with Amazon');
        const amazon = new AmazonT();
        amazon.translate(text, es.aws_translate, en.aws_translate, (err, data) => {
          if(err){
            console.error(err);
          }
          else{
            translationResults('amazon', data);
          }
        });
      } catch(error){
        console.error(`Error translating with Amazon: ${JSON.stringify(error)}`);
      }
    });

    socket.on('test-tts-engine', (data) => {
      const engine = data.engine;
      const text = data.text;
      const voice = data.voice;
      console.debug('Incoming Socket.IO:test-tts-engines');
      if (!config.sttServices) {
        console.info('STT Engines are disabled');
        return;
      }
        let tts, lang;
        switch (engine) {
          case 'amazon':
            tts = new AmazonTTS();
            lang = 'en-US';
            break;
          case 'azure':
            let azure_config = JSON.parse(
              fs.readFileSync('./configs/azure/azure-cognitive.json'),
            );
            if (proxy) {
              azure_config.proxy = proxy.hostname;
              azure_config.proxy_port = proxy.port;
            }
            tts = new AzureTTS(azure_config);
            lang = 'en-US';
            break;
          case 'google':
            tts = new GoogleTTS();
            lang = 'en-US';
            break;
          case 'watson':
            const watson_configs = JSON.parse(
              fs.readFileSync('./configs/watson/watson-tts.json'),
            );
            if (proxy) {
              watson_configs.proxy = proxy.hostname;
              watson_configs.proxy_port = proxy.port;
            }
            tts = new WatsonTTS(watson_configs);
            lang = 'en-US_BroadbandModel';
            break;
          default:
            break;
        }
        tts.textToSpeech(text, lang, voice, (err, audiofile) => {
          if (err) {
            console.error(`Error running TTS: ${JSON.stringify(err)}`);
          } else {
            io.to(socket.id).emit('test-tts-engine-results', {engine:engine, audiofile: audiofile});
          }
        });
    });
  
    socket.on('test-resources', () => {
      testAsterisk();
      testMySQL();
      testAce2();
    });

    socket.on('run-accuracy-reports', (data) => {
      console.debug('Incoming Socket.IO:run-accuracy-reports');

      console.log("data, ", data)
      let { hypothesis, reference, libraries, timestamp, alpha, perLine, customIds } = data;
      console.log(">>>", hypothesis, reference, libraries, timestamp, alpha, perLine, customIds);

      fs.writeFileSync('./uploads/accuracy/hypothesis_' + timestamp + '.txt', hypothesis);
      fs.writeFileSync('./uploads/accuracy/reference_' + timestamp + '.txt', reference);

      fs.writeFileSync('./resources/hypothesis.txt', hypothesis + "\n");
      fs.writeFileSync('./resources/reference.txt', reference + "\n");

      sclite_hypo = hypothesis.replace(/\r?\n|\r/g, " ")
      sclite_ref = reference.replace(/\r?\n|\r/g, " ")
      fs.writeFileSync('./resources/sclite_hypothesis.txt', sclite_hypo + "\n");
      fs.writeFileSync('./resources/sclite_reference.txt', sclite_ref + "\n");

      var arr = hypothesis.replace(/\r\n/g, '\n').split('\n');
      if (!customIds) {
        k = 0;
        for (let i of arr) {
          arr[k] = i + " (s" + String(k).padStart(2, '0') + ")"
          console.log("word ", arr[k]);
          k += 1;
        }
      }
      sclite_hypo = arr.join('\n')

      var arr = reference.replace(/\r\n/g, '\n').split('\n');
      if (!customIds) {
        k = 0;
        for (let i of arr) {
          arr[k] = i + " (s" + String(k).padStart(2, '0') + ")"
          console.log("word ", arr[k]);
          k += 1;
        }
      }
      sclite_ref = arr.join('\n')

      fs.writeFileSync('./resources/sclite_hypothesis.trn', sclite_hypo + "\n");
      fs.writeFileSync('./resources/sclite_reference.trn', sclite_ref + "\n");

      if (customIds) {
        reference = reference.replace(/\s*\(.*?\)\s*/g, '');
        hypothesis = hypothesis.replace(/\s*\(.*?\)\s*/g, '');
      }

      if (config.accuracy.jiwer == 'true') {
        testAccuracy('none', hypothesis, reference, perLine, timestamp);
      }

      var scliteData = ""
      if (config.accuracy.sclite == 'true') {
        if (perLine == 'all')
          sclitecmd = "./resources/SCTK/bin/sclite -i wsj -r ./resources/sclite_reference.txt -h ./resources/sclite_hypothesis.txt -l 110 -o sum pra stdout"
        else
          sclitecmd = "./resources/SCTK/bin/sclite -i wsj -r ./resources/sclite_reference.trn -h ./resources/sclite_hypothesis.trn -l 110 -o sum pra stdout"
        exec(sclitecmd, (error, stdout, stderr) => {
          if (error) {
            console.log(`error: ${error.message}`);
            return;
          }
          if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
          }
          console.log(`stdout: ${stdout}`);
          fs.writeFileSync('./uploads/accuracy/sclite_' + timestamp + '.txt', stdout);
          scliteData = stdout
          io.to(socket.id).emit('accuracy-report', { library: 'sclite', status: 'success', report: scliteData });
        });
      }
      var ace2Data = ""
      if (config.accuracy.ace2 == 'true') {
        if (config.accuracy.ace2server == 'local') {
          exec("python3.6 ace-code-master/ace.py --rfile ace-code-master/test/reference.txt --hfile ace-code-master/test/hypothesis.txt --ace2" + " --alpha " + parseFloat(alpha), (error, stdout, stderr) => {
            if (error) {
              console.log(`error0: ${error.message}`);
              return;
            }
            if (stderr) {
              console.log(`stderr0: ${stderr}`);
              return;
            }
            fs.writeFileSync('./uploads/accuracy/ace2_' + timestamp + '.txt', stdout);
            ace2Data = stdout
            io.to(socket.id).emit('accuracy-report', { library: 'ace2', status: 'success', report: ace2Data });
          });
        } else {
          exec("scp -3 ./resources/*.txt " + config.accuracy.ace2server + ":/usr/local/bin/ace-code-master/test/", (error, stdout, stderr) => {
            if (error) {
              console.log(`error1: ${error.message}`);
              return;
            }
            if (stderr) {
              console.log(`stderr1: ${stderr}`);
              return;
            }
            exec("ssh " + config.accuracy.ace2server + " python3.6 /usr/local/bin/ace-code-master/ace.py --rfile /usr/local/bin/ace-code-master/test/reference.txt --hfile /usr/local/bin/ace-code-master/test/hypothesis.txt --ace2" + " --alpha " + parseFloat(alpha), (error, stdout, stderr) => {
              if (error) {
                console.log(`error2: ${error.message}`);
                return;
              }
              if (stderr) {
                console.log(`stderr2: ${stderr}`);
                return;
              }
              console.log(`stdout: ${stdout}`);
              fs.writeFileSync('./uploads/accuracy/ace2_' + timestamp + '.txt', stdout);
              ace2Data = stdout
              io.to(socket.id).emit('accuracy-report', { library: 'ace2', status: 'success', report: ace2Data });
            });
          });
        }
      }
    });

    socket.on('test-transcript-accuracy', (data) => {
      console.debug('Incoming Socket.IO:test-transcript-accuracy');

      const { transcript } = data;
      const { baseline } = data;
      testAccuracy('none', transcript, baseline, "all");
    });

    socket.on('test-scenario-accuracy', (data) => {
      console.debug('Incoming Socket.IO:test-translation-accuracy');

      const filepath = data.audioPath;
      // var baseline = "Please join MITRE’s Benefits Team and Fidelity for a newly added
      //  Retirement 101 session to learn the basics of investing and explore ways you can
      // take steps now to build a strong retirement plan for your future. You will also have the
      // opportunity to ask questions about MITRE’s Retirement Plan Changes
      // and what that means for you,
      // and what actions you should be taking now through the Early Choice Window."
      const baseline = data.text;

      // baseline
      const baseLineData = {};
      baseLineData.engine = 'ground_truth';
      baseLineData.translation = baseline;
      accuracyResults(baseLineData);

      // Azure Test block
      const aconfig = JSON.parse(
        fs.readFileSync('./configs/azure/azure-cognitive.json'),
      );
      if (proxy) {
        aconfig.proxy = proxy.hostname;
        aconfig.proxy_port = proxy.port;
      }
      aconfig.file = filepath;
      aconfig.language = 'en-US';
      const azure = new Azure(aconfig);

      let azureTranscript = '';
      azure.start((data2) => {
        if (Object.prototype.hasOwnProperty.call(data2, 'end')) setTimeout(() => testAccuracy('azure', azureTranscript, baseline, "all"), 80000);
        if (data2.final) azureTranscript += data2.transcript;
      });

      // Google Test block
      const google = new Google(filepath, 'en-US', false);
      let googleTranscript = '';
      google.start((data3) => {
        if (Object.prototype.hasOwnProperty.call(data3, 'end')) {
          testAccuracy('google', googleTranscript, baseline, "all");
        }
        if (data3.final === true) googleTranscript += ` ${data3.transcript}`;
      });

      // Watson Test block
      const wconfig = JSON.parse(
        fs.readFileSync('./configs/watson/watson-stt.json'),
      );
      let watsonTranscript = '';
      if (proxy) {
        wconfig.proxy = proxy.hostname;
        wconfig.proxy_port = proxy.port;
      }
      console.log("watson filepath: " + filepath);
      const watson = new Watson(
        filepath,
        wconfig,
        'en-US_BroadbandModel'
      );
      watson.start((data4) => {
        if (Object.prototype.hasOwnProperty.call(data4, 'end')) setTimeout(() => testAccuracy('watson', watsonTranscript, baseline, "all"), 110000);
        if (data4.final) {
          watsonTranscript += data.transcript;
          console.info('watson transcripts', watsonTranscript);
        }
      });
    });

    socket.on('run-usability-transcription', (data) => {
      let usability = null;
      const fileData = data
      const audioDelete = data.deleteAudioFile;
      const asrEngine = data.engine || "AZURE";


      const filePath = fileData.file_location + "/" + fileData.id + "_" + fileData.filename;
      const filePathMono = fileData.file_location + "/" + fileData.id + "_" + fileData.filename.split(".wav")[0] + "_mono" + ".wav";
      ffmpeg.convertToMono(filePath, filePathMono).then(() => {
        const docLocation = fileData.file_location + "/" + fileData.id + "_" + fileData.title.replace(/ /g, "_") + ".txt";
        const id = fileData.id;
        fs.appendFileSync(docLocation, `${fileData.title}, ${fileData.firstname} ${fileData.lastname}, ${fileData.filename}, ${fileData.duration} seconds, ${new Date().toUTCString().replace(',', '')}, ${data.engine}\n`);

        switch (asrEngine) {
          case 'AZURE':
            const aconfig = JSON.parse(
              fs.readFileSync('./configs/azure/azure-cognitive.json'),
            );
            if (proxy) {
              aconfig.proxy = proxy.hostname;
              aconfig.proxy_port = proxy.port;
            }
            aconfig.file = filePathMono;
            aconfig.language = "en-US";
            usability = new UsabilityAzure(aconfig, docLocation);
            break;
          case 'WATSON':
            const wconfig = JSON.parse(
              fs.readFileSync('./configs/watson/watson-stt.json'),
            );
            if (proxy) {
              wconfig.proxy = proxy.hostname;
              wconfig.proxy_port = proxy.port;
            }
            usability = new UsabilityWatson(filePathMono, wconfig, 'en-US_BroadbandModel', docLocation);
            break;
        }
        usability.start(async (data) => {
          if (data.end) {
            try{
              const [result, _fields] = await mySqlConnection.query("UPDATE audio_file_transcribe SET status='COMPLETE' WHERE id=?;", id);
              io.to(socket.id).emit('complete-transcription', 'test');
            }
            catch(error){
              console.error(`Error updating audio file transcription: ${JSON.stringify(error)}`);
            }
            if (audioDelete == true) {
              try {
                fs.unlinkSync(filePath)
                fs.unlinkSync(filePathMono)
              } catch (error) {
                console.error(`Error updating deleting audio file: ${JSON.stringify(error)}`);
              }
            }
          }
        });
      })
    });

    process.on('SIGINT', () => {
      console.info('SIGINT About to exit \n closing sql connection pool');
      process.exit();
    });

    process.on('uncaughtException', (e) => {
      console.error('Uncaught Exception...');
      console.error(e.stack);
      if (e) {
        process.exit();
      }
    });

    socket.on('disconnect', (reason) => {
      console.error('socket disconnected ', reason);
    });
  });
};
