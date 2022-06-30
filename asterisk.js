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

const AsteriskManager = require('asterisk-manager');
const nconf = require('nconf');
const fs = require('fs');
// const util = require('util');
const moment = require('moment');
const mysql = require('mysql');
const HashMap = require('hashmap');
const Watson = require('./transcription/watson');
const Google = require('./transcription/google');
const PredefinedTranscripts = require('./transcription/predefined');
const Azure = require('./transcription/azure');
const Amazon = require('./transcription/amazon');
const WatsonT = require('./translation/watson');
const GoogleT = require('./translation/google');
const AzureT = require('./translation/azure');
const AmazonT = require('./translation/amazon');
const decode = require('./utils/decode');
const validator = require('./utils/validator');

const channelToDigitMap = new HashMap();
const channelToDestChannelMap = new HashMap();

const winston = require('winston');
// const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

// Set log4js level from the config file
// logger.setLevel(decode(nconf.get('debuglevel')));
// log level hierarchy: ALL TRACE DEBUG INFO WARN ERROR FATAL OFF
// logger.trace('TRACE messages enabled.');
// console.log('DEBUG messages enabled.');
// console.log('INFO messages enabled.');
// logger.warn('WARN messages enabled.');
// logger.error('ERROR messages enabled.');
// logger.fatal('FATAL messages enabled.');
// console.log(`Using config file: ${cfile}`);

const transcriptFilePath = decode(nconf.get('transcriptFilePath'));
const wavFilePath = decode(nconf.get('wavFilePath'));
const adminExtension = decode(nconf.get('asterisk:ext_admin'))

let ami = null;

let s = "";

let is_iprelay = null;

let researchId = null;

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

const mySqlConnection = openMySqlConnection();

function sendAmiAction(obj) {
  ami.action(obj, (err) => {
    if (err) {
      error.error(`AMI Action error ${JSON.stringify(err)}`);
    }
  });
}

function translate(text, settings, callback) {
  if (settings.sourceLanguage === settings.targetLanguage) {
    callback(null, text); // no need to translate
  } else {
    let engine;
    let configs;
    switch (settings.translationEngine) {
      case 'GOOGLE':
        info.info('Translating with google');
        engine = new GoogleT();
        break;
      case 'WATSON':
        info.info('Translating with watson');
        configs = JSON.parse(
          fs.readFileSync('./configs/watson/watson-translation.json'),
        );

        if (decode(nconf.get('proxy'))) {
          const proxy = new URL(decode(nconf.get('proxy')));
          configs.proxy = proxy.hostname;
          configs.proxy_port = proxy.port;
        }

        engine = new WatsonT(configs);
        break;
      case 'AZURE':
        info.info('Translating with azure');
        configs = JSON.parse(
          fs.readFileSync('./configs/azure/azure-translation.json'),
        );

        if (decode(nconf.get('proxy'))) {
          const proxy = new URL(decode(nconf.get('proxy')));
          configs.proxy = proxy;
        }
        engine = new AzureT(configs);
        break;
      case 'AMAZON':
        info.info('Translating with Amazon');
        engine = new AmazonT();
        break;
      default:
        callback(null, text); // return original text
        break;
    }

    engine.translate(
      text,
      settings.sourceLanguage,
      settings.targetLanguage,
      (err, data) => {
        callback(err, data);
      },
    );
  }
}

