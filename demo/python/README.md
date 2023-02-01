# Koala Noise Suppression Demos

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

## Koala

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (4, 3) and NVIDIA Jetson Nano

## Compatibility

- Python 3.5+
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64), Raspberry Pi (4, 3), and NVIDIA Jetson Nano.

## Installation

```console
pip3 install pvkoalademo
```

## AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

### Microphone Demo

You need a working microphone connected to your machine for this demo. Run the following in the terminal:

```console
koala_demo_mic --access_key ${ACCESS_KEY} --output-path ${WAV_OUTPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console and `${WAV_OUTPUT_PATH}` with a path to a `.wav` file
where the enhanced audio will be stored.

### File Demo

Run the following in the terminal:

```console
koala_demo_file --access_key ${ACCESS_KEY} --input_path ${WAV_INPUT_PATH} --output_path ${WAV_OUTPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console, `${WAV_INPUT_PATH}` with a path to a compatible
(single-channel, 16 kHz, 16-bit PCM) `.wav` file you wish to enhance, and `${WAV_OUTPUT_PATH}` with a path to a `.wav` 
file where the enhanced audio will be stored.
