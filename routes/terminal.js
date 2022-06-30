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

const express = require('express');

const router = express.Router();
const fs = require('fs');
const formidable = require('formidable');
const nconf = require('nconf');
const path = require('path');
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
const decode = require('../utils/decode');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

let is_iprelay = null;

let ip_config = JSON.parse(
          fs.readFileSync('./configs/acequill.json'),
        );
if (ip_config.isIprelay == "true"){
   is_iprelay = 1
} else{
   is_iprelay = 0;
}

router.get('/', (_req, res) => {
  res.redirect('./terminal');
});

router.get('/terminal', (_req, res) => {
  res.render('pages/terminal', {});
});

router.get('/iprelay', (_req, res) => {
  res.render('pages/terminal_iprelay', {});
});

router.get('/audiocontrols', (_req, res) => {
  res.render('pages/audio_control', {});
});

router.get('/iprelay/getHistory', (req, res) => {
  const ext = req.query.extension;
  let results;
  info.info(ext);
  req.dbconn.query(
    ' SELECT call_start, dest_phone_number FROM research_data WHERE extension = ? ORDER BY call_start DESC LIMIT 10',
    ext,
    (err, result) => {
      if (err) {
        error.error('ERROR: ', err);
      } else {
        results = result;
        res.status(200).send({ status: 'Success', results });
      }
    },
  );
});

router.get('/iprelay/getContacts', (req, res) => {
  const ext = req.query.extension;
  let results;
  req.dbconn.query(
    ' SELECT username, cellphone FROM contacts WHERE extension = ? OR extension = 0 ORDER BY FAVORITE DESC',
    ext,
    (err, result) => {
      if (err) {
        error.error('ERROR: ', err);
      } else {
        results = result;
        res.status(200).send({ status: 'Success', results });
      }
    },
  );
});

router.get('/iprelayscenario', (req, res) => {
  info.info('req.query results ', req.query);
  const ext = req.query.extension;
  const sql = 'select iprelay_scenario_content.id, convoOrder, bubbleText, rawText, isDUT from iprelay_scenario_content '
    + 'inner join iprelay_scenario on iprelay_scenario.id = iprelay_scenario_content.iprelay_scenario_id '
    + 'inner join device_settings on iprelay_scenario.name = device_settings.iprelay_scenario '
    + 'where device_settings.extension = ? '
    + 'ORDER BY convoOrder ASC;';
  req.dbconn.query(sql, ext, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      res.send(results);
    }
  });
});

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
          fs.readFileSync('./translation_configs/microsoft-azure.json'),
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

router.get('/loadACConfig', (req, res) => {
  info.info('req.query results ', req.query);
  const ext = req.query.extension;
  const sql = 'Select * from device_settings where extension = ?;';
  req.dbconn.query(sql, ext, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      info.info('loadACConfig results ', results);
      res.send(results[0]);
    }
  });
});

router.post('/iprelay/updateIprelay', (req, res) => {
  const isIprelay = req.body.isIprelay;

  var config = fs.readFileSync("./configs/acequill.json");

  config = JSON.parse(config);

  if (isIprelay == "true") {
    config.isIprelay = "true";
    fs.writeFileSync("./configs/acequill.json", JSON.stringify(config));
  } else {
    config.isIprelay = "false";
    fs.writeFileSync("./configs/acequill.json", JSON.stringify(config));  }
});

router.post('/iprelay/savenotes', (req, res) => {
  const { notes } = req.body;
  const ext = req.body.extension;
  const sqlGetCurrentCallRecord = `SELECT id FROM research_data
  WHERE extension = ? AND call_end IS NULL ORDER BY id DESC LIMIT 1;`;
  const sqlSaveNotes = 'UPDATE research_data SET notes = ? WHERE id = ?;';
  if (ext && notes) {
    req.dbconn.query(sqlGetCurrentCallRecord, [ext], (err1, result1) => {
      if (err1 || result1.length < 1) {
        res.status(304).send({ status: 'no record updated or found' });
      } else {
        req.dbconn.query(sqlSaveNotes, [notes, result1[0].id], (err2) => {
          if (err2) {
            error.error(err2);
            res.status(304).send({ status: 'no record updated or found' });
          } else {
            res.status(200).send({ status: 'success', callID: result1[0].id });
          }
        });
      }
    });
  } else {
    res.status(400).send({ status: 'invalid arguements' });
  }
});

