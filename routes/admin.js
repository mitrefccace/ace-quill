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
const fs = require('fs');
const fsPromises = require('fs/promises');
const { Parser } = require('@json2csv/plainjs');
const bcrypt = require('bcryptjs');

const router = express.Router();
const homedir = require('os').homedir();
const multer = require('multer');
const archiver = require('archiver');
const { Readable } = require('stream');
const formidable = require('formidable');
const validator = require('../utils/validator');
const { buildWordFromFile } = require('../utils/text-to-word.js');
const awsMFA = require('../utils/aws-mfa');

const async = require('async');
const config = require('./../configs/config.js');

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
  if (req.originalUrl === '/admin') {
    res.redirect('./admin/configs');
  } else {
    res.redirect('./configs');
  }
});

router.get('/cdr', restrict, (req, res) => {
  res.render('pages/cdr', {
    role: req.session.role,
  });
});

router.get('/getallcdrrecs', restrict, async (req, res) => {
  let query = 'SELECT * FROM asterisk.bit_cdr ORDER BY calldate';
  let params = [];
  if (req.query.start && req.query.end) {
    query = 'SELECT * FROM asterisk.bit_cdr WHERE (calldate BETWEEN ? AND ?)';
    params = [req.query.start, req.query.end];
  }
  try {
    const [results, fields] = await req.dbconn.query(query, params);
    if (results.length > 0) {
      if (req.query.download) {
        const parser = new Parser({ fields: fields });
        const csv = parser.parse(rows);
        res.setHeader('Content-disposition', 'attachment; filename=cdr.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      } else {
        res.status(200).send({ message: 'Success', data: results });
      }
    } else {
      res.status(200).send({ message: 'No cdr records', data: {} });
    }
  } catch (error) {
    console.error("Error /admin/getallcdrrecs:", error);
    res.status(200).send({ message: 'No cdr records', data: {} });
  }
});

router.get('/users', restrict, async (req, res) => {
  const sqlUsers = 'SELECT idlogin_credentials, username, first_name, last_name, last_login FROM login_credentials;';
  try {
    const [results, _fields] = await req.dbconn.query(sqlUsers);
    res.render('pages/users', { users: results, role: req.session.role });
  } catch (error) {
    console.error("Error /admin/users:", error);
    res.status(200).send("Error");
  }
});

router.get('/servertest', restrict, (req, res) => {
  res.render('pages/server_test');
});

router.get('/audio_transcribing', restrict, async (req, res) => {
  const sql = `SELECT id, title, status, date, file_location, audio_file_name FROM audio_file_transcribe ORDER BY id DESC;`;
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    res.render('pages/audio_transcribing', {
      extension: config.asterisk.ext_admin,
      password: config.asterisk.ext_admin_password,
      host: config.asterisk.fqdn,
      transcription: results
    });
  } catch (error) {
    console.error("Error GET /audio_transcribing:", error);
    res.render('pages/error', { message: "Error check the logs." });
  }
});

router.get('/audible_cues', restrict, async (req, res) => {
  const cues_sql = `SELECT id, title, transcript, status, date, file_location, audio_file_name, duration, type FROM audible_cues ORDER BY id DESC;`;
  try {
    const [results, _fields] = await req.dbconn.query(cues_sql);
    res.render('pages/audible_cues', {
      extension: config.asterisk.ext_admin,
      password: config.asterisk.ext_admin_password,
      host: config.asterisk.fqdn,
      cues: results
    });
  } catch (error) {
    console.error("Error GET /audible_cues:", error);
    res.render('pages/error', { message: "Error check the logs." });
  }
});

router.post('/AddUser', restrict, async (req, res) => {
  const { username, password, firstname, lastname } = req.body;
  if (validator.isUsernameValid(username) && validator.isPasswordComplex(password)
    && validator.isNameValid(firstname) && validator.isNameValid(lastname)) {
    try {
      const hash = await bcrypt.hash(password, 10)
      const sql = 'INSERT INTO login_credentials (username, password, first_name, last_name, role, last_login) VALUES (?,?,?,?,?,?);';
      const [results, _fields] = await req.dbconn.query(sql, [username, hash, firstname, lastname, 'researcher', null]);
      res.send(`${results.affectedRows} record updated`);
    } catch (error) {
      console.error("Error POST /AddUser:", error);
      res.send('Error');
    }
  } else {
    res.send('Bad Inputs');
  }
});

router.post('/DeleteUser', restrict, async (req, res) => {
  const { id } = req.body;
  if (id > 1 && !Number.isNaN(id)) {
    try {
      const sql = "DELETE FROM login_credentials WHERE idlogin_credentials = ? AND role <> 'admin';";
      const [results, _fields] = await req.dbconn.query(sql, id);
      res.send(`${results.affectedRows} record deleted`);
    } catch (error) {
      console.error("Error POST /DeleteUser:", error);
      res.send('Error');
    }
  } else {
    res.send('Bad Inputs');
  }
});

router.get('/audiocontrols', restrict, async (req, res) => {
  const sql = `SELECT p.id, p.name, p.description, p.active, COUNT(f.id) as freq_num FROM audio_profiles p
  LEFT JOIN audio_filters f ON f.profile_id = p.id
  GROUP BY p.id;`;
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    res.render('pages/audio_controls_admin', {
      extension: config.asterisk.ext_admin,
      password: config.asterisk.ext_admin_password,
      host: config.asterisk.fqdn,
      profiles: results
    });
  } catch (error) {
    console.error("Error GET /audiocontrols:", error);
    res.render('pages/error', { message: "Error check the logs." });
  }
});


router.get('/audioprofiledata', restrict, async (req, res) => {
  const { id } = req.query;
  const sql = `SELECT * from audio_filters WHERE profile_id = ? ORDER BY id;`;
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    res.status(200).send({ message: 'Success', filters: results });
  } catch (error) {
    console.error("Error GET /audioprofiledata:", error)
    res.status(500).send({ message: 'Error' })
  }
});

router.post('/audioprofiledelete', restrict, async (req, res) => {
  const { id } = req.body;
  const sql = 'DELETE FROM audio_profiles WHERE id = ?;';
  try {
    await req.dbconn.query(sql, id);
    res.send("OK")
  } catch (error) {
    console.error("Error POST /audioprofiledelete:", error)
    res.status(500).send("ERROR")
  }
});

router.post('/audioprofilenamesave', restrict, async (req, res) => {
  let { id, name } = req.body;
  let sql = '';
  let params = []

  if (name && id) {
    if (id == 'NEW') {
      sql = 'INSERT INTO audio_profiles (name) VALUES (?);';
      params = [name]
    } else {
      sql = 'UPDATE audio_profiles SET name = ? WHERE id = ?;';
      params = [name, id]
    }
    try {
      const [results, _fields] = await req.dbconn.query(sql, params);
      if (id == "NEW")
        id = results.insertId;
      res.send({ "message": "success", "id": id })
    } catch (error) {
      console.error("Error POST /audioprofilenamesave:", error)
      res.status(500).send("ERROR")
    }
  } else {
    res.send({ "message": "failure" })
  }
});

router.post('/audioprofileactive', restrict, async (req, res) => {
  let { id, active } = req.body;
  active = active == 'true' ? 1 : 0;
  const sql = 'UPDATE audio_profiles SET active = ? WHERE id = ?;';
  const params = [active, id]
  try {
    const [results, _fields] = await req.dbconn.query(sql, params);
    if (id == "NEW")
      id = results.insertId
    res.send({ "message": "success", "id": id })
  } catch (error) {
    console.error("Error POST /audioprofileactive:", error);
    res.status(500).send("ERROR")
  }
});

