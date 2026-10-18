// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SaldoZero",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // Um projeto xtool tem exatamente um produto de biblioteca: o app.
        .library(
            name: "SaldoZero",
            targets: ["SaldoZero"]
        ),
    ],
    targets: [
        .target(
            name: "SaldoZero",
            resources: [
                .copy("Resources/web"),
            ]
        ),
    ],
    swiftLanguageModes: [.v5]
)
