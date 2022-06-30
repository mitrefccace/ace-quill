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
const fs = require('fs');
const json2csv = require('json2csv');
const bcrypt = require('bcryptjs');

const router = express.Router();
const nconf = require('nconf');
const homedir = require('os').homedir();
const multer = require('multer');
const archiver = require('archiver');
// const { name } = require('ejs');
const formidable = require('formidable');
const decode = require('../utils/decode');
const validator = require('../utils/validator');

var log4js = require('log4js');

const winston = require('winston');
const logger = require('../utils/logger')
const error = winston.loggers.get('error');
const info = winston.loggers.get('info');
const debug = winston.loggers.get('debug');

const async = require('async');
const config = require('../configs/acequill.json')

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    if (req.originalUrl.substr(-1) === '/') {
      res.redirect('login');
    } else if (req.originalUrl === '/admin') {
      res.redirect('./admin/login');
    } else {
      res.redirect('./login');
    }
  }
}

router.get('/', restrict, (req, res) => {
  res.redirect('./configs');
});

router.get('/cdr', restrict, (req, res) => {
  res.render('pages/cdr', {
    role: req.session.role,
  });
});

router.get('/getallcdrrecs', restrict, (req, res) => {
  info.info('GET /getallcdrrecs');
  let query = 'SELECT * FROM asterisk.bit_cdr ORDER BY calldate';
  let params = [];
  if (req.query.start && req.query.end) {
    query = 'SELECT * FROM asterisk.bit_cdr WHERE (calldate BETWEEN ? AND ?)';
    params = [req.query.start, req.query.end];
  }
  req.dbconn.query(query, params, (err, rows) => {
    if (err) {
      error.error('/getallcdrrecs an error has occurred', err);
      res.status(500).send({
        message: 'MySQL error',
      });
    } else if (rows.length > 0) {
      // success
      if (req.query.download) {
        JSON.stringify(rows);

        // Column names for the CSV file.
        const csvFields = [
          'calldate',
          'clid',
          'src',
          'dst',
          'dcontext',
          'channel',
          'dstchannel',
          'lastapp',
          'lastdata',
          'duration',
          'billsec',
          'disposition',
          'amaflags',
          'accountcode',
          'userfield',
          'uniqueid',
          'linkedid',
          'sequence',
          'peeraccount',
        ];

        const csv = json2csv({
          data: rows,
          fields: csvFields,
        });
        res.setHeader('Content-disposition', 'attachment; filename=cdr.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      }
      res.status(200).send({
        message: 'Success',
        data: rows,
      });
    } else {
      res.status(200).send({
        message: 'No cdr records',
        data: {},
      });
    }
  });
});

router.get('/users', restrict, (req, res) => {
  const sqlUsers = 'SELECT idlogin_credentials, username, first_name, last_name, last_login FROM login_credentials;';

  req.dbconn.query(sqlUsers, (err1, users) => {
    if (err1) {
      error.error(`SQL Error: ${err1}`);
    } else {
          res.render('pages/users', {
            users,
            role: req.session.role,
          });
    }
  });
});

router.get('/servertest', restrict, (req, res) => {
  res.render('pages/server_test', {
    role: req.session.role,
  });
});

router.post('/AddUser', restrict, (req, res) => {
  const { username } = req.body;
  const { password } = req.body;
  const { firstname } = req.body;
  const { lastname } = req.body;

  if (
    validator.isUsernameValid(username)
    && validator.isPasswordComplex(password)
    && validator.isNameValid(firstname)
    && validator.isNameValid(lastname)
  ) {
    bcrypt.hash(password, 10, (err, hash) => {
      const sql = 'INSERT INTO login_credentials (username, password, first_name, last_name, role, last_login) VALUES (?,?,?,?,?,?);';
      req.dbconn.query(
        sql,
        [username, hash, firstname, lastname, 'researcher', null],
        (err2, result) => {
          if (err2) {
            error.error(`SQL ERR: ${err}`);
            res.send('err');
          } else {
            res.send(`${result.affectedRows} record updated`);
          }
        },
      );
    });
  } else {
    res.send('Bad Inputs');
  }
});

router.post('/DeleteUser', restrict, (req, res) => {
  const { id } = req.body;
  info.info(`Delete ID: ${id}`);
  if (id > 1 && !Number.isNaN(id)) {
    const sql = "DELETE FROM login_credentials WHERE idlogin_credentials = ? AND role <> 'admin';";
    req.dbconn.query(sql, id, (err, result) => {
      if (err) {
        error.error(`SQL ERR: ${err}`);
        res.send('err');
      } else {
        res.send(`${result.affectedRows} record deleted`);
      }
    });
  } else {
    res.send('Bad Inputs');
  }
});

router.get('/audiocontrols', restrict, (req, res) => {
  const sql = `SELECT p.id, p.name, p.description, p.active, COUNT(f.id) as freq_num FROM audio_profiles p
  LEFT JOIN audio_filters f ON f.profile_id = p.id
  GROUP BY p.id;`;
  req.dbconn.query(sql, (err, results) => {
    res.render('pages/audio_controls_admin', {
      extension: config.asterisk.ext_admin,
      password: config.asterisk.ext_admin_password,
      host: config.asterisk.fqdn,
      profiles: err ? [] : results
    });
  })
});


router.get('/audioprofiledata', restrict, (req, res) => {
  const { id } = req.query;
  const sql = `SELECT * from audio_filters WHERE profile_id = ? ORDER BY id;`;
  req.dbconn.query(sql, id, (err, results) => {
    if (err) {
      console.log(err)
      res.status(500).send({
        message: 'Error'
      })
    } else {
      res.status(200).send({
        message: 'Success',
        filters: results
      });
    }
  })
});

router.post('/audioprofiledelete', restrict, (req, res) => {
  const { id } = req.body;
  const sql = 'DELETE FROM audio_profiles WHERE id = ?;';
  req.dbconn.query(sql, id, (err) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      res.send("OK")
    }
  })
});

router.post('/audioprofilenamesave', restrict, (req, res) => {
  let { id, name } = req.body;
  let sql = '';
  let params = []

  if (id == 'NEW') {
    sql = 'INSERT INTO audio_profiles (name) VALUES (?);';
    params = [name]
  } else {
    sql = 'UPDATE audio_profiles SET name = ? WHERE id = ?;';
    params = [name, id]
  }
  req.dbconn.query(sql, params, (err, result) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      if (id == "NEW")
        id = result.insertId
      res.send({ "message": "success", "id": id })
    }
  })
});

router.post('/audioprofileactive', restrict, (req, res) => {
  console.log("We're in the correct route");
  let { id, active } = req.body;
  active = active == 'true' ? 1 : 0;

  const sql = 'UPDATE audio_profiles SET active = ? WHERE id = ?;';

  const params = [active, id]

  req.dbconn.query(sql, params, (err, result) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      if (id == "NEW")
        id = result.insertId
      res.send({ "message": "success", "id": id })
    }
  })
});

router.get('/audiofilterdata', restrict, (req, res) => {
  const { id } = req.query;
  const sql = `SELECT * from audio_filters WHERE id = ?;`;
  req.dbconn.query(sql, id, (err, results) => {
    if (err) {
      console.log(err)
      res.status(500).send({
        message: 'Error'
      })
    } else {
      res.status(200).send({
        message: 'Success',
        filter: results[0]
      });
    }
  })
});

router.post('/audiofiltersave', restrict, (req, res) => {
  let { id, name, type, profile_id, gain, frequency, rolloff, q_value, pitchshift } = req.body;
  gain = gain ? parseInt(gain) : null;
  frequency = frequency ? parseInt(frequency) : null;
  rolloff = rolloff ? parseInt(rolloff) : null;
  pitchshift = pitchshift ? parseInt(pitchshift) : null;
  q_value = q_value ? parseFloat(q_value) : null;

  console.log("SAVE: ", id, name, profile_id, gain, frequency, rolloff, q_value, pitchshift)
  let sql = ""
  let params = []
  if (id) {
    sql = 'UPDATE audio_filters SET name = ?, gain = ?, frequency = ?, type = ?, rolloff = ?, q_value = ?, pitchshift = ? WHERE id = ?;';
    params = [name, gain, frequency, type, rolloff, q_value, pitchshift, id]
  } else {
    sql = 'INSERT INTO audio_filters (profile_id, name, gain, frequency, type, rolloff, q_value, pitchshift) VALUES (?,?,?,?,?,?,?,?);';
    params = [profile_id, name, gain, frequency, type, rolloff, q_value, pitchshift]
  }
  req.dbconn.query(sql, params, (err) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      res.send("OK")
    }
  })
});