router.post('/terminal/texttospeech', (req, res) => {
  const { text, extension } = req.body;
  const sql_getDeviceSettings = 'SELECT * FROM device_settings WHERE extension = ?;';
  req.dbconn.query(sql_getDeviceSettings, extension, (err, result) => {
    if (err) {
      error.error('ERROR: ', err.code);
      res.status(500).send({ status: 'Error' });
    } else {
      // if no tts engine selected, use stt engine
      const engine = (result[0].tts_engine == null) ? result[0].stt_engine : result[0].tts_engine;
      console.log("")
      let tts;
      switch (engine) {
        case 'AMAZON':
          info.info('using azure stt');
          tts = new AmazonTTS();
          break;
        case 'AZURE':
          info.info('using azure stt');
          let aconfig = require('./../configs/azure/azure-cognitive.json');
          if (decode(nconf.get('proxy'))) {
            const proxy = new URL(decode(nconf.get('proxy')));
            aconfig.proxy = proxy.hostname;
            aconfig.proxy_port = proxy.port;
          }
          tts = new AzureTTS(aconfig);
          break;
        case 'GOOGLE':
          info.info('using google stt');
          tts = new GoogleTTS();
          break;
        case 'WATSON':
          info.info('using watson stt');
          const wconfigs = require('./../configs/watson/watson-tts.json');
          if (decode(nconf.get('proxy'))) {
            const proxy = new URL(decode(nconf.get('proxy')));
            wconfigs.proxy = proxy.hostname;
            wconfigs.proxy_port = proxy.port;
          }
          tts = new WatsonTTS(wconfigs);
          break;
        default:
          info.info('using default google stt');
          tts = new GoogleTTS();
          break;
      }

      let sql_researchdata = 'SELECT * FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';
      req.dbconn.query(sql_researchdata, extension, (err2, result2) => {
        if (err2) {
          error.error(err2)
          res.status(500).send({ status: 'Error' });
        } else {
          const researchDataId = result2[0].id;

          if (result[0].tts_translate === 1 && result[0].source_language !== result[0].target_language) {
            const settings = {
              // This is confusing but source and target language
              // are reversed for the tts end of the call.
              targetLanguage: result[0].source_language,
              sourceLanguage: result[0].target_language,
              translationEngine: result[0].translation_engine,
            };

            translate(text, settings, (_err3, translation) => {

              tts.textToSpeech(translation, result[0].source_language, result[0].tts_voice, (err4, audiofile) => {
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
                    is_iprelay: is_iprelay,
                  };
                  req.dbconn.query('INSERT INTO data_store SET ?', dataStore, (
                    err5,
                    result5
                  ) => {
                    if (err5) {
                      error.error(`Error in INSERT: ${JSON.stringify(err5)}`);
                    } else {
                      info.info(`INSERT result: ${JSON.stringify(result5)}`);
                    }
                  });
                  res.status(200).send({ status: 'Success', audiofile, translation });
                }
              });
            });
          } else {
            tts.textToSpeech(text, result[0].target_language, result[0].tts_voice, (err6, audiofile) => {
              if (err6) {
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
                  is_iprelay: is_iprelay,
                };
                req.dbconn.query('INSERT INTO data_store SET ?', dataStore, (
                  err7, result7
                ) => {
                  if (err7) {
                    error.error(`Error in INSERT: ${JSON.stringify(err7)}`);
                  } else {
                    info.info(`INSERT result: ${JSON.stringify(result7)}`);
                  }
                });
                res.status(200).send({ status: 'Success', audiofile });
              }
            });
          }
        }
      });
    }
  });
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
  } catch (error) {
    error.error(error);
    res.send('No results');
  }
});

