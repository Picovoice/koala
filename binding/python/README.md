# Koala Binding for Python

## Koala Noise Suppression Engine

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (3, 4, 5) and NVIDIA Jetson Nano

## Compatibility

- Python 3.7 or higher
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64), Raspberry Pi (3, 4, 5), and NVIDIA Jetson Nano.

## Installation

```console
pip3 install pvkoala
```

## AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

### Usage

Create an instance of the engine and enhance audio:

```python
import pvkoala

koala = pvkoala.create(access_key='${ACCESS_KEY}')

def get_next_audio_frame():
    pass

while True:
    enhanced_audio = koala.process(get_next_audio_frame())
```

Replace `${ACCESS_KEY}` with yours obtained from [Picovoice Console](https://console.picovoice.ai/).
The input audio must come from a single-channel stream with integer 16-bit encoding. The sample rate must be identical
to `koala.sample_rate`. The stream must be split into *frames* with a fixed length in samples that can be obtained
from `koala.frame_length`.

The output of `koala.process()` is a frame of enhanced audio with the same 16-bit integer encoding. The delay in
samples between the start time of the input frame and the start time of the output frame can be attained from
`koala.delay_sample`.

In case the next audio frame does not directly follow the previous one, call `koala.reset()`.
When done be sure to explicitly release the resources using `koala.delete()`.

## Demos

[pvkoalademo](https://pypi.org/project/pvkoalademo/) provides command-line utilities for processing audio using Koala.