router.post('/audiofilterdelete', restrict, (req, res) => {
  const { id } = req.body;
  const sql = 'DELETE FROM audio_filters WHERE id = ?;';
  req.dbconn.query(sql, id, (err) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      res.send("OK")
    }
  })
});

router.get('/precanned', restrict, (req, res) => {
  //const sql = `SELECT p.id, p.title FROM predefined_captions p;`;
  const sql = `SELECT p.id, p.title, MAX(w.ms) AS duration FROM predefined_captions p
  LEFT JOIN predefined_captions_data w ON p.id = w.fk_id
GROUP BY id;`;
  req.dbconn.query(sql, (err, results) => {
    res.render('pages/precanned_admin', {
      extension: config.asterisk.ext_admin,
      password: config.asterisk.ext_admin_password,
      host: config.asterisk.fqdn,
      profiles: err ? [] : results
    });
  })
});

router.post('/precannednamesave', restrict, (req, res) => {
  let { id, name } = req.body;
  let sql = '';
  let params = []

  if (id == 'NEW') {
    sql = 'INSERT INTO predefined_captions (title) VALUES (?);';
    params = [name]
  } else {
    sql = 'UPDATE predefined_captions SET title = ? WHERE id = ?;';
    params = [name, id]
  }
  req.dbconn.query(sql, params, (err, result) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      if (id == "NEW")
        id = result.insertId
      res.send({ "message": "success", "id": id })
    }
  })
});

router.get('/precanneddata', restrict, (req, res) => {
  const { id } = req.query;
  const sql = `SELECT phrase_id, GROUP_CONCAT(word ORDER BY ms SEPARATOR ' ') AS phrase,
  MIN(ms) as start_time, MAX(ms) AS end_time
  FROM predefined_captions_data
  WHERE fk_id = ?
  GROUP BY phrase_id;`
  req.dbconn.query(sql, id, (err, results) => {
    if (err) {
      console.log(err)
      res.status(500).send({
        message: 'Error'
      })
    } else {
      res.status(200).send({
        message: 'Success',
        filters: results
      });
    }
  })
});

router.post('/precannedphrasesave', restrict, (req, res) => {
  let { fk_id,word,offset,final,phrase_id } = req.body;
  let sql = '';
  let params = [];

  sql = 'INSERT INTO predefined_captions_data (fk_id,word,ms,final,phrase_id) VALUES (?,?,?,?,?);';
  params = [fk_id,word,offset,final,phrase_id];

  req.dbconn.query(sql, params, (err, result) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      res.send({ "message": "success", "result": result })
    }
  })
});

router.post('/precanneddelete', restrict, (req, res) => {
  const { id } = req.body;
  const sql = 'DELETE FROM predefined_captions WHERE id = ?;';
  req.dbconn.query(sql, id, (err) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      const sql = 'DELETE FROM predefined_captions_data WHERE fk_id = ?;'
      req.dbconn.query(sql, id, (err) => {
        if (err) {
          console.log(err)
          res.status(500).send("ERROR")
        } else {
          res.send("OK")
        }
      })
    }
  })
});

router.post('/phrasedelete', restrict, (req, res) => {
  const { id } = req.body;
  console.log(id);
  const sql = 'DELETE FROM predefined_captions_data WHERE phrase_id = ?;';
  req.dbconn.query(sql, id, (err) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      res.send("OK")
    }
  })
});

router.get('/phrasedata', restrict, (req, res) => {
  const { id } = req.query;
  const sql = `SELECT * from predefined_captions_data WHERE phrase_id = ? ORDER BY ms;`;
  req.dbconn.query(sql, id, (err, results) => {
    if (err) {
      console.log(err)
      res.status(500).send({
        message: 'Error'
      })
    } else {
      res.status(200).send({
        message: 'Success',
        filter: results
      });
    }
  })
});

router.post('/precannedphraseedit', restrict, (req, res) => {
  const { id,word,offset } = req.body;

  const sql = `UPDATE predefined_captions_data SET word=?, ms=? WHERE id = ?;`;
  params = [word,offset,id];
  req.dbconn.query(sql, params, (err, results) => {
    if (err) {
      console.log(err)
      res.status(500).send({
        message: 'Error'
      })
    } else {
      res.status(200).send({
        message: 'Success',
        filter: results
      });
    }
  })
});

router.get('/getMaxPhraseId', restrict, (req, res) => {
  let sql = '';

  sql = `SELECT MAX(phrase_id) as max FROM predefined_captions_data;`;

  req.dbconn.query(sql, (err, result) => {
    if (err) {
      console.log(err)
      res.status(500).send("ERROR")
    } else {
      res.send({ "message": "success", "results": result[0].max })
    }
  })
});



router.get('/accuracy', restrict, (req, res) => {
  const sql = 'Select id, scenario_name from scenario;';
  req.dbconn.query(sql, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      res.render('pages/accuracy', {
        scenarios: results,
        data: config,
      });
    }
  });
});

router.get('/getAccuracyConfig', restrict, (req, res) => {
  res.send(config.accuracy);
});