router.get('/terminal/audioprofiles', (req, res) => {
  const { extension } = req.query;
  const sql = 'SELECT * FROM audio_profiles where active=1;';
  req.dbconn.query(sql, (err, results) => {
    if(err){
      res.status(500).send({ status: 'Error' });
    } else {
      res.status(200).send({ status: 'Success', profiles: results });
    }
  });
});

router.get('/terminal/audioprofilefilters', (req, res) => {
  const { profileId } = req.query;
  const sql = 'SELECT gain, frequency, type, rolloff, q_value as Q, pitchshift FROM audio_filters WHERE profile_id = ?;';
  req.dbconn.query(sql, profileId, (err, results) => {
    if(err){
      res.status(500).send({ status: 'Error' });
    } else {
      res.status(200).send({ status: 'Success', filters: results });
    }
  });
});

router.get('/iprelay/playScenarioSpeech', (req, res) => {
  const { audioId } = req.query;
  const sql = 'SELECT audioFilePath FROM iprelay_scenario_content WHERE id = ?;';
  req.dbconn.query(sql, audioId, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      try {
        const stat = fs.statSync(results[0].audioFilePath);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': stat.size,
        });
        fs.createReadStream(results[0].audioFilePath).pipe(res);
      } catch (error) {
        error.error(error);
        res.send('No results');
      }
    }
  });
});

router.post('/iprelay/logIPRelay', (req, res) => {
  let sql_researchdata = 'SELECT * FROM data_store ORDER BY id DESC LIMIT 1;';
      req.dbconn.query(sql_researchdata, (err, result) => {
        if (err) {
          error.error(err)
          res.status(500).send({ status: 'Error' });
        } else {
          const callID = result[0].research_data_id;

  const { text } = req.body;
  const { isDUT } = req.body;

  if (callID && text) {
    const sql = 'INSERT INTO iprelay_log (fk_call_id, text, is_dut, timestamp) VALUES (?,?,?,NOW());';
    req.dbconn.query(sql, [callID, text, (isDUT === 'true') ? 1 : 0], (err) => {
      if (err) {
        res.status(500).send('err');
      } else {
        res.status(200).send('success');
      }
    });
  } else {
    res.status(400).send('Bad Inputs');
  }
  }
      });
});

router.post('/terminal/ariaSettings', (req, res) => {
  const ext = req.body.extension;
  let aria;
  info.info('This is getting called');
  req.dbconn.query(
    'SELECT ARIA_settings FROM device_settings WHERE extension = ?',
    ext,
    (err, result) => {
      if (err) {
        error.error('ERROR: ', err.code);
      } else {
        info.info(`results are: ${result[0]}`);
        aria = result[0].ARIA_settings;
      }

      if (aria === 'final') {
        info.info('final aria settings');
      } else if (aria === 'continuous') {
        info.info('continuous');
      }
      info.info(aria);
      res.status(200).send({ status: 'Success', aria });
    },
  );
});

router.post('/terminal/getEntities', (req, res) => {
  const ext = req.body.extension;
  let aria;
  let engine;
  let configs;
  info.info('text analysis with google');
  engine = new GoogleTA();

  const sql = 'SELECT id FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';
  req.dbconn.query(sql, ext, (err2, lastCall) => {
    if (err2 || lastCall.length < 1) {
      error.error('sql error:', err2);
    } else {
      id = lastCall[0].id
      console.log("id ",  id)
      if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

      req.dbconn.query(
        'SELECT translation, extension, timestamp FROM translation_data where research_data_id = ?;',
        id,
        (err, rows) => {
          if (err) {
            error.error('/getTranscripts ERROR: ' + err);
          } else if (rows.length === 0) {
            // send non translated transcription data back
            req.dbconn.query(
              'SELECT * FROM data_store where research_data_id = ? and final = 1;',
              id,
              (err2, rows2) => {
                if (err2) {
                  error.error('/getTranscripts ERROR: ', err.code);
                } else if (rows2.length !== 0) {
                  let records = '';
                  rows2.forEach((row) => {
                    records += row.transcript + '. '
                    console.log("row.transcript ", row.transcript)
                  });
                  engine.getEntites(
                    records,
                    (results) => {
                      res.status(200).send({ status: 'Success', results});
                    },
                  );
                }
              },
            );
          } else {
            // res.send('no records');
          }
        },
      );
    }
  });
});

