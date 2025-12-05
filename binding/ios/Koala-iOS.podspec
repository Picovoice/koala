Pod::Spec.new do |s|
  s.name = 'Koala-iOS'
  s.module_name = 'Koala'
  s.version = '3.0.0'
  s.license = {:type => 'Apache 2.0'}
  s.summary = 'iOS SDK for Picovoice\'s Koala Noise Suppression Engine'
  s.description =
  <<-DESC
  Koala is an on-device noise suppression engine.

  Koala is:
    - Private; All voice processing runs locally.
    - Cross-Platform:
      - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
      - Android and iOS
      - Chrome, Safari, Firefox, and Edge
      - Raspberry Pi (3, 4, 5)
  DESC
  s.homepage = 'https://github.com/Picovoice/koala/tree/main/binding/ios'
  s.author = { 'Picovoice' => 'hello@picovoice.ai' }
  s.source = { :git => "https://github.com/Picovoice/koala.git", :tag => s.version.to_s }
  s.ios.deployment_target = '16.0'
  s.swift_version = '5.0'
  s.vendored_frameworks = 'lib/ios/PvKoala.xcframework'
  s.resource_bundles = {
    'KoalaResources' => [
      'lib/common/koala_params.pv'
    ]
  }
  s.source_files = 'binding/ios/*.{swift}'
  s.exclude_files = 'binding/ios/KoalaAppTest/**'
end
