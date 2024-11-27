# Koala iOS Demo

## AccessKey

Koala requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Koala SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Running the Demo

Copy your `AccessKey` into the `ACCESS_KEY` variable inside [`ViewModel.swift`](./KoalaDemo/KoalaDemo/ViewModel.swift).

Before building the demo app, run the following from `KoalaDemo` directory to install the Koala CocoaPod:

```ruby
pod install
```

Open [KoalaDemo.xcodeproj](./KoalaDemo/KoalaDemo.xcodeproj) and run the demo.
