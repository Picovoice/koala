//
//  Copyright 2023-2025 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import Foundation

import PvKoala

/// iOS binding for Koala Noise Suppression Engine. Provides a Swift interface to the Koala library.
public class Koala {

#if SWIFT_PACKAGE

    static let resourceBundle = Bundle.module

#else

    static let resourceBundle: Bundle = {
        let myBundle = Bundle(for: Koala.self)

        guard let resourceBundleURL = myBundle.url(
                forResource: "KoalaResources", withExtension: "bundle")
                else {
            fatalError("KoalaResources.bundle not found")
        }

        guard let resourceBundle = Bundle(url: resourceBundleURL)
                else {
            fatalError("Could not open KoalaResources.bundle")
        }

        return resourceBundle
    }()

#endif

    private var handle: OpaquePointer?

    /// The number of audio samples per frame.
    public static let frameLength = UInt32(pv_koala_frame_length())

    /// Audio sample rate accepted by Koala.
    public static let sampleRate = UInt32(pv_sample_rate())

    /// Current Koala version.
    public static let version = String(cString: pv_koala_version())

    ///  Delay in samples. If the input and output of consecutive calls to `.process()` are viewed as two contiguous
    ///  streams of audio data, this delay specifies the time shift between the input and output stream.
    public var delaySample: UInt32 = 0

    private static var sdk = "ios"

    public static func setSdk(sdk: String) {
        self.sdk = sdk
    }

    /// Lists all available devices that Koala can use for inference.
    /// Entries in the list can be used as the `device` argument when initializing Koala.
    ///
    /// - Throws: KoalaError
    /// - Returns: Array of available devices that Koala can be used for inference.
    public static func getAvailableDevices() throws -> [String] {
        var cHardwareDevices: UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>?
        var numHardwareDevices: Int32 = 0
        let status = pv_koala_list_hardware_devices(&cHardwareDevices, &numHardwareDevices)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try getMessageStack()
            throw pvStatusToKoalaError(status, "Koala getAvailableDevices failed", messageStack)
        }

        var hardwareDevices: [String] = []
        for i in 0..<numHardwareDevices {
            hardwareDevices.append(String(cString: cHardwareDevices!.advanced(by: Int(i)).pointee!))
        }

        pv_koala_free_hardware_devices(cHardwareDevices, numHardwareDevices)

