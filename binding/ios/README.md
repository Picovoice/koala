# Koala Binding for iOS

## Koala Noise Suppression Engine

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (3, 4, 5)

## Compatibility

- iOS 13.0+

## Installation
<!-- markdown-link-check-disable -->
The Koala iOS binding is available via [Swift Package Manager](https://www.swift.org/documentation/package-manager/) or [CocoaPods](https://cocoapods.org/pods/Koala-iOS).
<!-- markdown-link-check-enable -->

To import the package using SPM, open up your project's Package Dependencies in XCode and add:
```
https://github.com/Picovoice/koala.git
```
To import it into your iOS project using CocoaPods, add the following line to your Podfile:

```ruby
pod 'Koala-iOS'
```

## AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Permissions

To enable recording with your iOS device's microphone you must add the following to your app's `Info.plist` file:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>[Permission explanation]</string>
```

### Usage

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

The input audio must come from a single-channel stream with integer 16-bit encoding. The sample rate must be identical
to `Koala.sampleRate`. The stream must be split into *frames* with a fixed length in samples that can be obtained
from `Koala.frameLength`.

The output of `koala.process()` is a frame of enhanced audio with the same 16-bit integer encoding. The delay in
samples between the start time of the input frame and the start time of the output frame can be attained from
`koala.delaySample`.

In case the next audio frame does not directly follow the previous one, call `koala.reset()`.

When done be sure to explicitly release the resources using `koala.delete()`.

## Running Unit Tests

Copy your `AccessKey` into the `accessKey` variable in [`KoalaAppTestUITests.swift`](KoalaAppTest/KoalaAppTestUITests/KoalaAppTestUITests.swift). Open [`KoalaAppTest.xcodeproj`](KoalaAppTest/KoalaAppTest.xcodeproj) with XCode and run the tests with `Product > Test`.

## Demo App

For example usage, refer to our [iOS demo application](../../demo/ios).
