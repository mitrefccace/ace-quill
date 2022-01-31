const path = require('path');
var fs = require('fs');
const shell = require('shelljs');
const config = require('./configs/acequill.json');


const CSS = [
    'admin-lte/dist/css/adminlte.min.css',
    'admin-lte/dist/css/adminlte.min.css.map',
   // 'admin-lte/dist/css/skins/skin-blue.min.css',
    'admin-lte/plugins/bootstrap-slider/css/bootstrap-slider.css',
    'bootstrap/dist/css/bootstrap.min.css',
    'bootstrap/dist/css/bootstrap.min.css.map',
    'daterangepicker/daterangepicker.css',
    'ionicons/dist/css/ionicons.min.css',
    'font-awesome/css/font-awesome.min.css',
    'datatables.net-bs4/css/dataTables.bootstrap4.min.css',
    'datatables.net-jqui/css/dataTables.jqueryui.css',
];
const FONT = [
    'font-awesome/fonts/fontawesome-webfont.woff2',
];

const JS = [
    'admin-lte/dist/js/adminlte.min.js',
    'admin-lte/dist/js/adminlte.min.js.map',
    'admin-lte/plugins/bootstrap-slider/bootstrap-slider.js',
    'admin-lte/plugins/jquery-ui/jquery-ui.min.js',
    'bootstrap/dist/js/bootstrap.js',
    'bootstrap/dist/js/bootstrap.js.map',
    'daterangepicker/daterangepicker.js',
    'datatables.net/js/jquery.dataTables.min.js',
    'datatables.net-jqui/js/dataTables.jqueryui.js',
    'datatables.net-bs4/js/dataTables.bootstrap4.min.js',
    'html2canvas/dist/html2canvas.min.js',
    'jquery/dist/jquery.min.js',
    'jquery-csv/src/jquery.csv.min.js',
    'jquery-validation/dist/jquery.validate.min.js',
    'jssip/dist/jssip.min.js',
    'moment/moment.js',
    'recordrtc/RecordRTC.js',
    'popper.js/dist/umd/popper.js'
];


if (!fs.existsSync('./public/assets')) {
    fs.mkdirSync('./public/assets');
}
if (!fs.existsSync('./public/assets/js')) {
    fs.mkdirSync('./public/assets/js');
}
if (!fs.existsSync('./public/assets/css')) {
    fs.mkdirSync('./public/assets/css');
}
if (!fs.existsSync('./public/assets/fonts')) {
    fs.mkdirSync('./public/assets/fonts');
}
JS.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`)
    let to = path.resolve(__dirname, `./public/assets/js/${filename}`)
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`)
        process.exit(1)
    }
});

CSS.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`)
    let to = path.resolve(__dirname, `./public/assets/css/${filename}`)
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`)
        process.exit(1)
    }
});

FONT.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`)
    let to = path.resolve(__dirname, `./public/assets/fonts/${filename}`)
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`)
        process.exit(1)
    }
});

shell.exec('./python.sh')
if (config.accuracy.ace2 == 'true') {
    shell.exec('git clone ' + config.accuracy.ace2_repo, {cwd: './resources'})
    shell.exec('git lfs pull', {cwd: './resources/ace-code-master'})
    shell.exec('sudo pip3.6 install -r requirements.txt', {cwd: './resources/ace-code-master'})
    shell.exec('mkdir w2v', {cwd: './resources/ace-code-master/res'})
    shell.exec('wget -c "https://s3.amazonaws.com/dl4j-distribution/GoogleNews-vectors-negative300.bin.gz"', {cwd: './resources/ace-code-master/res/w2v'})
    shell.exec('gzip -d GoogleNews-vectors-negative300.bin.gz', {cwd: './resources/ace-code-master/res/w2v'})
}

if (config.accuracy.sclite == 'true') {
    shell.exec('git clone https://github.com/usnistgov/SCTK.git', {cwd: './resources'})
    shell.exec('make config && make all && make check && make install && make doc', {cwd: './resources/SCTK'})
}

