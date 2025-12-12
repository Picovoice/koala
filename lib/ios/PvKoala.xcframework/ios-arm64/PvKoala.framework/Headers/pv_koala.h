/*
    Copyright 2023-2025 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

#ifndef PV_KOALA_H
#define PV_KOALA_H

#include <stdint.h>

#include "picovoice.h"

#ifdef __cplusplus

extern "C" {

#endif


/**
 * Forward declaration for Koala noise suppression engine. It enhances an incoming stream of audio in real-time by
 * preserving speech signals and suppressing noise signals. It processes incoming audio in consecutive frames
 * and returns a frame of output audio of the same length, but with a delay of a fixed number of samples. Hence the
 * output of `pv_koala_process` will correspond to samples of audio that were passed to prior calls to that function.
 * The length of the delay in samples can be obtained from `pv_koala_delay_sample()`. The number of samples per frame
 * can be attained by calling `pv_koala_frame_length()`. The incoming audio needs to have a sample rate equal to
 * `pv_sample_rate()` and be 16-bit linearly-encoded. Koala operates on single-channel audio.
 */
typedef struct pv_koala pv_koala_t;

/**
 * Constructor.
 *
 * @param access_key AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
 * @param model_path Absolute path to the file containing model parameters.
 * @param device String representation of the device (e.g., CPU or GPU) to use for inference. If set to `best`, the most
 * suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device.
 * To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the
 * target GPU. If set to `cpu`, the engine will run on the CPU with the default number of threads. To specify the
 * number of threads, set this argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the desired number of threads.
 * @param[out] object Constructed instance of Koala.
 * @return Status code. Returns `PV_STATUS_INVALID_ARGUMENT` or `PV_STATUS_OUT_OF_MEMORY`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_koala_init(
        const char *access_key,
        const char *model_path,
        const char *device,
        pv_koala_t **object);

/**
 * Destructor.
 *
 * @param object The Koala object.
 */
PV_API void pv_koala_delete(pv_koala_t *object);

/**
 * Processes a frame of the incoming audio stream and returns a frame of enhanced audio. The output is not necessarily
 * in sync with the input frame; instead, the output audio will contain the enhancement result for audio that has been
 * passed to previous calls of this function. The total delay in samples can be obtained by `pv_koala_delay_sample()`.
 *
 * @param object The Koala object.
 * @param pcm A frame of audio samples. The number of samples per frame can be attained by calling
 * `pv_koala_frame_length()`. The incoming audio needs to have a sample rate equal to `pv_sample_rate()` and be 16-bit
 * linearly-encoded. Koala operates on single-channel audio.
 * @param[out] enhanced_pcm The output frame of audio. Needs to point to an allocated block of memory of the same size
 * as the `pcm` input argument.
 * @return Status code. Returns `PV_STATUS_INVALID_ARGUMENT` or `PV_STATUS_OUT_OF_MEMORY`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_koala_process(pv_koala_t *object, const int16_t *pcm, int16_t *enhanced_pcm);

/**
 * Finalizes the enhancement process and resets the internal state of the Koala object. Subsequent calls to
 * `pv_koala_process` will not return any delayed samples from previous calls; that data will be lost. Instead, the
 * result will be the same as if the Koala object were newly created.
 *
 * @param object The Koala object.
 * @return Returns `PV_STATUS_INVALID_ARGUMENT` on failure.
 */
PV_API pv_status_t pv_koala_reset(pv_koala_t *object);

/**
 * Getter for the delay in samples. If the input and output of sequential calls to `pv_koala_process` are viewed as two
 * contiguous streams of audio data, this delay specifies the time shift between the input and output stream.
 *
 * @param object The koala object.
 * @param[out] delay_sample The delay in samples.
 * @return Returns `PV_STATUS_INVALID_ARGUMENT` on failure.
 */
PV_API pv_status_t pv_koala_delay_sample(const pv_koala_t *object, int32_t *delay_sample);

/**
 * Getter for the number of audio samples per frame.
 *
 * @return Frame length.
 */
PV_API int32_t pv_koala_frame_length(void);

/**
 * Getter for version.
 *
 * @return Version.
 */
PV_API const char *pv_koala_version(void);

/**
 * Gets a list of hardware devices that can be specified when calling `pv_koala_init`
 *
 * @param[out] hardware_devices Array of available hardware devices. Devices are NULL terminated strings.
 *                              The array must be freed using `pv_koala_free_hardware_devices`.
 * @param[out] num_hardware_devices The number of devices in the `hardware_devices` array.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`, `PV_STATUS_INVALID_STATE`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_koala_list_hardware_devices(
        char ***hardware_devices,
        int32_t *num_hardware_devices);

/**
 * Frees memory allocated by `pv_koala_list_hardware_devices`.
 *
 * @param[out] hardware_devices Array of available hardware devices allocated by `pv_koala_list_hardware_devices`.
 * @param[out] num_hardware_devices The number of devices in the `hardware_devices` array.
 */
PV_API void pv_koala_free_hardware_devices(
        char **hardware_devices,
        int32_t num_hardware_devices);

#ifdef __cplusplus

}

#endif

#endif // PV_KOALA_H
