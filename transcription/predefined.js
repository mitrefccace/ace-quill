const PREDEFINED_QUERY = "SELECT * FROM predefined_captions_data WHERE fk_id = ? ORDER BY ms;"
function Predefined(id, connection) {
  this.id = id;
  this.db = connection;

}

Predefined.prototype.start = function start(callback) {
  console.log(this.id);
  this.db.query(PREDEFINED_QUERY, this.id, (err, results)=>{
  let phrase = ""
  results.forEach(w => {
    phrase += w.word + " "
    let final = (w.final == 1) ? true : false;
    sendPhrase(phrase, final, w.ms, callback)
    if(final){
      phrase = ""
    }
  })
  });
  
};

function sendPhrase(phrase, final, ms, callback){
  setTimeout(()=>{
    callback({"transcript":phrase, final});
  },ms)
}


module.exports = Predefined;

