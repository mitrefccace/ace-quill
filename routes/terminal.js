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

const express = require('express');

const router = express.Router();
const fs = require('fs');
const formidable = require('formidable');
const path = require('path');
const config = require('./../configs/config.js');
// const log4js = require('log4js');
const GoogleTTS = require('../texttospeech/google');
const WatsonTTS = require('../texttospeech/watson');
const AzureTTS = require('../texttospeech/azure');
const AmazonTTS = require('../texttospeech/amazon');
const GoogleT = require('../translation/google');
const WatsonT = require('../translation/watson');
const AzureT = require('../translation/azure');
const AmazonT = require('../translation/amazon');
const GoogleTA = require('../textanalysis/google');
const awsMFA = require('../utils/aws-mfa');

let proxy;
if (config.proxy) {
  proxy = new URL(config.proxy);
}

router.get('/', (_req, res) => {
  res.redirect('./terminal');
});

router.get('/terminal', (_req, res) => {
  res.render('pages/terminal_combined', { iprelayMode: false });
});

router.get('/iprelay', (_req, res) => {
  res.render('pages/terminal_combined', { iprelayMode: true });
});

router.get('/iprelay_deprecated', (_req, res) => {
  res.render('pages/terminal_iprelay', {});
});

router.get('/terminal_deprecated', (_req, res) => {
  res.render('pages/terminal', {});
});

router.get('/audiocontrols', (_req, res) => {
  res.render('pages/audio_control', {});
});

router.get('/amazon-mfa-status', async (_req, res) => {
  try {
    const isValid = await awsMFA.validateSession();
    if (isValid) {
      res.send('valid');
    } else {
      res.send('invalid');
    }
  } catch (error) {
    res.send('invalid');
  }
});

router.get('/audiorecorder', async (req, res) => {
  try {
    const [results, _fields] = await req.dbconn.query('SELECT text FROM recording_text ORDER BY id DESC LIMIT 1;');
    const recordingText = results.length > 0 ? results[0].text : 'NO TEXT RECORD';
    res.render('pages/audio_recorder', { recordingText });
  } catch (error) {
    console.error('ERROR: ', error);
    res.send('error');
  }
});

router.post('/uploadAudioRecording', async (req, res) => {
  console.info('/uploadAudioRecording Called');
  const form = new formidable.IncomingForm();
  const dir = process.platform.match(/^win/) ? '\\..\\uploads\\recordings\\' : '/../uploads/recordings/';

  form.uploadDir = path.join(__dirname, dir);
  form.keepExtensions = true;
  form.maxFieldsSize = 10 * 1024 * 1024;
  form.maxFields = 1000;
  form.multiples = false;
  try {
    const [fields, files] = await new Promise(function (resolve, reject) {
      form.parse(req, function (err, fields, files) {
        if (err) {
          reject(err);
          return;
        }
        resolve([fields, files]);
      });
    });

    const insertStatement = `INSERT INTO recordings (recording_id, filepath, text) VALUES (?,?,?);`;
    await req.dbconn.query(insertStatement, [fields.recordingId, files.file.path, fields.text]);

    res.status(200).send({ status: 'Success' });
  } catch (error) {
    console.log("Error uploadAudioRecording:", error)
    res.writeHead(200, {
      'content-type': 'text/plain',
    });
    res.write('an error occurred');
  }
});

router.get('/iprelay/getHistory', async (req, res) => {
  const ext = req.query.extension;
  const query = 'SELECT call_start, dest_phone_number FROM research_data WHERE extension = ? ORDER BY call_start DESC LIMIT 10;';
  try {
    const [results, _fields] = await req.dbconn.query(query, ext)
    res.status(200).send({ status: 'Success', results: results });
  } catch (error) {
    console.error('Error /iprelay/getHistory:', error)
  }
});

router.get('/iprelay/getContacts', async (req, res) => {
  const ext = req.query.extension;
  const query = 'SELECT username, cellphone FROM contacts WHERE extension = ? OR extension = 0 ORDER BY FAVORITE DESC;';
  try {
    const [results, _fields] = await req.dbconn.query(query, ext)
    res.status(200).send({ status: 'Success', results: results });
  } catch (error) {
    console.error('Error /iprelay/getContacts:', error)
  }
});

