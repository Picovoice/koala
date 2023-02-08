//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import PvKoala

/// iOS binding for Koala Noise Suppression Engine. Provides a Swift interface to the Koala library.
public class Koala {

    private var handle: OpaquePointer?

    /// The number of audio samples per frame.
    public static let frameLength = UInt32(pv_koala_frame_length())

    /// Audio sample rate accepted by Koala.
    public static let sampleRate = UInt32(pv_sample_rate())

    /// Current Koala version.
    public static let version = String(cString: pv_koala_version())

    ///  Delay in samples. If the input and output of consecutive calls to `.process()` are viewed as two contiguous
    ///  streams of audio data, this delay specifies the time shift between the input and output stream.
    public var delaySample: UInt32

    /// Constructor.
    ///
    /// - Parameters:
    ///   - accessKey: The AccessKey obtained from Picovoice Console (https://console.picovoice.ai).
    ///   - modelPath: Absolute path to file containing model parameters.
    /// - Throws: KoalaError
    public init(
            accessKey: String,
            modelPath: String) throws {

        if accessKey.count == 0 {
            throw KoalaInvalidArgumentError("AccessKey is required for Koala initialization")
        }

        var modelPathArg = modelPath
        if !FileManager().fileExists(atPath: modelPathArg) {
            modelPathArg = try getResourcePath(modelPathArg)
        }

        var status = pv_koala_init(
                accessKey,
                modelPathArg,
                &self.handle)
        if status != PV_STATUS_SUCCESS {
            throw pvStatusToKoalaError(status, "Koala init failed")
        }

        status = pv_koala_delay_sample(self.handle, &delaySample)
        if status != PV_STATUS_SUCCESS {
            throw pvStatusToKoalaError(status, "Failed to get Koala delay sample")
        }
    }

    deinit {
        self.delete()
    }

    /// Constructor.
    ///
    /// - Parameters:
    ///   - accessKey: The AccessKey obtained from Picovoice Console (https://console.picovoice.ai).
    ///   - modelURL: URL to file containing model parameters.
    /// - Throws: KoalaError
    public convenience init(
            accessKey: String,
            modelURL: URL) throws {
        try self.init(
                accessKey: accessKey,
                modelPath: modelURL.path)
    }

    /// Releases native resources that were allocated to Koala
    public func delete() {
        if handle != nil {
            pv_koala_delete(handle)
            handle = nil
        }
    }

    /// Processes a frame of audio and returns a frame of delayed enhanced audio.
    ///
    /// - Parameters:
    ///   - pcm: A frame of audio samples. The number of samples per frame can be attained by calling
    ///     `Koala.frameLength`. The incoming audio needs to have a sample rate equal to `Koala.sampleRate`
    ///      and be 16-bit linearly-encoded. Koala operates on single-channel audio. Consecutive calls to `.process()`
    ///      must provide consecutive frames of audio from the same source, unless `.reset()` has been called in between.
    /// - Throws: KoalaError
    /// - Returns: A frame of enhanced audio samples, stored as a sequence of 16-bit linearly-encoded integers.
    ///        The output is not directly the enhanced version of the input PCM, but corresponds to samples that were given in
    ///        previous calls to `.process()`. The delay in samples between the start time of the input frame and the start
    ///        time of the output frame can be attained from `.delaySample` instance property.
    public func process(_ pcm: [Int16]) throws -> [Int16] {
        if handle == nil {
            throw KoalaInvalidStateError("Koala must be initialized before processing")
        }

        if pcm.count != Koala.frameLength {
            throw KoalaInvalidArgumentError("Frame of audio data must contain \(Koala.frameLength) samples - given frame contained \(pcm.count)")
        }

        var enhancedPcm: [Int16] = [Koala.frameLength]
        let status = pv_koala_process(self.handle, pcm, enhancedPcm)
        if status != PV_STATUS_SUCCESS {
            throw pvStatusToKoalaError(status, "Koala process failed")
        }

        return enhancedPcm
    }

    /// Resets Koala into a state as if it had just been newly created.
    /// Call this function in between calls to `process` that do not provide consecutive frames of audio.
    ///
    /// - Throws: KoalaError
    public func reset() throws {
        if handle == nil {
            throw KoalaInvalidStateError("Koala must be initialized before processing")
        }

        let status = pv_koala_reset(self.handle)
        if status != PV_STATUS_SUCCESS {
            throw pvStatusToKoalaError(status, "Koala process failed")
        }
    }

    /// Given a path, return the full path to the resource.
    ///
    /// - Parameters:
    ///   - filePath: relative path of a file in the bundle.
    /// - Throws: KoalaIOError
    /// - Returns: The full path of the resource.
    private func getResourcePath(_ filePath: String) throws -> String {
        if let resourcePath = Bundle(for: type(of: self)).resourceURL?.appendingPathComponent(filePath).path {
            if (FileManager.default.fileExists(atPath: resourcePath)) {
                return resourcePath
            }
        }

        throw KoalaIOError("""
                           Could not find file at path '\(filePath)'. 
                           If this is a packaged asset, ensure you have added it to your xcode project.
                           """)
    }

    private func pvStatusToKoalaError(_ status: pv_status_t, _ message: String) -> KoalaError {
        switch status {
        case PV_STATUS_OUT_OF_MEMORY:
            return KoalaMemoryError(message)
        case PV_STATUS_IO_ERROR:
            return KoalaIOError(message)
        case PV_STATUS_INVALID_ARGUMENT:
            return KoalaInvalidArgumentError(message)
        case PV_STATUS_STOP_ITERATION:
            return KoalaStopIterationError(message)
        case PV_STATUS_KEY_ERROR:
            return KoalaKeyError(message)
        case PV_STATUS_INVALID_STATE:
            return KoalaInvalidStateError(message)
        case PV_STATUS_RUNTIME_ERROR:
            return KoalaRuntimeError(message)
        case PV_STATUS_ACTIVATION_ERROR:
            return KoalaActivationError(message)
        case PV_STATUS_ACTIVATION_LIMIT_REACHED:
            return KoalaActivationLimitError(message)
        case PV_STATUS_ACTIVATION_THROTTLED:
            return KoalaActivationThrottledError(message)
        case PV_STATUS_ACTIVATION_REFUSED:
            return KoalaActivationRefusedError(message)
        default:
            let pvStatusString = String(cString: pv_status_to_string(status))
            return KoalaError("\(pvStatusString): \(message)")
        }
    }
}