router.get('/accuracyreportdownload', restrict, (req, res) => {
  const { date, id, filename, ace2, jiwer, sclite, parsingtype } = req.query;
  csvId = id.split(",");
  // console.log("here id ", req.query)
  const reportPath = './uploads/accuracy/'
  const arch = archiver('zip');

  const refPath = reportPath + 'reference_' + date + '.txt';
  const hypPath = reportPath + 'hypothesis_' + date + '.txt';
  const ace2Path = reportPath + 'ace2_' + date + '.txt';
  const jiwerPath = reportPath + 'jiwer_' + date + '.txt';
  const sclitePath = reportPath + 'sclite_' + date + '.txt';
  const csvPath = reportPath + 'csv_' + date + '.txt';

  var hypo = fs.readFileSync(hypPath).toString().split("\n");
  var ref = fs.readFileSync(refPath).toString().split("\n");

  // create csv
  // ace2
  ace2res = []
  if (ace2 === 'true' && fs.existsSync(ace2Path)) {
    var array = fs.readFileSync(ace2Path).toString().split("\n");
    // ace2res = []
    array.forEach(function (value, i) {
      // console.log('%d: %s', i, value);
      if ( i > 4 && i < array.length-3 ){
        curArray = value.split(" ")
        // console.log(curArray);
        score = curArray[curArray.length-1]
        ace2res.push(score)
      }
    });
  }

  // sclite
  scliteErr = []
  scliteSub = []
  scliteDel = []
  scliteIns = []
  scliteWrds = []
  if(sclite === 'true' && fs.existsSync(sclitePath)){
    var array = fs.readFileSync(sclitePath).toString().split("\n");
    if (hypo.length %2 == 0)
      k = 1
    else
      k = 0
    console.log("k", k);
    console.log("hypo", hypo);

    array.forEach(function (value, i) {
      console.log('%d: %s', i, value);

      if ( parsingtype=="all" && i == 14 ){
        curArray = value.split(" ")
        const result = curArray.filter(function(x) {
            return x !== '';
        });
        console.log("sclite res", result);
        err = result[result.length-3]
        ins = result[result.length-4]
        del = result[result.length-5]
        sub = result[result.length-6]
        wrd = result[3]

        scliteSub.push(sub)
        scliteDel.push(del)
        scliteIns.push(ins)
        scliteErr.push(err)
        scliteWrds.push(wrd)
      }


      if ( parsingtype=="line" && i > 12 + hypo.length && i < array.length-8 && i%2==k){
        curArray = value.split(" ")
        const result = curArray.filter(function (x) {
          return x !== '';
        });
        console.log("sclite res", result);
        err = result[result.length-3]
        ins = result[result.length-4]
        del = result[result.length-5]
        sub = result[result.length-6]
        wrd = result[4]

        scliteSub.push(sub)
        scliteDel.push(del)
        scliteIns.push(ins)
        scliteErr.push(err)
        scliteWrds.push(wrd)
      }
    });
  }

  //jiwer
  var array = fs.readFileSync(jiwerPath).toString().split("\n");
  // if(parsingtype == "whole")
  //   jiwerRes = array[1].split(" ")
  // else{
  wer = [];
  mer = [];
  wil = [];
  if (jiwer === 'true' && fs.existsSync(jiwerPath)) {
    array.forEach(function (value, i) {
      console.log('%d: %s', i, value);
      if (i > 0 && i < array.length - 1) {
        curArray = value.split(" ")
        console.log(curArray);
        wer.push(curArray[0])
        mer.push(curArray[1])
        wil.push(curArray[2])
      }
    });
  }

  // create CSV

  csv = 'id, reference, hypothesis, ACE2, SCLITE # WRD, SCLITE SUB, SCLITE DEL, SCLITE INS, SCLITE ERR, JIWER WER, JIWER MER, JIWER WIL \n'
  // console.log("scliteSub ", scliteSub)
  // console.log("scliteDel ", scliteDel)
  // console.log("scliteIns ", scliteIns)
  // console.log("scliteErr ", scliteErr)
  wer.forEach(function (value, i) {
    console.log('%d: %s', i, value);
    aceVal = ace2res[i]
    if (aceVal == undefined)
      aceVal = ' '
    sclitewrd = scliteWrds[i]
    if(sclitewrd == undefined)
      sclitewrd = ' '
    sclitesub = scliteSub[i]
    if (sclitesub == undefined)
      sclitesub = ' '
    sclitedel = scliteDel[i]
    if (sclitedel == undefined)
      sclitedel = ' '
    scliteins = scliteIns[i]
    if (scliteins == undefined)
      scliteins = ' '
    scliteVal = scliteErr[i]
    if (scliteVal == undefined)
      scliteVal = ' '
    werVal = wer[i]
    if (werVal == undefined)
      werVal = ' '
    merVal = mer[i]
    if (merVal == undefined)
      merVal = ' '
    wilVal = wil[i]
    if (wilVal == undefined)
      wilVal = ' '

    if(i==0 && parsingtype=="all"){
      csv += csvId[i]+','+ref[i]+','+hypo[i]+','+aceVal+','+sclitewrd+','+sclitesub+','+sclitedel+','+scliteins+','+scliteVal+','+wer[0]+','+wer[1]+','+wer[2]+'\n';
      wer[1] = undefined
      wer[2] = undefined
    }
    else
      csv += csvId[i]+','+ref[i]+','+hypo[i]+','+aceVal+','+sclitewrd+','+sclitesub+','+sclitedel+','+scliteins+','+scliteVal+','+werVal+','+merVal+','+wilVal+'\n';
  });
  fs.writeFileSync(csvPath, csv);


  if (fs.existsSync(refPath))
    arch.append(fs.createReadStream(refPath), { name: 'reference.txt' });

  if (fs.existsSync(hypPath))
    arch.append(fs.createReadStream(hypPath), { name: 'hypothesis.txt' });

  if (fs.existsSync(csvPath))
    arch.append(fs.createReadStream(csvPath), { name: 'output_' + parsingtype + '.csv' });

  if (ace2 === 'true' && fs.existsSync(ace2Path))
    arch.append(fs.createReadStream(ace2Path), { name: 'ace2.txt' });

  if (jiwer === 'true' && fs.existsSync(jiwerPath))
    arch.append(fs.createReadStream(jiwerPath), { name: 'jiwer.txt' });

  if (sclite === 'true' && fs.existsSync(sclitePath))
    arch.append(fs.createReadStream(sclitePath), { name: 'sclite.txt' });

  res.attachment(filename + '.zip').type('zip');
  arch.on('end', () => res.end());
  arch.pipe(res);
  arch.finalize();
});

router.get('/research_data', restrict, (req, res) => {
  const sql = 'Select * from scenario;';
  req.dbconn.query(sql, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      results.forEach((s) => {
        const t = s;
        delete t.transcript;
      });
      res.render('pages/research_data', {
        scenarios: results,
        role: req.session.role,
      });
    }
  });
});

router.get('/iprelay_research_data', restrict, (req, res) => {
  const sql = 'Select * from scenario;';
  req.dbconn.query(sql, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      results.forEach((s) => {
        const t = s;
        delete t.transcript;
      });
      res.render('pages/iprelay_research_data', {
        scenarios: results,
        role: req.session.role,
      });
    }
  });

});

router.get('/getResearchData', restrict, (req, res) => {
  let { download } = req.query;
  const { start } = req.query;
  const { end } = req.query;

  download = !((typeof download === 'undefined' || download !== 'true'));

  let params = [];
  let query = `SELECT rd.id, rd.call_start, rd.device_id, rd.extension,
    rd.dest_phone_number, rd.call_duration, rd.stt_engine, rd.scenario_number,
    rd.added_delay, rd.transcription_file, rd.audio_file, rd.notes, rd.translation_engine,
    rd.source_language, rd.target_language, rd.tts_engine, 
    CASE WHEN rd.video_file IS NULL THEN 'false' ELSE 'true' END AS has_video
    FROM research_data rd
    LEFT JOIN device_settings ds ON rd.extension = ds.extension
    WHERE rd.transcription_file_path LIKE '%${homedir}%' AND is_iprelay = 0 OR is_iprelay IS NULL `;

  if (start && end && start !== 'undefined' && end !== 'undefined') {
    query += ' AND (call_start BETWEEN ? AND ?)';
    params = [start, end];
  }

  req.dbconn.query(query, params, (err, rows) => {
    if (err) {
      error.error('/call_logs ERROR: ', err.code);
      res.send({
        message: 'Failed',
      });
    } else if (download) {
      // Column names for the CSV file.
      const csvFields = [
        'id',
        'call_start',
        'device_id',
        'extension',
        'dest_phone_number',
        'call_duration',
        'scenario_number',
        'stt_engine',
        'added_delay',
        'transcription_file',
        'audio_file',
        'transcription_filename',
        'audio_filename',
        'notes',
        'translation_engine',
        'source_language',
        'target_language',
        'tts_engine',
        'mobizen_notes',
      ];
      const csvData = [];
      const fullUrl = `https://${req.get('host')}`; // req.protocol always return http?

      // for (i in rows) {
      rows.forEach((row) => {
        const obj = {
          id: row.id,
          call_start: row.call_start,
          device_id: row.device_id,
          extension: row.extension,
          dest_phone_number: row.dest_phone_number,
          call_duration: row.call_duration,
          scenario_number: row.scenario_number,
          stt_engine: row.stt_engine,
          added_delay: row.added_delay,
          transcription_file:
            `=HYPERLINK("${fullUrl
            }/admin/getTranscripts?download=true&id=${row.id
            }", "text")`,
          audio_file:
            `=HYPERLINK("${fullUrl
            }/admin/getAudioFile?download=true&id=${row.id
            }", "audio")`,
          transcription_filename: row.transcription_file,
          audio_filename: row.audio_file,
          notes: row.notes,
          translation_engine: row.translation_engine,
          source_language: row.source_language,
          target_language: row.target_language,
          tts_engine: row.tts_engine,
          mobizen_notes: row.mobizen_notes,
        };
        csvData.push(obj);
      });
      // }

      const csv = json2csv({
        data: csvData,
        fields: csvFields,
      });
      res.setHeader(
        'Content-disposition',
        'attachment; filename=acequill_research_data.csv',
      );
      res.set('Content-Type', 'text/csv');
      res.status(200).send(csv);
    } else if (rows.length > 0) {
      res.status(200).send({
        records: rows,
        message: 'Success',
      });
    } else {
      res.status(200).send({
        records: rows,
        message: 'No Data',
      });
    }
  });
});

