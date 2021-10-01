/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

                        ©2018 The MITRE Corporation.
*/

// const https = require('https');
const fs = require('fs');
const log4js = require('log4js');

const adminLogger = log4js.getLogger('admin');
const mysql = require('mysql');
// const { exec } = require('child_process');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const decode = require('../utils/decode');
const nconf = require('nconf');

const Azure = require('../transcription/azure');
const Google = require('../transcription/google');
const Watson = require('../transcription/watson');
const Amazon = require('../transcription/amazon');
const WatsonT = require('../translation/watson');
const GoogleT = require('../translation/google');
const AzureT = require('../translation/azure');
const AmazonT = require('../translation/amazon');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

module.exports = function mod(io, nconf) {
  if (decode(nconf.get('sttService')) !== 'enabled') {
    info.info(
      'STT Service is currently DISABLED. This allows the ACE Quill web server to be run without including the STT node_modules.',
    );
  }

  adminLogger.debug('Entering admin.js');

  io.on('connection', (socket) => {
    adminLogger.debug('Incoming Socket.IO:connection');

    function openMySqlConnection() {
      info.info('watson sql pool connection');
      const mySqlConnection = mysql.createPool({
        host: decode(nconf.get('mysql:host')),
        user: decode(nconf.get('mysql:user')),
        password: decode(nconf.get('mysql:password')),
        database: decode(nconf.get('mysql:database')),
        debug: false,
      });
      return mySqlConnection;
    }

    function sttResults(data) {
      if (data.final) {
        io.to(socket.id).emit('test-stt-engines-results', data);
      }
    }

    function accuracyResults(data) {
      debug.debug('Accuracy Results here', data);
      if (data.engine === 'none') io.to(socket.id).emit('test-transcript-accuracy-results', data);
      else io.to(socket.id).emit('test-scenario-accuracy-results', data);
    }

    function translationResults(data) {
      debug.debug('translationResults here', data);
      io.to(socket.id).emit('test-translation-engine-results', data);
    }

    function testAccuracy(engine, transcript, groundTruth) {
      let gTruth = groundTruth.toLowerCase();
      let transc = transcript.toLowerCase();

      gTruth = gTruth.replace(/\./g, ' ');
      gTruth = gTruth.replace(/,/g, ' ');
      gTruth = gTruth.replace(/\?/g, ' ');
      gTruth = gTruth.replace(/\r?\n|\r/g, ' ');
      transc = transc.replace(/\./g, ' ');
      transc = transc.replace(/,/g, ' ');
      transc = transc.replace(/\?/g, ' ');

      const reBrackets = /\[(.*?)\]/g;
      const listOfAlternatives = [];
      let found;
      while (true) {
        found = reBrackets.exec(gTruth);
        if(!found){
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

      gTruth = gTruth.replace(/\[/g, '');
      gTruth = gTruth.replace(/\]/g, '');

      const py = spawn('python3', [`${__dirname}/research.py`]);
      const data = [gTruth, transc];
      const dataString = [];

      info.info('transcript  :', transcript);
      info.info('');
      info.info('groundtruth :', groundTruth);

      py.stdout.on('data', (data2) => {
        info.info('here', data.toString());
        dataString.push(data2.toString().split(/\r?\n/));
      });
      py.stdout.on('end', () => {
        info.info(dataString);
        const wrapper = {};
        wrapper.engine = engine;
        const index = 0;
        wrapper.finding = dataString[index];
        wrapper.translation = transc;
        accuracyResults(wrapper);
      });
      py.stdin.write(JSON.stringify(data));
      py.stdin.end();
    }

    function testAsterisk() {
      // const results = 'fail';
      exec('service asterisk status', (err, res) => {
        const results = (res.indexOf('Active: active (running)') > 0) ? 'pass' : 'fail';
        io.to(socket.id).emit('test-resources-asterisk-results', results);
      });
    }

    function testMySQL() {
      let results = 'fail';
      const mySqlConnection = mysql.createConnection({
        host: decode(nconf.get('mysql:host')),
        user: decode(nconf.get('mysql:user')),
        password: decode(nconf.get('mysql:password')),
        database: decode(nconf.get('mysql:database')),
        debug: false,
      });

      mySqlConnection.connect((err) => {
        if (!err) {
          results = 'pass';
        }
        io.to(socket.id).emit('test-resources-mysql-results', results);
      });

      mySqlConnection.end();
    }

    const mySqlConnection = openMySqlConnection();

    socket.on('get-configs-amazon', () => {
      adminLogger.debug('Incoming Socket.IO:get-configs-amazon');
      try {
        const amazon = JSON.parse(
          fs.readFileSync('./configs/amazon/amazon.json'),
        );
        io.to(socket.id).emit('load-amazon-configs', amazon);
      } catch (err) {
        adminLogger.error('Error parsing configs amazon JSON',);
        adminLogger.error(err);
      }
    });

    socket.on('get-configs-azure', () => {
      adminLogger.debug('Incoming Socket.IO:get-configs-azure');
      try {
        const azureCog = JSON.parse(
          fs.readFileSync('./configs/azure/azure-cognitive.json'),
        );
        io.to(socket.id).emit('load-azure-cognitive-configs', azureCog);
      } catch (err) {
        adminLogger.error('Error parsing stt configs azure-cognitive JSON',);
        adminLogger.error(err);
      }
      try {
        const azureTranslation = JSON.parse(
          fs.readFileSync('./configs/azure/azure-translation.json'),
        );
        io.to(socket.id).emit('load-azure-translation-configs', azureTranslation);
      } catch (err) {
        adminLogger.error('Error parsing stt configs azure-translation JSON',);
        adminLogger.error(err);
      }
    });

    socket.on('get-configs-google', () => {
      adminLogger.debug('Incoming Socket.IO:get-configs-google');
      try {
        const google = JSON.parse(
          fs.readFileSync('./configs/google/google.json'),
        );
        io.to(socket.id).emit('load-google-configs', google);
      } catch (err) {
        adminLogger.error('Error parsing configs google JSON',);
        adminLogger.error(err);
      }
    });

    socket.on('get-configs-watson', () => {
      adminLogger.debug('Incoming Socket.IO:get-configs-watson');
      try {
        const watsonStt = JSON.parse(
          fs.readFileSync('./configs/watson/watson-stt.json'),
        );
        io.to(socket.id).emit('load-watson-stt-configs', watsonStt);
      } catch (err) {
        adminLogger.error('Error parsing  configs watson-stt JSON',);
        adminLogger.error(err);
      }
      try {
        const watsonTranslation = JSON.parse(
          fs.readFileSync('./configs/watson/watson-translation.json'),
        );
        io.to(socket.id).emit('load-watson-translation-configs', watsonTranslation);
      } catch (err) {
        adminLogger.error('Error parsing  configs watson-translation JSON',);
        adminLogger.error(err);
      }
      try {
        const watsonTts = JSON.parse(
          fs.readFileSync('./configs/watson/watson-tts.json'),
        );
        io.to(socket.id).emit('load-watson-tts-configs', watsonTts);
      } catch (err) {
        adminLogger.error('Error parsing  configs watson-tts JSON',);
        adminLogger.error(err);
      }
    });

    socket.on('update-amazon-configs', (data) => {
      adminLogger.debug('Incoming Socket.IO:update-amazon-configs');
      adminLogger.debug(JSON.stringify(data));
      const amazon = {};
      amazon.key = data.key;
      amazon.secret = data.secret;
      amazon.region = data.region;
      fs.writeFile(
        './configs/amazon/amazon.json',
        JSON.stringify(amazon, null, 2),
        (err) => {
          if (err) {
            adminLogger.error(
              'Error writing ./configs/amazon/amazon.json',
            );
            adminLogger.error(err.message);
            return;
          }
          adminLogger.debug(
            'Azure config saveed to ./configs/amazon/amazon.json',
          );
          io.to(socket.id).emit('save-stt-success', 'Amazon');
          io.to(socket.id).emit('save-tts-success', 'Amazon');
          io.to(socket.id).emit('save-translation-success', 'Amazon');
        },
      );
    });

    socket.on('update-azure-cognitive-configs', (data) => {
      adminLogger.debug('Incoming Socket.IO:update-azure-cognitive-configs');
      const azure = {};
      azure.key = data.key;
      azure.url = data.url;
      azure.location = data.location;
      fs.writeFile(
        './configs/azure/azure-cognitive.json',
        JSON.stringify(azure, null, 2),
        (err) => {
          if (err) {
            adminLogger.error(
              'Error writing ./configs/azure/azure-cognitive.json',
            );
            adminLogger.error(err.message);
            return;
          }
          adminLogger.debug(
            'Azure config saveed to ./configs/azure/azure-cognitive.json',
          );
          io.to(socket.id).emit('save-success', 'Azure Cognitive');
        },
      );
    });

    socket.on('update-azure-translation-configs', (data) => {
      adminLogger.debug('Incoming Socket.IO:update-translation-azure-configs');
      const azure = {};
      azure.key = data.key;
      azure.url = data.url;
      azure.location = data.location;
      fs.writeFile(
        './configs/azure/azure-translation.json',
        JSON.stringify(azure, null, 2),
        (err) => {
          if (err) {
            adminLogger.error(
              'Error writing ./configs/azure/azure-translation.json',
            );
            adminLogger.error(err.message);
            return;
          }
          adminLogger.debug(
            'Azure config saveed to ./configs/azure/azure-translation.json',
          );
          io.to(socket.id).emit('save-success', 'Azure Translation');
        },
      );
    });

    //Google uses the same config for tts, stt, and translation
    socket.on('update-google-configs', (data) => {
      adminLogger.debug('Incoming Socket.IO:update-google-configs');
      adminLogger.debug(JSON.stringify(data));
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
            adminLogger.error('Error writing ./configs/google/google.json');
            adminLogger.error(err.message);
            return;
          }
          adminLogger.debug(
            'Google config saved to ./configs/google/google.json',
          );
          io.to(socket.id).emit('save-stt-success', 'Google');
          io.to(socket.id).emit('save-tts-success', 'Google');
          io.to(socket.id).emit('save-translation-success', 'Google');
        },
      );
    });

    socket.on('update-watson-stt-configs', (data) => {
      adminLogger.debug('Incoming Socket.IO:update-watson-stt-configs');
      const watson = {};
      watson.authtype = data.authtype;
      watson.apikey = data.apikey;
      watson.url = data.url;
      fs.writeFile(
        './configs/watson/watson-stt.json',
        JSON.stringify(watson, null, 2),
        (err) => {
          if (err) {
            adminLogger.error('Error writing ./configs/watson/watson-stt.json');
            adminLogger.error(err.message);
            return;
          }
          adminLogger.debug('Watson config to ./configs/watson/watson-stt.json');
          io.to(socket.id).emit('save-success', 'Watson Speech to Text');
        },
      );
    });

    socket.on('update-watson-tts-configs', (data) => {
      adminLogger.debug('Incoming Socket.IO:update-watson-tts-configs');
      const watson = {};
      watson.authtype = data.authtype;
      watson.apikey = data.apikey;
      watson.url = data.url;
      fs.writeFile(
        './configs/watson/watson-tts.json',
        JSON.stringify(watson, null, 2),
        (err) => {
          if (err) {
            adminLogger.error('Error writing ./configs/watson/watson-tts.json');
            adminLogger.error(err.message);
            return;
          }
          adminLogger.debug('Watson config to ./configs/watson/watson-tts.json');
          io.to(socket.id).emit('save-success', 'Watson Text to Speech');
        },
      );
    });

    socket.on('update-watson-translation-configs', (data) => {
      adminLogger.debug('Incoming Socket.IO:update-watson-translation-configs');
      const watson = {};
      watson.authtype = data.authtype;
      watson.apikey = data.apikey;
      watson.url = data.url;
      fs.writeFile(
        './configs/watson/watson-translation.json',
        JSON.stringify(watson, null, 2),
        (err) => {
          if (err) {
            adminLogger.error(
              'Error writing ./configs/watson/watson-translation.json',
            );
            adminLogger.error(err.message);
            return;
          }
          adminLogger.debug(
            'Watson config to ./configs/watson/watson-translation.json',
          );
          io.to(socket.id).emit('save-success', 'Watson Translation');
        },
      );
    });

    socket.on('test-stt-engines', () => {
      adminLogger.debug('Incoming Socket.IO:test-stt-engines');
      if (decode(nconf.get('sttService')) === 'enabled') {
        const filepath = 'public/sounds/rain_in_spain.wav';
        const filepathSpanish = 'public/sounds/rain_in_spain_spanish.wav';

        mySqlConnection.query('SELECT * FROM language_code', (
          err,
          result,
        ) => {
          if (err) {
            error.error(`Error in INSERT: ${JSON.stringify(err)}`);
          } else {
            error.error(`language code result: ${JSON.stringify(result)}`);
            const en = result[0];
            const es = result[1];
            // Azure Test block
            const aconfig = JSON.parse(
              fs.readFileSync('./configs/azure/azure-cognitive.json'),
            );

            if (decode(nconf.get('proxy'))) {
              const proxy = new URL(decode(nconf.get('proxy')));
              aconfig.proxy = proxy.hostname;
              aconfig.proxy_port = proxy.port;
            }
            aconfig.file = filepath;
            aconfig.language = en.azure;
            const azure = new Azure(aconfig);
            azure.start((data) => {
              const data2 = data;
              data2.engine = 'azure';
              sttResults(data2);
            });
            // Azure Spanish test block
            const aSpanishconfig = JSON.parse(
              fs.readFileSync('./configs/azure/azure-cognitive.json'),
            );
            if (decode(nconf.get('proxy'))) {
              const proxy = new URL(decode(nconf.get('proxy')));
              aSpanishconfig.proxy = proxy.hostname;
              aSpanishconfig.proxy_port = proxy.port;
            }
            aSpanishconfig.language = es.azure;
            aSpanishconfig.file = filepathSpanish;
            const azureSpanish = new Azure(aSpanishconfig);
            azureSpanish.start((data) => {
              const data2 = data;
              data2.engine = 'azureSpanish';
              sttResults(data2);
            });

            // AWS
            const awsConfig = {};
            awsConfig.file = filepath;
            awsConfig.language = en.aws;
            const amazon = new Amazon(awsConfig);
            amazon.start((data) => {
              const data2 = data;
              data2.engine = 'amazon';
              sttResults(data2);
            });

            // AWS Spanish
            const awsConfig2 = {};
            awsConfig2.file = filepathSpanish;
            awsConfig2.language = es.aws;
            const amazonSpanish = new Amazon(awsConfig2);
            amazonSpanish.start((data) => {
              const data2 = data;
              data2.engine = 'amazonSpanish';
              sttResults(data2);
            });

            // Google Test block
            const google = new Google(filepath, en.google);
            google.start((data) => {
              const data2 = data;
              data2.engine = 'google';
              sttResults(data2);
            });
            // Google Spanish Test block
            const googleSpanish = new Google(filepathSpanish, es.google);
            googleSpanish.start((data) => {
              const data2 = data;
              data2.engine = 'googleSpanish';
              sttResults(data2);
            });

            // Watson Test block
            const wconfig = JSON.parse(
              fs.readFileSync('./configs/watson/watson-stt.json'),
            );
            info.info('wconfig', wconfig);
            if (decode(nconf.get('proxy'))) {
              const proxy = new URL(decode(nconf.get('proxy')));
              wconfig.proxy = proxy.hostname;
              wconfig.proxy_port = proxy.port;
            }
            const watson = new Watson(
              filepath,
              wconfig,
              en.watson,
              'en-US',
            );
            watson.start((data) => {
              const data2 = data;
              data2.engine = 'watson';
              sttResults(data2);
            });

            const watsonSpanish = new Watson(
              filepathSpanish,
              wconfig,
              es.watson,
              'es-US',
            );
            watsonSpanish.start((data) => {
              const data2 = data;
              data2.engine = 'watsonSpanish';
              sttResults(data2);
            });
          }
        });
      } else {
        info.info('STT Engines are disabled');
      }
    });

    socket.on('test-translation-engines', () => {
      adminLogger.debug('Incoming Socket.IO:test-translation-engines');
      if (decode(nconf.get('sttService')) === 'enabled') {
        mySqlConnection.query('SELECT * FROM language_code', (
          err,
          result,
        ) => {
          if (err) {
            error.error(`Error in INSERT: ${JSON.stringify(err)}`);
          } else {
            const en = result[0];
            const es = result[1];
            let configs;
            const text = 'esto fue originalmente en español';
            const wrapper = {};
            // Google Test block
            info.info('test google translate');
            const google = new GoogleT();
            google.translate(text, es.google_translate, en.google_translate, (err2, data) => {
              wrapper.TranslatedText = data;
              wrapper.engine = 'google';
              translationResults(wrapper);
              translationResults(data);
            });

            // Watson Test block
            info.info('Translating with watson');
            configs = JSON.parse(
              fs.readFileSync('./configs/watson/watson-translation.json'),
            );
            if (decode(nconf.get('proxy'))) {
              const proxy = new URL(decode(nconf.get('proxy')));
              configs.proxy = proxy.hostname;
              configs.proxy_port = proxy.port;
            }
            const watson = new WatsonT(configs);
            watson.translate(text, es.watson_translate, en.watson_translate, (err3, data) => {
              wrapper.TranslatedText = data;
              wrapper.engine = 'watson';
              translationResults(wrapper);
              translationResults(data);
            });

            // Azure
            info.info('Translating with azure');
            configs = JSON.parse(
              fs.readFileSync('./configs/azure/azure-translation.json'),
            );
            if (decode(nconf.get('proxy'))) {
              const proxy = new URL(decode(nconf.get('proxy')));
              configs.proxy = proxy;
            }
            const azure = new AzureT(configs);
            azure.translate(text, es.azure_translate, en.azure_translate, (err4, data) => {
              wrapper.TranslatedText = data;
              wrapper.engine = 'azure';
              translationResults(wrapper);
              translationResults(data);
            });

            // Amazon
            info.info('Translating with Amazon');
            const amazon = new AmazonT();
            amazon.translate(text, es.aws_translate, en.aws_translate, (err5, data) => {
              wrapper.TranslatedText = data;
              wrapper.engine = 'amazon';
              translationResults(wrapper);
            });
          }
        });
      } else {
        info.info('STT Engines are disabled');
      }
    });

    socket.on('test-resources', () => {
      testAsterisk();
      testMySQL();
    });

    socket.on('test-transcript-accuracy', (data) => {
      adminLogger.debug('Incoming Socket.IO:test-transcript-accuracy');

      const { transcript } = data;
      const { baseline } = data;
      testAccuracy('none', transcript, baseline);
    });

    socket.on('test-scenario-accuracy', (data) => {
      adminLogger.debug('Incoming Socket.IO:test-translation-accuracy');

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
      if (decode(nconf.get('proxy'))) {
        const proxy = new URL(decode(nconf.get('proxy')));
        aconfig.proxy = proxy.hostname;
        aconfig.proxy_port = proxy.port;
      }
      aconfig.file = filepath;
      aconfig.language = 'en-US';
      const azure = new Azure(aconfig);

      let azureTranscript = '';
      azure.start((data2) => {
        if (Object.prototype.hasOwnProperty.call(data2, 'end')) setTimeout(() => testAccuracy('azure', azureTranscript, baseline), 80000);
        if (data2.final) azureTranscript += data2.transcript;
      });

      // Google Test block
      const google = new Google(filepath, 'en-US', false);
      let googleTranscript = '';
      google.start((data3) => {
        if (Object.prototype.hasOwnProperty.call(data3, 'end')) {
          testAccuracy('google', googleTranscript, baseline);
        }
        if (data3.final === true) googleTranscript += ` ${data3.transcript}`;
      });

      // Watson Test block
      const wconfig = JSON.parse(
        fs.readFileSync('./configs/watson/watson-stt.json'),
      );
      let watsonTranscript = '';
      if (decode(nconf.get('proxy'))) {
        const proxy = new URL(decode(nconf.get('proxy')));
        wconfig.proxy = proxy.hostname;
        wconfig.proxy_port = proxy.port;
      }
      const watson = new Watson(
        filepath,
        wconfig,
        'en-US_BroadbandModel',
        'en-US',
      );
      watson.start((data4) => {
        if (Object.prototype.hasOwnProperty.call(data4, 'end')) setTimeout(() => testAccuracy('watson', watsonTranscript, baseline), 110000);
        if (data4.final) {
          watsonTranscript += data.transcript;
          info.info('watson transcripts', watsonTranscript);
        }
      });
    });

    process.on('SIGINT', () => {
      info.info('SIGINT About to exit \n closing sql connection pool');
      mySqlConnection.end();
      process.exit();
    });

    process.on('uncaughtException', (e) => {
      error.error('Uncaught Exception...');
      error.error(e.stack);
      error.error('closing sql connection pool');
      if (e) {
        mySqlConnection.end();
        process.exit();
      }
    });

    socket.on('disconnect', (reason) => {
      error.error('socket disconnected ', reason);
      mySqlConnection.end();
    });
  });
};