        return hardwareDevices
    }

    /// Constructor.
    ///
    /// - Parameters:
    ///   - accessKey: The AccessKey obtained from Picovoice Console (https://console.picovoice.ai).
    ///   - modelPath: Absolute path to file containing model parameters.
    ///   - device: String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
    ///     suitable device is selected automatically. If set to `gpu`, the engine uses the first available
    ///     GPU device. To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}`
    ///     is the index of the target GPU. If set to `cpu`, the engine will run on the CPU with the default
    ///     number of threads. To specify the number of threads, set this argument to `cpu:${NUM_THREADS}`,
    ///     where `${NUM_THREADS}` is the desired number of threads.
    /// - Throws: KoalaError
    public init(
            accessKey: String,
            modelPath: String? = nil,
            device: String? = nil) throws {

        if accessKey.count == 0 {
            throw KoalaInvalidArgumentError("AccessKey is required for Koala initialization")
        }

        var modelPathArg = modelPath
        if modelPathArg == nil {
            modelPathArg = Koala.resourceBundle.path(forResource: "koala_params", ofType: "pv")
            if modelPathArg == nil {
                throw KoalaIOError("Could not find default model file in app bundle.")
            }
        }

        if !FileManager().fileExists(atPath: modelPathArg!) {
            modelPathArg = try getResourcePath(modelPathArg!)
        }

        var deviceArg = device
        if deviceArg == nil {
            deviceArg = "cpu:1"
        }

        pv_set_sdk(Koala.sdk)

        var status = pv_koala_init(
                accessKey,
                modelPathArg,
                deviceArg,
                &self.handle)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try getMessageStack()
            throw pvStatusToKoalaError(status, "Koala init failed", messageStack)
        }

        var cDelaySample: Int32 = 0
        status = pv_koala_delay_sample(self.handle, &cDelaySample)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try getMessageStack()
            throw pvStatusToKoalaError(status, "Failed to get Koala delay sample", messageStack)
        }
        self.delaySample = UInt32(cDelaySample)
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
    ///      must provide consecutive frames of audio from the same source, unless `.reset()` has
    ///      been called in between.
    /// - Throws: KoalaError
    /// - Returns: A frame of enhanced audio samples, stored as a sequence of 16-bit
    ///        linearly-encoded integers. The output is not directly the enhanced version
    ///        of the input PCM, but corresponds to samples that were given in previous
    ///        calls to `.process()`. The delay in samples between the start time of the
    ///        input frame and the start time of the output frame can be attained from
    ///        `.delaySample` instance property.
    public func process(_ pcm: [Int16]) throws -> [Int16] {
        if handle == nil {
            throw KoalaInvalidStateError("Koala must be initialized before processing")
        }

        if pcm.count != Koala.frameLength {
            throw KoalaInvalidArgumentError(
                "Frame of audio data must contain \(Koala.frameLength) samples - given frame contained \(pcm.count)"
            )
        }

        var enhancedPcm = [Int16](repeating: 0, count: Int(Koala.frameLength))
        let status = pv_koala_process(self.handle, pcm, &enhancedPcm[0])
        if status != PV_STATUS_SUCCESS {
            let messageStack = try getMessageStack()
            throw pvStatusToKoalaError(status, "Koala process failed", messageStack)
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
            let messageStack = try getMessageStack()
            throw pvStatusToKoalaError(status, "Koala process failed", messageStack)
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
            if FileManager.default.fileExists(atPath: resourcePath) {
                return resourcePath
            }
        }

        throw KoalaIOError("""
                           Could not find file at path '\(filePath)'.
                           If this is a packaged asset, ensure you have added it to your xcode project.
                           """)
    }

    private func pvStatusToKoalaError(
        _ status: pv_status_t,
        _ message: String,
        _ messageStack: [String] = []) -> KoalaError {
        switch status {
        case PV_STATUS_OUT_OF_MEMORY:
            return KoalaMemoryError(message, messageStack)
        case PV_STATUS_IO_ERROR:
            return KoalaIOError(message, messageStack)
        case PV_STATUS_INVALID_ARGUMENT:
            return KoalaInvalidArgumentError(message, messageStack)
        case PV_STATUS_STOP_ITERATION:
            return KoalaStopIterationError(message, messageStack)
        case PV_STATUS_KEY_ERROR:
            return KoalaKeyError(message, messageStack)
        case PV_STATUS_INVALID_STATE:
            return KoalaInvalidStateError(message, messageStack)
        case PV_STATUS_RUNTIME_ERROR:
            return KoalaRuntimeError(message, messageStack)
        case PV_STATUS_ACTIVATION_ERROR:
            return KoalaActivationError(message, messageStack)
        case PV_STATUS_ACTIVATION_LIMIT_REACHED:
            return KoalaActivationLimitError(message, messageStack)
        case PV_STATUS_ACTIVATION_THROTTLED:
            return KoalaActivationThrottledError(message, messageStack)
        case PV_STATUS_ACTIVATION_REFUSED:
            return KoalaActivationRefusedError(message, messageStack)
        default:
            let pvStatusString = String(cString: pv_status_to_string(status))
            return KoalaError("\(pvStatusString): \(message)", messageStack)
        }
    }

    private func getMessageStack() throws -> [String] {
        var messageStackRef: UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>?
        var messageStackDepth: Int32 = 0
        let status = pv_get_error_stack(&messageStackRef, &messageStackDepth)
        if status != PV_STATUS_SUCCESS {
            throw pvStatusToKoalaError(status, "Unable to get Koala error state")
        }

        var messageStack: [String] = []
        for i in 0..<messageStackDepth {
            messageStack.append(String(cString: messageStackRef!.advanced(by: Int(i)).pointee!))
        }

        pv_free_error_stack(messageStackRef)

        return messageStack
    }
}