router.get('/getIprelayResearchData', restrict, (req, res) => {
  let { download } = req.query;
  const { start } = req.query;
  const { end } = req.query;

  download = !((typeof download === 'undefined' || download !== 'true'));

  let params = [];
  let query = `SELECT rd.id, rd.call_start, rd.device_id, rd.extension,
    rd.dest_phone_number, rd.call_duration, rd.stt_engine, rd.scenario_number,
    rd.added_delay, rd.transcription_file, rd.audio_file, rd.notes, rd.translation_engine,
    rd.source_language, rd.target_language, rd.tts_engine,
    CASE WHEN rd.video_file IS NULL THEN 'false' ELSE 'true' END AS has_video
    FROM research_data rd
    LEFT JOIN device_settings ds ON rd.extension = ds.extension
    WHERE rd.transcription_file_path LIKE '%${homedir}%' AND is_iprelay = 1`;

  if (start && end && start !== 'undefined' && end !== 'undefined') {
    query += ' AND (call_start BETWEEN ? AND ?)';
    params = [start, end];
  }

  req.dbconn.query(query, params, (err, rows) => {
    if (err) {
      error.error('/call_logs ERROR: ', err.code);
      res.send({
        message: 'Failed',
      });
    } else if (download) {
      // Column names for the CSV file.
      const csvFields = [
        'id',
        'call_start',
        'device_id',
        'extension',
        'dest_phone_number',
        'call_duration',
        'scenario_number',
        'stt_engine',
        'added_delay',
        'transcription_file',
        'audio_file',
        'transcription_filename',
        'audio_filename',
        'notes',
        'translation_engine',
        'source_language',
        'target_language',
        'tts_engine',
        'mobizen_notes',
      ];
      const csvData = [];
      const fullUrl = `https://${req.get('host')}`; // req.protocol always return http?

      // for (i in rows) {
      rows.forEach((row) => {
        const obj = {
          id: row.id,
          call_start: row.call_start,
          device_id: row.device_id,
          extension: row.extension,
          dest_phone_number: row.dest_phone_number,
          call_duration: row.call_duration,
          scenario_number: row.scenario_number,
          stt_engine: row.stt_engine,
          added_delay: row.added_delay,
          transcription_file:
            `=HYPERLINK("${fullUrl
            }/admin/getTranscripts?download=true&id=${row.id
            }", "text")`,
          audio_file:
            `=HYPERLINK("${fullUrl
            }/admin/getAudioFile?download=true&id=${row.id
            }", "audio")`,
          transcription_filename: row.transcription_file,
          audio_filename: row.audio_file,
          notes: row.notes,
          translation_engine: row.translation_engine,
          source_language: row.source_language,
          target_language: row.target_language,
          tts_engine: row.tts_engine,
          mobizen_notes: row.mobizen_notes,
        };
        csvData.push(obj);
      });
      // }

      const csv = json2csv({
        data: csvData,
        fields: csvFields,
      });
      res.setHeader(
        'Content-disposition',
        'attachment; filename=acequill_research_data.csv',
      );
      res.set('Content-Type', 'text/csv');
      res.status(200).send(csv);
    } else if (rows.length > 0) {
      res.status(200).send({
        records: rows,
        message: 'Success',
      });
    } else {
      res.status(200).send({
        records: rows,
        message: 'No Data',
      });
    }
  });
});

router.get('/getTranscripts', restrict, (req, res) => {
  let { id } = req.query;
  let { download } = req.query;

  if (typeof download === 'undefined' || download !== 'true') download = false;

  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

  req.dbconn.query(
    'SELECT translation, extension, timestamp FROM translation_data where research_data_id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/getTranscripts ERROR: ' + err);
        res.send('An Error Occurred');
      } else if (rows.length !== 0) {
        // send translated data back
        const records = [];
        rows.forEach((row) => {
          records.push([row.timestamp, row.extension, row.translation]);
        });
        info.info('records ', records);
        res.send(records);
      } else if (rows.length === 0) {
        // send non translated transcription data back
        req.dbconn.query(
          'SELECT * FROM data_store where research_data_id = ? and final = 1;',
          id,
          (err2, rows2) => {
            if (err2) {
              error.error('/getTranscripts ERROR: ', err.code);
              res.send('An Error Occurred');
            } else if (rows2.length !== 0) {
              const records = [];
              rows2.forEach((row) => {
                records.push([row.timestamp, row.extension, row.transcript]);
              });
              res.send(records);
            } else {
              res.send('no records');
            }
          },
        );
      } else {
        res.send('no records');
      }
    },
  );
});

router.get('/getAQDUTTranscripts', restrict, (req, res) => {
  let { id } = req.query;
  let { download } = req.query;

  if (typeof download === 'undefined' || download !== 'true') download = false;

  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

  req.dbconn.query(
    'SELECT * FROM iprelay_log WHERE fk_call_id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/getAQDUTTranscripts ERROR: ' + err);
        res.send('An Error Occurred');
      } else if (rows.length !== 0) {
        const records = [];
        rows.forEach((row) => {
          records.push([row.timestamp, row.is_dut, row.text]);
        });
        info.info('records ', records);
        res.send(records);
      } else {
        res.send('no records');
      }
    },
  );
});

router.get('/getRecordings', restrict, (req, res) => {
  let { id } = req.query;

  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

  req.dbconn.query(
    'SELECT id, source FROM iprelay_recordings where fk_research_data_id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/getRecordings ERROR: ', err.code);
        res.send('An Error Occurred');
      } else if (rows.length !== 0) {
        // send translated data back
        const recordings = [];
        rows.forEach((row) => {
          recordings.push([row.id, row.source]);
        });
        res.send(recordings);
      } else {
        res.send('no records');
      }
    },
  );
});

router.get('/getGeckoData', restrict, (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

  const final = 1;

  info.info('req.query.id;, ', req.query.id);

  req.dbconn.query(
    'SELECT * FROM data_store where research_data_id = ? and final = ?;',
    [id, final],
    (err, data) => {
      if (err) {
        error.error('/getGeckoData ERROR: ', err.code);
      }
      info.info('data ', data);
      const terms = [];
      const terms2 = [];
      const speaker1 = data[0].extension;
      let speaker2 = '';

      // Amazon
      if (data[0].sttEngine === 'Z') {
        data.forEach((row) => {
          if (row.extension !== speaker1 && speaker2 === '') speaker2 = row.extension;
          const word = JSON.parse(row.raw).Transcript.Results[0].Alternatives[0].Items;
          let temp;
          word.forEach((line) => {
            temp = {
              start: line.StartTime,
              end: line.EndTime,
              text: line.Content,
              type: 'WORD',
            };
            if (row.extension === speaker1) terms.push(temp);
            else terms2.push(temp);
          });
        });
      }

      // Azure
      if (data[0].sttEngine === 'A') {
        data.forEach((row) => {
          if (row.extension !== speaker1 && speaker2 === '') speaker2 = row.extension;
          const word = JSON.parse(JSON.parse(row.raw).privResult.privJson).NBest[0].Words;
          let temp;
          word.forEach((line) => {
            temp = {
              start: (line.Offset) / (10 ** 7),
              end: (line.Offset + line.Duration) / (10 ** 7),
              text: line.Word,
              type: 'WORD',
            };
            if (row.extension === speaker1) terms.push(temp);
            else terms2.push(temp);
          });
        });
      }

      // Google
      if (data[0].sttEngine === 'G') {
        let prevTime = 0;
        data.forEach((row) => {
          if (row.extension !== speaker1 && speaker2 === '') speaker2 = row.extension;
          const word = JSON.parse(row.raw).results[0].alternatives[0].words;
          let temp;
          word.forEach((line) => {
            temp = {
              start: parseInt(line.startTime.seconds, 10)
                + (line.startTime.nanos / (10 ** 9)) + prevTime,
              end: parseInt(line.endTime.seconds, 10) + (line.endTime.nanos / (10 ** 9)) + prevTime,
              text: line.word,
              type: 'WORD',
            };
            if (row.extension === speaker1) terms.push(temp);
            else terms2.push(temp);
          });
          info.info('end time', parseInt(JSON.parse(row.raw).results[0].resultEndTime.seconds, 10) + JSON.parse(row.raw).results[0].resultEndTime.nanos / (10 ** 9));
          prevTime += parseInt(JSON.parse(row.raw).results[0].resultEndTime.seconds, 10)
            + JSON.parse(row.raw).results[0].resultEndTime.nanos / (10 ** 9);
        });
      }

      // Watson
      if (data[0].sttEngine === 'W') {
        data.forEach((row) => {
          if (row.extension !== speaker1 && speaker2 === '') speaker2 = row.extension;
          const word = JSON.parse(row.raw).results[0].alternatives[0].timestamps;
          word.forEach((line) => {
            if (line[0] !== '%HESITATION') {
              const temp = {
                start: line[1],
                end: line[2],
                text: line[0],
                type: 'WORD',
              };
              if (row.extension === speaker1) terms.push(temp);
              else terms2.push(temp);
            }
          });
        });
      }
      const gecko = {
        schemaVersion: '2.0',
        monologues: [{
          speaker: {
            name: null,
            id: speaker1,
          },
          terms,
        },
        ],
      };
      if (speaker2 !== '') {
        gecko.monologues.push(
          {
            speaker: {
              name: null,
              id: speaker2,
            },
            terms: terms2,
          },
        );
      }
      res.set('Content-Type', 'text/json');
      res.status(200).send(gecko);
      info.info('gecko data ', gecko);
    },
  );
});

