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
const config = require('./configs/config.js');
const AsteriskManager = require('asterisk-manager');
const fs = require('fs');
// const util = require('util');
const moment = require('moment');
const mysql = require('mysql2/promise');
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
const validator = require('./utils/validator');

const channelToDigitMap = new HashMap();
const channelToDestChannelMap = new HashMap();

const transcriptFilePath = config.transcriptFilePath;
const wavFilePath = config.wavFilePath;
const adminExtension = config.adminExtension;

const constants = require('./configs/constants');

let ami = null;

let s = "";

let is_iprelay = null;

let researchId = null;

function openMySqlConnection() {
  console.info('watson sql pool connection');
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

function sendAmiAction(obj) {
  console.log(obj)
  ami.action(obj, (err) => {
    if (err) {
      console.error(`AMI Action error ${JSON.stringify(err)}`);
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
        console.info('Translating with google');
        engine = new GoogleT();
        break;
      case 'WATSON':
        console.info('Translating with watson');
        configs = JSON.parse(
          fs.readFileSync('./configs/watson/watson-translation.json'),
        );

        if (config.proxy) {
          const proxy = new URL(config.proxy);
          configs.proxy = proxy.hostname;
          configs.proxy_port = proxy.port;
        }

        engine = new WatsonT(configs);
        break;
      case 'AZURE':
        console.info('Translating with azure');
        configs = JSON.parse(
          fs.readFileSync('./configs/azure/azure-translation.json'),
        );

        if (config.proxy) {
          const proxy = new URL(config.proxy);
          configs.proxy = proxy;
        }
        engine = new AzureT(configs);
        break;
      case 'AMAZON':
        console.info('Translating with Amazon');
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
  audio,
  sttSettings,
  channel,
  srcExtension,
  isOutgoing,
  isIncoming,
  aqInternalCall
) {
  let pstn;
  let engineCd = 'A';
  //const file = `${wavFilePath + sipFilename}-out.wav16`;
  const file = `${wavFilePath + audio}-out.wav16`;

  console.info(
    `Entering startTranscription() for extension: ${extension
    }, and file: ${file}`,
  );
  //sttSettings.sttEngine = "PREDEFINED"
  //sttSettings.predefined_id = 10;
  console.info(`STT Engine: ${sttSettings.sttEngine}`);
  console.info(`Delay: ${sttSettings.delay}`);
  const index0 = 0;
  const index1 = 1;
  let langCode;
  switch (sttSettings.sttEngine) {
    case 'GOOGLE': {
      // pstn = new Google(file, 'en');
      if (sttSettings.sourceLanguage === 'en') {
        langCode = constants.LANGUAGE_CODES.US_ENGLISH.GOOGLE;
      }
      if (sttSettings.sourceLanguage === 'es') {
        langCode = constants.LANGUAGE_CODES.US_SPANISH.GOOGLE;
      }
      pstn = new Google(file, langCode, sttSettings.auto_punctuation, sttSettings.v2);
      engineCd = 'G';
      console.info('Connected to Google');
      break;
    }
    case 'WATSON': {
      try {
        const config = JSON.parse(
          fs.readFileSync('./configs/watson/watson-stt.json'),
        );
        if (config.proxy) {
          const proxy = new URL(config.proxy);
          config.proxy = proxy.hostname;
          config.proxy_port = proxy.port;
        }
        // pstn = new Watson(file, config, 'en-US_BroadbandModel');
        if (sttSettings.sourceLanguage === 'en') {
          langCode = constants.LANGUAGE_CODES.US_ENGLISH.WATSON;
        }
        if (sttSettings.sourceLanguage === 'es') {
          langCode = constants.LANGUAGE_CODES.US_SPANISH.WATSON;
        }
        pstn = new Watson(file, config, langCode, sttSettings.background_audio_suppression, sttSettings.speech_detector_sensitivity);
        engineCd = 'W';
        console.info('Connected to Watson');
      } catch (err) {
        console.error('Error loading configs/watson/watson-stt.json');
        console.error(err);
      }
      break;
    }
    case 'AZURE': {
      try {
        const config = JSON.parse(
          fs.readFileSync('./configs/azure/azure-cognitive.json'),
        );
        config.file = file;
        config.language = constants.LANGUAGE_CODES.US_ENGLISH.AZURE;
        if (sttSettings.sourceLanguage === 'es') {
          config.language = constants.LANGUAGE_CODES.US_SPANISH.AZURE;
        }
        if (config.proxy) {
          const proxy = new URL(config.proxy);
          config.proxy = proxy.hostname;
          config.proxy_port = proxy.port;
        }
        config.stt_dropout_enabled = sttSettings.stt_dropout_enabled;
        config.stt_dropout_interval = sttSettings.stt_dropout_interval;
        config.stt_dropout_length_min = sttSettings.stt_dropout_length_min;
        config.stt_dropout_length_max = sttSettings.stt_dropout_length_max;

        pstn = new Azure(config);
        engineCd = 'A';
        console.info('Connected Azure');
      } catch (err) {
        console.error('Error loading configs/azure/azure-cognitive.json');
        console.error(err);
      }
      break;
    }
    case 'AMAZON': {
      try {
        const config = {};
        config.file = file;
        config.language = constants.LANGUAGE_CODES.US_ENGLISH.AMAZON;
        if (sttSettings.sourceLanguage === 'es') {
          config.language = constants.LANGUAGE_CODES.US_SPANISH.AMAZON;
        }

        pstn = new Amazon(config);
        engineCd = 'Z';
        console.info('Connected Amazon');
      } catch (err) {
        console.error('Error loading configs/amazon/amazon.json');
        console.error(err);
      }
      break;
    }
    case 'PREDEFINED': {
      console.info("PREDEFINED: " + sttSettings.predefined_id);
      pstn = new PredefinedTranscripts(sttSettings.predefined_id, mySqlConnection);
      engineCd = 'P';
      console.info('Connected to Predefined Transcripts');
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
            `Extension: ${extension
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

  if (!isOutgoing) {
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
        type: "info",
        isIncoming: true,
        msgid: now.getTime(),
      }),
    });
  }

  let pstnMsgTime = 0;
  pstn.start(async (data) => {
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
    Data.isOutgoing = isOutgoing;
    Data.isIncoming = isIncoming;

    let ip_config = JSON.parse(
      fs.readFileSync('./configs/acequill.json'),
    );
    if (ip_config.isIprelay == "true") {
      is_iprelay = 1;
    } else {
      is_iprelay = 0;
    }

    const dataStore = {
      transcript: Data.transcript,
      extension: Data.extension,
      final: Data.final,
      timestamp: Data.timestamp,
      raw: (Data.sttengine == 'A') ? null : Data.raw,
      sttEngine: Data.sttengine,
      research_data_id: sttSettings.researchId,
      is_iprelay: is_iprelay,

    };
    console.info('callback dataStore, ', dataStore);
    try{
      const [result, _fields] = await mySqlConnection.query('INSERT INTO data_store SET ?', dataStore);
      console.info(`INSERT result: ${JSON.stringify(result)}`);
    }
    catch(error){
      console.error(`Error in INSERT: ${JSON.stringify(error)}`);
    }

    Data.raw = null; // dont need to send this to the phone
    // if (sttSettings.translationEngine !== 'NONE') {
    translate(Data.transcript, sttSettings, async (err, translation) => {
      Data.transcript = err ? Data.transcript : translation;
      const delay = sttSettings.delay * 1000;
      setTimeout(() => {
        if (channel) {
          if (Buffer.byteLength(JSON.stringify(data)) > 1024) {
            var theData = (JSON.stringify(data));
            var msgCount = Math.ceil((Buffer.byteLength(theData)) / 1024);
            var i = 0;
            var splitAt = Math.ceil(theData.length / msgCount);
            while (i < msgCount) {
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
            if (aqInternalCall) {
              data.isIncoming = !data.isIncoming;
              data.isOutgoing = !data.isOutgoing;
              sendAmiAction({
                Action: 'SendText',
                ActionID: data.msgid,
                Channel: aqInternalCall,
                Message: JSON.stringify(data),
              });
            }
          }
        }
      }, delay);
      if (Data.final) {
        console.info(`PSTN: ${data.transcript}`);
        fs.appendFileSync(
          `${transcriptFilePath + audio}.txt`,
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
          try {
            const [result2, _fields2] = await mySqlConnection.query('INSERT INTO translation_data SET ?', translationData);
            console.info(`INSERT result: ${JSON.stringify(result2)}`);
          } catch (error) {
            console.error(`Error in INSERT: ${JSON.stringify(error)}`);
          }
        }
        // reset pstnMsgTime;
        pstnMsgTime = 0;
      }
    });
    // }
  });
}

async function handleManagerEvent(evt) {
  let extString;
  let extensionArray;
  let ext;

  if (evt.channel && evt.channel.startsWith(`PJSIP/${adminExtension}-`))
    return;

  switch (evt.event) {
    case 'DialEnd':

      /*
       * Listen for DialEnd to indicate a connected call.
       */
      console.info('****** Processing AMI DialEnd ******');
      console.info(`PJSIP/+${adminExtension}-`)
      if (evt.channel.startsWith(`PJSIP/${adminExtension}-`))
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

        // console.info('Call connected');
        if (
          validator.isChannel(evt.channel)
          && validator.isChannel(evt.destchannel)
        ) {
          // Populate the map containing destchannel => EMPTY as an initial value
          channelToDigitMap.set(evt.destchannel, 'EMPTY');
          console.info(
            `DialEnd - setting channelToDigitMap: ${evt.destchannel
            } => `
            + 'EMPTY',
          );

          /*
           * Populate the map containing channel => destchannel
           * We need this because in the Hangup where we do the db update,
           * we only have access to the
           * channel, but, also need access to the destchannel.
           */
          console.info(
            `DialEnd - setting channelToDestChannelMap: ${evt.channel
            } => ${evt.destchannel}`,
          );
          channelToDestChannelMap.set(evt.channel, evt.destchannel);

          // Build unique filenames using timestamp and channel name
          const now = moment().format('MM-DD-YYYY_HH-mm-ss');
          let sipFilename = `${now}_${evt.channel}`;
          sipFilename = sipFilename.replace(/\//g, '-');
          console.info(`sipFilename: ${sipFilename}`);

          let pstnFilename = `${now}_${evt.destchannel}`;
          pstnFilename = pstnFilename.replace(/\//g, '-');
          console.info(`pstnFilename: ${pstnFilename}`);


          console.info(`channel 1: ${evt.channel}`);
          console.info(`channel 2: ${evt.destchannel}`);

          const mixMonitorCommand = {
            Action: 'MixMonitor',
            Channel: evt.channel,
            File: `${wavFilePath + pstnFilename}-mix.wav16`,
            options: `r(${wavFilePath}${pstnFilename}-callee-out.wav16) t(${wavFilePath}${pstnFilename}-caller-out.wav16)`,
          };

          console.info(
            `Outgoing AMI Action for Caller: ${JSON.stringify(mixMonitorCommand)}`,
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
          let sttSettings = {};
          try {
            sttSettings = await getExtensionSettings(ext);
          }
          catch (error) {
            console.info("ERROR GETTING EXTENSION SETTINGS", error);
            return;
          }
          
          const milliseconds = new Date().getTime();
          // Insert MySQL insert here
          console.info('DialEnd MySQL Data');
          console.info('Device ID: 1');
          console.info(`Extension: ${ext}`);
          console.info(`Source channel: ${evt.channel}`);
          console.info(`Dest channel: ${evt.destchannel}`);
          console.info(`Call start: ${milliseconds}`);
          console.info(`Unique ID: ${evt.uniqueid}`);
          console.info(`Dest Phone number: ${evt.destcalleridnum}`);
          console.info(`STT Engine: ${sttSettings.sttEngine}`);
          console.info(`STT Delay: ${sttSettings.delay}`);
          console.info(`STT Background Audio Suppression: ${sttSettings.background_audio_suppression}`);
          console.info(`STT Speech Detector Sensitivity: ${sttSettings.speech_detector_sensitivity}`);
          console.info(
            `Translation Engine: ${sttSettings.translationEngine}`,
          );
          console.info(`Source Langauge: ${sttSettings.sourceLanguage}`);
          console.info(`Target Language: ${sttSettings.targetLanguage}`);
          console.info(`TTS Engine: ${sttSettings.ttsEngine}`);
          console.info('Call Accuracy: 100%');
          console.info(`Transcript File Path: ${transcriptFilePath}`);
          console.info(`Transcript File: ${pstnFilename}.txt`);
          console.info(`Wav File Path: ${wavFilePath}`);
          console.info(`Wav File: ${pstnFilename}-mix.wav16`);

          const buildNumber = null;
          const gitCommit = null;

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

          console.info(`Call data: ${JSON.stringify(mySet)}`);
          try {
            const [result, _fields] = await mySqlConnection.query('INSERT INTO research_data SET ?', mySet);
            console.info(`INSERT result: ${JSON.stringify(result)}`);
            sttSettings.researchId = result.insertId;
            researchId = sttSettings.researchId;
          } catch (error) {
            console.error(`Error in INSERT: ${JSON.stringify(error)}`);
          }
          // if dest is 4 in length must be terminal to terminal.
          let aqCall = dest.length === 4 ? evt.destchannel : false;
          console.info("MW ORIGIN CAPTIONS TURN ON FOR", ext);
          console.info("MW AND AQ DUAL", aqCall && sttSettings.dual_enabled)
          startTranscription(
            ext,
            `${pstnFilename}-caller`,
            sttSettings,
            evt.channel,
            dest,
            false,
            true,
            aqCall
          );
        
        if (aqCall) {
          try {
            const destSettings = await getExtensionSettings(dest);
          }
          catch (error) {
            console.error('Error fetching destSettings ', error);
          }
          if (destSettings) {
            console.info("MW REC CAPTIONS TURN ON FOR", dest);
            console.info("MW AND AQ DUAL", aqCall && destSettings.dual_enabled)
            console.info(JSON.stringify(destSettings, null, 2))
            destSettings.researchId = researchId;
            const aqCallChannel = evt.channel
              startTranscription(
                dest,
                `${pstnFilename}-callee`,
                destSettings,
                evt.destchannel,
                ext,
                false,
                true,
                aqCallChannel
              );
          }
        }
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

      console.info('****** Processing AMI Hangup ******');

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

      if (researchId) {
        try {
          const [result, _fields] = await mySqlConnection.query('SELECT is_iprelay FROM data_store WHERE research_data_id = ? LIMIT 1', researchId);
          if (result.length > 0) {
            await mySqlConnection.query('UPDATE research_data SET is_iprelay = ? WHERE id = ?', [result[0].is_iprelay, researchId]);
          }
        } catch (error) {
          console.error("Error fetching and setting is_iprelay" + error);
        }
      }

      if (evt.uniqueid === evt.linkedid && validator.isUniqueId(evt.uniqueid)) {
        let sql = 'UPDATE research_data SET call_end = CURRENT_TIMESTAMP(), ';
        sql += 'call_duration = UNIX_TIMESTAMP(call_end) - UNIX_TIMESTAMP(call_start)';
        sql += ' WHERE unique_id = ?;';

        const params = evt.uniqueid;

        console.info(`Hangup SQL statement: ${sql}`);
        console.info(`Hangup SQL statement: ${params}`);
        try {
          const [result3, _fields3] = await mySqlConnection.query(sql, params);
          console.info(`MySQL INSERT result: ${JSON.stringify(result3)}`);
        }
        catch (error) {
          console.error(`Error in UPDATE statement for research_data: ${JSON.stringify(error)}`);
          throw error;
        }
      }

      // This should be the channel containing twilio
      if (channelToDigitMap.has(evt.channel)) {
        console.info(
          `Hangup, - deleting ${evt.channel} from channelToDigitMap`,
        );
        channelToDigitMap.delete(evt.channel);
      }

      if (channelToDestChannelMap.has(evt.channel)) {
        console.info(
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
      console.info('****** Processing AMI DTMFBegin ******');
      // logger.info(`Received DTMF: ${util.inspect(evt, false, null)}`);

      console.info('Contents of map before:');
      channelToDigitMap.forEach((value, key) => {
        console.info(`${key} => ${value}`);
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
          console.info(
            `DTMFBegin - setting channelToDigitMap ${evt.channel
            } => ${evt.digit}`,
          );
          channelToDigitMap.set(evt.channel, evt.digit);
          // Validate both digit and linkedid (linkedid is same Format of uniqueid) are numbers.
          if (
            validator.isDtmfDigit(evt.digit)
            && validator.isUniqueId(evt.linkedid)
          ) {
            const sql = 'UPDATE research_data SET scenario_number = ? WHERE unique_id = ?;';
            const params = [evt.digit, evt.linkedid];
            console.info(`DTMF SQL statement: ${sql}`);
            console.info(`DTMF SQL params: ${params}`);
            try{
              const [result4, _fields4] = await mySqlConnection.query(sql, params);
              console.info(`MySQL UPDATE result: ${JSON.stringify(result4)}`);
            }
            catch(error){
              console.error(`MySQL UPDATE research_data error: ${JSON.stringify(error)}`);
            }
          }
        } else {
          console.info('No match in the channelToDigitMap');
        }
      }

      console.info('Contents of map after:');
      channelToDigitMap.forEach((value, key) => {
        console.info(`${key} => ${value}`);
      });

      break;
    }

    case 'UserEvent':
      console.info('AMI Event: UserEvent');
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
          try {
            [result5, _fields5] = await mySqlConnection.query(sql, [myRegisterData, buildNumber, gitCommit, deviceId]);
            console.info(`MySQL UPDATE result: ${JSON.stringify(result5)}`);
          }
          catch(error) {
            console.error(
              `Error in UPDATE statement: ${JSON.stringify(error)}`,
            );
          }
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
        config.asterisk.port,
        config.asterisk.host,
        config.asterisk.user,
        config.asterisk.password,
        true,
      );

      ami.keepConnected();

      // Define event handlers here
      ami.on('managerevent', handleManagerEvent);

      console.info('Connected to Asterisk');
    } catch (exp) {
      console.error(`Init AMI error${JSON.stringify(exp)}`);
    }
  }
}


async function getExtensionSettings(ext, callback) {
  const sql = '(SELECT * FROM device_settings WHERE extension = ?) '
    + 'UNION '
    + '(SELECT * FROM device_settings WHERE default_device = 1) '
    + 'LIMIT 1;';

  const [result, _fields] = await mySqlConnection.query(sql, ext);
  if (result[0]) {
    var row = result[0];
    return {
      sttEngine: row.stt_engine || 'UNKNOWN',
      delay: row.delay || '0',
      background_audio_suppression: row.background_audio_suppression,
      speech_detector_sensitivity: row.speech_detector_sensitivity,
      auto_punctuation: row.auto_punctuation || '0',
      v2: row.v2,
      translationEngine: row.translation_engine || 'UNKNOWN',
      sourceLanguage: row.source_language || 'UNKNOWN',
      targetLanguage: row.target_language || 'UNKNOWN',
      ttsEngine: row.tts_engine || 'UNKNOWN',
      ariaSettings: row.ARIA_settings || 'UNKNOWN',
      predefined_id: row.predefined_id,
      stt_dropout_enabled: row.stt_dropout_enabled,
      stt_dropout_interval: row.stt_dropout_interval || 1,
      stt_dropout_length_min: row.stt_dropout_length_min || 100,
      stt_dropout_length_max: row.stt_dropout_length_max || 200,
      dual_enabled: row.dual_enabled,
      captions_enabled: row.caller_captions_enabled
    }
  } else {
    throw new Error('No Record for extension');
  }
}

initAmi();

process.on('SIGINT', () => {
  console.info('SIGINT About to exit \n closing sql connection pool');
  mySqlConnection.end();
  process.exit();
});

process.on('uncaughtException', (e) => {
  console.error('Uncaught Exception...');
  console.error(e.stack);
  console.error('closing sql connection pool');
  mySqlConnection.end();
  process.exit();
});
