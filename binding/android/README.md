# Koala Binding for Android

## Koala Noise Suppression Engine

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (4, 3) and NVIDIA Jetson Nano

## Compatibility

- Android 5.0 (SDK 21+)

## Installation

Koala is hosted on Maven Central. To include the package in your Android project, ensure you have
included `mavenCentral()` in your top-level `build.gradle` file and then add the following to your
app's `build.gradle`:

```groovy
dependencies {
    // ...
    implementation 'ai.picovoice:koala-android:${VERSION}'
}
```

## AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

Add the Koala model file to your Android application by:

1. Either create a model in [Picovoice Console](https://console.picovoice.ai/) or use the [default model](../../lib/common).
2. Add the model as a bundled resource by placing it under the assets directory of your Android project (`src/main/assets`).

Create an instance of the engine with the Koala Builder class by passing in the `accessKey`, `modelPath` and Android app context:

```java
import ai.picovoice.koala.*;

final String accessKey = "${ACCESS_KEY}"; // AccessKey provided by Picovoice Console (https://console.picovoice.ai/)
final String modelPath = "${MODEL_PATH}"; // relative path to assets directory or absolute path to file on device
try {
    Koala koala = new Koala.Builder()
        .setAccessKey(accessKey)
        .setModelPath(modelPath)
        .build(appContext);
} catch (KoalaException ex) { }
```

Enhance audio:

```java
short[] getNextAudioFrame() {
    // .. get audioFrame
    return audioFrame;
}

while true {
    short[] enhancedFrame = koala.process(getNextAudioFrame());
}
```

When done, resources have to be released explicitly:

```java
koala.delete();
```

## Demo App

For example usage refer to our [Android demo application](../../demo/android).