router.get('/getIPRelayLog', restrict, (req, res) => {
  const { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) res.status(500).send('Missing valid ID');
  const csvFields = [
    'id',
    'callID',
    'isDUT',
    'text',
    'timestamp',
  ];
  req.dbconn.query(
    'SELECT id, fk_call_id AS callID, is_dut as isDUT, text, timestamp FROM iprelay_log where fk_call_id = ?;',
    id,
    (err, data) => {
      if (err) {
        res.status(500).send('Error');
      } else if (data.length > 0) {
        const jsonData = JSON.parse(JSON.stringify(data));
        const csv = json2csv({
          data: jsonData,
          fields: csvFields,
        });
        res.setHeader(
          'Content-disposition',
          `attachment; filename=acequill_ip_relay_log_${id}.csv`,
        );
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      } else {
        res.status(204).send(`No Results for ${id}`);
      }
    },
  );
});

router.get('/getRawTranscript', restrict, (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const csvFields = [
    'id',
    'extension',
    'transcript',
    'final',
    'timestamp',
    'sttEngine',
    'research_data_id',
    'raw',
  ];
  if (req.query.type === 'all') {
    req.dbconn.query(
      'SELECT * FROM data_store where research_data_id = ?;',
      id,
      (err, data) => {
        if (err) {
          error.error('/getRawTranscript ERROR: ', err.code);
        }

        const jsonData = JSON.parse(JSON.stringify(data));
        const csv = json2csv({
          data: jsonData,
          fields: csvFields,
        });
        res.setHeader(
          'Content-disposition',
          'attachment; filename=acequill_research_data.csv',
        );
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      },
    );
  } else {
    let final = 0;
    if (req.query.type === 'final') final = 1;
    req.dbconn.query(
      'SELECT * FROM data_store where research_data_id = ? and final = ?;',
      [id, final],
      (err, data) => {
        if (err) {
          error.error('/getRawTranscript ERROR: ', err.code);
        }

        const jsonData = JSON.parse(JSON.stringify(data));
        const csv = json2csv({
          data: jsonData,
          fields: csvFields,
        });
        res.setHeader(
          'Content-disposition',
          'attachment; filename=acequill_research_data.csv',
        );
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      },
    );
  }
});

router.get('/getAudioFile', restrict, (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

  req.dbconn.query(
    'SELECT audio_file_path, audio_file FROM research_data where id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/getAudioFile ERROR: ', err);
        res.send('An Error Occurred');
      } else if (rows.length === 1) {
        const audioFile = `${rows[0].audio_file_path}/${rows[0].audio_file}`;
        try {
          const stat = fs.statSync(audioFile);
          res.set('Content-disposition', `${'attachment; filename=acequill_'}${id}.wav`);
          res.writeHead(200, {
            'Content-Type': 'audio/wav',
            'Content-Length': stat.size,
          });
          const readStream = fs.createReadStream(audioFile);
          readStream.pipe(res);
        } catch (error) {
          res.send('No results');
        }
        // var stat = fs.statSync(audioFile);
        // res.writeHead(200, {
        //   "Content-Type": "audio/wav",
        //   "Content-Length": stat.size,
        // });
        // var readStream = fs.createReadStream(audioFile);
        // readStream.pipe(res);
      } else {
        res.send('No results');
      }
    },
  );
});

router.get('/getVideoFile', restrict, (req, res) => {
  let { id } = req.query;
  const videoFilepath = decode(req.configs.get('videoFilePath'));
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  info.info(`/getVideoFile id:${id}`);
  req.dbconn.query(
    'SELECT video_file FROM research_data where id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/getVideoFile ERROR: ', err.code);
        res.send('An Error Occurred');
      } else if (rows.length === 1) {
        const videoFile = videoFilepath + rows[0].video_file;
        const stat = fs.statSync(videoFile);
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': stat.size,
        });
        const readStream = fs.createReadStream(videoFile);
        readStream.pipe(res);
      } else {
        res.send('No video');
      }
    },
  );
});

router.get('/getVideoFile', restrict, (req, res) => {
  let { id } = req.query;
  const videoFilepath = decode(req.configs.get('videoFilePath'));
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  info.info(`/getVideoFile id:${id}`);
  req.dbconn.query(
    'SELECT video_file FROM research_data where id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/getVideoFile ERROR: ', err.code);
        res.send('An Error Occurred');
      } else if (rows.length === 1) {
        const videoFile = videoFilepath + rows[0].video_file;
        const stat = fs.statSync(videoFile);
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': stat.size,
        });
        const readStream = fs.createReadStream(videoFile);
        readStream.pipe(res);
      } else {
        res.send('No video');
      }
    },
  );
});

router.get('/playrecording', restrict, (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  info.info(`/playRecording id:${id}`);
  req.dbconn.query(
    'SELECT filepath FROM iprelay_recordings where id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/playrecording ERROR: ', err.code);
        res.send('An Error Occurred');
      } else if (rows.length === 1) {
        const videoFile = rows[0].filepath;
        const stat = fs.statSync(videoFile);
        res.writeHead(200, {
          'Content-Type': 'video/webm',
          'Content-Length': stat.size,
        });
        const readStream = fs.createReadStream(videoFile);
        readStream.pipe(res);
      } else {
        res.send('No video');
      }
    },
  );
});

router.get('/getNotes', restrict, (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

  req.dbconn.query(
    'SELECT notes, mobizen_notes FROM research_data where id = ?;',
    id,
    (err, rows) => {
      if (err) {
        error.error('/getNotes ERROR: ', err.code);
        res.send('An Error Occurred');
      } else if (rows.length > 0) {
        const notes = {};
        notes.call = rows[0].notes;
        notes.mobizen = rows[0].mobizen_notes;
        res.send(notes);
      } else {
        res.send(null);
      }
    },
  );
});

router.post('/saveNotes', restrict, (req, res) => {
  const { id } = req.body;
  const { callNotes } = req.body;
  const { mobizenNotes } = req.body;
  const sql = 'UPDATE research_data SET notes = ?, mobizen_notes = ? WHERE id = ?;';
  req.dbconn.query(sql, [callNotes, mobizenNotes, id], (
    err,
    result,
  ) => {
    res.send(`${result.affectedRows} record updated`);
  });
});

router.post('/deleteVideo', restrict, (req, res) => {
  const { id } = req.body;
  const sql = 'UPDATE research_data SET video_file = NULL WHERE id = ?;';
  req.dbconn.query(sql, id, (err, result) => {
    res.send(`${result.affectedRows} record updated`);
  });
});

router.post('/uploadVideo', restrict, (req, res) => {
  info.info('/uploadVideo Called');
  const form = new formidable.IncomingForm();
  form.uploadDir = `${__dirname}/../${decode(req.configs.get('videoFilePath'))}`;
  form.keepExtensions = true;
  form.maxFieldsSize = 10 * 1024 * 1024;
  form.maxFields = 1000;
  form.multiples = false;

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.writeHead(200, {
        'content-type': 'text/plain',
      });
      res.write('an error occurred');
    } else {
      const id = JSON.parse(fields.id);
      const fullpath = files.file.path;
      const filename = fullpath.substring(fullpath.lastIndexOf('/') + 1);

      req.dbconn.query(
        'UPDATE research_data SET video_file = ? WHERE id = ?;',
        [filename, id],
        (err2) => {
          if (err2) {
            error.error('/uploadVideo MySQL ERROR: ', err.code);
            res.send('An Error Occurred');
          } else {
            info.info(`${id}: received upload: ${filename}`);
            res.write(`received upload: ${filename}`);
            res.end();
          }
        },
      );
    }
  });
});