function startTranscription(
  extension,
  sipFilename,
  pstnFilename,
  sttSettings,
  channel,
  srcExtension,
  langCodes,
) {
  let pstn;
  let engineCd = 'A';
  const file = `${wavFilePath + sipFilename}-out.wav16`;

  info.info(
    `Entering startTranscription() for extension: ${
      extension
    }, and file: ${
      file}`,
  );
  //sttSettings.sttEngine = "PREDEFINED"
  //sttSettings.predefined_id = 10;
  info.info(`STT Engine: ${sttSettings.sttEngine}`);
  info.info(`Delay: ${sttSettings.delay}`);
  info.info('language codes ', langCodes);
  const index0 = 0;
  const index1 = 1;
  const en = langCodes[index0];
  const es = langCodes[index1];
  let langCode;
  switch (sttSettings.sttEngine) {
    case 'GOOGLE': {
      // pstn = new Google(file, 'en');
      if (sttSettings.sourceLanguage === 'en') {
        langCode = en.google;
      }
      if (sttSettings.sourceLanguage === 'es') {
        langCode = es.google;
      }

      pstn = new Google(file, langCode);
      engineCd = 'G';
      info.info('Connected to Google');
      break;
    }
    case 'WATSON': {
      try {
        const config = JSON.parse(
          fs.readFileSync('./configs/watson/watson-stt.json'),
        );
        if (decode(nconf.get('proxy'))) {
          const proxy = new URL(decode(nconf.get('proxy')));
          config.proxy = proxy.hostname;
          config.proxy_port = proxy.port;
        }
        // pstn = new Watson(file, config, 'en-US_BroadbandModel');
        if (sttSettings.sourceLanguage === 'en') {
          langCode = en.watson;
        }
        if (sttSettings.sourceLanguage === 'es') {
          langCode = es.watson;
        }
        pstn = new Watson(file, config, langCode);
        engineCd = 'W';
        info.info('Connected to Watson');
      } catch (err) {
        error.error('Error loading configs/watson/watson-stt.json');
        error.error(err);
      }
      break;
    }
    case 'AZURE': {
      try {
        const config = JSON.parse(
          fs.readFileSync('./configs/azure/azure-cognitive.json'),
        );
        // config.key = config.key;
        // config.location = config.location;
        config.file = file;
        config.language = en.azure;
        if (sttSettings.sourceLanguage === 'es') {
          config.language = es.azure;
        }
        if (decode(nconf.get('proxy'))) {
          const proxy = new URL(decode(nconf.get('proxy')));
          config.proxy = proxy.hostname;
          config.proxy_port = proxy.port;
        }

        pstn = new Azure(config);
        engineCd = 'A';
        info.info('Connected Azure');
      } catch (err) {
        error.error('Error loading configs/azure/azure-cognitive.json');
        error.error(err);
      }
      break;
    }
    case 'AMAZON': {
      try {
        const config = {};
        config.file = file;
        config.language = en.aws;
        if (sttSettings.sourceLanguage === 'es') {
          config.language = es.aws;
        }

        pstn = new Amazon(config);
        engineCd = 'Z';
        info.info('Connected Amazon');
      } catch (err) {
        error.error('Error loading configs/amazon/amazon.json');
        error.error(err);
      }
      break;
    }
    case 'PREDEFINED': {
          console.log("PREDEFINED: " + sttSettings.predefined_id);
          pstn = new PredefinedTranscripts(sttSettings.predefined_id, mySqlConnection);
          engineCd = 'P';
          info.info('Connected to Predefined Transcripts');
          break;
    }
    default: {
      const now = new Date();
      sendAmiAction({
        Action: 'SendText',
        Channel: channel,
        Message: JSON.stringify({
          event: 'message-stream',
          extension,
          transcript:
            `Extension: ${
              extension
            } has not been configured for ACE Quill. Please add this extension in the administrative research portal.`,
          source: 'PSTN',
          sttengine: '?',
          final: true,
          timestamp: now,
          msgid: now.getTime(),
        }),
      });
    }
    // return;
  }
  const now = new Date();
  sendAmiAction({
    Action: 'SendText',
    Channel: channel,
    Message: JSON.stringify({
      event: 'message-stream',
      extension,
      transcript: '---Answered---',
      source: 'PSTN',
      sttengine: engineCd,
      final: true,
      timestamp: now,
      msgid: now.getTime(),
    }),
  });

  let pstnMsgTime = 0;
  pstn.start((data) => {
    if (pstnMsgTime === 0) {
      const d = new Date();
      pstnMsgTime = d.getTime();
    }
    const Data = data;
    Data.event = 'message-stream';
    Data.source = 'PSTN';
    Data.extension = extension;
    Data.msgid = pstnMsgTime;
    Data.sttengine = engineCd;

    let ip_config = JSON.parse(
          fs.readFileSync('./configs/acequill.json'),
        );
    if (ip_config.isIprelay == "true"){
      is_iprelay = 1;
    } else{
      is_iprelay = 0;
    }

    const dataStore = {
      transcript: Data.transcript,
      extension: Data.extension,
      final: Data.final,
      timestamp: Data.timestamp,
      raw: Data.raw,
      sttEngine: Data.sttengine,
      research_data_id: sttSettings.researchId,
      is_iprelay: is_iprelay,

    };
    info.info('callback dataStore, ', dataStore);
    mySqlConnection.query('INSERT INTO data_store SET ?', dataStore, (
      err,
      result,
    ) => {
      if (err) {
        error.error(`Error in INSERT: ${JSON.stringify(err)}`);
      } else {
        info.info(`INSERT result: ${JSON.stringify(result)}`);
      }
    });
    Data.raw = null; // dont need to send this to the phone
    // if (sttSettings.translationEngine !== 'NONE') {
    translate(Data.transcript, sttSettings, (err, translation) => {
      Data.transcript = err ? Data.transcript : translation;
      const delay = sttSettings.delay * 1000;
      setTimeout(() => {
        if (channel) {
          if (Buffer.byteLength(JSON.stringify(data)) > 1024){
            var theData = (JSON.stringify(data));
            var msgCount = Math.ceil((Buffer.byteLength(theData)) / 1024);
            var i = 0;
            var splitAt = Math.ceil(theData.length / msgCount);
            while (i < msgCount){
                i += 1;
                s = "Part " + i + " of " + msgCount + ": " + theData.slice(0, splitAt);
                sendAmiAction({
                  Action: 'SendText',
                  ActionID: data.msgid,
                  Channel: channel,
                  Message: s,
                });
                theData = theData.slice(splitAt);
            }
          } else {
            sendAmiAction({
                Action: 'SendText',
                ActionID: data.msgid,
                Channel: channel,
                Message: JSON.stringify(data),
          });
          }
        }
      }, delay);
      if (Data.final) {
        info.info(`PSTN: ${data.transcript}`);
        fs.appendFileSync(
          `${transcriptFilePath + pstnFilename}.txt`,
          `${+Data.timestamp}: ${Data.transcript}\n`,
        );
        if (sttSettings.sourceLanguage !== sttSettings.targetLanguage) {
          const translationData = {
            extension: srcExtension,
            translation: Data.transcript,
            timestamp: Data.timestamp,
            engine: sttSettings.translationEngine,
            msgid: Data.msgid,
            research_data_id: sttSettings.researchId,
          };
          mySqlConnection.query(
            'INSERT INTO translation_data SET ?',
            translationData,
            (err2,
              result2) => {
              if (err2) {
                error.error(`Error in INSERT: ${JSON.stringify(err2)}`);
              } else {
                info.info(`INSERT result: ${JSON.stringify(result2)}`);
              }
            },
          );
        }
        // reset pstnMsgTime;
        pstnMsgTime = 0;
      }
    });
    // }
  });
}