router.get('/audiofilterdata', restrict, async (req, res) => {
  const { id } = req.query;
  const sql = `SELECT * from audio_filters WHERE id = ?;`;
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    res.status(200).send({ message: 'Success', filter: results[0] });
  } catch (error) {
    console.error("Error POST /audioprofileactive:", error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/audiofiltersave', restrict, async (req, res) => {
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
  try {
    await req.dbconn.query(sql, params);
    res.send("OK");
  } catch (error) {
    console.error("Error POST /audiofiltersave:", error);
    res.status(500).send("ERROR")
  }
});

router.post('/audiofilterdelete', restrict, async (req, res) => {
  const { id } = req.body;
  const sql = 'DELETE FROM audio_filters WHERE id = ?;';
  try {
    await req.dbconn.query(sql, id);
    res.send("OK");
  } catch (error) {
    console.error("Error POST /audiofilterdelete:", error);
    res.status(500).send("ERROR")
  }
});

router.get('/precanned', restrict, async (req, res) => {
  const sql = `SELECT p.id, p.title, MAX(w.ms) AS duration FROM predefined_captions p
  LEFT JOIN predefined_captions_data w ON p.id = w.fk_id
  GROUP BY id;`;
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    res.render('pages/precanned_admin', {
      extension: config.asterisk.ext_admin,
      password: config.asterisk.ext_admin_password,
      host: config.asterisk.fqdn,
      profiles: results
    });
  } catch (error) {
    console.error("Error GET /precanned:", error);
    res.render('pages/error', { message: "Error check the logs." });
  }
});

router.post('/precannednamesave', restrict, async (req, res) => {
  let { id, name } = req.body;
  let sql = '';
  let params = []
  if (name && id) {
    if (id == 'NEW') {
      sql = 'INSERT INTO predefined_captions (title) VALUES (?);';
      params = [name]
    } else {
      sql = 'UPDATE predefined_captions SET title = ? WHERE id = ?;';
      params = [name, id]
    }
    try {
      const [results, _fields] = await req.dbconn.query(sql, params);
      if (id == "NEW")
        id = results.insertId
      res.send({ "message": "success", "id": id })
    } catch (error) {
      console.error("Error POST /precannednamesave:", error);
      res.status(500).send("ERROR")
    }
  } else {
    res.status(500).send("Missing Parameters");
  }
});