router.get('/scenarios', restrict, (req, res) => {
  const sql = 'Select * from scenario;';
  req.dbconn.query(sql, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      results.forEach((s) => {
        const t = s;
        delete t.transcript;
      });
      res.render('pages/scenario', {
        scenarios: results,
        role: req.session.role,
      });
    }
  });
});

router.post('/addScenario', restrict, (req, res) => {
  const sname = req.body.name;
  info.info(req.body);
  // TODO: insert scenario name in db
  const scenario = { scenario_name: sname };
  req.dbconn.query('INSERT INTO scenario SET ?', scenario, (
    err,
    result,
  ) => {
    if (err) {
      error.error(`Error in INSERT: ${JSON.stringify(err)}`);
    } else {
      error.info(`INSERT result: ${JSON.stringify(result)}`);
    }
  });
  res.send({ status: 'Success', id: '2' });
});

const scenarioFileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, './uploads/scenarios/');
    },
    filename(req, file, cb) {
      cb(null, Date.now() + file.originalname);
    },
  }),
});

router.post('/updateScenario', scenarioFileUpload.single('scenarioFile'), (req, res) => {
  const sText = req.body.scenarioText;
  const sId = req.body.scenarioId;
  let params = [sText, sId];
  let sql = 'UPDATE scenario SET transcript = ? WHERE id = ?';
  if (req.file) {
    params = ['./uploads/scenarios', req.file.filename, sText, sId];
    sql = 'UPDATE scenario SET audio_file_path = ?, audio_file = ?, transcript = ? WHERE id = ?';
  }

  req.dbconn.query(sql, params, (err, result) => {
    if (err) {
      error.error('Error in UPDATE: ', err);
      res.status(500).send({ status: 'Error' });
    } else {
      info.info(`UPDATE result: ${JSON.stringify(result)}`);
      res.status(200).send({ status: 'Success' });
    }
  });
});

router.post('/deleteScenario', restrict, (req, res) => {
  const { sId } = req.body;
  info.info('deleteScenario ', sId);
  // TODO: delete row in scenario table by ID
  const sql = 'DELETE FROM scenario WHERE id = ?';
  req.dbconn.query(sql, sId, (err, result) => {
    if (err) {
      error.error(`Error in DELETE: ${JSON.stringify(err)}`);
    } else {
      info.info(`DELETE result: ${JSON.stringify(result)}`);
    }
  });
  res.send({ status: 'Success' });
});

router.get('/ScenarioDetails', restrict, (req, res) => {
  const sId = req.query.id;
  // TODO: get scenario details by id
  const sql = 'Select * from scenario WHERE id = ?';
  req.dbconn.query(sql, sId, (err, results) => {
    if (err || !results[0]) {
      error.error(`SQL Error: ${err}`);
    } else {
      info.info(results);
      const hasAudioFile = !!(results[0].audio_file);
      res.send({
        status: 'Success',
        id: sId,
        sName: results[0].scenario_name,
        sText: results[0].transcript,
        path: `${results[0].audio_file_path}/${results[0].audio_file}`,
        hasAudioFile,
      });
    }
  });
  // res.send({status: "Success", id: "2", sName:"Some Name",sText:
  // "The rain in Spain falls mainly on the plain."})
});

router.get('/getScenarioAudioFile', restrict, (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT audio_file_path, audio_file FROM scenario where id = ?;';
  req.dbconn.query(sql, id, (err, rows) => {
    if (err) {
      error.error('/getScenarioAudioFile ERROR: ', err);
      res.status(500).send('An Error Occurred');
    } else if (rows.length === 1) {
      const audioFile = `${rows[0].audio_file_path}/${rows[0].audio_file}`;
      info.info(audioFile);
      try {
        const stat = fs.statSync(audioFile);
        info.info('sss', stat);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': stat.size,
        });
        fs.createReadStream(audioFile).pipe(res);
        // readStream.pipe(res);
      } catch (err) {
        error.error('/getScenarioAudioFile an error has occurred', err);
        res.send('No results');
      }
    } else {
      res.send('No results');
    }
  });
});

router.get('/getIPRelayScenario', restrict, (req, res) => {
  const { id } = req.query;
  const sql = 'Select * from iprelay_scenario_content where iprelay_scenario_id = ?;';
  req.dbconn.query(sql, id, (err, results) => {
    if (err || !results[0]) {
      error.error('SQL Error: this IpRelay scenario has no content' + err);
      res.send(results);
    } else {
      info.info('getIPRelayScenario results ', results);
      res.send(results);
    }
  });
});

router.post('/addIpRelayScenario', restrict, (req, res) => {
  const sname = req.body.name;
  const scenario = { name: sname, use_count: 0 };
  // console.log("scenario ", scenario)
  req.dbconn.query('INSERT INTO iprelay_scenario SET ?', scenario, (
    result,
    err,
  ) => {
    if (err) {
      error.error(`Error in INSERT: ${JSON.stringify(err)}`);
    } else {
      info.info(`INSERT result: ${JSON.stringify(result)}`);
    }
  });
  res.send({ status: 'Success', id: '1' });
});

router.post('/renameScenario', restrict, (req, res) => {
  const sid = req.body.id;
  const sname = req.body.name;
  const scenario = { name: sname };

  let sql = 'UPDATE iprelay_scenario SET ? WHERE id =' + sid;
  req.dbconn.query(sql, scenario, (
    err,
  ) => { });
  res.send({ status: 'Success', id: '1' });
});

router.post('/cloneScenario', restrict, (req, res) => {
  const sid = req.body.id;
  const sname = req.body.name;
  const scenario = { name: sname };
  var newid = "";
  console.log("cloneScenario asdcoiasdcaoisdcaidosc", req.body)

  let sql = 'INSERT INTO iprelay_scenario (name, use_count, notes)'
    + 'SELECT name, use_count, notes FROM iprelay_scenario WHERE id = ' + sid + ';';

  req.dbconn.query(sql, (err, result) => {
    if (err) {
      // console.log(`Error in INSERT: ${JSON.stringify(err)}`);
    } else {
      console.log("ascasdcasdcasdc insertId: ", result.insertId)
      let contentsql = 'INSERT INTO iprelay_scenario_content (iprelay_scenario_id, convoOrder, bubbleText, rawText, audioFilePath, isDUT)'
        + 'SELECT ' + result.insertId + ', convoOrder, bubbleText, rawText, audioFilePath, isDUT FROM iprelay_scenario_content WHERE iprelay_scenario_id = '
        + sid + ' ;';
      newid = result.insertId;

      // duplicate content
      req.dbconn.query(contentsql, (err, result) => {
        // duplicate the audio files
        const sql = 'Select * from iprelay_scenario_content where iprelay_scenario_id = ?;';
        req.dbconn.query(sql, sid, (err, results) => {
          if (err || !results[0]) {
            // console.log('SQL Error: this IpRelay scenario has no content');
          } else {
            // console.log("getIPRelayScenario results ", results);
            results.forEach(row => {
              // console.log("old path ", row.audioFilePath);
              if (row.audioFilePath != 'DUT') {
                fn = row.audioFilePath.substring(31, row.audioFilePath.length);
                fn = "./uploads/iprelay/" + Date.now() + fn
                fs.copyFile(row.audioFilePath, fn, (err) => {
                  if (err) {
                    // console.log("Error in cloning Scenario:", err);
                  } else {
                    // console.log("new fn ", fn);
                    // console.log("new newid ", newid);
                    // console.log("new row.convoOrder ", row.convoOrder);
                    let updatePathSql = 'UPDATE iprelay_scenario_content SET audioFilePath = "' + fn
                      + '" WHERE iprelay_scenario_id = ' + newid + ' AND convoOrder = ' + row.convoOrder + ' ;'
                    req.dbconn.query(updatePathSql, (
                      err,
                    ) => {
                      if (err) {
                        // console.log(`Error in INSERT: ${JSON.stringify(err)}`);
                      } else {
                        // console.log(`INSERT result: ${JSON.stringify(result)}`);
                      }
                    });
                  }
                });
              }
            });
          }
        });
      });
    }
  });
  res.send({ status: 'Success', id: '1' });
});

