/*
    Copyright 2023-2025 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

#include <float.h>
#include <getopt.h>
#include <limits.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>

#if defined(_WIN32) || defined(_WIN64)

#include <windows.h>

#define UTF8_COMPOSITION_FLAG (0)
#define NULL_TERMINATED       (-1)

#else

#include <dlfcn.h>

#endif

#define DR_WAV_IMPLEMENTATION

#include "dr_wav.h"

#include "pv_koala.h"
#include "pv_recorder.h"

static void *open_dl(const char *dl_path) {

#if defined(_WIN32) || defined(_WIN64)

    return LoadLibrary(dl_path);

#else

    return dlopen(dl_path, RTLD_NOW);

#endif
}

static void *load_symbol(void *handle, const char *symbol) {

#if defined(_WIN32) || defined(_WIN64)

    return GetProcAddress((HMODULE) handle, symbol);

#else

    return dlsym(handle, symbol);

#endif
}

static void close_dl(void *handle) {

#if defined(_WIN32) || defined(_WIN64)

    FreeLibrary((HMODULE) handle);

#else

    dlclose(handle);

#endif
}

static void print_dl_error(const char *message) {

#if defined(_WIN32) || defined(_WIN64)

    fprintf(stderr, "%s with code '%lu'.\n", message, GetLastError());

#else

    fprintf(stderr, "%s with '%s'.\n", message, dlerror());

#endif
}

static volatile bool is_interrupted = false;

static struct option long_options[] = {
        {"access_key",              required_argument, NULL, 'a'},
        {"audio_device_index",      required_argument, NULL, 'd'},
        {"library_path",            required_argument, NULL, 'l'},
        {"model_path",              required_argument, NULL, 'm'},
        {"device",                  required_argument, NULL, 'y'},
        {"output_audio_path",       required_argument, NULL, 'o'},
        {"reference_audio_path",    no_argument,       NULL, 'r'},
        {"show_audio_devices",      no_argument,       NULL, 's'},
        {"show_inference_devices",  no_argument,       NULL, 'z'},
};

static void print_usage(const char *program_name) {
    fprintf(stdout,
            "Usage: %s -l LIBRARY_PATH [-m MODEL_PATH -a ACCESS_KEY -y DEVICE -d AUDIO_DEVICE_INDEX -o WAV_OUTPUT_PATH -r WAV_REFERENCE_PATH]\n"
            "        %s [-s, --show_audio_devices]\n"
            "        %s [-z, --show_inference_devices] -l LIBRARY_PATH\n",
            program_name,
            program_name,
            program_name);
}

static void print_error_message(char **message_stack, int32_t message_stack_depth) {
    for (int32_t i = 0; i < message_stack_depth; i++) {
        fprintf(stderr, "  [%d] %s\n", i, message_stack[i]);
    }
}

static void interrupt_handler(int _) {
    (void) _;
    is_interrupted = true;
}

static void show_audio_devices(void) {
    char **devices = NULL;
    int32_t count = 0;

    pv_recorder_status_t status = pv_recorder_get_available_devices(&count, &devices);
    if (status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to get audio devices with: %s.\n", pv_recorder_status_to_string(status));
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "Printing devices...\n");
    for (int32_t i = 0; i < count; i++) {
        fprintf(stdout, "index: %d, name: %s\n", i, devices[i]);
    }

    pv_recorder_free_available_devices(count, devices);
}

static void print_inference_devices(const char *library_path) {
    void *dl_handle = open_dl(library_path);
    if (!dl_handle) {
        fprintf(stderr, "Failed to open library at '%s'.\n", library_path);
        exit(EXIT_FAILURE);
    }

    const char *(*pv_status_to_string_func)(pv_status_t) = load_symbol(dl_handle, "pv_status_to_string");
    if (!pv_status_to_string_func) {
        print_dl_error("Failed to load 'pv_status_to_string'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_koala_list_hardware_devices_func)(char ***, int32_t *) =
    load_symbol(dl_handle, "pv_koala_list_hardware_devices");
    if (!pv_koala_list_hardware_devices_func) {
        print_dl_error("failed to load `pv_koala_list_hardware_devices`");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_koala_free_hardware_devices_func)(char **, int32_t) =
        load_symbol(dl_handle, "pv_koala_free_hardware_devices");
    if (!pv_koala_free_hardware_devices_func) {
        print_dl_error("failed to load `pv_koala_free_hardware_devices`");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_get_error_stack_func)(char ***, int32_t *) =
        load_symbol(dl_handle, "pv_get_error_stack");
    if (!pv_get_error_stack_func) {
        print_dl_error("failed to load 'pv_get_error_stack_func'");
        exit(EXIT_FAILURE);
    }

    void (*pv_free_error_stack_func)(char **) =
        load_symbol(dl_handle, "pv_free_error_stack");
    if (!pv_free_error_stack_func) {
        print_dl_error("failed to load 'pv_free_error_stack_func'");
        exit(EXIT_FAILURE);
    }

    char **message_stack = NULL;
    int32_t message_stack_depth = 0;
    pv_status_t error_status = PV_STATUS_RUNTIME_ERROR;

    char **hardware_devices = NULL;
    int32_t num_hardware_devices = 0;
    pv_status_t status = pv_koala_list_hardware_devices_func(&hardware_devices, &num_hardware_devices);
    if (status != PV_STATUS_SUCCESS) {
        fprintf(
                stderr,
                "Failed to list hardware devices with `%s`.\n",
                pv_status_to_string_func(status));
        error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
        if (error_status != PV_STATUS_SUCCESS) {
            fprintf(
                    stderr,
                    ".\nUnable to get Koala error state with '%s'.\n",
                    pv_status_to_string_func(error_status));
            exit(EXIT_FAILURE);
        }

        if (message_stack_depth > 0) {
            fprintf(stderr, ":\n");
            print_error_message(message_stack, message_stack_depth);
            pv_free_error_stack_func(message_stack);
        }
        exit(EXIT_FAILURE);
    }

    for (int32_t i = 0; i < num_hardware_devices; i++) {
        fprintf(stdout, "%s\n", hardware_devices[i]);
    }
    pv_koala_free_hardware_devices_func(hardware_devices, num_hardware_devices);
    close_dl(dl_handle);
}

static void print_vu_meter(const int16_t *pcm_buffer, int32_t num_samples) {
    float sum = 0;
    for (uint32_t i = 0; i < num_samples; i++) {
        sum += (float) pcm_buffer[i] * (float) pcm_buffer[i];
    }
    float volume_db = 10 * log10f((sum + FLT_EPSILON) / (float) num_samples / (float) (SHRT_MAX * SHRT_MAX));

    float volume = (volume_db + 45) / 45;
    volume = volume < 0 ? 0 : volume;
    int32_t percentage = (int32_t) roundf(volume * 100);
    int32_t bar_length = ((int32_t) roundf(volume * 20));
    int32_t empty_length = 20 - (bar_length);
    fprintf(stdout,
            "\r[%3d%%]%.*s%.*s|",
            percentage,
            bar_length,
            "####################",
            empty_length,
            "                    ");
    fflush(stdout);
}

int picovoice_main(int argc, char *argv[]) {
    signal(SIGINT, interrupt_handler);

    const char *access_key = NULL;
    const char *library_path = NULL;
    const char *output_path = NULL;
    const char *reference_path = NULL;
    const char *model_path = NULL;
    const char *device = NULL;
    bool show_inference_devices = false;
    int32_t device_index = -1;

    int c;
    while ((c = getopt_long(argc, argv, "hszl:a:y:d:o:m:r:", long_options, NULL)) != -1) {
        switch (c) {
            case 's':
                show_audio_devices();
                return 0;
            case 'l':
                library_path = optarg;
                break;
            case 'a':
                access_key = optarg;
                break;
            case 'o':
                output_path = optarg;
                break;
            case 'r':
                reference_path = optarg;
                break;
            case 'm':
                model_path = optarg;
                break;
            case 'd':
                device_index = (int32_t) strtol(optarg, NULL, 10);
                break;
            case 'y':
                device = optarg;
                break;
            case 'z':
                show_inference_devices = true;
                break;
            default:
                exit(EXIT_FAILURE);
        }
    }

    if (show_inference_devices) {
        if (!library_path) {
            fprintf(stderr, "`library_path` is required to view available inference devices.\n");
            print_usage(argv[0]);
            exit(EXIT_FAILURE);
        }

        print_inference_devices(library_path);
        return EXIT_SUCCESS;
    }

    if (!library_path || !access_key || !output_path || !model_path) {
        print_usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    if (device == NULL) {
        device = "best";
    }

    drwav_data_format format;
    format.container = drwav_container_riff;
    format.format = DR_WAVE_FORMAT_PCM;
    format.channels = 1;
    format.sampleRate = 16000;
    format.bitsPerSample = 16;

    drwav output_file;

#if defined(_WIN32) || defined(_WIN64)

    int output_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, output_path, NULL_TERMINATED, NULL, 0);
    wchar_t output_path_w[output_path_wchars_num];
    MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, output_path, NULL_TERMINATED, output_path_w, output_path_wchars_num);
    unsigned int drwav_init_file_status = drwav_init_file_write_w(&output_file, output_path_w, &format, NULL);

#else

    unsigned int drwav_init_file_status = drwav_init_file_write(&output_file, output_path, &format, NULL);

#endif

    if (!drwav_init_file_status) {
        fprintf(stderr, "Failed to open the output wav file at '%s'.", output_path);
        exit(EXIT_FAILURE);
    }

    drwav reference_file;

    if (reference_path) {

#if defined(_WIN32) || defined(_WIN64)

        int reference_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, reference_path, NULL_TERMINATED, NULL, 0);
        wchar_t reference_path_w[reference_path_wchars_num];
        MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, reference_path, NULL_TERMINATED, reference_path_w, reference_path_wchars_num);
        unsigned int drwav_init_file_status = drwav_init_file_write_w(&reference_file, reference_path_w, &format, NULL);

#else

        unsigned int drwav_init_file_status = drwav_init_file_write(&reference_file, reference_path, &format, NULL);

#endif

        if (!drwav_init_file_status) {
            fprintf(stderr, "Failed to open the reference wav file at '%s'.", reference_path);
            exit(EXIT_FAILURE);
        }
    }

    void *koala_library = open_dl(library_path);
    if (!koala_library) {
        fprintf(stderr, "Failed to open library at '%s'.\n", library_path);
        exit(EXIT_FAILURE);
    }

    const char *(*pv_status_to_string_func)(pv_status_t) = load_symbol(koala_library, "pv_status_to_string");
    if (!pv_status_to_string_func) {
        print_dl_error("Failed to load 'pv_status_to_string'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_sample_rate_func)() = load_symbol(koala_library, "pv_sample_rate");
    if (!pv_sample_rate_func) {
        print_dl_error("Failed to load 'pv_sample_rate'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_koala_init_func)(
            const char *,
            const char *,
            const char *,
            pv_koala_t **) = load_symbol(koala_library, "pv_koala_init");
    if (!pv_koala_init_func) {
        print_dl_error("Failed to load 'pv_koala_init'");
        exit(EXIT_FAILURE);
    }

    void (*pv_koala_delete_func)(pv_koala_t *) = load_symbol(koala_library, "pv_koala_delete");
    if (!pv_koala_delete_func) {
        print_dl_error("Failed to load 'pv_koala_delete'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_koala_process_func)(pv_koala_t *,
                                         const int16_t *,
                                         int16_t *) =
            load_symbol(koala_library, "pv_koala_process");
    if (!pv_koala_process_func) {
        print_dl_error("Failed to load 'pv_koala_process'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_koala_frame_length_func)() = load_symbol(koala_library, "pv_koala_frame_length");
    if (!pv_koala_frame_length_func) {
        print_dl_error("Failed to load 'pv_koala_frame_length'");
        exit(EXIT_FAILURE);
    }

    const char *(*pv_koala_version_func)() = load_symbol(koala_library, "pv_koala_version");
    if (!pv_koala_version_func) {
        print_dl_error("Failed to load 'pv_koala_version'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_get_error_stack_func)(char ***, int32_t *) = load_symbol(koala_library, "pv_get_error_stack");
    if (!pv_get_error_stack_func) {
        print_dl_error("Failed to load 'pv_get_error_stack'");
        exit(EXIT_FAILURE);
    }

    void (*pv_free_error_stack_func)(char **) = load_symbol(koala_library, "pv_free_error_stack");
    if (!pv_free_error_stack_func) {
        print_dl_error("Failed to load 'pv_free_error_stack'");
        exit(EXIT_FAILURE);
    }

    pv_koala_t *koala = NULL;
    pv_status_t koala_status = pv_koala_init_func(access_key, model_path, device, &koala);
    if (koala_status != PV_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to init with '%s'", pv_status_to_string_func(koala_status));
        char **message_stack = NULL;
        int32_t message_stack_depth = 0;
        pv_status_t error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
        if (error_status != PV_STATUS_SUCCESS) {
            fprintf(
                    stderr,
                    ".\nUnable to get Octopus error state with '%s'.\n",
                    pv_status_to_string_func(error_status));
            exit(EXIT_FAILURE);
        }

        if (message_stack_depth > 0) {
            fprintf(stderr, ":\n");
            print_error_message(message_stack, message_stack_depth);
            pv_free_error_stack_func(message_stack);
        }
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "V%s\n\n", pv_koala_version_func());

    const int32_t frame_length = pv_koala_frame_length_func();
    pv_recorder_t *recorder = NULL;
    pv_recorder_status_t recorder_status = pv_recorder_init(frame_length, device_index, 100, &recorder);
    if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to initialize device with %s.\n", pv_recorder_status_to_string(recorder_status));
        exit(EXIT_FAILURE);
    }

    const char *selected_device = pv_recorder_get_selected_device(recorder);
    fprintf(stdout, "Selected device: %s.\n", selected_device);

    fprintf(stdout, "Start recording (press Ctrl+C to stop)...\n");
    recorder_status = pv_recorder_start(recorder);
    if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to start device with %s.\n", pv_recorder_status_to_string(recorder_status));
        exit(EXIT_FAILURE);
    }

    int16_t *pcm = (int16_t *) malloc(frame_length * sizeof(int16_t));
    if (!pcm) {
        fprintf(stderr, "Failed to allocate pcm memory.\n");
        exit(EXIT_FAILURE);
    }

    int16_t *enhanced_pcm = (int16_t *) malloc(frame_length * sizeof(int16_t));
    if (!enhanced_pcm) {
        fprintf(stderr, "Failed to allocate enhanced_pcm memory.\n");
        exit(EXIT_FAILURE);
    }

    while (!is_interrupted) {
        recorder_status = pv_recorder_read(recorder, pcm);
        if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
            fprintf(stderr, "Failed to read with %s.\n", pv_recorder_status_to_string(recorder_status));
            exit(EXIT_FAILURE);
        }

        koala_status = pv_koala_process_func(koala, pcm, enhanced_pcm);
        if (koala_status != PV_STATUS_SUCCESS) {
            fprintf(stderr, "'pv_koala_process' failed with '%s'", pv_status_to_string_func(koala_status));
            char **message_stack = NULL;
            int32_t message_stack_depth = 0;
            pv_status_t error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
            if (error_status != PV_STATUS_SUCCESS) {
                fprintf(
                        stderr,
                        ".\nUnable to get Octopus error state with '%s'.\n",
                        pv_status_to_string_func(error_status));
                exit(EXIT_FAILURE);
            }

            if (message_stack_depth > 0) {
                fprintf(stderr, ":\n");
                print_error_message(message_stack, message_stack_depth);
                pv_free_error_stack_func(message_stack);
            }
            exit(EXIT_FAILURE);
        }

        if ((int32_t) drwav_write_pcm_frames(&output_file, frame_length, enhanced_pcm) != frame_length) {
            fprintf(stderr, "Failed to write to wav file.\n");
            exit(EXIT_FAILURE);
        }

        if (reference_path) {
            if ((int32_t) drwav_write_pcm_frames(&reference_file, frame_length, pcm) != frame_length) {
                fprintf(stderr, "Failed to write to reference wav file.\n");
                exit(EXIT_FAILURE);
            }
        }

        print_vu_meter(pcm, frame_length);
    }
    fprintf(stdout, "\n");

    recorder_status = pv_recorder_stop(recorder);
    if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to stop device with %s.\n", pv_recorder_status_to_string(recorder_status));
        exit(1);
    }

    free(pcm);
    free(enhanced_pcm);
    drwav_uninit(&output_file);
    if (reference_path) {
        drwav_uninit(&reference_file);
    }
    pv_recorder_delete(recorder);
    pv_koala_delete_func(koala);
    close_dl(koala_library);

    return EXIT_SUCCESS;
}

int main(int argc, char *argv[]) {

#if defined(_WIN32) || defined(_WIN64)

    LPWSTR *wargv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (wargv == NULL) {
        fprintf(stderr, "CommandLineToArgvW failed\n");
        exit(EXIT_FAILURE);
    }

    char *utf8_argv[argc];

    for (int i = 0; i < argc; ++i) {
        // WideCharToMultiByte: https://docs.microsoft.com/en-us/windows/win32/api/stringapiset/nf-stringapiset-widechartomultibyte
        int arg_chars_num = WideCharToMultiByte(CP_UTF8, UTF8_COMPOSITION_FLAG, wargv[i], NULL_TERMINATED, NULL, 0, NULL, NULL);
        utf8_argv[i] = (char *) malloc(arg_chars_num * sizeof(char));
        if (!utf8_argv[i]) {
            fprintf(stderr, "Failed to to allocate memory for converting args");
        }
        WideCharToMultiByte(CP_UTF8, UTF8_COMPOSITION_FLAG, wargv[i], NULL_TERMINATED, utf8_argv[i], arg_chars_num, NULL, NULL);
    }

    LocalFree(wargv);
    argv = utf8_argv;

#endif

    int result = picovoice_main(argc, argv);

#if defined(_WIN32) || defined(_WIN64)

    for (int i = 0; i < argc; ++i) {
        free(utf8_argv[i]);
    }

#endif

    return result;
}
