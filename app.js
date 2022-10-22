require("dotenv").config();
const SpotifyWebApi = require('spotify-web-api-node');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require("firebase-admin/firestore");
const { SerialPort } = require('serialport');

SerialPort.list().then(function(ports){
    ports.forEach(function(port){
        if(!port.pnpId){
            return;
        }
      console.log("Port: ", port);
    })
  });

const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 9600 })

let track = "";
let trackAnalytics = null;
let position = 0;
const WAIT_TIME = 50;

let docId = null;
let dbUnsubscribe = null;
let sessionStarted = false;
let dbData = null;

const serialWrite = (data) => {
    port.write(data, function (err) {
        if (err) {
            return console.log('Error on write: ', err.message)
        }
        //console.log(position)
    });
}

const app = initializeApp({
    databaseURL: process.env.DB_URL
});

const db = getFirestore();

const dbJob = () => {
    if (!dbData.initialized) {
        if (sessionStarted) {
            sessionStarted = false;
        }
        return;
    }
    if(dbData.ended){
        initDb();
        return;
    }
    if (!sessionStarted) {
        serialWrite('D:0;R:50;G:50;B:50;FS:;F:;\n');
    }
    console.log(dbData);
    sessionStarted = true;
    const pressed = Object.keys(dbData).filter(v => v.indexOf("pressed") !== -1).map(v => dbData[v]).some(v => v);

    if (dbData.type === "LAB") {
        if (pressed) {
            serialWrite('D:0;R:50;G:50;B:50;FS:;F:;\n');
        } else {
            serialWrite('D:0;R:50;G:0;B:0;FS:;F:;\n');
        }
    }


}

const initDb = async () => {
    if (docId) {
        return;
    }
    if (dbUnsubscribe) {
        dbUnsubscribe();
        dbUnsubscribe = null;
    }
    console.log("Fetching db");
    const q = db.collection("electrolab").orderBy("createdAt", "desc").limit(1);
    const snapshot = await q.get();
    const docSnapshot = snapshot.docs[0];
    if (snapshot.empty) {
        return;
    }

    console.log("Got session");
    console.log(docSnapshot.data());

    dbUnsubscribe = db.doc(`electrolab/${docSnapshot.id}`).onSnapshot((snapshot) => {
        dbData = snapshot.data();
        dbJob();
    });


    dbData = docSnapshot.data();
    dbJob();
}
initDb();

(async () => {
    setInterval(() => {

    }, 1000);
})();


if (process.env.SPOTIFY_TOKEN) {
    console.log("Spotify TOKEN detected");
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
            if (!sessionStarted) {
                port.write('D:0;R:50;G:50;B:50;FS:;F:;\n', function (err) {
                    if (err) {
                        return console.log('Error on write: ', err.message)
                    }
                    console.log(position)
                });
            }

        }
        position += WAIT_TIME;
    }, WAIT_TIME);

    (async () => {
        setInterval(async () => {
            if (sessionStarted) {
                return;
            }
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
} else {
    console.log("Spotify TOKEN not provided. Skip this feature...");
}
