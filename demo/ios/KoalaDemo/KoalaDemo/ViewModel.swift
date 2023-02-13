//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import AVFoundation
import Foundation

import Koala
import ios_voice_processor

enum UIState {
    case INIT
    case RECORD
    case TEST
}

class ViewModel: ObservableObject {

    private let ACCESS_KEY = "${YOUR_ACCESS_KEY_HERE}" // Obtained from Picovoice Console (https://console.picovoice.ai)

    private let AUDIO_FORMAT = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: Double(Koala.sampleRate), channels: 1, interleaved: true)!

    private var koala: Koala!

    private var recordingTimer = Timer()
    private var samplesWritten = 0
    private var currentSliderVal = 1.0

    private var refFileUrl: URL?
    private var refFile: AVAudioFile?
    private var refPlayer: AVAudioPlayer?
    private var enhancedFileUrl: URL?
    private var enhancedFile: AVAudioFile?
    private var enhancedPlayer: AVAudioPlayer?

    @Published var errorMessage = ""
    @Published var recordingTimeSec = 0.0
    @Published var sliderVal = 0
    @Published var isRecording = false
    @Published var isPlaying = false
    @Published var state = UIState.INIT

    init() {
        initialize()
    }

    public func initialize() {
        state = UIState.INIT

        do {
            try koala = Koala(accessKey: ACCESS_KEY)

            let outputDir = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
            refFileUrl = outputDir.appendingPathComponent("ref.wav")
            enhancedFileUrl = outputDir.appendingPathComponent("enhanced.wav")

            state = UIState.RECORD
        } catch let error as KoalaInvalidArgumentError {
            errorMessage = "\(error.localizedDescription)\nEnsure your AccessKey '\(ACCESS_KEY)' is valid."
        } catch is KoalaActivationError {
            errorMessage = "ACCESS_KEY activation error"
        } catch is KoalaActivationRefusedError {
            errorMessage = "ACCESS_KEY activation refused"
        } catch is KoalaActivationLimitError {
            errorMessage = "ACCESS_KEY reached its limit"
        } catch is KoalaActivationThrottledError {
            errorMessage = "ACCESS_KEY is throttled"
        } catch {
            errorMessage = "\(error)"
        }
    }

    public func destroy() {
        if isRecording {
            recordingOff()
        }
        if isPlaying {
            playbackOff()
        }
        refFile = nil
        refPlayer = nil
        enhancedFile = nil
        enhancedPlayer = nil
        koala.delete()
    }

    public func onSliderChange(newValue: Double) {
        currentSliderVal = newValue
        refPlayer?.setVolume(Float(1.0 - currentSliderVal), fadeDuration: 0.05)
        enhancedPlayer?.setVolume(Float(currentSliderVal), fadeDuration: 0.05)
    }

    public func toggleRecording() {
        if isRecording {
            recordingOff()
        } else {
            recordingOn()
        }
    }

    public func recordingOff() {
        recordingTimer.invalidate()
        VoiceProcessor.shared.stop()

        cleanupRecording()
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(
                    AVAudioSession.Category.playback
            )
            try audioSession.setActive(true)

            refPlayer = try AVAudioPlayer(contentsOf: refFileUrl!)
            refPlayer?.setVolume(Float(1.0 - currentSliderVal), fadeDuration: 0.05)
            refPlayer?.numberOfLoops = -1
            refPlayer?.prepareToPlay()

            enhancedPlayer = try AVAudioPlayer(contentsOf: enhancedFileUrl!)
            enhancedPlayer?.setVolume(Float(currentSliderVal), fadeDuration: 0.05)
            enhancedPlayer?.numberOfLoops = -1
            enhancedPlayer?.prepareToPlay()
        } catch {
            errorMessage = "\(error)"
        }

        state = UIState.TEST
        isRecording = false
    }

    public func recordingOn() {
        if (isPlaying) {
            refPlayer?.stop()
            enhancedPlayer?.stop()
            isPlaying = false
        }
        refPlayer = nil
        enhancedPlayer = nil

        samplesWritten = 0
        refFile = openOutputWav(fileUrl: refFileUrl!)
        enhancedFile = openOutputWav(fileUrl: enhancedFileUrl!)

        recordingTimeSec = 0
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            self.recordingTimeSec += 0.1
        }

        do {
            try koala.reset()
            
            guard try VoiceProcessor.shared.hasPermissions() else {
                errorMessage = "Microphone permissions denied"
                return
            }

            try VoiceProcessor.shared.start(
                    frameLength: Koala.frameLength,
                    sampleRate: Koala.sampleRate,
                    audioCallback: audioCallback
            )

            state = UIState.RECORD
            isRecording = true
        } catch {
            errorMessage = "\(error.localizedDescription)"
        }
    }

    public func togglePlayback() {
        if isPlaying {
            playbackOff()
        } else {
            playbackOn()
        }
    }

    public func playbackOff() {
        refPlayer?.pause()
        refPlayer?.currentTime = 0
        enhancedPlayer?.pause()
        enhancedPlayer?.currentTime = 0
        isPlaying = false
    }

    public func playbackOn() {
        let timeOffset = refPlayer!.deviceCurrentTime + 0.01
        refPlayer?.play(atTime: timeOffset)
        enhancedPlayer?.play(atTime: timeOffset)
        isPlaying = true
    }

    private func audioCallback(pcm: [Int16]) {
        guard koala != nil else {
            return
        }

        do {
            writePcmToWav(pcm: pcm, audioFile: refFile)
            samplesWritten += pcm.count

            var enhancedPcm = try koala!.process(pcm)

            // Koala's output is delayed by a certain number of samples
            // this ensures the original recording and the Koala-processed recording are aligned
            if samplesWritten > koala.delaySample {
                let sampleDiff = samplesWritten - Int(koala.delaySample)
                if sampleDiff < Koala.frameLength {
                    let startSample = Int(Koala.frameLength) - sampleDiff
                    enhancedPcm = Array(enhancedPcm[startSample..<startSample + sampleDiff])
                }
                writePcmToWav(pcm: enhancedPcm, audioFile: enhancedFile)
            }
        } catch {
            errorMessage = "\(error.localizedDescription)"
        }
    }

    private func cleanupRecording() {

        // Koala's output is delayed by a certain number of samples
        // passing empty frames to Koala at the end aligns the two recordings
        let padFrame = [Int16](repeating: 0, count: Int(Koala.frameLength))
        var padSamplesToWrite = Int(koala.delaySample)

        do {
            while padSamplesToWrite > 0 {
                var procFrame = try koala!.process(padFrame)
                if padSamplesToWrite < Koala.frameLength {
                    procFrame = Array(procFrame[0..<padSamplesToWrite])
                }
                writePcmToWav(pcm: procFrame, audioFile: enhancedFile)
                padSamplesToWrite -= Int(Koala.frameLength)
            }
        } catch {
            errorMessage = "\(error)"
        }

        refFile = nil
        enhancedFile = nil
    }

    private func openOutputWav(fileUrl: URL) -> AVAudioFile? {
        do {
            if FileManager.default.fileExists(atPath: fileUrl.path) {
                try FileManager.default.removeItem(at: fileUrl)
            }
            return try AVAudioFile(forWriting: fileUrl, settings: AUDIO_FORMAT.settings, commonFormat: .pcmFormatInt16, interleaved: true)
        } catch {
            errorMessage = "\(error)"
            return nil
        }
    }

    private func writePcmToWav(pcm: [Int16], audioFile: AVAudioFile?) {
        let writeBuffer = AVAudioPCMBuffer(pcmFormat: AUDIO_FORMAT, frameCapacity: AVAudioFrameCount(pcm.count))!
        memcpy(writeBuffer.int16ChannelData![0], pcm, pcm.count * 2)
        writeBuffer.frameLength = UInt32(pcm.count)

        do {
            try audioFile?.write(from: writeBuffer)
        } catch {
            errorMessage = "\(error)"
        }

    }
}