router.post('/terminal/getClassification', (req, res) => {
  const ext = req.body.extension;
  let aria;
  let engine;
  let configs;
  info.info('text analysis with google');
  engine = new GoogleTA();

  const sql = 'SELECT id FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';
  req.dbconn.query(sql, ext, (err2, lastCall) => {
    if (err2 || lastCall.length < 1) {
      error.error('sql error:', err2);
    } else {
      id = lastCall[0].id
      console.log("id ",  id)
      if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

      req.dbconn.query(
        'SELECT translation, extension, timestamp FROM translation_data where research_data_id = ?;',
        id,
        (err, rows) => {
          if (err) {
            error.error('/getTranscripts ERROR: ' + err);
          } else if (rows.length === 0) {
            // send non translated transcription data back
            req.dbconn.query(
              'SELECT * FROM data_store where research_data_id = ? and final = 1;',
              id,
              (err2, rows2) => {
                if (err2) {
                  error.error('/getTranscripts ERROR: ', err.code);
                } else if (rows2.length !== 0) {
                  let records = '';
                  rows2.forEach((row) => {
                    records += row.transcript + '. '
                    console.log("row.transcript ", row.transcript)
                  });
                  console.log("records ", records)
                  engine.getClassification(
                    records,
                    (results) => {
                      res.status(200).send({ status: 'Success', results});
                    },
                  );
                }
              },
            );
          } else {
            // res.send('no records');
          }
        },
      );
    }
  });
});

router.post('/terminal/sentenceAnalysis', (req, res) => {
  const text = req.body.text;
  let engine;
  let configs;
  engine = new GoogleTA();

  engine.getSentiment(
    text,
    (results) => {
      console.log(results)
      res.status(200).send({ status: 'Success', results});
    },
  );
});

// upload recording web.m file
router.post('/iprelay/uploadRecording', (req, res) => {
  info.info('/iprelay/uploadRecording Called');
  const form = new formidable.IncomingForm();
  const dir = process.platform.match(/^win/) ? '\\..\\uploads\\recordings\\' : '/../uploads/recordings/';

  form.uploadDir = path.join(__dirname, dir);
  form.keepExtensions = true;
  form.maxFieldsSize = 10 * 1024 * 1024;
  form.maxFields = 1000;
  form.multiples = false;

  form.parse(req, (err, fields, files) => {
    if (err) {
      error.error('oh no an error', err);
      res.writeHead(200, {
        'content-type': 'text/plain',
      });
      res.write('an error occurred');
    } else {
      info.info(JSON.stringify(fields));
      // {"source":"screen", "extension": "5001"}
      // res.status(200).send({ status: "Success" })

      const sqlLatestCall = 'SELECT id FROM research_data WHERE extension = ? ORDER BY id DESC LIMIT 1;';
      req.dbconn.query(sqlLatestCall, fields.extension, (err2, lastCall) => {
        if (err2 || lastCall.length < 1) {
          error.error('sql error:', err2);
          res.writeHead(200, {
            'content-type': 'text/plain',
          });
          res.write('an error occurred');
        } else {
          const sqlInsertRecording = `INSERT INTO iprelay_recordings (source, filepath, fk_research_data_id)
          VALUES (?,?,?);`;
          const params = [fields.source, files.file.path, lastCall[0].id];
          req.dbconn.query(sqlInsertRecording, params, (err3) => {
            if (err3) {
              error.error('sql error:', err3);
              res.writeHead(200, {
                'content-type': 'text/plain',
              });
              res.write('an error occurred');
            } else {
              info.info(`File Uploaded: ${JSON.stringify(files)}`);
              res.status(200).send({ status: 'Success' });
            }
          });
        }
      });
    }
  });
});


module.exports = router;