router.get('/iprelayscenario', async (req, res) => {
  const ext = req.query.extension;
  const query = `select iprelay_scenario_content.id, convoOrder, bubbleText, rawText, isDUT from iprelay_scenario_content 
  inner join iprelay_scenario on iprelay_scenario.id = iprelay_scenario_content.iprelay_scenario_id
  inner join device_settings on iprelay_scenario.name = device_settings.iprelay_scenario
  where device_settings.extension = ?
  ORDER BY convoOrder ASC;`;
  try {
    const [results, _fields] = await req.dbconn.query(query, ext);
    res.status(200).send(results);
  } catch (error) {
    console.error('Error /iprelayscenario:', error)
    c
  }
});

//TODO: Move this out of the Routes file.
function translate(text, settings, callback) {
  if (settings.sourceLanguage === settings.targetLanguage) {
    callback(null, text); // no need to translate
  } else {
    let ttsConfig;
    let engine;
    switch (settings.translationEngine) {
      case 'GOOGLE':
        console.info('Translating with google');
        engine = new GoogleT();
        break;
      case 'WATSON':
        console.info('Translating with watson');
        ttsConfig = JSON.parse(
          fs.readFileSync('./configs/watson/watson-translation.json'),
        );
        if (proxy) {
          ttsConfig.proxy = proxy.hostname;
          ttsConfig.proxy_port = proxy.port;
        }
        engine = new WatsonT(ttsConfig);
        break;
      case 'AZURE':
        console.info('Translating with azure');
        ttsConfig = JSON.parse(
          fs.readFileSync('./configs/azure/azure-translation.json'),
        );
        if (proxy) {
          ttsConfig.proxy = proxy.hostname;
          ttsConfig.proxy_port = proxy.port;
        }
        engine = new AzureT(ttsConfig);
        break;
      case 'AMAZON':
        console.info('Translating with Amazon');
        engine = new AmazonT();
        break;
      default:
        callback(null, text); // return original text
        return;
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
router.get('/loadACConfig', async (req, res) => {
  const ext = req.query.extension;
  const sql = 'Select * from device_settings where extension = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, ext);
    res.send(results[0]);
  } catch (error) {
    console.error('Error /loadACConfig:', error);
  }
});

router.post('/iprelay/savenotes', async (req, res) => {
  const { notes, extension } = req.body;
  const sqlGetCurrentCallRecord = `SELECT id FROM research_data
    WHERE extension = ? AND call_end IS NULL ORDER BY id DESC LIMIT 1;`;
  const sqlSaveNotes = 'UPDATE research_data SET notes = ? WHERE id = ?;';

  if (extension && notes) {
    try {
      const [results1, _fields1] = await req.dbconn.query(sqlGetCurrentCallRecord, [ext]);
      if (results1.length < 1) {
        res.status(304).send({ status: 'no record updated or found' });
      } else {
        const [results2, _fields2] = await req.dbconn.query(sqlSaveNotes, [notes, results1[0].id]);
        res.status(200).send({ status: 'success', callID: results1[0].id });
      }
    } catch (error) {
      console.error("ERROR /iprelay/savenotes:", error)
      res.status(304).send({ status: 'no record updated or found' });
    }
  } else {
    res.status(400).send({ status: 'invalid arguements' });
  }
});

router.post('/terminal/texttospeech', async (req, res) => {
  const { text, extension } = req.body;
  const sql_getDeviceSettings = 'SELECT * FROM device_settings WHERE extension = ?;';
  try {
    const [results1, _fields1] = await req.dbconn.query(sql_getDeviceSettings, extension);
    const engine = (results1[0].tts_engine == null) ? results1[0].stt_engine : results1[0].tts_engine;
    let tts;
    switch (engine) {
      case 'AMAZON':
        console.info('using AWS tts');
        tts = new AmazonTTS();
        break;
      case 'AZURE':
        console.info('using azure tts');
        let azure_config = JSON.parse(
          fs.readFileSync('./configs/azure/azure-cognitive.json'),
        );
        if (proxy) {
          azure_config.proxy = proxy.hostname;
          azure_config.proxy_port = proxy.port;
        }
        tts = new AzureTTS(azure_config);
        break;
      case 'GOOGLE':
        console.info('using google tts');
        tts = new GoogleTTS();
        break;
      case 'WATSON':
        console.info('using watson tts');
        const watson_configs = JSON.parse(
          fs.readFileSync('./configs/watson/watson-tts.json'),
        );
        if (proxy) {
          watson_configs.proxy = proxy.hostname;
          watson_configs.proxy_port = proxy.port;
        }
        tts = new WatsonTTS(watson_configs);
        break;
      default:
        console.info('using default google tts');
        tts = new GoogleTTS();
        break;
    }
    let sql_researchdata = 'SELECT * FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';
    const [results2, _fields2] = await req.dbconn.query(sql_researchdata, extension);
    const researchDataId = results2[0].id;
    if (results1[0].tts_translate === 1 && results1[0].source_language !== results1[0].target_language) {
      const settings = {
        // This is confusing but source and target language
        // are reversed for the tts end of the call.
        targetLanguage: results1[0].source_language,
        sourceLanguage: results1[0].target_language,
        translationEngine: results1[0].translation_engine,
      };

      translate(text, settings, (_err3, translation) => {
        tts.textToSpeech(translation, results1[0].source_language, results1[0].tts_voice, async (err4, audiofile) => {
          if (err4) {
            res.status(500).send({ status: 'Error' });
          } else {
            const d = new Date();
            const dataStore = {
              transcript: translation + " (" + text + ")",
              extension: extension,
              final: true,
              timestamp: d,
              sttEngine: engine,
              research_data_id: researchDataId,
              is_iprelay: config.isIprelay,
            };
            await req.dbconn.query('INSERT INTO data_store SET ?', dataStore);
            res.status(200).send({ status: 'Success', audiofile, translation });
          }
        });
      });
    } else {
      tts.textToSpeech(text, results1[0].target_language, results1[0].tts_voice, async (err6, audiofile) => {
        if (err6) {
          console.error(`Error running TTS: ${JSON.stringify(err6)}`);
          res.status(500).send({ status: 'Error' });
        } else {
          const d = new Date();
          const dataStore = {
            transcript: text,
            extension: extension,
            final: true,
            timestamp: d,
            sttEngine: engine,
            research_data_id: researchDataId,
            is_iprelay: config.isIprelay,
          };
          await req.dbconn.query('INSERT INTO data_store SET ?', dataStore);
          res.status(200).send({ status: 'Success', audiofile });
        }
      });
    }
  } catch (error) {
    console.error('ERROR: /terminal/texttospeech ', error);
    res.status(500).send({ status: 'Error' });
  }

});

router.get('/terminal/playTextToSpeech', (req, res) => {
  const { audiofile } = req.query;
  try {
    const stat = fs.statSync(`./texttospeech/audiofiles/${audiofile}`);
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': stat.size,
    });
    fs.createReadStream(`./texttospeech/audiofiles/${audiofile}`).pipe(res);
  } catch (err) {
    console.error(err);
    res.send('No results');
  }
});

