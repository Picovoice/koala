# Koala Binding for Web

## Koala Noise Suppression Engine

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Koala is an on-device noise suppression engine. Koala is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), and Windows (x86_64, arm64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (3, 4, 5)

## Compatibility

- Chrome / Edge
- Firefox
- Safari

## Requirements

The Koala Web Binding uses [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer).

Include the following headers in the response to enable the use of `SharedArrayBuffers`:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Refer to our [Web demo](../../demo/web) for an example on creating a server with the corresponding response headers.

Browsers that don't support `SharedArrayBuffers` or applications that don't include the required headers will fall back to using standard `ArrayBuffers`. This will disable multithreaded processing.

### Restrictions

IndexedDB is required to use `Koala` in a worker thread. Browsers without IndexedDB support
(i.e. Firefox Incognito Mode) should use `Koala` in the main thread.

Multi-threading is only enabled for `Koala` when using on a web worker.

## Installation

### Package

Using `Yarn`:

```console
yarn add @picovoice/koala-web
```

or using `npm`:

```console
npm install --save @picovoice/koala-web
```

### AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

### Usage

For the web packages, there are two methods to initialize Koala.

#### Public Directory

**NOTE**: Due to modern browser limitations of using a file URL, this method does __not__ work if used without hosting a server.

This method fetches the model file from the public directory and feeds it to Koala. Copy the model file into the public directory:

```console
cp ${KOALA_MODEL_FILE} ${PATH_TO_PUBLIC_DIRECTORY}
```

#### Base64

**NOTE**: This method works without hosting a server, but increases the size of the model file roughly by 33%.

This method uses a base64 string of the model file and feeds it to Koala. Use the built-in script `pvbase64` to
base64 your model file:

```console
npx pvbase64 -i ${KOALA_MODEL_FILE} -o ${OUTPUT_DIRECTORY}/${MODEL_NAME}.js
```

The output will be a js file which you can import into any file of your project. For detailed information about `pvbase64`,
run:

```console
npx pvbase64 -h
```

#### Koala Model

Koala saves and caches your model file in IndexedDB to be used by WebAssembly. Use a different `customWritePath` variable
to hold multiple models and set the `forceWrite` value to true to force re-save a model file.

Either `base64` or `publicPath` must be set to instantiate Koala. If both are set, Koala will use the `base64` model.

```typescript
const koalaModel = {
  publicPath: ${MODEL_RELATIVE_PATH},
  // or
  base64: ${MODEL_BASE64_STRING},

  // Optionals
  customWritePath: "koala_model",
  forceWrite: false,
  version: 1,
}
```

#### Initialize Koala

Set `processErrorCallback` to handle errors if an error occurs while enhancing audio.
Create a `processCallback` function to get the streaming results from the engine:

```typescript
// Optional
const options = {
  processErrorCallback: (error) => {}
}

function processCallback(enhancedPcm: Int16Array) {
  // do something with enhancedPcm
}
```

Create an instance of `Koala` on the main thread:

```typescript
const handle = await Koala.create(
  ${ACCESS_KEY},
  processCallback,
  koalaModel,
  options // optional options
);
```

Or create an instance of `Koala` in a worker thread:

```typescript
const handle = await KoalaWorker.create(
  ${ACCESS_KEY},
  processCallback,
  koalaModel,
  options // optional options
);
```

#### Process Audio Frames

The `process` function will send the input frames to the engine.
The enhanced audio is received from `processCallback` as mentioned above.
In case the next audio frame does not follow the previous one, call `reset` before calling `process`.

```typescript
function getAudioFrame(): Int16Array {
  ... // function to get a frame of audio
  return new Int16Array();
}

await handle.reset();
for (;;) {
  await handle.process(getAudioFrame());
  // break on some condition
}
```

#### Clean Up

Clean up used resources by `Koala` or `KoalaWorker`:

```typescript
await handle.release();
```

#### Terminate (Worker only)

Terminate `KoalaWorker` instance:

```typescript
await handle.terminate();
```

## Demo

For example usage refer to our [Web demo application](https://github.com/Picovoice/koala/tree/main/demo/web).