function handleManagerEvent(evt) {
  let extString;
  let extensionArray;
  let ext;

  if(evt.channel && evt.channel.startsWith(`PJSIP/${adminExtension}-`))
    return;

  switch (evt.event) {
    case 'DialEnd':

      /*
       * Listen for DialEnd to indicate a connected call.
       */
      info.info('****** Processing AMI DialEnd ******');
      console.log(`PJSIP/+${adminExtension}-`)
      if(evt.channel.startsWith(`PJSIP/${adminExtension}-`))
           break

      if (evt.dialstatus === 'ANSWER') {
        /*
         * Get the channel names (channel and destchannel)
         * Send AMI Monitor events for those channels
         *
         * Message Format
         * Action: Monitor
         * [ActionID:] <value>
         * Channel: <value>
         * [File:] <value>
         * [Format:] <value>
         * [Mix:] <value>
         */

        // console.log('Call connected');
        if (
          validator.isChannel(evt.channel)
          && validator.isChannel(evt.destchannel)
        ) {
          // Populate the map containing destchannel => EMPTY as an initial value
          channelToDigitMap.set(evt.destchannel, 'EMPTY');
          info.info(
            `DialEnd - setting channelToDigitMap: ${
              evt.destchannel
            } => `
          + 'EMPTY',
          );

          /*
           * Populate the map containing channel => destchannel
           * We need this because in the Hangup where we do the db update,
           * we only have access to the
           * channel, but, also need access to the destchannel.
           */
          info.info(
            `DialEnd - setting channelToDestChannelMap: ${
              evt.channel
            } => ${
              evt.destchannel}`,
          );
          channelToDestChannelMap.set(evt.channel, evt.destchannel);



          // Build unique filenames using timestamp and channel name
          const now = moment().format('MM-DD-YYYY_HH-mm-ss');
          let sipFilename = `${now}_${evt.channel}`;
          sipFilename = sipFilename.replace(/\//g, '-');
          info.info(`sipFilename: ${sipFilename}`);

          // Open the file for the SIP transcript text
          // const fdSip = fs.open(
          //   `${transcriptFilePath + sipFilename}.txt`,
          //   'w',
          //   (err, sfd) => {
          //     if (err) {
          //       logger.error(
          //         `Error opening SIP transcript text: ${JSON.stringify(err)}`,
          //       );
          //     }
          //     logger.info('SIP transcript file opened successfully!');
          //   },
          // );

          let pstnFilename = `${now}_${evt.destchannel}`;
          pstnFilename = pstnFilename.replace(/\//g, '-');
          info.info(`pstnFilename: ${pstnFilename}`);

          // Open the file for the PSTN transcript text
          // const fdPstn = fs.open(
          //   `${transcriptFilePath + pstnFilename}.txt`,
          //   'w',
          //   (err, sfd) => {
          //     if (err) {
          //       logger.error('Error opening PSTN transcript text');
          //     }

          //     logger.info('PSTN transcript file opened successfully!');
          //   },
          // );

          info.info(`channel 1: ${evt.channel}`);
          info.info(`channel 2: ${evt.destchannel}`);
          /*
                    var calleeRecordCommand = {
                      Action: "MixMonitor",
                      Channel: evt.destchannel,
                      File: wavFilePath + pstnFilename + "-callee-out.wav16",
                      //Format: "wav16",
                      //Mix: "false",
                  options: "t("+wavFilePath + pstnFilename + "-callee-first.wav16)",
                    };

                    console.log(
                      "Outgoing AMI Action for Callee: " +
                        JSON.stringify(calleeRecordCommand)
                    );

                    sendAmiAction(calleeRecordCommand);
          */
          const mixMonitorCommand = {
            Action: 'MixMonitor',
            Channel: evt.channel,
            File: `${wavFilePath + pstnFilename}-mix.wav16`,
            options: `r(${wavFilePath}${pstnFilename}-callee-out.wav16) t(${wavFilePath}${pstnFilename}-caller-out.wav16)`,
          };

          info.info(
            `Outgoing AMI Action for Caller: ${
              JSON.stringify(mixMonitorCommand)}`,
          );

          sendAmiAction(mixMonitorCommand);

          // Extract the extension from the DialEnd, looks like this:   channel: 'SIP/5001-00000000'
          extString = evt.channel;
          extensionArray = extString.split(/[/,-]/);
          const index = 1;
          ext = extensionArray[index];

          // get dest channel
          const destString = evt.destchannel;
          const destArray = destString.split(/[/,-]/);
          const dest = destArray[1];

          const sql = '(SELECT id, extension, stt_engine, delay, default_device, translation_engine, source_language, target_language, ARIA_settings, tts_engine, predefined_id FROM device_settings WHERE extension = ?) '
            + 'UNION '
            + '(SELECT id, extension, stt_engine, delay, default_device, translation_engine, source_language, target_language, ARIA_settings, tts_engine, predefined_id FROM device_settings WHERE default_device = 1) '
            + 'LIMIT 1;';

          mySqlConnection.query(sql, ext, (err, result) => {
            if (err) {
              error.error(`Error in UPDATE statement: ${JSON.stringify(err)}`);
              throw err;
            } else {
              info.info(`MySQL INSERT result: ${JSON.stringify(result)}`);
              const sttSettings = {
                sttEngine: result[0] ? result[0].stt_engine : 'UNKNOWN',
                delay: result[0] ? result[0].delay : '0',
                translationEngine: result[0]
                  ? result[0].translation_engine
                  : 'UNKNOWN',
                sourceLanguage: result[0]
                  ? result[0].source_language
                  : 'UNKNOWN',
                targetLanguage: result[0]
                  ? result[0].target_language
                  : 'UNKNOWN',
                ttsEngine: result[0]
                  ? result[0].tts_engine
                  : 'UNKNOWN',
                ariaSettings: result[0] ? result[0].ARIA_settings : 'UNKNOWN',
                predefined_id: result[0]
                ? result[0].predefined_id
                : 'UNKNOWN',
              };
              /*
                            startTranscription(
                              ext,
                              sipFilename,
                              pstnFilename,
                              sttSettings,
                              evt.channel
                            );
              */
              // startTranscription(dest, pstnFilename, sipFilename,sttSettings, evt.destchannel);
              // mw both sides
              const milliseconds = new Date().getTime();
              // Insert MySQL insert here
              info.info('DialEnd MySQL Data');
              info.info('Device ID: 1');
              info.info(`Extension: ${ext}`);
              info.info(`Source channel: ${evt.channel}`);
              info.info(`Dest channel: ${evt.destchannel}`);
              info.info(`Call start: ${milliseconds}`);
              info.info(`Unique ID: ${evt.uniqueid}`);
              info.info(`Dest Phone number: ${evt.destcalleridnum}`);
              info.info(`STT Engine: ${sttSettings.sttEngine}`);
              info.info(`STT Delay: ${sttSettings.delay}`);
              info.info(
                `Translation Engine: ${sttSettings.translationEngine}`,
              );
              info.info(`Source Langauge: ${sttSettings.sourceLanguage}`);
              info.info(`Target Language: ${sttSettings.targetLanguage}`);
              info.info(`TTS Engine: ${sttSettings.ttsEngine}`);
              info.info('Call Accuracy: 100%');
              info.info(`Transcript File Path: ${transcriptFilePath}`);
              info.info(`Transcript File: ${pstnFilename}.txt`);
              info.info(`Wav File Path: ${wavFilePath}`);
              info.info(`Wav File: ${pstnFilename}-mix.wav16`);

              const buildNumber = null;
              const gitCommit = null;
              // const deviceId = null;
              // TODO: we'll register the devices and and this back.
              /*
                            mySqlConnection.query(
                              "SELECT build_number, git_commit, device_id FROM registration_data
                              WHERE extension = ?",
                              ext,
                              function (err, result) {
                                if (err) {
                                  console.log("Error in SELECT " + err);
                                  throw err;
                                } else {
                                  console.log("SELECT success: " + JSON.stringify(result));
                                  buildNumber = result[0].build_number;
                                  console.log("buildNumber: " + buildNumber);

                                  gitCommit = result[0].git_commit;
                                  console.log("gitCommit: " + gitCommit);

                                  deviceId = result[0].device_id;
                                  console.log("deviceId: " + deviceId);
              */



              const mySet = {
                device_id: ext, // deviceId,
                extension: ext,
                src_channel: evt.channel,
                dest_channel: evt.destchannel,
                unique_id: evt.uniqueid,
                dest_phone_number: evt.destcalleridnum,
                stt_engine: sttSettings.sttEngine,
                translation_engine: sttSettings.translationEngine,
                source_language: sttSettings.sourceLanguage,
                target_language: sttSettings.sourceLanguage,
                tts_engine: sttSettings.ttsEngine,
                call_accuracy: 100,
                added_delay: sttSettings.delay,
                transcription_file_path: transcriptFilePath,
                transcription_file: `${pstnFilename}.txt`,
                audio_file_path: wavFilePath,
                audio_file: `${pstnFilename}-mix.wav16`,
                build_number: buildNumber,
                git_commit: gitCommit,
                is_iprelay: is_iprelay,
                predefined_id: sttSettings.predefined_id,
              };

              info .info(`Call data: ${JSON.stringify(mySet)}`);

              mySqlConnection.query(
                'INSERT INTO research_data SET ?',
                mySet,
                (err2, result2) => {
                  if (err2) {
                    error.error(`Error in INSERT: ${JSON.stringify(err2)}`);
                  } else {
                    info.info(`INSERT result: ${JSON.stringify(result2)}`);
                    sttSettings.researchId = result2.insertId;

                    researchId = sttSettings.researchId;


                    // let en;
                    // let es;
                    mySqlConnection.query('SELECT * FROM language_code', (
                      err3,
                      result3,
                    ) => {
                      if (err3) {
                        error.error(`Error in INSERT: ${JSON.stringify(err3)}`);
                      } else {
                        info.info(`language code result: ${JSON.stringify(result3)}`);
                        startTranscription(
                          ext,
                          // sipFilename + "-caller",
                          `${pstnFilename}-caller`,
                          `${pstnFilename}-callee`,
                          sttSettings,
                          evt.channel,
                          dest,
                          result3,
                        );

                        // Extension to Extension are 4 digits,
                        // if dest is 4 in length must be terminal to terminal.
                        if (dest.length === 4) {
                          // Reverse the language settings for the destination caller
                          const destSettings = JSON.parse(
                            JSON.stringify(sttSettings),
                          ); // Must copy the JSON Object, otherwise both ext's will be effected.
                          destSettings.sourceLanguage = sttSettings.targetLanguage;
                          destSettings.targetLanguage = sttSettings.sourceLanguage;
                          startTranscription(
                            dest,
                            // sipFilename,
                            `${pstnFilename}-callee`, // mw test 1009
                            `${pstnFilename}-caller`,
                            destSettings,
                            evt.destchannel,
                            ext,
                            result2,
                          );
                        }
                      }
                    });
                  }
                },
              );


              // }
              // }
              // );
            }
          });
        }
      }
      break;
    case 'Hangup': {
      /*
       * Note - We will receive two hangups, once per channel, so,
       * just process them one at a time.
       */

      /*
       *  Send a StopMonitor action here:
       *
       *  Message Format
       *  Action: StopMonitor
       *  [ActionID:] <value>
       *  Channel: <value>
       *
       */

      info.info('****** Processing AMI Hangup ******');

      /*
       * Extract the extension from the Hangup.  Note, we will get two hangup messages:
       * 1. channel: 'SIP/5001-00000000'
       * 2. channel: 'SIP/twilio0-00000001',
       *
       * I'm assuming we want to send the hangup based on the SIP-side hangup.
       */
      extString = evt.channel;
      extensionArray = extString.split(/[/,-]/);
      const index = 1;
      ext = extensionArray[index];

      if (ext.includes('twilio') === false) {
        sendAmiAction({
          Action: 'SendText',
          Channel: evt.channel,
          Message: JSON.stringify({
            event: 'end-call',
            extension: ext,
            time: new Date(),
          }),
        });
      }
      /*
       * Since we get two hangups, we only one call the database insert once.  For
       * the SIP side of the call, the uniqueid and destunique are equal.
       *
       */

      if(researchId){
       let sql = 'SELECT is_iprelay FROM data_store WHERE research_data_id = ? LIMIT 1';

      mySqlConnection.query(sql, researchId, (err, result) => {
          if (err){
            error.error("error!!" + err)
          } else{
            let sql = 'UPDATE research_data SET is_iprelay = ? WHERE id = ?'

            if (result.length != 0){
                let args = [result[0].is_iprelay, researchId]
                mySqlConnection.query(sql, args,
                (err, result) => {
                  if(err){
                    console.log("error:" + err);
                  } else {
                    console.log("Success!!!");
                  }
                }
              );
            }
          }
      } );
    }



      if (evt.uniqueid === evt.linkedid && validator.isUniqueId(evt.uniqueid)) {
        let sql = 'UPDATE research_data SET call_end = CURRENT_TIMESTAMP(), ';
        sql
          += 'call_duration = UNIX_TIMESTAMP(call_end) - UNIX_TIMESTAMP(call_start)';
        sql += ' WHERE unique_id = ?;';

        const params = evt.uniqueid;

        info.info(`Hangup SQL statement: ${sql}`);
        info.info(`Hangup SQL statement: ${params}`);

        mySqlConnection.query(sql, params, (err, result) => {
          if (err) {
            error.error(`Error in UPDATE statement: ${JSON.stringify(err)}`);
            throw err;
          } else {
            info.info(`MySQL INSERT result: ${JSON.stringify(result)}`);
          }
        });
      }

      // This should be the channel containing twilio
      if (channelToDigitMap.has(evt.channel)) {
        info.info(
          `Hangup, - deleting ${evt.channel} from channelToDigitMap`,
        );
        channelToDigitMap.delete(evt.channel);
      }

      if (channelToDestChannelMap.has(evt.channel)) {
        info.info(
          `Hangup, - deleting ${evt.channel} from channelToDestChannelMap`,
        );
        channelToDestChannelMap.delete(evt.channel);
      }

      break;
    }
    case 'DTMFBegin': {
      /*
        Event: DTMFBegin
        Privilege: dtmf,all
        Channel: SIP/twilio0-0000000d
        ChannelState: 6
        ChannelStateDesc: Up
        CallerIDNum: 7034548537
        CallerIDName: <unknown>
        ConnectedLineNum: 8449060685
        ConnectedLineName: ntldevsip2
        Language: en
        AccountCode:
        Context: from-twilio
        Exten:
        Priority: 1
        Uniqueid: 1507661182.19
        Linkedid: 1507661182.18
        Digit: 1
        Direction: Sent
      */
      info.info('****** Processing AMI DTMFBegin ******');
      // logger.info(`Received DTMF: ${util.inspect(evt, false, null)}`);

      info.info('Contents of map before:');
      channelToDigitMap.forEach((value, key) => {
        info.info(`${key} => ${value}`);
      });

      /*
       * Extract the extension from the Hangup.  Note, we will get two hangup messages:
       * 1. channel: 'SIP/5001-00000000'
       * 2. channel: 'SIP/twilio0-00000001',
       *
       * I'm assuming we want to send the hangup based on the SIP-side hangup.
       */
      extString = evt.channel;
      extensionArray = extString.split(/[/,-]/);
      const index = 1;
      ext = extensionArray[index];

      //
      if (ext.includes('twilio') === true) {
        /* Store the channel => digit map here
         *  Originally set to EMPTY to make sure we only set it once
         */
        if (channelToDigitMap.get(evt.channel) === 'EMPTY') {
          info.info(
            `DTMFBegin - setting channelToDigitMap ${
              evt.channel
            } => ${
              evt.digit}`,
          );
          channelToDigitMap.set(evt.channel, evt.digit);
          // Validate both digit and linkedid (linkedid is same Format of uniqueid) are numbers.
          if (
            validator.isDtmfDigit(evt.digit)
            && validator.isUniqueId(evt.linkedid)
          ) {
            const sql = 'UPDATE research_data SET scenario_number = ? WHERE unique_id = ?;';
            const params = [evt.digit, evt.linkedid];
            info.info(`DTMF SQL statement: ${sql}`);
            info.info(`DTMF SQL params: ${params}`);
            mySqlConnection.query(sql, params, (err, result) => {
              if (err) {
                error.error(
                  `Error in UPDATE statement: ${JSON.stringify(err)}`,
                );
                throw err;
              } else {
                info.info(`MySQL UPDATE result: ${JSON.stringify(result)}`);
              }
            });
          }
        } else {
          info.info('No match in the channelToDigitMap');
        }
      }

      info.info('Contents of map after:');
      channelToDigitMap.forEach((value, key) => {
        info.info(`${key} => ${value}`);
      });

      break;
    }

    case 'UserEvent':
      info.info('AMI Event: UserEvent');
      if (evt.userevent === 'SIPMESSAGE') {
        /*
        { event: 'UserEvent',
          privilege: 'user,all',
          channel: 'Message/ast_msg_queue',
          channelstate: '6',
          channelstatedesc: 'Up',
          calleridnum: '<unknown>',
          calleridname: '<unknown>',
          connectedlinenum: '<unknown>',
          connectedlinename: '<unknown>',
          language: 'en',
          accountcode: '',
          context: 'sip-message',
          exten: '9999',
          priority: '6',
          uniqueid: '1513789882.0',
          linkedid: '1513789882.0',
          userevent: 'SIPMESSAGE',
          eventcustom: 'register-ext',
          extension: '5001',
          buildnbr: '1047',
          gitcommit: 'c773c8dbc0dcf8c06938542ac06d6ee30a3ca217',
          deviceid: '17ee4e3d9b203b7a' }
        */
        if (
          evt.eventcustom
          && evt.extension
          && evt.buildnbr
          && evt.gitcommit
          && evt.deviceid
        ) {
          const sql = 'INSERT INTO registration_data SET ? ON DUPLICATE KEY UPDATE build_number = ?, git_commit = ?, device_id = ?';

          const extension = parseInt(evt.extension, 10);
          const buildNumber = evt.buildnbr.toString();
          const gitCommit = evt.gitcommit.toString();
          const deviceId = evt.deviceid.toString();

          const myRegisterData = {
            extension,
            build_number: buildNumber,
            git_commit: gitCommit,
            device_id: deviceId,
          };
          mySqlConnection.query(
            sql,
            [myRegisterData, buildNumber, gitCommit, deviceId],
            (err, result) => {
              if (err) {
                error.error(
                  `Error in UPDATE statement: ${JSON.stringify(err)}`,
                );
                throw err;
              } else {
                info.info(`MySQL UPDATE result: ${JSON.stringify(result)}`);
              }
            },
          );
        }
      }

      break;
    default:
      break;
  }
}

function initAmi() {
  if (ami === null) {
    try {
      ami = new AsteriskManager(
        decode(nconf.get('asterisk:port')),
        decode(nconf.get('asterisk:host')),
        decode(nconf.get('asterisk:user')),
        decode(nconf.get('asterisk:password')),
        true,
      );

      ami.keepConnected();

      // Define event handlers here
      ami.on('managerevent', handleManagerEvent);

      info.info('Connected to Asterisk');
    } catch (exp) {
      info.info(`Init AMI error${JSON.stringify(exp)}`);
    }
  }
}

initAmi();

process.on('SIGINT', () => {
  info.info('SIGINT About to exit \n closing sql connection pool');
  mySqlConnection.end();
  process.exit();
});

process.on('uncaughtException', (e) => {
  error.error('Uncaught Exception...');
  error.error(e.stack);
  error.error('closing sql connection pool');
  mySqlConnection.end();
  process.exit();
});