router.post('/deleteIpRelayScenario', restrict, (req, res) => {
  const { sId } = req.body;

  let sql = 'SELECT audioFilePath FROM iprelay_scenario_content WHERE iprelay_scenario_id = ?';
  req.dbconn.query(sql, sId, (err, result) => {
    if (err) {
      error.error(`Error in get audio path: ${JSON.stringify(err)}`);
    } else {
      info.info(`audio path: ${JSON.stringify(result)}`);
      result.forEach((path) => {
        info.info(`audio path indexed: ${JSON.stringify(path)}`);
        if (path.audioFilePath !== 'DUT' && path.audioFilePath !== '') {
          fs.unlink(path.audioFilePath, ((err2) => {
            if (err2) {
              error.error(err);
            } else {
              info.info('Deleted file:', path.audioFilePath);
            }
          }));
        }
      });
    }
  });

  sql = 'DELETE FROM iprelay_scenario_content WHERE iprelay_scenario_id = ?';
  req.dbconn.query(sql, sId, (result, err) => {
    if (err) {
      error.error(`Error in DELETE: ${JSON.stringify(err)}`);
    } else {
      info.info(`DELETE result: ${JSON.stringify(result)}`);
      const sql2 = 'DELETE FROM iprelay_scenario WHERE id = ?';
      req.dbconn.query(sql2, sId, (err2) => {
        if (err2) {
          error.error(`Error in DELETE: ${JSON.stringify(err)}`);
        } else {
          info.info(`DELETE result: ${JSON.stringify(result)}`);
        }
      });
    }
  });
  res.send({ status: 'Success' });
});

const iprelayFileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, './uploads/iprelay/');
    },
    filename(req, file, cb) {
      cb(null, Date.now() + file.originalname);
    },
  }),
});

router.post('/updateIpRelayScenario', iprelayFileUpload.array('scenarioFile', 12), (req, res) => {
  info.info('files ' + req.files);
  const data = req.body.data.split(',');
  const sid = req.body.id;

  const formated = [];
  for (let i = 0; i < data.length; i += 7) {
    formated.push(data.slice(i, i + 7));
  }
  info.info('formated ' + formated);
  let k = 0;
  for (let i = 0; i < formated.length; i += 1) {
    info.info('here ' + formated[i][4]);
    //info.info('file name '+ req.files[k].filename);
    if (formated[i][6] === '1') {
      info.info('file name ' + req.files[k].filename);
      formated[i][4] = req.files[k].destination + req.files[k].filename;
      k += 1;
    }
  }
  formated.forEach((row) => {
    row.splice(6, 1);
  });
  info.info('formated ', formated);

  const sql = 'DELETE FROM iprelay_scenario_content WHERE iprelay_scenario_id = ?;';
  console.log(">>>>>", sid);
  req.dbconn.query(sql, sid, (err, result) => {
    if (err) {
      error.error(`Error in DELETE: ${JSON.stringify(err)}`);
    } else {
      info.info(`DELETE result: ${JSON.stringify(result)}`);
      const sql2 = 'INSERT INTO iprelay_scenario_content(iprelay_scenario_id, convoOrder, bubbleText, rawText, audioFilePath, isDUT)  VALUES ? ';
      req.dbconn.query(sql2, [formated], (err2, result2) => {
        if (err2) {
          error.error(`SQL ERR: ${err}`);
          res.send('err');
        } else {
          info.info('insert updateIpRelayScenario sucess');
          res.send(`${result2.affectedRows} record updated`);
        }
      });
    }
  });
});

router.get('/loadACConfig', restrict, (req, res) => {
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

router.get('/saveACConfig', restrict, (req, res) => {
  const { data } = req.query;
  let sql = 'UPDATE device_settings SET stt_engine = ?, source_language = ?, stt_show_final_caption = ?, delay = ?, translation_engine = ?, ';
  sql += 'target_language = ?, tts_engine = ?, tts_translate = ?, tts_voice = ?, ARIA_settings = ?, confidence_show_word = ?,confidence_show_phrase = ?, ';
  sql += 'confidence_upper_lim = ?, confidence_lower_lim = ?, confidence_upper_color = ?, confidence_lower_color = ?, ';
  sql += 'confidence_bold = ?, confidence_italicize = ?, confidence_underline = ?, iprelay = ?, iprelay_scenario = ?, tts_enabled = ?, stt_show_entity_sentiment = ?, predefined_id = ? ';
  sql += 'WHERE extension = ?;';

  if (data.confidence_lower_lim === '') {
    data.confidence_lower_lim = 0;
  }
  if (data.confidence_upper_lim === '') {
    data.confidence_upper_lim = 0;
  }

  data.predefined_id = data.predefined_id ? data.predefined_id : null;
  const params = [data.stt_engine, data.source_language,
  data.stt_show_final_caption, Number(data.delay),
  data.translation_engine, data.target_language, data.tts_engine,
  data.tts_translate, data.tts_voice, data.ARIA_settings,
  data.confidence_show_word, data.confidence_show_phrase,
  data.confidence_upper_lim, data.confidence_lower_lim,
  data.confidence_upper_color, data.confidence_lower_color,
  data.confidence_bold, data.confidence_italicize, data.confidence_underline,
  data.iprelay, data.iprelay_scenario, data.tts_enabled, data.stt_show_entity_sentiment, data.predefined_id,
  data.extension,
  ];
  for (let i = 0; i < params.length; i += 1) {
    if (params[i] === 'true') {
      params[i] = 1;
    }
    if (params[i] === 'false') {
      params[i] = 0;
    }
  }
  req.dbconn.query(sql, params, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      info.info('saveACConfig success');
      res.send(results[0]);
    }
  });
});


router.get('/contacts', restrict, (req, res) => {
  const sql1 = 'SELECT idcontacts, username, cellphone, workphone, homephone, faxphone, personalemail, workemail, favorite, extension FROM contacts;';
  const sql2 = 'SELECT extension FROM device_settings order by extension;'
  async.parallel([
    function (callback) {
      req.dbconn.query(sql1, (err, results) => {
        if (err) {
          error.error(`SQL Error: ${err}`);
        }
        results1 = results;
        callback(null, 'finished\n')
      });
    },
    function (callback) {
      req.dbconn.query(sql2, (err, results) => {
        if (err) {
          error.error(`SQL Error: ${err}`);
        }
        results2 = results;
        callback(null, 'finished\n')
      });
    }
  ], function (err) {
    if (err) {
      error.error(err);
    }
    res.render('pages/contacts', {
      contact: results1,
      extensions: results2,
      role: req.session.role,
    });
  });
});

router.post('/UpdateConfig', restrict, (req, res) => {
  let extension = parseInt(req.body.extension, 10);
  var name = req.body.name;
  var sttEngine = req.body.stt_engine;
  var delay = req.body.delay;
  var translationEngine = req.body.translation_engine;
  var sourceLanguage = req.body.source_language;
  var targetLanguage = req.body.target_language;
  var ariaSettings = req.body.aria_settings;

  console.log("req.body ", req.body)
  console.log("name ", name)
  console.log("sttEngine ", sttEngine)
  console.log("delay ", delay)
  console.log("translationEngine ", translationEngine)
  console.log("sourceLanguage ", sourceLanguage)
  console.log("targetLanguage ", targetLanguage)
  console.log("ariaSettings ", ariaSettings)


  if (!extension) extension = 0;

  if (
    sttEngine
    && delay
    && name
    && translationEngine
    && sourceLanguage
    && targetLanguage
    && ariaSettings
  ) {
    const sql = `INSERT INTO device_settings
      (extension, stt_engine, delay, name,
        translation_engine, source_language, target_language, ARIA_settings) VALUES (?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE stt_engine = VALUES(stt_engine),
        name = VALUES(name), delay = VALUES(delay),
        translation_engine = VALUES(translation_engine),
        source_language= VALUES(source_language),
        target_language = VALUES(target_language),
        ARIA_settings = VALUES(aria_settings);`;
    const params = [
      extension,
      sttEngine,
      delay,
      name,
      translationEngine,
      sourceLanguage,
      targetLanguage,
      ariaSettings,
    ];
    req.dbconn.query(sql, params, (err, result) => {
      if (err) {
        error.error(`SQL ERR: ${err}`);
        res.send('err');
      } else {
        res.send(`${result.affectedRows} record updated`);
      }
    });
  } else {
    res.send('Bad Inputs');
  }
});

