// swift-tools-version:5.3
import PackageDescription
let package = Package(
    name: "Koala-iOS",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "Koala",
            targets: ["Koala"]
        )
    ],
    targets: [
        .binaryTarget(
            name: "PvKoala",
            path: "lib/ios/PvKoala.xcframework"
        ),
        .target(
            name: "Koala",
            dependencies: ["PvKoala"],
            path: ".",
            exclude: [
                "binding/ios/KoalaAppTest",
                "demo"
            ],
            sources: [
                "binding/ios/Koala.swift",
                "binding/ios/KoalaErrors.swift"
            ],
            resources: [
               .copy("lib/common/koala_params.pv")
            ]
        )
    ]
)