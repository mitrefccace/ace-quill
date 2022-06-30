var wave;
var micContext;
var mediaStreamSource;
var levelChecker;


function createWaveSurfer(stream) {


    if (wave)
        wave.destroy();

    var wave = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#FFF',
        barHeight: 3,
        hideScrollbar: true,
        audioRate: 1,
        barWidth: 2,
        interact: false,
    });


    micContext = wave.backend.getAudioContext();
    mediaStreamSource = micContext.createMediaStreamSource(stream);
    levelChecker = micContext.createScriptProcessor(4096, 1, 1);

    mediaStreamSource.connect(levelChecker);
    levelChecker.connect(micContext.destination);

    levelChecker.onaudioprocess = function (event) {
        wave.empty();
        wave.loadDecodedBuffer(event.inputBuffer);
    };
};

var destroyWaveSurfer = function() {

    if (wave) {
        wave.destroy();
        wave = undefined;
    }

    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource = undefined;
    }

    if (levelChecker) {
        levelChecker.disconnect();
        levelChecker.onaudioprocess = undefined;
        levelChecker = undefined;
    }
};