router.post('/UpdateContact', restrict, (req, res) => {
  const { idcontacts } = req.body;
  const { username } = req.body;
  const { cellphone } = req.body;
  const { workphone } = req.body;
  const { homephone } = req.body;
  const { faxphone } = req.body;
  const { personalemail } = req.body;
  const { workemail } = req.body;
  const { favorite } = req.body;
  const { extension } = req.body;

  if (username && cellphone && extension) {
    if (idcontacts === "0") {
      const sql = `INSERT INTO contacts
        (username, cellphone, workphone, homephone, faxphone, personalemail,
          workemail, favorite, extension) VALUES (?,?,?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE username = VALUES(username),
          cellphone = VALUES(cellphone),
          workphone = VALUES(workphone),
          homephone = VALUES(homephone),
          faxphone = VALUES(faxphone),
          personalemail= VALUES(personalemail),
          workemail = VALUES(workemail),
          favorite = VALUES(favorite),
          extension = VALUES(extension);`;

      const params = [
        username,
        cellphone,
        workphone,
        homephone,
        faxphone,
        personalemail,
        workemail,
        favorite,
        extension,
      ];

      req.dbconn.query(sql, params, (err, result) => {
        if (err) {
          error.error(`SQL ERR: ${err}`);
          res.send('err');
        } else {
          res.send(`${result.affectedRows} record updated`);
        }
      });
    } else {
      const sql = `UPDATE contacts
          SET username = ?,
          cellphone = ?,
          workphone = ?,
          homephone = ?,
          faxphone = ?,
          personalemail= ?,
          workemail = ?,
          favorite = ?,
          extension = ? WHERE idcontacts = ?;`;

      const params = [
        username,
        cellphone,
        workphone,
        homephone,
        faxphone,
        personalemail,
        workemail,
        favorite,
        extension,
        idcontacts,
      ];

      req.dbconn.query(sql, params, (err, result) => {
        if (err) {
          error.error(`SQL ERR: ${err}`);
          res.send('err');
        } else {
          res.send(`${result.affectedRows} record updated`);
        }
      });
    }
  } else {
    res.send('Bad Inputs');
  }
});

router.post('/DeleteConfig', restrict, (req, res) => {
  const { extension } = req.body;
  info.info(`Delete ID: ${extension}`);
  if (extension) {
    const sql2 = 'DELETE FROM device_settings WHERE extension = ? AND default_device <> true;';
    req.dbconn.query(sql2, extension, (err, result) => {
      if (err) {
        error.error(`SQL ERR: ${err}`);
        res.send('err');
      } else {
        res.send(`${result.affectedRows} record deleted`);
      }
    });
  } else {
    res.send('Bad Inputs');
  }
});

router.post('/DeleteContact', restrict, (req, res) => {
  const { idcontacts } = req.body;
  if (idcontacts) {
    const sql = 'DELETE FROM contacts WHERE idcontacts = ?;';
    req.dbconn.query(sql, idcontacts, (err, result) => {
      if (err) {
        error.error(`SQL ERR: ${err}`);
        res.send('err');
      } else {
        res.send(`${result.affectedRows} record deleted`);
      }
    });
  } else {
    res.send('Bad Inputs');
  }
});

router.get('/iprelay', restrict, (req, res) => {
  const sql = 'Select * from iprelay_scenario;';
  req.dbconn.query(sql, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      error.error('iprelay_scenario ', results);
      res.render('pages/iprelay', {
        scenarios: results,
        role: req.session.role,
      });
    }
  });
});
router.get('/configs', restrict, (req, res) => {
  const sql = 'Select * from device_settings order by extension;';
  req.dbconn.query(sql, (err, results) => {
    if (err) {
      error.error(`SQL Error: ${err}`);
    } else {
      const sql2 = 'Select * from iprelay_scenario;';
      req.dbconn.query(sql2, (err2, iprelayResults) => {
        if (err2) {
          error.error(`SQL Error: ${err2}`);
        } else {
          const sql3 = 'Select * from predefined_captions';
          req.dbconn.query(sql3, (err3, predefinedResults) => {
          if (err3) {
              error.error(`SQL Error: ${err2}`);
            } else {
         // error.error('iprelayResults ', iprelayResults);
          res.render('pages/advanced_config', {
            extensions: results,
            iprelay: iprelayResults,
            device_setting: results[0] ? JSON.stringify(results[0]) : "{}",
            role: req.session.role,
            predefined: predefinedResults,
          });
        }
      });
        }
      });
    }
  });
});

router.get('/csp-:cspEngine', restrict, (req, res) => {
  let csp = req.params.cspEngine || 'unknown';
  csp = csp.toLowerCase();
  const available = ['amazon', 'azure', 'google', 'watson'];
  if (available.includes(csp)) {
    console.log(csp)
    res.render('pages/config_' + csp);
  } else {
    res.render('pages/error', { message: "Unknown CSP" });
  }
});

router.get('/rtstt', restrict, (req, res) => {
  res.render('pages/rtstt', {
    role: req.session.role,
  });
});
router.get('/callreview', restrict, (req, res) => {
  res.render('pages/callreview', {
    role: req.session.role,
  });
});

router.get('/firsttimesetup', (req, res) => {
  const sql = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
  req.dbconn.query(sql, (err, result) => {
    if (err) {
      error.error(`SQL ERR: ${err}`);
      res.send('err');
    } else if (result[0].adminCount === 0) {
      res.render('pages/firsttimesetup');
    } else {
      res.redirect('./');
    }
  });
});

router.post('/CreateAdmin', (req, res) => {
  const { username } = req.body;
  const { password } = req.body;
  const { firstname } = req.body;
  const { lastname } = req.body;
  if (
    validator.isUsernameValid(username)
    && validator.isPasswordComplex(password)
    && validator.isNameValid(firstname)
    && validator.isNameValid(lastname)
  ) {
    const sql1 = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
    req.dbconn.query(sql1, (err, result1) => {
      if (err) {
        error.error(`SQL ERR: ${err}`);
        res.send('err');
      } else if (result1[0].adminCount === 0) {
        bcrypt.hash(password, 10, (err2, hash) => {
          const sql2 = 'INSERT INTO login_credentials (username, password, first_name, last_name, role, last_login) VALUES (?,?,?,?,?,?);';
          req.dbconn.query(
            sql2,
            [username, hash, firstname, lastname, 'admin', null],
            (err3, result2) => {
              if (err3) {
                error.error(`SQL ERR: ${err}`);
                res.send('err');
              } else {
                res.send(`${result2.affectedRows} record updated`);
              }
            },
          );
        });
      } else {
        res.send('Account already exists');
      }
    });
  } else {
    res.send('Bad Inputs');
  }
});

router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('./');
  }
  const sql = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
  req.dbconn.query(sql, (err, result) => {
    if (err) {
      error.error(`SQL ERR: ${err}`);
      res.send('err');
    } else if (result[0].adminCount === 0) {
      res.render('pages/firsttimesetup');
    } else {
      res.render('pages/login')
    }
  });


});

router.post('/login', (req, res) => {
  const { username } = req.body;
  const { password } = req.body;
  if (
    validator.isUsernameValid(username)
    && validator.isPasswordComplex(password)
  ) {
    const sql = 'SELECT * FROM login_credentials WHERE username = ? limit 0,1;';
    const params = [username];
    req.dbconn.query(sql, params, (err, user) => {
      if (err) {
        error.error(`SQL Login Error: ${err}`);
      } else if (user.length === 1) {
        bcrypt.compare(password, user[0].password, (err2, valid) => {
          if (valid) {
            req.session.idlogin_credentials = user[0].idlogin_credentials;
            req.session.user = user[0].username;
            req.session.firstname = user[0].first_name;
            req.session.lastname = user[0].last_name;
            req.session.role = user[0].role;
            req.session.error = '';
            req.dbconn.query(
              'UPDATE `login_credentials` SET `last_login` = now() WHERE `idlogin_credentials` = ?',
              user[0].idlogin_credentials,
            );
            res.status(200).send('success');
          } else {
            info.info(valid);
            res.status(200).send('failure');
          }
        });
      } else {
        res.status(200).send('failure');
      }
    });
  } else {
    res.send('Bad Inputs');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      error.error(err);
    } else {
      res.redirect('./');
    }
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      error.error(err);
    } else {
      res.redirect('./');
    }
  });
});

module.exports = router;