router.get('/terminal/playAudibleCue', (req, res) => {
  const { audiofile } = req.query;
  try {
    const stat = fs.statSync(`./uploads/audible_cues/${audiofile}`);
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': stat.size,
    });
    fs.createReadStream(`./uploads/audible_cues/${audiofile}`).pipe(res);
  } catch (err) {
    console.error(err);
    res.send('No results');
  }
});

router.get('/terminal/getAudibleCue', async (req, res) => {
  const { id } = req.query;
  const sql = 'SELECT * FROM audible_cues WHERE id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id)
    res.status(200).send({ status: 'Success', cue: results[0] });
  } catch (error) {
    console.error("Error /terminal/getAudibleCue:", error);
    res.status(500).send({ status: 'Error' });
  }
});

router.get('/terminal/audioprofiles', async (req, res) => {
  const { extension } = req.query;
  const sql = 'SELECT * FROM audio_profiles where active=1;';
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    res.status(200).send({ status: 'Success', profiles: results });
  } catch (error) {
    console.error("Error /terminal/audioprofiles:", error);
    res.status(500).send({ status: 'Error' });
  }
});

router.get('/terminal/audioprofilefilters', async (req, res) => {
  const { profileId } = req.query;
  const sql = 'SELECT gain, frequency, type, rolloff, q_value as Q, pitchshift FROM audio_filters WHERE profile_id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, profileId);
    res.status(200).send({ status: 'Success', filters: results });
  } catch (error) {
    console.error("Error /terminal/audioprofilefilters:", error);
    res.status(500).send({ status: 'Error' });
  }
});

