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
        - [C](#c-demos)
    - [SDKs](#sdks)
        - [Python](#python)
        - [C](#c)
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
koala_demo_file \
    --access_key ${ACCESS_KEY} \
    --input_path ${WAV_INPUT_PATH} \
    --output_path ${WAV_OUTPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

### C Demos

Build the demo:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target koala_demo_mic
```

To list the available audio input devices:

```console
./demo/c/build/koala_demo_mic -s
```

To run the demo:

```console
./demo/c/build/koala_demo_mic -l ${LIBRARY_PATH} -m ${MODLE_PATH} -a ${ACCESS_KEY} -o ${WAV_OUTPUT_PATH}
```

Replace `${LIBRARY_PATH}` with path to appropriate library available under [lib](./lib), `${MODEL_PATH}` with path
to the model file available under [lib/common](./lib/common), `${ACCESS_KEY}` with AccessKey
obtained from [Picovoice Console](https://console.picovoice.ai/), and `${WAV_OUTPUT_PATH}` with a path to a `.wav` file
where the enhanced audio will be stored. Terminate the demo with `Ctrl+C`.

For more information about C demos go to [demo/c](./demo/c).

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

### C

[include/pv_koala.h](./include/pv_koala.h) header file contains relevant information. Build an instance of the object:

```c
    pv_cobra_t *handle = NULL;
    const char *model_path = "${MODEL_PATH}";
    pv_status_t status = pv_koala_init(${ACCESS_KEY}, model_path, &handle);
    if (status != PV_STATUS_SUCCESS) {
        // error handling logic
    }
```

Replace `${ACCESS_KEY}` with the AccessKey obtained from Picovoice Console, and `${MODEL_PATH}` with the path to the
model file available under [lib/common](./lib/common).

Now the `handle` can be used to enhance audio in real-time:

```c
extern const int16_t *get_next_audio_frame(void);

const int32_t frame_length = pv_koala_frame_length();
int16_t *enhanced_pcm = (int16_t *) malloc(frame_length * sizeof(int16_t));

while (true) {
    const int16_t *pcm = get_next_audio_frame();
    const pv_status_t status = pv_koala_process(handle, pcm, enhanced_pcm);
    if (status != PV_STATUS_SUCCESS) {
        // error handling logic
    }
}
```

Finally, when done be sure to release the acquired resources:

```c
pv_koala_delete(handle);
```

## Releases

### v1.0.0 February 7th, 2023

- Initial release.