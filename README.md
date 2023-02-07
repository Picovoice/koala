# Koala

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

[![Twitter URL](https://img.shields.io/twitter/url?label=%40AiPicovoice&style=social&url=https%3A%2F%2Ftwitter.com%2FAiPicovoice)](https://twitter.com/AiPicovoice)
[![YouTube Channel Views](https://img.shields.io/youtube/channel/views/UCAdi9sTCXLosG1XeqDwLx7w?label=YouTube&style=social)](https://www.youtube.com/channel/UCAdi9sTCXLosG1XeqDwLx7w)

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (4, 3) and NVIDIA Jetson Nano

## Table of Contents

- [Koala](#koala)
    - [Table of Contents](#table-of-contents)
    - [AccessKey](#accesskey)
    - [Demos](#demos)
        - [Python](#python-demos)
    - [SDKs](#sdks)
        - [Python](#python)
    - [Releases](#releases)

## AccessKey

AccessKey is your authentication and authorization token for deploying Picovoice SDKs, including Koala. Anyone who is
using Picovoice needs to have a valid AccessKey. You must keep your AccessKey secret. You would need internet
connectivity to validate your AccessKey with Picovoice license servers even though the noise suppression is running 100%
offline.

AccessKey also verifies that your usage is within the limits of your account. Everyone who signs up for
[Picovoice Console](https://console.picovoice.ai/) receives the `Free Tier` usage rights described
[here](https://picovoice.ai/pricing/). If you wish to increase your limits, you can purchase a subscription plan.

## Demos

### Python Demos

Install the demo package:

```console
pip3 install pvkoalademo
```

```console
koala_demo_mic --access_key ${ACCESS_KEY} --output_path ${WAV_OUTPUT_PATH}
```

```console
koala_demo_file --access_key ${ACCESS_KEY} --input_path ${WAV_INPUT_PATH} --output_path ${WAV_OUTPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

## SDKs

### Python

Install the Python SDK:

```console
pip3 install pvkoala
```

Create an instance of the engine and enhance audio in real-time:

```python
import pvkoala

koala = pvkoala.create(access_key='${ACCESS_KEY}')

def get_next_audio_frame():
    pass

while True:
    enhanced_audio = koala.process(get_next_audio_frame())
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

## Releases