router.get('/iprelay/playScenarioSpeech', async (req, res) => {
  const { audioId } = req.query;
  const sql = 'SELECT audioFilePath FROM iprelay_scenario_content WHERE id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, audioId);
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': stat.size,
    });
    fs.createReadStream(results[0].audioFilePath).pipe(res);
  } catch (error) {
    console.error("Error /iprelay/playScenarioSpeech:", error);
    res.send('No results');
  }
});

router.post('/iprelay/logIPRelay', async (req, res) => {
  const { text } = req.body;
  const { isDUT } = req.body;
  let sql_researchdata = 'SELECT * FROM data_store ORDER BY id DESC LIMIT 1;';

  try {
    const [results, _fields] = await req.dbconn.query(sql_researchdata);
    const callID = results[0].research_data_id;
    if (callID && text) {
      const sql = 'INSERT INTO iprelay_log (fk_call_id, text, is_dut, timestamp) VALUES (?,?,?,NOW());';
      await req.dbconn.query(sql, [callID, text, (isDUT === 'true') ? 1 : 0])
      res.status(200).send('success');
    } else {
      res.status(400).send('Bad Inputs');
    }
  } catch (error) {
    console.error("Error /iprelay/logIPRelay:", error);
    res.status(500).send({ status: 'Error' });
  }
});

router.post('/terminal/ariaSettings', async (req, res) => {
  const ext = req.body.extension;
  try {
    const [results, _fields] = await req.dbconn.query('SELECT ARIA_settings FROM device_settings WHERE extension = ?', ext);
    const aria = results[0].ARIA_settings;
    res.status(200).send({ status: 'Success', aria });
  } catch (error) {
    console.error("Error /terminal/ariaSettings:", error);
    res.status(500).send("error");
  }
});

router.post('/terminal/getEntities', async (req, res) => {
  const ext = req.body.extension;
  const engine = new GoogleTA();
  const sql1 = 'SELECT id FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';
  const sql2 = 'SELECT translation, extension, timestamp FROM translation_data where research_data_id = ?;';
  const sql3 = 'SELECT * FROM data_store where research_data_id = ? and final = 1;';

  try {
    const [results1, _fields1] = await req.dbconn.query(sql1, ext);
    let id = results1[0].id

    if (typeof id === 'undefined' || Number.isNaN(id))
      id = 0;

    const [results2, _fields2] = await req.dbconn.query(sql2, id)
    if (results2.length === 0) {
      // send non translated transcription data back
      const [results3, _fields3] = await req.dbconn.query(sql3, id);
      if (results3.length !== 0) {
        let records = '';
        results3.forEach((row) => {
          records += row.transcript + '. ';
        });

        engine.getEntities(records, (data) => {
          res.status(200).send({ status: 'Success', results: data });
        },
        );
      } else {
        res.status(500).send({ status: 'No Data' });
      }
    } else {
      res.status(500).send({ status: 'No Data' });
    }
  } catch (error) {
    console.error("Error /terminal/getEntities:", error);
    res.status(500).send({ status: 'Error' });
  }

});

