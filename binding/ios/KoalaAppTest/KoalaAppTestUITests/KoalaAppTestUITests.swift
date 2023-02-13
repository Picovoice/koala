//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import AVFoundation
import XCTest
import Koala

class KoalaDemoUITests: XCTestCase {
    let accessKey: String = "{TESTING_ACCESS_KEY_HERE}"

    let testAudioUrl = Bundle(for: KoalaDemoUITests.self).url(forResource: "test", withExtension: "wav")!
    let noiseAudioUrl = Bundle(for: KoalaDemoUITests.self).url(forResource: "noise", withExtension: "wav")!

    var koala: Koala?

    override func setUp() {
        super.setUp()
    }

    override func tearDown() {
        if koala != nil {
            koala!.delete()
            koala = nil
        }
        super.tearDown()
    }

    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    func pcmRootMeanSquare(pcm: [Int16]) -> Float {
        var sumOfSquares: Float = 0
        for x in pcm {
            sumOfSquares += pow(Float(x) / Float(Int16.max), 2)
        }
        return sqrtf(sumOfSquares / Float(pcm.count))
    }

    func getPcm(fileUrl: URL) throws -> [Int16] {
        let data = try Data(contentsOf: fileUrl)
        var pcm = [Int16](repeating: 0, count: data.count / 2)

        _ = pcm.withUnsafeMutableBytes {
            data.copyBytes(to: $0, from: 44..<data.count)
        }
        return pcm
    }

    func runTest(inputPcm: [Int16], refPcm: [Int16]? = nil, tolerance: Float = 0.02) throws -> Void {

        try koala!.reset()

        let frameLength = Int(Koala.frameLength)
        for frameStart in stride(from: 0, to: inputPcm.count - frameLength + 1, by: frameLength) {
            let inputFrame = Array(inputPcm[frameStart..<frameStart + frameLength])
            let enhancedFrame = try koala!.process(inputFrame)

            let frameEnergy: Float = pcmRootMeanSquare(pcm: enhancedFrame)
            var energyDeviation: Float
            if refPcm == nil || frameStart < koala!.delaySample {
                energyDeviation = frameEnergy
            } else {
                let refStart = frameStart - Int(koala!.delaySample)
                let referenceFrame = refPcm![refStart..<refStart + frameLength]
                energyDeviation = abs(frameEnergy - pcmRootMeanSquare(pcm: Array(referenceFrame)))
            }

            XCTAssertLessThan(energyDeviation, tolerance)
        }
    }

    func testPureSpeech() throws {
        let testPcm = try getPcm(fileUrl: testAudioUrl)

        koala = try Koala(accessKey: accessKey)
        try runTest(inputPcm: testPcm, refPcm: testPcm)
    }

    func testPureNoise() throws {
        let noisePcm = try getPcm(fileUrl: noiseAudioUrl)

        koala = try Koala(accessKey: accessKey)
        try runTest(inputPcm: noisePcm)
    }

    func testMixed() throws {
        let testPcm = try getPcm(fileUrl: testAudioUrl)
        let noisePcm = try getPcm(fileUrl: noiseAudioUrl)
        let mixPcm: [Int16] = zip(testPcm, noisePcm).map(+)

        koala = try Koala(accessKey: accessKey)
        try runTest(inputPcm: mixPcm, refPcm: testPcm)
    }

    func testReset() throws {
        let testPcm = try getPcm(fileUrl: testAudioUrl)

        koala = try Koala(accessKey: accessKey)
        try koala!.reset()

        let frameLength = Int(Koala.frameLength)
        var firstFrames: [Int16] = []
        for frameStart in stride(from: 0, to: testPcm.count - frameLength + 1, by: frameLength) {
            let inputFrame = Array(testPcm[frameStart..<frameStart + frameLength])
            firstFrames.append(contentsOf: try koala!.process(inputFrame))
        }

        try koala!.reset()
        var secondFrames: [Int16] = []
        for frameStart in stride(from: 0, to: testPcm.count - frameLength + 1, by: frameLength) {
            let inputFrame = Array(testPcm[frameStart..<frameStart + frameLength])
            secondFrames.append(contentsOf: try koala!.process(inputFrame))
        }

        XCTAssertEqual(firstFrames.count, secondFrames.count)
        for (x, y) in zip(firstFrames, secondFrames) {
            XCTAssertEqual(x, y)
        }
    }

    func testDelaySample() throws {
        koala = try Koala(accessKey: accessKey)
        XCTAssertGreaterThan(koala!.delaySample, 0)
    }

    func testFrameLength() throws {
        XCTAssertGreaterThan(Koala.frameLength, 0)
    }

    func testSampleRate() throws {
        XCTAssertGreaterThan(Koala.sampleRate, 0)
    }

    func testVersion() throws {
        XCTAssertGreaterThan(Koala.version, "")
    }
}
