require("dotenv").config();
const SpotifyWebApi = require('spotify-web-api-node');
const { SerialPort } = require('serialport')
const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 9600 })

let track = "";
let trackAnalytics = null;
let position = 0;
const WAIT_TIME = 50;

// credentials are optional
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});
spotifyApi.setAccessToken(process.env.SPOTIFY_TOKEN);

setInterval(() => {
    if (!trackAnalytics) {
        return;
    }
    const targetBeats = trackAnalytics.beats.find(b => position < b.start * 1000);
    if (!targetBeats) {
        return;
    }
    if (!targetBeats.checked) {
        targetBeats.checked = true;
        port.write('f', function (err) {
            if (err) {
                return console.log('Error on write: ', err.message)
            }
            console.log(position)
        })
    }
    position += WAIT_TIME;
}, WAIT_TIME);

(async () => {
    setInterval(async () => {
        const playState = await spotifyApi.getMyCurrentPlaybackState();
        const gotTrack = playState.body.item.id;
        position = playState.body.progress_ms;
        if (gotTrack !== track) {
            track = gotTrack;
            trackAnalytics = (await spotifyApi.getAudioAnalysisForTrack(gotTrack)).body;
            console.log(trackAnalytics)
            console.log(playState.body);
        }
    }, 5000);

})();