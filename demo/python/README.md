# Koala Noise Suppression Demos

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

## Koala

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (3, 4, 5)

## Compatibility

- Python 3.8+
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64), and Raspberry Pi (3, 4, 5).

## Installation

```console
pip3 install pvkoalademo
```

## AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala 
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

### Microphone Demo

The microphone demo collects audio from a microphone connected to your machine. The audio is passed through the Koala
noise suppression engine and stored in a `.wav` file.
Run the following in the terminal:

```console
koala_demo_mic --access_key ${ACCESS_KEY} --output-path ${WAV_OUTPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console and `${WAV_OUTPUT_PATH}` with a path to a `.wav` file
where the enhanced audio will be stored. Terminate the demo with `Ctrl+C`.

### File Demo

The file demo passes audio stored in a `.wav` file through the Koala noise suppression engine. The result is shifted to
compensate for the delay introduced by Koala and stored in a separate `.wav` file that will have the same length as the
input file without any delay.
Run the following in the terminal:

```console
koala_demo_file --access_key ${ACCESS_KEY} --input_path ${WAV_INPUT_PATH} --output_path ${WAV_OUTPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console, `${WAV_INPUT_PATH}` with a path to a compatible
(single-channel, 16 kHz, 16-bit PCM) `.wav` file you wish to enhance, and `${WAV_OUTPUT_PATH}` with a path to a `.wav` 
file where the enhanced audio will be stored.
