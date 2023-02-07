# C Demos

## Compatibility

You need a C99-compatible compiler to build these demos.

## AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Requirements

- The demo requires [CMake](https://cmake.org/) version 3.4 or higher.
- **For Windows Only**: [MinGW](http://mingw-w64.org/doku.php) is required to build the demo.

# Microphone Demo

The microphone demo collects audio from a microphone connected to your machine. The audio is passed through the Koala
noise suppression engine and stored in a `.wav` file.

The Koala microphone demo opens an audio stream and detects the presence of speech.

**Note**: the following commands are run from the root of the repo

## Build

Use CMake to build the Koala microphone demo target:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target koala_demo_mic
```

## Usage

Running the executable without any command-line arguments prints the usage info to the console:

```console
Usage: ./koala_demo_mic [-s] [-l LIBRARY_PATH -a ACCESS_KEY -d AUDIO_DEVICE_INDEX]
```

To list the available audio input devices:

```console
./demo/c/build/koala_demo_mic -s
```

To run the Koala microphone demo:

```console
./demo/c/build/koala_demo_mic -l ${LIBRARY_PATH} -a ${ACCESS_KEY} -d ${AUDIO_DEVICE_INDEX} -o ${WAV_OUTPUT_PATH}
```

Replace `${LIBRARY_PATH}` with path to appropriate library available under [lib](/lib), `${ACCESS_KEY}` with AccessKey
obtained from [Picovoice Console](https://console.picovoice.ai/), `${AUDIO_DEVICE_INDEX}` with the index of the
audio device  you wish to capture audio with, and `${WAV_OUTPUT_PATH}` with a path to a `.wav` file
where the enhanced audio will be stored. An `${AUDIO_DEVICE_INDEX}` of -1 will provide you with your system's
default recording device. Terminate the demo with `Ctrl+C`.

# File Demo

The file demo passes audio stored in a `.wav` file through the Koala noise suppression engine. The result is shifted to
compensate for the delay introduced by Koala and stored in a separate `.wav` file that will have the same length as the
input file without any delay. This demo expects a single-channel WAV file with a sampling rate of 16000 and 16-bit linear PCM encoding.

**Note**: the following commands are run from the root of the repo

## Build

Use CMake to build the Koala file demo target:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target Koala_demo_file
```

## Usage

Run the demo:

```console
./demo/c/build/Koala_demo_file -l ${LIBRARY_PATH} -a ${ACCESS_KEY} -i ${INPUT_WAV_FILE} -o ${OUTPUT_WAV_FILE}
```

Replace `${LIBRARY_PATH}` with the path to the appropriate Koala library available under [lib](/lib), `${ACCESS_KEY}` with a
Picovoice AccessKey obtained from the [Picovoice Console](https://console.picovoice.ai/), `${WAV_INPUT_PATH}` with a path to a compatible
(single-channel, 16 kHz, 16-bit PCM) `.wav` file you wish to enhance, and `${WAV_OUTPUT_PATH}` with a path to a `.wav`
file where the enhanced audio will be stored.
