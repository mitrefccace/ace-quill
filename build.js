const path = require('path');
var fs = require('fs');
const shell = require('shelljs')


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
    'jquery-validation/dist/jquery.validate.min.js',
    'jssip/dist/jssip.min.js',
    'moment/moment.js',
    'recordrtc/RecordRTC.js'
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
