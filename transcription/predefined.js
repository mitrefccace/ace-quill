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

const PREDEFINED_QUERY = "SELECT * FROM predefined_captions_data WHERE fk_id = ? ORDER BY ms;"
function Predefined(id, connection) {
  this.id = id;
  this.db = connection;

}

Predefined.prototype.start = async function start(callback) {
  console.info(this.id);
  try{
    const [results, _fields] = await this.db.query(PREDEFINED_QUERY, this.id);
    let phrase = "";
    results.forEach(w => {
      phrase += w.word + " ";
      let final = (w.final == 1) ? true : false;
      sendPhrase(phrase, final, w.ms, callback)
      if(final){
        phrase = "";
      }
    });
  }
  catch(error){
    console.error(`Error in Predefined start: ${JSON.stringify(error)}`);
  }
};

function sendPhrase(phrase, final, ms, callback){
  setTimeout(()=>{
    callback({"transcript":phrase, timestamp: new Date(), final});
  },ms)
}


module.exports = Predefined;

