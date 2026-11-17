// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OttlineCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "OttlineCore", targets: ["OttlineCore"])
    ],
    targets: [
        .target(
            name: "OttlineCore",
            path: "Sources/OttlineCore",
            linkerSettings: [
                .linkedLibrary("sqlite3")
            ]
        )
    ]
)
