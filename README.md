# Koala

[![GitHub release](https://img.shields.io/github/release/Picovoice/Koala.svg)](https://github.com/Picovoice/Koala/releases)
[![GitHub](https://img.shields.io/github/license/Picovoice/koala)](https://github.com/Picovoice/koala/)

[![Maven Central](https://img.shields.io/maven-central/v/ai.picovoice/koala-android?label=maven-central%20%5Bandroid%5D)](https://repo1.maven.org/maven2/ai/picovoice/koala-android/)
[![npm](https://img.shields.io/npm/v/@picovoice/koala-web?label=npm%20%5Bweb%5D)](https://www.npmjs.com/package/@picovoice/koala-web)<!-- markdown-link-check-disable-line -->
[![CocoaPods](https://img.shields.io/cocoapods/v/Koala-iOS)](https://cocoapods.org/pods/Koala-iOS)<!-- markdown-link-check-disable-line -->
[![PyPI](https://img.shields.io/pypi/v/pvkoala)](https://pypi.org/project/pvkoala/)

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

[![Twitter URL](https://img.shields.io/twitter/url?label=%40AiPicovoice&style=social&url=https%3A%2F%2Ftwitter.com%2FAiPicovoice)](https://twitter.com/AiPicovoice)<!-- markdown-link-check-disable-line -->
[![YouTube Channel Views](https://img.shields.io/youtube/channel/views/UCAdi9sTCXLosG1XeqDwLx7w?label=YouTube&style=social)](https://www.youtube.com/channel/UCAdi9sTCXLosG1XeqDwLx7w)

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64, arm64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (3, 4, 5)

## Table of Contents

- [Koala](#koala)
  - [Table of Contents](#table-of-contents)
  - [AccessKey](#accesskey)
  - [Demos](#demos)
    - [Python Demos](#python-demos)
    - [Android Demo](#android-demo)
    - [iOS Demo](#ios-demo)
    - [C Demos](#c-demos)
    - [Web Demo](#web-demo)
  - [SDKs](#sdks)
    - [Python](#python)
    - [Android](#android)
    - [iOS](#ios)
    - [C](#c)
    - [Web](#web)
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

### Android Demo

Using [Android Studio](https://developer.android.com/studio/index.html), open
[demo/android/Activity](./demo/android/Activity) as an Android project and then run the application.

Replace `"${YOUR_ACCESS_KEY_HERE}"` in the file [MainActivity.java](./demo/android/Activity/koala-activity-demo-app/src/main/java/ai/picovoice/koalaactivitydemo/MainActivity.java) with your `AccessKey`.

### iOS Demo

Copy your `AccessKey` into the `ACCESS_KEY` variable inside [`ViewModel.swift`](./demo/ios/KoalaDemo/KoalaDemo/ViewModel.swift).

Before building the demo app, run the following from [`KoalaDemo`](./demo/ios/KoalaDemo) directory to install the `Koala-iOS` CocoaPod:

```ruby
pod install
```

Open [KoalaDemo.xcodeproj](./demo/ios/KoalaDemo/KoalaDemo.xcodeproj) and run the demo.


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
./demo/c/build/koala_demo_mic -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -o ${WAV_OUTPUT_PATH}
```

Replace `${LIBRARY_PATH}` with path to appropriate library available under [lib](./lib), `${MODEL_PATH}` with path
to the model file available under [lib/common](./lib/common), `${ACCESS_KEY}` with AccessKey
obtained from [Picovoice Console](https://console.picovoice.ai/), and `${WAV_OUTPUT_PATH}` with a path to a `.wav` file
where the enhanced audio will be stored. Terminate the demo with `Ctrl+C`.

For more information about C demos go to [demo/c](./demo/c).

### Web Demo

From [demo/web](./demo/web) run the following in the terminal:

```console
yarn
yarn start
```

(or)

```console
npm install
npm run start
```

Open `http://localhost:5000` in your browser to try the demo.

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
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

```python
def get_next_audio_frame():
    pass

while True:
    enhanced_audio = koala.process(get_next_audio_frame())
```

Finally, when done be sure to explicitly release the resources using `koala.delete()`.

### Android

To include the package in your Android project, ensure you have included `mavenCentral()` in your top-level `build.gradle` file and then add the following to your app's `build.gradle`:

```groovy
dependencies {
    implementation 'ai.picovoice:koala-android:${LATEST_VERSION}'
}
```

Create an instance of the engine and enhance audio in real-time:

```java
import ai.picovoice.koala.*;

final String accessKey = "${ACCESS_KEY}"; // AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)

short[] getNextAudioFrame() {
    // .. get audioFrame
    return audioFrame;
}

try {
    Koala koala = new Koala.Builder()
        .setAccessKey(accessKey)
        .build(appContext);

    while true {
        short[] enhancedFrame = koala.process(getNextAudioFrame());
    };

} catch (KoalaException ex) { }
```

Replace `${ACCESS_KEY}` with yours obtained from [Picovoice Console](https://console.picovoice.ai/).

### iOS

Create an instance of the engine and enhance audio:

```swift
import Koala

do {
  let koala = try Koala(accessKey: "${ACCESS_KEY}")
} catch {}

func getNextAudioFrame() -> [Int16] {
  // .. get a frame of audio
  return audioFrame;
}

while true {
  do {
    let enhancedAudio = try koala.process(getNextAudioFrame())
    // .. use enhanced audio
  } catch {}
}
```

Replace `${ACCESS_KEY}` with yours obtained from [Picovoice Console](https://console.picovoice.ai/).

In case the next audio frame does not directly follow the previous one, call `koala.reset()`.

When done be sure to explicitly release the resources using `koala.delete()`.

### C

[include/pv_koala.h](./include/pv_koala.h) header file contains relevant information. Build an instance of the object:

```c
    pv_koala_t *handle = NULL;
    const char *model_path = "${MODEL_PATH}";
    const char *device = "best";

    pv_status_t status = pv_koala_init(${ACCESS_KEY}, model_path, device, &handle);
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

### Web

Install the web SDK using yarn:

```console
yarn add @picovoice/koala-web
```

or using npm:

```console
npm install --save @picovoice/koala-web
```

Create an instance of the engine using `KoalaWorker` and enhance audio in real-time:

```typescript
import { Koala } from "@picovoice/koala-web";
import koalaParams from "${PATH_TO_BASE64_KOALA_PARAMS}";

function processCallback(enhancedPcm) {
  // do something with enhancedPcm
}

function getAudioData(): Int16Array {
... // function to get audio data
  return new Int16Array();
}

const koala = await KoalaWorker.create(
  "${ACCESS_KEY}",
  processCallback,
  { base64: koalaParams },
);

await koala.reset();
for (;;) {
    await koala.process(getAudioData());
}
```

Replace `${ACCESS_KEY}` with yours obtained from [Picovoice Console](https://console.picovoice.ai/). Finally, when done release the resources using `koala.release()`.

## Releases

### v3.0.0 - December 9th, 2025

 - Improved engine performance
 - Added support for running on GPU or multiple CPU cores
 - Node.js min version bumped to Node 18
 - iOS min version bumped to iOS 16

### v2.0.0 - November 24th, 2023

- Improvements to error reporting
- Upgrades to authorization and authentication system
- Various bug fixes and improvements
- Web min support bumped to Node 16
- iOS support bumped to iOS 13

### v1.0.0 - February 7th, 2023

- Initial release
