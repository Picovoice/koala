let koala = null;

let originalBuffer;
let enhancedBuffer;
let outputFrames;

window.onload = function () {
  const audioContext = new (window.AudioContext || window.webKitAudioContext)(
          {sampleRate: 16000}
  );

  const originalAudioGain = audioContext.createGain();
  originalAudioGain.gain.value = 0;

  const enhancedAudioGain = audioContext.createGain();
  enhancedAudioGain.gain.value = 1;

  originalAudioGain.connect(audioContext.destination);
  enhancedAudioGain.connect(audioContext.destination);

  let originalAudioSource;
  let enhancedAudioSource;
  let isPlaying = false;

  function readAudioFile(selectedFile, callback) {
    let reader = new FileReader();
    reader.onload = function (ev) {
      let wavBytes = reader.result;
      audioContext.decodeAudioData(wavBytes, callback);
    };
    reader.readAsArrayBuffer(selectedFile);
  }

  const fileSelector = document.getElementById("audioFile");
  fileSelector.addEventListener("change", async (event) => {
    outputFrames = [];
    resultBox.style.display = "none";

    originalAudioSource?.stop();
    enhancedAudioSource?.stop();

    writeMessage("Loading audio file...");
    const fileList = event.target.files;
    readAudioFile(fileList[0], async (audioBuffer) => {
      const f32PCM = audioBuffer.getChannelData(0);
      const i16PCM = new Int16Array(f32PCM.length);

      const INT16_MAX = 32767;
      const INT16_MIN = -32768;
      i16PCM.set(
        f32PCM.map((f) => {
          let i = Math.trunc(f * INT16_MAX);
          if (f > INT16_MAX) i = INT16_MAX;
          if (f < INT16_MIN) i = INT16_MIN;
          return i;
        })
      );

      writeMessage("Processing audio file...");
      const splitPcm = [];
      await koala.reset();
      for (let i = 0; i < (i16PCM.length - koala.frameLength + 1); i += koala.frameLength) {
        const split = i16PCM.slice(i, i + koala.frameLength);
        splitPcm.push(split);
        await koala.process(split);
      }

      writeMessage("Waiting for Koala engine to finish processing audio file...");
      await waitForProcess(splitPcm, outputFrames);

      originalBuffer = createBuffer(i16PCM);
      enhancedBuffer = createBuffer(mergeFrames(outputFrames, koala.delaySample));

      writeMessage("Press 'Play' to listen to recording. Move the slider to play around with noise.");
      resultBox.style.display = "block";
    });
  });

  const displayTimer = document.getElementById("displayTimer");
  const recordButton = document.getElementById("recordAudio");
  const stopRecord = document.getElementById("stopRecord");
  const resultBox = document.getElementById("result");
  const volumeControl = document.getElementById("volumeControl");
  const playAudio = document.getElementById("playAudio");

  let timer = null;
  let currentTimer = 0.0;
  let audioData = [];
  const recorderEngine = {
    onmessage: (event) => {
      switch (event.data.command) {
        case "process":
          audioData.push(event.data.inputFrame);
          break;
      }
    }
  }

  recordButton.addEventListener("click", async () => {
    displayTimer.style.display = "inline";
    stopRecord.style.display = "inline";
    recordButton.style.display = "none";
    resultBox.style.display = "none";

    originalAudioSource?.stop();
    enhancedAudioSource?.stop();

    currentTimer = 0.0;
    audioData = [];
    outputFrames = [];

    try {
      writeMessage("Recording audio...");
      window.WebVoiceProcessor.WebVoiceProcessor.setOptions({
        frameLength: koala.frameLength
      });
      await window.WebVoiceProcessor.WebVoiceProcessor.subscribe([recorderEngine, koala]);
      timer = setInterval(() => {
        currentTimer += 0.1;
        displayTimer.innerText = `${currentTimer.toFixed(1)} / 120`;
        if (currentTimer === 120) {
          stopRecord.click();
        }
      }, 100);
    } catch (e) {
      writeMessage(e);
    }
  });

  stopRecord.addEventListener("click", async () => {
    displayTimer.style.display = "none";
    stopRecord.style.display = "none";
    recordButton.style.display = "inline";

    await window.WebVoiceProcessor.WebVoiceProcessor.unsubscribe([recorderEngine, koala]);
    clearInterval(timer);

    writeMessage("Waiting for Koala engine to finish processing...")
    await waitForProcess(audioData, outputFrames);

    originalBuffer = createBuffer(mergeFrames(audioData));
    enhancedBuffer = createBuffer(mergeFrames(outputFrames, koala.delaySample));

    writeMessage("Press 'Play' to listen to recording. Move the slider to play around with noise.");
    resultBox.style.display = "block";
  });

  volumeControl.addEventListener("input", (e) => {
    originalAudioGain.gain.value = 1 - e.target.value;
    enhancedAudioGain.gain.value = e.target.value;
  });

  playAudio.addEventListener("click", () => {
    if (!isPlaying) {
      isPlaying = true;
      const current_time = audioContext.currentTime;

      originalAudioSource = audioContext.createBufferSource();
      enhancedAudioSource = audioContext.createBufferSource();

      originalAudioSource.buffer = originalBuffer;
      originalAudioSource.loop = true;
      originalAudioSource.connect(originalAudioGain);
      originalAudioSource.start(current_time + 0.2);

      enhancedAudioSource.buffer = enhancedBuffer;
      enhancedAudioSource.loop = true;
      enhancedAudioSource.connect(enhancedAudioGain);
      enhancedAudioSource.start(current_time + 0.2);

      playAudio.innerHTML = "Stop"
    } else {
      isPlaying = false;

      originalAudioSource.stop();
      enhancedAudioSource.stop();

      playAudio.innerHTML = "Play"
    }
  });

  function mergeFrames(data, delaySample = 0) {
    let delay = 0;

    const pcm = new Int16Array(data.length * koala.frameLength);
    for (let i = 0; i < data.length; i++) {
      if (i * koala.frameLength < delaySample) {
        delay += 1;
      } else {
        pcm.set(data[i], (i - delay) * koala.frameLength);
      }
    }
    return pcm;
  }

  function createBuffer(data) {
    const buffer = audioContext.createBuffer(1, data.length, koala.sampleRate);
    const source = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++){
      source[i] = data[i] < 0 ? data[i] / 32768 : data[i] / 32767;
    }
    buffer.copyToChannel(source, 0);
    return buffer;
  }

  async function waitForProcess(input, output) {
    return new Promise(resolve => {
      setInterval(() => {
        if (input.length === output.length) {
          resolve();
        }
      }, 100)
    });
  }
}

function writeMessage(message) {
  console.log(message);
  document.getElementById("status").innerHTML = message;
}

function processErrorCallback(error) {
  writeMessage(error);
}

function processCallback(enhancedPcm) {
  outputFrames.push(enhancedPcm);
}

async function startKoala(accessKey) {
  writeMessage("Koala is loading. Please wait...");
  try {
    koala = await KoalaWeb.KoalaWorker.create(
            accessKey,
            processCallback,
            { base64: modelParams },
            { processErrorCallback: processErrorCallback }
    );

    writeMessage("Koala worker ready!");

    writeMessage(
            "WebVoiceProcessor initializing. Microphone permissions requested ..."
    );
    window.WebVoiceProcessor.WebVoiceProcessor.setOptions({
      frameLength: koala.frameLength
    });
    document.getElementById("control").style.display = "block";
    writeMessage("Koala worker is ready!");
  } catch (err) {
    processErrorCallback(err);
  }
}