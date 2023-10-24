// swift-tools-version: 5.7.1

import PackageDescription

let package = Package(
    name: "koala",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v16),
        .watchOS(.v9),
        .macOS(.v13),
    ],
    products: [
        .library(
            name: "koala",
            targets: ["Koala"]),
    ],
    dependencies: [
    ],
    targets: [
        .target(
            name: "Koala",
            dependencies: [
                "PvKoala"
            ],
            path: "binding/ios",
            exclude: [
                "KoalaAppTest"
            ]),
        .binaryTarget(name: "PvKoala", path: "lib/ios/PvKoala.xcframework"),
    ]
)