router.post('/terminal/getClassification', async (req, res) => {
  const ext = req.body.extension;
  const engine = new GoogleTA();
  const sql1 = 'SELECT id FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';
  const sql2 = 'SELECT translation, extension, timestamp FROM translation_data where research_data_id = ?;';
  const sql3 = 'SELECT * FROM data_store where research_data_id = ? and final = 1;';
  try {
    const [results1, _fields1] = await req.dbconn.query(sql1, ext);
    const id = (results1[0].id === 'undefined' || Number.isNaN(results1[0].id)) ? 0 : results1[0].id;
    const [results2, _fields2] = await req.dbconn.query(sql2, id);
    if (results2.length === 0) {
      const [results3, _fields3] = await req.dbconn.query(sql3, id);
      let records = '';
      results3.forEach((row) => {
        records += row.transcript + '. '
      });
      engine.getClassification(records, (data) => {
        res.status(200).send({ status: 'Success', results: data });
      });
    } else {
      res.status(500).send({ status: 'No Data' });
    }
  } catch (error) {
    console.error("Error /terminal/getClassification:", error);
    res.status(500).send({ status: 'Error' });
  }
});

router.post('/terminal/sentenceAnalysis', (req, res) => {
  const text = req.body.text;
  const engine = new GoogleTA();
  engine.getSentiment(text,(data) => {
      res.status(200).send({ status: 'Success', results:data });
  });
});

// upload recording web.m file
router.post('/iprelay/uploadRecording', async (req, res) => {
  console.info('/iprelay/uploadRecording Called');
  const form = new formidable.IncomingForm();
  const dir = process.platform.match(/^win/) ? '\\..\\uploads\\recordings\\' : '/../uploads/recordings/';
  const sqlLatestCall = 'SELECT id FROM research_data WHERE extension = ? or dest_phone_number = ? ORDER BY id DESC LIMIT 1;';
  const sqlInsertRecording = `INSERT INTO iprelay_recordings (source, filepath, fk_research_data_id) VALUES (?,?,?);`;

  form.uploadDir = path.join(__dirname, dir);
  form.keepExtensions = true;
  form.maxFieldsSize = 10 * 1024 * 1024;
  form.maxFields = 1000;
  form.multiples = false;

  try {
    const [fields, files] = await new Promise(function (resolve, reject) {
      form.parse(req, function (err, fields, files) {
        if (err) {
          reject(err);
          return;
        }
        resolve([fields, files]);
      });
    });

    const [results, _fields] = await req.dbconn.query(sqlLatestCall, [fields.extension, fields.extension]);
    if (results.length < 1) {
      console.error('sql error:', err2);
      res.writeHead(200, {
        'content-type': 'text/plain',
      });
      res.write('an error occurred');
    } else {
      const params = [fields.source, files.file.path, results[0].id];
      await req.dbconn.query(sqlInsertRecording, params);

      console.info(`File Uploaded: ${JSON.stringify(files)}`);
      res.status(200).send({ status: 'Success' });
    }
  } catch (error) {
    console.log("Error /iprelay/uploadAudioRecording:", error)
    res.writeHead(200, {
      'content-type': 'text/plain',
    });
    res.write('an error occurred');
  }
});

router.post('/terminal/saveCustomName', async (req, res) => {
  const { customName, extension } = req.body;
  const sqlGetCurrentCallRecord = `SELECT id FROM research_data
                                   WHERE extension = ? AND call_end IS NULL 
                                   ORDER BY id DESC LIMIT 1;`;
  const sqlSaveCustomName = 'UPDATE research_data SET custom_name = ? WHERE id = ?;';
  try {
    if (customName && extension) {
      const [results1, _fields1] = await req.dbconn.query(sqlGetCurrentCallRecord, extension);
      if(results1.length < 1) {
        res.status(304).send({ status: 'no record updated or found' });
      } else {
        await req.dbconn.query(sqlSaveCustomName, [customName, results1[0].id])
        res.status(200).send({ status: 'success', callID: result1[0].id });
      }
      } else {
        res.status(400).send({ status: 'invalid arguments' });
      }
  } catch (error) {
    console.error("Error /terminal/saveCustomName:", error);
    res.status(500).send({ status: 'Error' });
  }
});

module.exports = router;