router.get('/precanneddata', restrict, async (req, res) => {
  const { id } = req.query;
  const sql = `SELECT phrase_id, GROUP_CONCAT(word ORDER BY ms SEPARATOR ' ') AS phrase,
  MIN(ms) as start_time, MAX(ms) AS end_time
  FROM predefined_captions_data
  WHERE fk_id = ?
  GROUP BY phrase_id;`
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    res.status(200).send({ message: 'Success', filters: results });
  } catch (error) {
    console.error("Error GET /precanneddata:", error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/precannedphrasesave', restrict, async (req, res) => {
  const { fk_id, word, offset, final, phrase_id } = req.body;
  const sql = 'INSERT INTO predefined_captions_data (fk_id,word,ms,final,phrase_id) VALUES (?,?,?,?,?);';
  const params = [fk_id, word, offset, final, phrase_id];
  try {
    const [results, _fields] = await req.dbconn.query(sql, params);
    res.send({ "message": "success", "result": results });
  } catch (error) {
    console.error("Error POST /precannedphrasesave:", error);
    res.status(500).send("ERROR")
  }
});

router.post('/precanneddelete', restrict, async (req, res) => {
  const { id } = req.body;
  const sql1 = 'DELETE FROM predefined_captions WHERE id = ?;';
  const sql2 = 'DELETE FROM predefined_captions_data WHERE fk_id = ?;';
  try {
    await req.dbconn.query(sql1, id);
    await req.dbconn.query(sql2, id);
    res.send("OK");
  } catch (error) {
    console.error("Error POST /precanneddelete:", error);
    res.status(500).send("ERROR");
  }
});

router.post('/phrasedelete', restrict, async (req, res) => {
  const { id } = req.body;
  const sql = 'DELETE FROM predefined_captions_data WHERE phrase_id = ?;';
  try {
    await req.dbconn.query(sql, id);
    res.send("OK");
  } catch (error) {
    console.error("Error POST /phrasedelete:", error);
    res.status(500).send("ERROR");
  }
});

router.get('/phrasedata', restrict, async (req, res) => {
  const { id } = req.query;
  const sql = `SELECT * from predefined_captions_data WHERE phrase_id = ? ORDER BY ms;`;
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    res.status(200).send({ message: 'Success', filter: results });
  } catch (error) {
    console.error("Error GET /phrasedata:", error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/precannedphraseedit', restrict, async (req, res) => {
  const { id, word, offset } = req.body;
  const sql = `UPDATE predefined_captions_data SET word=?, ms=? WHERE id = ?;`;
  const params = [word, offset, id];
  try {
    const [results, _fields] = await req.dbconn.query(sql, params);
    res.status(200).send({ message: 'Success', filter: results });
  } catch (error) {
    console.error("Error POST /precannedphraseedit:", error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getMaxPhraseId', restrict, async (req, res) => {
  const sql = `SELECT MAX(phrase_id) as max FROM predefined_captions_data;`;
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    res.send({ "message": "success", "results": results[0].max });
  } catch (error) {
    console.error("Error GET /getMaxPhraseId:", error);
    res.status(500).send('Error');
  }
});

router.get('/accuracy', restrict, async (req, res) => {
  const sql = 'Select id, scenario_name from scenario;';
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    res.render('pages/accuracy', { scenarios: results, data: config });
  } catch (error) {
    console.error("Error GET /accuracy:", error);
    res.render('pages/error', { message: "Error check the logs." });
  }
});

router.get('/getAccuracyConfig', restrict, async (req, res) => {
  res.send(config.accuracy);
});

router.get('/accuracyreportdownload', restrict, (req, res) => {
  const { date, id, filename, ace2, jiwer, sclite, parsingtype } = req.query;
  const csvId = id.split(",");
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
      if (i > 4 && i < array.length - 3) {
        curArray = value.split(" ")
        // console.log(curArray);
        score = curArray[curArray.length - 1]
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
  if (sclite === 'true' && fs.existsSync(sclitePath)) {
    var array = fs.readFileSync(sclitePath).toString().split("\n");
    if (hypo.length % 2 == 0)
      k = 1
    else
      k = 0
    console.log("k", k);
    console.log("hypo", hypo);

    array.forEach(function (value, i) {
      console.log('%d: %s', i, value);

      if (parsingtype == "all" && i == 10) {
        curArray = value.split(" ")
        const result = curArray.filter(function (x) {
          return x !== '';
        });
        console.log("sclite res", result);
        err = result[result.length - 3]
        ins = result[result.length - 4]
        del = result[result.length - 5]
        sub = result[result.length - 6]
        wrd = result[3]

        scliteSub.push(sub)
        scliteDel.push(del)
        scliteIns.push(ins)
        scliteErr.push(err)
        scliteWrds.push(wrd)
      }


      if (parsingtype == "line" && i > 6 + hypo.length && i < array.length - 8 && i % 2 == k) {
        curArray = value.split(" ")
        const result = curArray.filter(function (x) {
          return x !== '';
        });
        console.log("sclite res", result);
        err = result[result.length - 3]
        ins = result[result.length - 4]
        del = result[result.length - 5]
        sub = result[result.length - 6]
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
  wer = [];
  mer = [];
  wil = [];
  if (jiwer === 'true' && fs.existsSync(jiwerPath)) {
    var array = fs.readFileSync(jiwerPath).toString().split("\n");
    // if(parsingtype == "whole")
    //   jiwerRes = array[1].split(" ")
    // else{
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
  const lines = hypo.length
  console.log("LINES:", lines)
  //wer.forEach(function (value, i) {
  //  console.log('%d: %s', i, value);
  for (let i = 0; i < lines; i++) {
    aceVal = ace2res[i]
    if (aceVal == undefined)
      aceVal = ' '
    sclitewrd = scliteWrds[i]
    if (sclitewrd == undefined)
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

    if (i == 0 && parsingtype == "all") {
      csv += csvId[i] + ',"' + ref[i] + '","' + hypo[i] + '",' + aceVal + ',' + sclitewrd + ',' + sclitesub + ',' + sclitedel + ',' + scliteins + ',' + scliteVal + ',' + werVal + ',' + merVal + ',' + wilVal + '\n';
    }
    else
      csv += csvId[i] + ',"' + ref[i] + '","' + hypo[i] + '",' + aceVal + ',' + sclitewrd + ',' + sclitesub + ',' + sclitedel + ',' + scliteins + ',' + scliteVal + ',' + werVal + ',' + merVal + ',' + wilVal + '\n';
  }
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

router.get('/research_data', restrict, async (req, res) => {
  const sql = 'Select * from scenario;';
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    for (let s of results) {
      const t = s;
      delete t.transcript;
    }
    res.render('pages/research_data', { scenarios: results, role: req.session.role });
  } catch (error) {
    console.error("Error GET /research_data:", error);
    res.render('pages/error', { message: "Error check the logs." });
  }
});

router.get('/iprelay_research_data', restrict, async (req, res) => {
  const sql = 'Select * from scenario;';
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    for (let s of results) {
      const t = s;
      delete t.transcript;
    }
    res.render('pages/iprelay_research_data', { scenarios: results, role: req.session.role });
  } catch (error) {
    console.error("Error GET /iprelay_research_data:", error);
    res.render('pages/error', { message: "Error check the logs." });
  }
});

router.get('/getResearchData', restrict, async (req, res) => {
  let { download } = req.query;
  const { start, end } = req.query;
  const arch = archiver('zip');

  download = (download === 'true');

  let params = [];
  let query = `SELECT rd.id, rd.call_start, rd.device_id, rd.extension, rd.custom_name,
    rd.dest_phone_number, rd.call_duration, rd.stt_engine,
    rd.added_delay, rd.transcription_file, rd.audio_file, rd.notes, rd.translation_engine,
    rd.source_language, rd.target_language, rd.tts_engine, rd.audio_file_path, 
    CASE WHEN rd.video_file IS NULL THEN 'false' ELSE 'true' END AS has_video
    FROM research_data rd
    LEFT JOIN device_settings ds ON rd.extension = ds.extension
    WHERE rd.transcription_file_path LIKE '%${homedir}%' AND (is_iprelay = 0 OR is_iprelay IS NULL) `;

  if (start && end && start !== 'undefined' && end !== 'undefined') {
    query += ' AND (call_start BETWEEN ? AND ?)';
    params = [start, end];
  }

  try {
    const [results, _fields] = await req.dbconn.query(query, params);
    if (download) {
      var csvFields = Object.keys(results[0]);
      csvFields.push('transcription_file_link');
      csvFields.push('audio_file_link');
      const csvData = [];
      const fullUrl = `https://${req.get('host')}`; // req.protocol always return http?

      results.forEach((row) => {
        row.transcription_file_link = `=HYPERLINK("${fullUrl
          }/admin/getTranscripts?download=true&id=${row.id
          }", "text")`,
          row.audio_file_link = `=HYPERLINK("${fullUrl
          }/admin/getCallAudioFile?download=true&id=${row.id
          }", "audio")`
        csvData.push(row);
        // get audio file for row
        const audioFile = `${row.audio_file_path}/${row.audio_file}`;
        const fileName = row.custom_name ? `call_${row.custom_name}_${row.id}.wav` : `call_${row.id}.wav`
        arch.append(fs.createReadStream(audioFile), { name: fileName });
      });
      // add csv file
      const parser = new Parser({ fields: csvFields });
      const csv = parser.parse(csvData);
      fs.writeFileSync('acequill_research_data.csv', csv);
      arch.append(fs.createReadStream('acequill_research_data.csv'), { name: 'acequill_research_data.csv' });
      res.attachment('acequill_research_data.zip').type('zip');

      arch.on('end', () => {
        res.end();
        fs.unlink('acequill_research_data.csv', ((err2) => {
          if (err2) {
            console.error(err);
          } else {
            console.info('Deleted CSV file:');
          }
        }));
      });
      arch.pipe(res);
      arch.finalize();
    } else if (results.length > 0) {
      res.status(200).send({
        records: results,
        message: 'Success',
      });
    } else {
      res.status(200).send({
        records: results,
        message: 'No Data',
      });
    }
  } catch (error) {
    console.error('Errir GET /call_logs: ', err.code);
    res.send({ message: 'Failed' });
  }
});

router.get('/getIprelayResearchData', restrict, async (req, res) => {
  const { start, end } = req.query;
  let { download } = req.query;
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

  try {
    const [results, _fields] = await req.dbconn.query(query, params);
    if (download) {
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
      ];
      const csvData = [];
      const fullUrl = `https://${req.get('host')}`; // req.protocol always return http?

      results.forEach((row) => {
        const obj = {
          id: row.id,
          call_start: row.call_start,
          device_id: row.device_id,
          extension: row.extension,
          dest_phone_number: row.dest_phone_number,
          call_duration: row.call_duration,
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
        };
        csvData.push(obj);
      });
      const parser = new Parser({ fields: csvFields });
      const csv = parser.parse(csvData);
      res.setHeader(
        'Content-disposition',
        'attachment; filename=acequill_research_data.csv',
      );
      res.set('Content-Type', 'text/csv');
      res.status(200).send(csv);
    } else if (results.length > 0) {
      res.status(200).send({
        records: results,
        message: 'Success',
      });
    } else {
      res.status(200).send({
        records: results,
        message: 'No Data',
      });
    }
  } catch (error) {
    console.error('/call_logs ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getTranscripts', restrict, async (req, res) => {
  let { id, download } = req.query;
  download = (download !=='true');
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;

  const sql = 'SELECT translation, extension, timestamp FROM translation_data where research_data_id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length !== 0) {
      // send translated data back
      const records = [];
      results.forEach((row) => {
        records.push([row.timestamp, row.extension, row.translation]);
      });
      console.info('records ', records);
      res.send(records);
    } else {
      // send non translated transcription data back
      const sql2 = 'SELECT * FROM data_store where research_data_id = ? and final = 1;';
      try {
        const [results2, _fields2] = await req.dbconn.query(sql2, id);
        if (results2.length !== 0) {
          const records = [];
          results2.forEach((row) => {
            records.push([row.timestamp, row.extension, row.transcript]);
          });
          res.send(records);
        } else {
          res.send('no records');
        }
      } catch (error2) {
        console.error('/getTranscripts ERROR: ', error2);
        res.status(500).send({ message: 'Error' });
      }
    }
  } catch (error) {
    console.error('/getTranscripts ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getAQDUTTranscripts', restrict, async (req, res) => {
  let { id, download } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  download = (download !=='true');
  const sql = 'SELECT * FROM iprelay_log WHERE fk_call_id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length !== 0) {
      const records = [];
      results.forEach((row) => {
        records.push([row.timestamp, row.is_dut, row.text]);
      });
      console.info('records ', records);
      res.send(records);
    } else {
      res.send('no records');
    }
  } catch (error) {
    console.error('/getAQDUTTranscripts ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getRecordings', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT id, source FROM iprelay_recordings where fk_research_data_id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length !== 0) {
      // send translated data back
      const recordings = [];
      results.forEach((row) => {
        recordings.push([row.id, row.source]);
      });
      res.send(recordings);
    } else {
      res.send('no records');
    }
  } catch (error) {
    console.error('/getRecordings ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getGeckoData', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const final = 1;
  const sql = 'SELECT * FROM data_store where research_data_id = ? and final = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, [id, final]);
    const terms = [];
    const terms2 = [];
    const speaker1 = results[0].extension;
    let speaker2 = '';

    // Amazon
    if (results[0].sttEngine === 'Z') {
      results.forEach((row) => {
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
    if (results[0].sttEngine === 'A') {
      results.forEach((row) => {
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
    if (results[0].sttEngine === 'G') {
      let prevTime = 0;
      results.forEach((row) => {
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
        console.info('end time', parseInt(JSON.parse(row.raw).results[0].resultEndTime.seconds, 10) + JSON.parse(row.raw).results[0].resultEndTime.nanos / (10 ** 9));
        prevTime += parseInt(JSON.parse(row.raw).results[0].resultEndTime.seconds, 10)
          + JSON.parse(row.raw).results[0].resultEndTime.nanos / (10 ** 9);
      });
    }

    // Watson
    if (results[0].sttEngine === 'W') {
      results.forEach((row) => {
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
    console.info('gecko data ', gecko);
  } catch (error) {
    console.error('/getGeckoData ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getIPRelayLog', restrict, async (req, res) => {
  const { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) res.status(500).send('Missing valid ID');
  const csvFields = [
    'id',
    'callID',
    'isDUT',
    'text',
    'timestamp',
  ];
  const sql = 'SELECT id, fk_call_id AS callID, is_dut as isDUT, text, timestamp FROM iprelay_log where fk_call_id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const jsonData = JSON.parse(JSON.stringify(results));
      const parser = new Parser({ fields: csvFields });
      const csv = parser.parse(jsonData);
      res.setHeader(
        'Content-disposition',
        `attachment; filename=acequill_ip_relay_log_${id}.csv`,
      );
      res.set('Content-Type', 'text/csv');
      res.status(200).send(csv);
    } else {
      res.status(204).send(`No Results for ${id}`);
    }
  } catch (error) {
    console.error('/getIPRelayLog ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getRawTranscript', restrict, async (req, res) => {
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
    const sql ='SELECT * FROM data_store where research_data_id = ?;'
  } else if (req.query.type === 'final'){
    const sql ='SELECT * FROM data_store where research_data_id = ? and final = 1;'
  }
  else {
    const sql ='SELECT * FROM data_store where research_data_id = ? and final = 0;'
  }
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    const jsonData = JSON.parse(JSON.stringify(results));
    const parser = new Parser({ fields: csvFields });
    const csv = parser.parse(jsonData);
    res.setHeader(
      'Content-disposition',
      'attachment; filename=acequill_research_data.csv',
    );
    res.set('Content-Type', 'text/csv');
    res.status(200).send(csv);
  } catch (error) {
    console.error('/getRawTranscript ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getCallAudioFile', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT audio_file_path, audio_file FROM research_data where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const audioFile = `${results[0].audio_file_path}/${results[0].audio_file}`;
      try {
        const stat = fs.statSync(audioFile);
        res.set('Content-disposition', `${'attachment; filename=call_'}${id}.wav`);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': stat.size,
        });
        const readStream = fs.createReadStream(audioFile);
        readStream.pipe(res);
      } catch (error2) {
        console.error('/getCallAudioFile ERROR: ', error2);
        res.status(500).send({ message: 'Error' });
      }
    } else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/getCallAudioFile ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getCallAudioFiles', restrict, async (req, res) => {
  const arch = archiver('zip');
  let { id, customName } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  if (typeof customName === 'undefined' || customName === 'undefined') customName = '';
  const sql = 'SELECT audio_file_path, audio_file, call_start FROM research_data where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      // Example file: 05-01-2023_19-50-31_PJSIP-5004-00000015-mix.wav16 
      const mixFile = `${results[0].audio_file_path}/${results[0].audio_file}`;
      const audioFiles = [mixFile, mixFile.replace('mix', 'caller-out'), mixFile.replace('mix', 'callee-out')]
      try {
        let timestamp = results[0].call_start.replaceAll(':', '-').replaceAll(' ', '_');
        let prefix = customName ? `call_${customName}_${timestamp}` : `call_${id}_${timestamp}`;
        audioFiles.forEach(fileName => {
          if (fs.existsSync(fileName)) {
            // Channel will probably be mix, caller, or callee
            let channel = fileName.replace('-out', '').replace('.wav16', '').split('-').pop();
            arch.append(fs.createReadStream(fileName), { name: `${prefix}_${channel}.wav` });
          }
        });
        res.attachment(`${prefix}.zip`).type('zip');
        arch.on('end', () => res.end());
        arch.pipe(res);
        arch.finalize();
      } catch (fsErr) {
        console.error('/getAudioFile ERROR: ', fsErr);
        res.status(500).send({ message: 'Error' });
      }
    } else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/getCallAudioFiles ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getTranscriptFile', restrict, async (req, res) => {
  let { id } = req.query;
  const sql = 'SELECT file_location, title FROM audio_file_transcribe where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 1) {
      const transcript = `${results[0].file_location}/${id}_${results[0].title.replace(/ /g, "_")}.txt`;
      if (fs.existsSync(transcript)) {
        res.setHeader('Content-disposition', `attachment; filename=${results[0].title.replace(/ /g, "_")}.doc`);
        res.setHeader('Content-type', 'application/msword');
        buildWordFromFile(transcript, (buffer) => {
          let stream = Readable.from(buffer)
          stream.pipe(res);
        });
      } else {
        res.send("no file");
      }
    } else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/getTranscriptFile ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/checkTranscriptFile', restrict, async (req, res) => {
  let { id } = req.query;
  const sql = 'SELECT file_location, title FROM audio_file_transcribe where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const transcript = `${results[0].file_location}/${id}_${results[0].title.replace(/ /g, "_")}.txt`;
      if (fs.existsSync(transcript)) {
        console.log("does exist");
        res.send({ "message": "file exists" });
      } else {
        console.log("does not exist");
        res.send({ "message": "no file" });
      }
    } else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/checkTranscriptFile ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getTranscriptAudioFile', restrict, async (req, res) => {
  let { id } = req.query;
  const sql = 'SELECT file_location, audio_file_name FROM audio_file_transcribe where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const audioFile = `${results[0].file_location}/${id}_${results[0].audio_file_name}.wav`;
      res.download(audioFile, function (err) {
        if (err) {
          console.log("err", err)
        }
        res.end();
      });
    } else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/getTranscriptAudioFile ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/insertRunningTranscript', restrict, async (req, res) => {
  let status = req.body.status;
  let title = req.body.title;
  let file_location = req.body.file_location;
  let file_name = req.body.file_name;
  let user_id = req.session.idlogin_credentials;
  let deleteAudio = req.body.deleteAudioFile;

  const sql = `INSERT INTO audio_file_transcribe (title, status, user_id, file_location, audio_file_name, date) VALUES (?,?,?,?,?,NOW());`;
  const params = [
    title,
    status,
    user_id,
    file_location,
    deleteAudio == 'true' ? null : file_name,
  ]
  try {
    const [results, _fields] = await req.dbconn.query(sql, params);
    res.send({ "message": "success!" })
  } catch (error) {
    console.error('/insertRunningTranscript ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getTranscriptId', restrict, async (req, res) => {
  const sql = 'SELECT max(id) AS id FROM audio_file_transcribe;' ;
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    let id = results[0].id;
    let firstname = req.session.firstname;
    let lastname = req.session.lastname;
    res.send({ "id": id, "firstname": firstname, "lastname": lastname });
  } catch (error) {
    console.error('/getTranscriptId ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getTranscriptFileName', restrict, async (req, res) => {
  let id = req.query.id;
  const sql = 'SELECT audio_file_name FROM audio_file_transcribe where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if(results.length > 0) {
      res.send({ "filename": results[0].audio_file_name });
    }
    else {
      res.status(404).send({ message: 'Error, not found' });
    }
  } catch (error) {
    console.error('/getTranscriptFileName ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});


router.get('/getVideoFile', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const videoFilepath = config.videoFilepath;
  const sql = 'SELECT video_file FROM research_data where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length  > 0) {
      const videoFile = videoFilepath + results[0].video_file;
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
  } catch (error) {
    console.error('/getVideoFile ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/playrecording', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT filepath FROM iprelay_recordings where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const videoFile = results[0].filepath;
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
  } catch (error) {
    console.error('/playrecording ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  } 
});

router.get('/downloadRecording', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT filepath, source FROM iprelay_recordings where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length === 1) {
      const videoFile = results[0].filepath;
      const stat = fs.statSync(videoFile);
      res.set('Content-disposition', `${'attachment; filename=call_'}${id}${'_'}${results[0].source}.webm`);
      res.writeHead(200, {
        'Content-Type': 'video/webm',
        'Content-Length': stat.size,
      });
      const readStream = fs.createReadStream(videoFile);
      readStream.pipe(res);
    } else {
      res.send('No video');
    }
  } catch (error) {
    console.error('/downloadRecording ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/playTextToSpeech', (req, res) => {
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

router.get('/getNotes', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT notes FROM research_data where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const notes = {};
      notes.call = results[0].notes;
      res.send(notes);
    } else {
      res.send(null);
    }
  } catch (error) {
    console.error('/getNotes ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/saveNotes', restrict, async (req, res) => {
  const { id, callNotes } = req.body;
  const sql = 'UPDATE research_data SET notes = ? WHERE id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, [callNotes, id]);
    res.send(`${results.affectedRows} record updated`);
  } catch (error) {
    console.error('/saveNotes ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/deleteVideo', restrict, async (req, res) => {
  const { id } = req.body;
  const sql = 'UPDATE research_data SET video_file = NULL WHERE id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    res.send(`${results.affectedRows} record updated`);
  } catch (error) {
    console.error('/deleteVideo ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/uploadVideo', restrict, (req, res) => {
  const form = new formidable.IncomingForm();
  form.uploadDir = `${__dirname}/../${config.videoFilepath}`;
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
            console.error('/uploadVideo MySQL ERROR: ', err.code);
            res.send('An Error Occurred');
          } else {
            console.info(`${id}: received upload: ${filename}`);
            res.write(`received upload: ${filename}`);
            res.end();
          }
        },
      );
    }
  });
});

const transcriptionFileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, './uploads/transcription/');
    },
    filename(req, file, cb) {
      cb(null, req.body.id + "_" + file.originalname);
    },
  }),
});

router.post('/uploadTranscriptionAudio', transcriptionFileUpload.single('file'), (req, res) => {
  console.info('/uploadAudio Called');
  res.send({ message: "this worked!" })
});

const audibleCueFileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, './uploads/audible_cues/');
    },
    filename(req, file, cb) {
      cb(null, req.body.id + "_" + file.originalname);
    },
  }),
});

router.post('/uploadAudibleCue', audibleCueFileUpload.single('file'), (req, res) => {
  res.send({ message: "this worked!" })
});

router.get('/downloadAudibleCue', restrict, async (req, res) => {
  let { id } = req.query;
  const sql = 'SELECT file_location, audio_file_name FROM audible_cues where id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const audioFile = `${results[0].file_location}/${id}_${results[0].audio_file_name}.wav`;
      res.download(audioFile, function (err) {
        if (err) {
          console.log("err", err)
        }
        res.end();
      });
    } else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/downloadAudibleCue ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/createAudibleCue', restrict, async (req, res) => {
  const {status, title, transcript,
        file_location, file_name,
        type, duration } = req.body;

  console.log("filename:", file_name);
  let user_id = req.session.idlogin_credentials;
  const insert_sql = `INSERT INTO audible_cues (title, status, user_id, file_location, audio_file_name, transcript, type, duration, date) VALUES (?,?,?,?,?,?,?,?,NOW());`;
  const params = [
    title,
    status,
    user_id,
    file_location,
    file_name,
    transcript,
    type,
    duration,
  ]
  try {
    const [_result, _fields] = await req.dbconn.query(insert_sql, params);
    const [results, _fields2] = await req.dbconn.query('SELECT max(id) AS id FROM audible_cues;');
    res.send({ "id": results[0].id });
  } catch (error) {
    console.error('/createAudibleCue ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/deleteAudibleCue', restrict, async (req, res) => {
  const { id } = req.body;
  if (typeof id === 'undefined' || Number.isNaN(id)) res.status(500).send('Missing valid ID');
  const findSql = 'DELETE FROM audible_cues WHERE id = ?;';
  const delSql = 'DELETE FROM audible_cues WHERE id = ?;';
  try {
    const [result, _fields] = await req.dbconn.query(findSql, id);
    const [result2, _fields2] = await req.dbconn.query(delSql, id);
    const filePath = result[0].file_location + "/" + result[0].id + "_" + result[0].audio_file_name + ".wav";
    fs.unlinkSync(filePath)
    res.send(`${result2.affectedRows} record deleted`);
  } catch (error) {
    console.error('/deleteAudibleCue ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/scenarios', restrict, async (req, res) => {
  const sql = 'Select * from scenario;';
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    results.forEach((s) => {
      const t = s;
      delete t.transcript;
    });
    res.render('pages/scenario', {
      scenarios: results,
      role: req.session.role,
    });
  } catch (error) {
    console.error('/scenarios ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/addScenario', restrict, async (req, res) => {
  const scenario = { scenario_name: req.body.name };
  // TODO: insert scenario name in db
  const sql = 'INSERT INTO scenario SET ?';
  try {
    const [result, _fields] = await req.dbconn.query(scenario);
    console.info(`INSERT result: ${JSON.stringify(result)}`);
    res.send({ status: 'Success', id: '2' });
  } catch (error) {
    console.error('/addScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
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

router.post('/updateScenario', scenarioFileUpload.single('scenarioFile'), async (req, res) => {
  const sText = req.body.scenarioText;
  const sId = req.body.scenarioId;
  let params = [sText, sId];
  let sql = 'UPDATE scenario SET transcript = ? WHERE id = ?';
  if (req.file) {
    params = ['./uploads/scenarios', req.file.filename, sText, sId];
    sql = 'UPDATE scenario SET audio_file_path = ?, audio_file = ?, transcript = ? WHERE id = ?';
  }
  try {
    const [results, _fields] = await req.dbconn.query(sql, params);
    console.info(`UPDATE result: ${JSON.stringify(result)}`);
    res.status(200).send({ status: 'Success' });
  } catch (error) {
    console.error('/updateScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/deleteScenario', restrict, async (req, res) => {
  const { sId } = req.body;
  console.info('deleteScenario ', sId);
  // TODO: delete row in scenario table by ID
  const sql = 'DELETE FROM scenario WHERE id = ?';
  try {
    const [result, _fields] = await req.dbconn.query(sql, sId);
    console.info(`DELETE result: ${JSON.stringify(result)}`);
    res.send({ status: 'Success' });
  } catch (error) {
    console.error('/deleteScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/ScenarioDetails', restrict, async (req, res) => {
  const sId = req.query.id;
  // TODO: get scenario details by id
  const sql = 'Select * from scenario WHERE id = ?';
  req.dbconn.query(sql, sId, (err, results) => {
    if (err || !results[0]) {
      console.error(`SQL Error: ${err}`);
    } else {
      console.info(results);
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

router.get('/getScenarioAudioFile', restrict, async (req, res) => {
  let { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT audio_file_path, audio_file FROM scenario where id = ?;';

  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const audioFile = `${results[0].audio_file_path}/${results[0].audio_file}`;
      console.info(audioFile);
      try {
        const stat = fs.statSync(audioFile);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': stat.size,
        });
        fs.createReadStream(audioFile).pipe(res);
        // readStream.pipe(res);
      } catch (err) {
        console.error('/getScenarioAudioFile an error has occurred: ', err);
        res.send('No results');
      }
    } else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/getScenarioAudioFile ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/getIPRelayScenario', restrict, async (req, res) => {
  const { id } = req.query;
  const sql = 'Select * from iprelay_scenario_content where iprelay_scenario_id = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (!results[0]) {
      console.error('SQL Error: this IpRelay scenario has no content' + err);
      res.send(results);
    } else {
      console.info('getIPRelayScenario results ', results);
      res.send(results);
    }
  } catch (error) {
    console.error('/getIPRelayScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/addIpRelayScenario', restrict, async (req, res) => {
  const scenario = { name: req.body.name, use_count: 0 };
  const sql = 'INSERT INTO iprelay_scenario SET ?';
  try {
    const [results, _fields] = await req.dbconn.query(sql, scenario);
    console.info(`INSERT result: ${JSON.stringify(result)}`);
    res.send({ status: 'Success', id: '1' });
  } catch (error) {
    console.error('/addIpRelayScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/renameScenario', restrict, async (req, res) => {
  const sid = req.body.id;
  const scenario = { name: req.body.name };
  let sql = 'UPDATE iprelay_scenario SET ? WHERE id = ? ;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, [scenario, sid]);
    res.send({ status: 'Success', id: '1' });
  } catch (error) {
    console.error('/renameScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/cloneScenario', restrict, async (req, res) => {
  const sid = req.body.id;
  const scenario = { name: req.body.name};
  var newid = "";

  let cloneSql = 'INSERT INTO iprelay_scenario (name, use_count, notes) '
                + 'SELECT name, use_count, notes FROM iprelay_scenario WHERE id = ? ;';
  try {
    const [result, _fields] = await req.dbconn.query(cloneSql, sid);
    let contentSql = 'INSERT INTO iprelay_scenario_content (iprelay_scenario_id, convoOrder, bubbleText, rawText, audioFilePath, isDUT) '
      + 'SELECT ? , convoOrder, bubbleText, rawText, audioFilePath, isDUT FROM iprelay_scenario_content WHERE iprelay_scenario_id = ? ;';
    newid = result.insertId;
    const [_result2, _fields2] = await req.dbconn.query(contentSql, [newid, sid]);
    // duplicate the audio files
    const originalSql = 'Select * from iprelay_scenario_content where iprelay_scenario_id = ?;';
    const [results, _fields3] = await req.dbconn.query(originalSql, sid);
    for(const row of results) {
      if (row.audioFilePath != 'DUT') {
        filepath = "./uploads/iprelay/" + Date.now() + row.audioFilePath.substring(31, row.audioFilePath.length);
        await fsPromises.copyFile(row.audioFilePath, filepath);
        const updatePathSql = 'UPDATE iprelay_scenario_content SET audioFilePath = ? WHERE iprelay_scenario_id = ? AND convoOrder = ?;'
        const [result4, _fields3] = await req.dbconn.query(updatePathSql,[filepath, newid, row.convoOrder]);
        console.log(`INSERT result: ${JSON.stringify(result4)}`);
      }
    }
    res.send({ status: 'Success', id: '1' });
  } catch (error) {
    console.error('/cloneScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/deleteIpRelayScenario', restrict, async (req, res) => {
  const { sId } = req.body;
  const contentSql = 'SELECT audioFilePath FROM iprelay_scenario_content WHERE iprelay_scenario_id = ?';
  try {
    const [results, _fields] = await req.dbconn.query(contentSql, sId);
    console.info(`audio path: ${JSON.stringify(results)}`);
    for(const path of results) {
      console.info(`audio path indexed: ${JSON.stringify(path)}`);
      if (path.audioFilePath !== 'DUT' && path.audioFilePath !== '') {
        await fsPromises.unlink(path.audioFilePath);
        console.info('Deleted file:', path.audioFilePath);
      }
    }
    const delContentSql = 'DELETE FROM iprelay_scenario_content WHERE iprelay_scenario_id = ?';
    const [results2, _fields2] = await req.dbconn.query(delContentSql, sId);
    console.info(`DELETE result: ${JSON.stringify(result2)}`);

    const delSql = 'DELETE FROM iprelay_scenario WHERE id = ?';
    const [results3, _fields3] = await req.dbconn.query(delSql, sId);
    console.info(`DELETE result: ${JSON.stringify(results3)}`);

    res.send({ status: 'Success' });
  } catch (error) {
    console.error('/deleteIpRelayScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
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

router.post('/updateIpRelayScenario', iprelayFileUpload.array('scenarioFile', 12), async (req, res) => {
  console.info('files ' + req.files);
  const data = req.body.data.split(',');
  const sid = req.body.id;
  const formatted = [];
  for (let i = 0; i < data.length; i += 7) {
    formatted.push(data.slice(i, i + 7));
  }
  console.info('formatted ' + formatted);
  let k = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    console.info('here ' + formatted[i][4]);
    if (formatted[i][6] === '1') {
      console.info('file name ' + req.files[k].filename);
      formatted[i][4] = req.files[k].destination + req.files[k].filename;
      k += 1;
    }
  }
  formatted.forEach((row) => {
    row.splice(6, 1);
  });
  console.info('formatted ', formatted);

  const sql = 'DELETE FROM iprelay_scenario_content WHERE iprelay_scenario_id = ?;';
  try {
    const [result, _fields] = await req.dbconn.query(sql, id);
    console.info(`DELETE result: ${JSON.stringify(result)}`);
    const sql2 = 'INSERT INTO iprelay_scenario_content(iprelay_scenario_id, convoOrder, bubbleText, rawText, audioFilePath, isDUT)  VALUES ? ';
    const [result2, _fields2] = await req.dbconn.query(sql2, [formatted]);
    console.info('insert updateIpRelayScenario sucess');
    res.send(`${result2.affectedRows} record updated`);
  } catch (error) {
    console.error('/updateIpRelayScenario ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/loadACConfig', restrict, async (req, res) => {
  const ext = req.query.extension;
  const sql = 'SELECT * FROM device_settings WHERE extension = ?;';
  try {
    const [results, _fields] = await req.dbconn.query(sql, ext);
    console.info('loadACConfig results ', results);
    res.send(results[0]);
  } catch (error) {
    console.error('/loadACConfig ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/saveACConfig', restrict, async (req, res) => {
  const { data } = req.body;
  let sql = 'UPDATE device_settings SET stt_engine = ?, source_language = ?, stt_show_final_caption = ?, delay = ?, background_audio_suppression = ?, ';
  sql += 'speech_detector_sensitivity = ?, auto_punctuation = ?, v2 = ?, translation_engine = ?, ';
  sql += 'target_language = ?, tts_engine = ?, tts_translate = ?, tts_voice = ?, ARIA_settings = ?, confidence_show_word = ?,confidence_show_phrase = ?, ';
  sql += 'confidence_upper_lim = ?, confidence_lower_lim = ?, confidence_upper_color = ?, confidence_lower_color = ?, ';
  sql += 'confidence_bold = ?, confidence_italicize = ?, confidence_underline = ?, iprelay = ?, iprelay_scenario = ?, tts_enabled = ?, steno_enabled = ?, stt_show_entity_sentiment = ?, ';
  sql += 'predefined_id = ?, greeting_id=? , greeting_delay=?, greeting_show_transcript=?, typing_id=?, typing_repeat=?, typing_repeat_delay=?, typing_show_transcript=?, ';
  sql += 'dual_enabled = ?, caller_captions_enabled = ?, caller_confidence_show_word = ?, caller_confidence_show_phrase = ?, caller_confidence_upper_lim = ?, caller_confidence_lower_lim=?, ';
  sql += 'caller_confidence_upper_color = ?, caller_confidence_lower_color =?, caller_confidence_bold = ?, caller_confidence_italicize = ?, caller_confidence_underline = ?, dual_font_color = ?, ';
  sql += 'dropout_incoming_enabled = ?, dropout_incoming_interval_min = ?, dropout_incoming_interval_max = ?, dropout_incoming_length_min = ?, dropout_incoming_length_max = ?, ';
  sql += 'dropout_outgoing_enabled = ?, dropout_outgoing_interval_min = ?, dropout_outgoing_interval_max = ?, dropout_outgoing_length_min = ?, dropout_outgoing_length_max = ?, ';
  sql += 'background_noise_incoming_enabled = ?, background_noise_incoming_id = ?, background_noise_outgoing_enabled = ?, background_noise_outgoing_id = ?, ';
  sql += 'stt_dropout_enabled = ?, stt_dropout_interval = ?, stt_dropout_length_min = ?, stt_dropout_length_max = ? ';
  sql += 'WHERE extension = ?;';

  if (data.confidence_lower_lim === '') {
    data.confidence_lower_lim = 0;
  }
  if (data.confidence_upper_lim === '') {
    data.confidence_upper_lim = 0;
  }
  if (data.caller_confidence_lower_lim === '') {
    data.caller_confidence_lower_lim = 0;
  }
  if (data.caller_confidence_upper_lim === '') {
    data.caller_confidence_upper_lim = 0;
  }
  //console.log(JSON.stringify(data, null, 2))
  data.predefined_id = data.predefined_id ? data.predefined_id : null;
  data.greeting_id = data.greeting_id === '(NONE)' ? null : data.greeting_id;
  data.typing_id = data.typing_id === '(NONE)' ? null : data.typing_id;
  const params = [data.stt_engine, data.source_language,
  data.stt_show_final_caption, Number(data.delay),
  Number(data.background_audio_suppression), Number(data.speech_detector_sensitivity), data.auto_punctuation, data.v2,
  data.translation_engine, data.target_language, data.tts_engine,
  data.tts_translate, data.tts_voice, data.ARIA_settings,
  data.confidence_show_word, data.confidence_show_phrase,
  data.confidence_upper_lim, data.confidence_lower_lim,
  data.confidence_upper_color, data.confidence_lower_color,
  data.confidence_bold, data.confidence_italicize, data.confidence_underline,
  data.iprelay, data.iprelay_scenario, data.tts_enabled, data.steno_enabled, data.stt_show_entity_sentiment,
  data.predefined_id, data.greeting_id, Number(data.greeting_delay), data.greeting_show_transcript,
  data.typing_id, data.typing_repeat, Number(data.typing_repeat_delay), data.typing_show_transcript,
  data.dual_enabled, data.caller_captions_enabled, data.caller_confidence_show_word, data.caller_confidence_show_phrase, data.caller_confidence_upper_lim,
  data.caller_confidence_lower_lim, data.caller_confidence_upper_color, data.caller_confidence_lower_color, data.caller_confidence_bold,
  data.caller_confidence_italicize, data.caller_confidence_underline, data.dual_font_color,
  data.dropout_incoming_enabled, Number(data.dropout_incoming_interval_min), Number(data.dropout_incoming_interval_max), Number(data.dropout_incoming_length_min), Number(data.dropout_incoming_length_max),
  data.dropout_outgoing_enabled, Number(data.dropout_outgoing_interval_min), Number(data.dropout_outgoing_interval_max), Number(data.dropout_outgoing_length_min), Number(data.dropout_outgoing_length_max),
  data.background_noise_incoming_enabled, data.background_noise_incoming_id, data.background_noise_outgoing_enabled, data.background_noise_outgoing_id,
  data.stt_dropout_enabled, Number(data.stt_dropout_interval), Number(data.stt_dropout_length_min), Number(data.stt_dropout_length_max),
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
  //console.log(params);
  try {
    const [results, _fields] = await req.dbconn.query(sql, params);
    console.info('saveACConfig success');
    res.send(results[0]);
  } catch (error) {
    console.error('/saveACConfig ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});


router.get('/contacts', restrict, async (req, res) => {
  const sql1 = 'SELECT idcontacts, username, cellphone, workphone, homephone, faxphone, personalemail, workemail, favorite, extension FROM contacts;';
  const sql2 = 'SELECT extension FROM device_settings order by extension;'
  try {
    const [results1, _fields1] = await req.dbconn.query(sql1);
    const [results2, _fields2] = await req.dbconn.query(sql2);
    res.render('pages/contacts', {
      contact: results1,
      extensions: results2,
      role: req.session.role,
    });
  } catch (error) {
    console.error('/contacts ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/UpdateConfig', restrict, async (req, res) => {
  let extension = parseInt(req.body.extension, 10);
  if (!extension) extension = 0;
  var name = req.body.name;
  if (extension && name) {
    const sql = `INSERT INTO device_settings (extension, name) VALUES (?,?) 
                  ON DUPLICATE KEY UPDATE 
                  name = VALUES(name);`;
    try {
      const [results, _fields] = await req.dbconn.query(sql, [extension, name]);
      res.send(`${result.affectedRows} record updated`);
    } catch (error) {
      console.error('/UpdateConfig ERROR: ', error);
      res.status(500).send({ message: 'Error' });
    }
  } else {
    res.status(400).send('Bad Inputs');
  }
});

router.post('/UpdateContact', restrict, async (req, res) => {
  const { idcontacts, username,
          cellphone, workphone,
          homephone, faxphone,
          personalemail, workemail,
          favorite, extension } = req.body;
  
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
      try {
        const [results, _fields] = await req.dbconn.query(sql, params);
        res.send(`${results.affectedRows} record updated`);
      } catch (error) {
        console.error('/UpdateContact ERROR: ', error);
        res.status(500).send({ message: 'Error' });
      }
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
      try {
        const [results, _fields] = await req.dbconn.query(sql, params);
        res.send(`${results.affectedRows} record updated`);
      } catch (error) {
        console.error('/UpdateContact ERROR: ', error);
        res.status(500).send({ message: 'Error' });
      }
    }
  } else {
    res.status(400).send('Bad Inputs');
  }
});

router.post('/DeleteConfig', restrict, async (req, res) => {
  const { extension } = req.body;
  console.info(`Delete ID: ${extension}`);
  if (extension) {
    const sql = 'DELETE FROM device_settings WHERE extension = ? AND default_device <> true;';
    try {
      const [results, _fields] = await req.dbconn.query(sql, extension);
      res.send(`${results.affectedRows} record deleted`);
    } catch (error) {
      console.error('/DeleteConfig ERROR: ', error);
      res.status(500).send({ message: 'Error' });
    }
  }
  else {
    res.status(400).send('Bad Inputs');
  }
});

router.post('/DeleteTranscription', restrict, async (req, res) => {
  const { id } = req.body;
  console.info(`Delete ID: ${id}`);
  if (id) {
    const sql = 'SELECT * FROM audio_file_transcribe WHERE id = ?;';
    try {
      const [result, _fields] = await req.dbconn.query(sql, id);
      const sql2 = 'DELETE FROM audio_file_transcribe WHERE id = ?;';
      const [result2, _fields2] = await req.dbconn.query(sql2, id);
      if (result[0].audio_file_name == null) {
        const docLocation = result[0].file_location + "/" + result[0].id + "_" + result[0].title.replace(/ /g, "_") + ".txt";
        fs.unlinkSync(docLocation)
      } else {
        const filePath = result[0].file_location + "/" + result[0].id + "_" + result[0].audio_file_name + ".wav";
        const filePathMono = result[0].file_location + "/" + result[0].id + "_" + result[0].audio_file_name + "_mono" + ".wav";
        const docLocation = result[0].file_location + "/" + result[0].id + "_" + result[0].title.replace(/ /g, "_") + ".txt";
        fs.unlinkSync(filePath)
        fs.unlinkSync(filePathMono)
        fs.unlinkSync(docLocation)
      }
      res.send(`${result2.affectedRows} record deleted`);
    } catch (error) {
      console.error('/DeleteTranscription ERROR: ', error);
      res.status(500).send({ message: 'Error' });
    }
  }
  else {
    res.status(400).send('Bad Inputs');
  }
});

router.post('/DeleteContact', restrict, async (req, res) => {
  const { idcontacts } = req.body;
  if (idcontacts) {
    const sql = 'DELETE FROM contacts WHERE idcontacts = ?;';
    try {
      const [results, _fields] = await req.dbconn.query(sql, idcontacts);
      res.send(`${result.affectedRows} record deleted`);
    } catch (error) {
      console.error('/DeleteContact ERROR: ', error);
      res.status(500).send({ message: 'Error' });
    }
  }
  else {
    res.status(400).send('Bad Inputs');
  }
});

router.get('/iprelay', restrict, async (req, res) => {
  const sql = 'SELECT * FROM iprelay_scenario;';
  try {
    const [results, _fields] = await req.dbconn.query(sql);
    res.render('pages/iprelay', {
      scenarios: results,
      role: req.session.role,
    });
  } catch (error) {
    console.error('/iprelay ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.get('/configs', restrict, async (req, res) => {
  try {
    const sql = 'SELECT * FROM device_settings ORDER BY extension;';
    const [extensions, _fields] = await req.dbconn.query(sql);
    const sql2 = 'SELECT * FROM iprelay_scenario;';
    const [iprelayResults, _fields2] = await req.dbconn.query(sql2);
    const sql3 = 'SELECT * FROM predefined_captions;';
    const [predefinedResults, _fields3] = await req.dbconn.query(sql3);
    const sql4 = "SELECT * FROM audible_cues where status='ACTIVE' ORDER BY id";
    const [cues, _fields4] = await req.dbconn.query(sql4);
    res.render('pages/advanced_config', {
      extensions: extensions,
      iprelay: iprelayResults,
      device_setting: extensions[0] ? JSON.stringify(extensions[0]) : "{}",
      role: req.session.role,
      predefined: predefinedResults,
      cues: cues
    });
  } catch (error) {
    console.error('/configs ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
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

router.get('/amazon-mfa-status', restrict, (req, res) => {
  awsMFA.validateSession().then((isValid) => {
    if (isValid) {
      res.send('valid');
    } else {
      res.send('invalid');
    }
  }).catch(() => {
    res.send('invalid');
  })
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

router.get('/recordings', restrict, async (req, res) => {
  const sql1 = `SELECT id, text FROM  recording_text ORDER BY id DESC LIMIT 1;`;
  const sql2 = `SELECT id, recording_id, text, timestamp FROM recordings ORDER BY id DESC;`;
  try {
    const [textRecord, _fields] = await req.dbconn.query(sql1);
    const [recordings, _fields2] = await req.dbconn.query(sql2);
    res.render('pages/recordings', {
      text: (textRecord.length == 0) ? '' : textRecord[0].text,
      recordings: recordings
    });
  } catch (error) {
    console.error('/recordings ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/recordingtextupdate', restrict, async (req, res) => {
  const { text } = req.body;
  const sql = 'INSERT INTO recording_text (text) VALUES (?);';
  try {
    await req.dbconn.query(sql, text);
    res.send("OK")
  } catch (error) {
    console.error('/recordingtextupdate ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
})

router.get('/recordingdownload', restrict, async (req, res) => {
  const { id } = req.query;
  if (typeof id === 'undefined' || Number.isNaN(id)) id = 0;
  const sql = 'SELECT filepath, recording_id FROM recordings where id = ?;'
  try {
    const [results, _fields] = await req.dbconn.query(sql, id);
    if (results.length > 0) {
      const audioFile = `${results[0].filepath}`;
      const recId = `${results[0].recording_id}`;
      const stat = fs.statSync(audioFile);
      res.set('Content-disposition', `${'attachment; filename=recording_'}${recId}.wav`);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': stat.size,
      });
      const readStream = fs.createReadStream(audioFile);
      readStream.pipe(res);
    }
    else {
      res.send('No results');
    }
  } catch (error) {
    console.error('/recordingdownload ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
})

router.post('/recordingdelete', restrict, async (req, res) => {
  const { id } = req.body;
  if (id) {
    try {
      const sql = 'SELECT * FROM recordings WHERE id = ?;';
      const [results, _fields] = await req.dbconn.query(sql, id);
      const sql2 = 'DELETE FROM recordings WHERE id = ?;';
      const [results2, _fields2] = await req.dbconn.query(sql2, id);
      const filePath = results[0].filepath;
      fs.unlinkSync(filePath)
      res.send(`${result2.affectedRows} record deleted`);
    } catch (error) {
      console.error('/recordingdelete ERROR: ', error);
      res.status(500).send({ message: 'Error' });
    }
  }
  else {
    res.status(400).send('Bad Inputs');
  }
})

router.get('/firsttimesetup', async (req, res) => {
  const sql = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
  try {
    const [result, _fields] = await req.dbconn.query(sql);
    if (result[0].adminCount === 0) {
      res.render('pages/firsttimesetup');
    } else {
      res.redirect('./');
    }
  } catch (error) {
    console.error('/firsttimesetup ERROR: ', error);
    res.status(500).send({ message: 'Error' });
  }
});

router.post('/CreateAdmin', async (req, res) => {
  const { username, password, firstname, lastname } = req.body;
  if (
    validator.isUsernameValid(username)
    && validator.isPasswordComplex(password)
    && validator.isNameValid(firstname)
    && validator.isNameValid(lastname)
  ) {
    const sql1 = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
    try {
      const [result1, _fields] = await req.dbconn.query(sql1, id);
      if (result1[0].adminCount === 0) {
        const hash = await bcrypt.hash(password, 10)
        const sql2 = 'INSERT INTO login_credentials (username, password, first_name, last_name, role, last_login) VALUES (?,?,?,?,?,?);';
        const [result2, _fields] = await req.dbconn.query(sql2, [username, hash, firstname, lastname, 'admin', null]);
        res.send(`${result2.affectedRows} record updated`);
      } else {
        res.send('Account already exists');
      } 
    } catch (error) {
      console.error('/CreateAdmin ERROR: ', error);
      res.status(500).send({ message: 'Error' });
    }
  }
  else {
    res.status(400).send('Bad Inputs');
  }
});


router.post('/adminPasswordUpdate', restrict, (req, res) => {
  const { username } = req.body;
  const { password } = req.body;
  if (
    validator.isUsernameValid(username)
    && validator.isPasswordComplex(password)
  ) {
    const sql = 'SELECT * FROM login_credentials WHERE username = ? ;';
    req.dbconn.query(sql, [username], (err, result1) => {
      if (err) {
        console.error(`SQL ERR: ${err}`);
        res.status(500).send('Error');
      } else if (result1.length === 1) {
        bcrypt.hash(password, 10, (err2, hash) => {
          req.dbconn.query(
            'UPDATE `login_credentials` SET `password` = ? WHERE `idlogin_credentials` = ?',
            [hash, result1[0].idlogin_credentials],
            (err3, result2) => {
              if (err3) {
                console.error(`SQL ERR: ${err}`);
                res.status(500).send('Error');
              } else {
                res.status(200).send(`${username} password updated`);
              }
            },
          );
        });
      } else {
        res.status(400).send('User not found');
      }
    });
  } else {
    res.status(400).send('Invalid Password');
  }
});

router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('./');
  }
  const sql = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
  try {
    const [results, _fields] = await req.dbconn.query(sql)

    if (results[0].adminCount === 0) {
      res.render('pages/firsttimesetup');
    } else {
      res.render('pages/login')
    }
  } catch (error) {
    console.error('Error GET /login:', error);
    res.send('err');
  }


});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    if (validator.isUsernameValid(username) && validator.isPasswordComplex(password)) {
      const sql = 'SELECT * FROM login_credentials WHERE username = ? limit 0,1;';
      const params = [username];
      const [results, _fields] = await req.dbconn.query(sql, params);
      if (results.length === 1) {
        const valid = await bcrypt.compare(password, results[0].password);
        if (valid) {
          req.session.idlogin_credentials = results[0].idlogin_credentials;
          req.session.user = results[0].username;
          req.session.firstname = results[0].first_name;
          req.session.lastname = results[0].last_name;
          req.session.role = results[0].role;
          req.session.error = '';
          await req.dbconn.query('UPDATE `login_credentials` SET `last_login` = now() WHERE `idlogin_credentials` = ?', results[0].idlogin_credentials);
          res.status(200).send('success');
        } else {
          console.info(valid);
          res.status(200).send('failure');
        }
      } else {
        res.status(200).send('failure');
      }

    } else {
      res.send('Bad Inputs');
    }
  } catch (error) {
    console.error('Error POST /login:', error);
    res.status(200).send('failure');
  }
  if (
    validator.isUsernameValid(username)
    && validator.isPasswordComplex(password)
  ) {
    const sql = 'SELECT * FROM login_credentials WHERE username = ? limit 0,1;';
    const params = [username];
    req.dbconn.query(sql, params, (err, user) => {
      if (err) {
        console.error(`SQL Login Error: ${err}`);
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
            console.info(valid);
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
      console.error(err);
    } else {
      res.redirect('./');
    }
  });
});


module.exports = router;
