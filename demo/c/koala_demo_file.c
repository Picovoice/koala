/*
    Copyright 2023 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.
    
    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

#include <getopt.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/time.h>

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

static struct option long_options[] = {
        {"access_key",   required_argument, NULL, 'a'},
        {"library_path", required_argument, NULL, 'l'},
        {"model_path",   required_argument, NULL, 'm'},
        {"input_path",   required_argument, NULL, 'i'},
        {"output_path",  required_argument, NULL, 'o'},
};

static void print_usage(const char *program_name) {
    fprintf(
            stdout,
            "Usage: %s [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY -i INPUT_PATH -o OUTPUT_PATH]\n",
            program_name);
}

static void print_error_message(char **message_stack, int32_t message_stack_depth) {
    for (int32_t i = 0; i < message_stack_depth; i++) {
        fprintf(stderr, "  [%d] %s\n", i, message_stack[i]);
    }
}

static void print_progress_bar(size_t num_total_samples, size_t num_processed_samples) {
    float ratio = (float) num_processed_samples / (float) num_total_samples;
    int32_t percentage = (int32_t) roundf(ratio * 100);
    int32_t bar_length = ((int32_t) roundf(ratio * 20));
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
    const char *library_path = NULL;
    const char *model_path = NULL;
    const char *access_key = NULL;
    const char *input_path = NULL;
    const char *output_path = NULL;

    int c;
    while ((c = getopt_long(argc, argv, "l:m:a:i:o:", long_options, NULL)) != -1) {
        switch (c) {
            case 'l':
                library_path = optarg;
                break;
            case 'm':
                model_path = optarg;
                break;
            case 'a':
                access_key = optarg;
                break;
            case 'i':
                input_path = optarg;
                break;
            case 'o':
                output_path = optarg;
                break;
            default:
                exit(EXIT_FAILURE);
        }
    }

    if (!library_path || !access_key || !input_path || !output_path) {
        print_usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    void *koala_library = open_dl(library_path);
    if (!koala_library) {
        fprintf(stderr, "Failed to open library at '%s'.\n", library_path);
        exit(EXIT_FAILURE);
    }

    const char *(*pv_status_to_string_func)(pv_status_t) =
            load_symbol(koala_library, "pv_status_to_string");
    if (!pv_status_to_string_func) {
        print_dl_error("Failed to load 'pv_status_to_string'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_sample_rate_func)() = load_symbol(koala_library, "pv_sample_rate");
    if (!pv_sample_rate_func) {
        print_dl_error("Failed to load 'pv_sample_rate'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_koala_init_func)(const char *, const char *, pv_koala_t **) =
            load_symbol(koala_library, "pv_koala_init");
    if (!pv_koala_init_func) {
        print_dl_error("Failed to load 'pv_koala_init'");
        exit(EXIT_FAILURE);
    }

    void (*pv_koala_delete_func)(pv_koala_t *) = load_symbol(koala_library, "pv_koala_delete");
    if (!pv_koala_delete_func) {
        print_dl_error("Failed to load 'pv_koala_delete'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_koala_process_func)(pv_koala_t *, const int16_t *, int16_t *) =
            load_symbol(koala_library, "pv_koala_process");
    if (!pv_koala_process_func) {
        print_dl_error("Failed to load 'pv_koala_process'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_koala_delay_sample_func)(pv_koala_t *, int32_t *) =
            load_symbol(koala_library, "pv_koala_delay_sample");
    if (!pv_koala_delay_sample_func) {
        print_dl_error("Failed to load 'pv_koala_delay_sample'");
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
        print_dl_error("Failed to load 'pv_free_error_stack./b'");
        exit(EXIT_FAILURE);
    }

    pv_koala_t *koala = NULL;
    pv_status_t koala_status = pv_koala_init_func(access_key, model_path, &koala);
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

    drwav input_file;

#if defined(_WIN32) || defined(_WIN64)

    int input_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, input_path, NULL_TERMINATED, NULL, 0);
    wchar_t input_path_w[input_path_wchars_num];
    MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, input_path, NULL_TERMINATED, input_path_w, input_path_wchars_num);
    int drwav_init_file_status = drwav_init_file_w(&input_file, input_path_w, NULL);

#else

    int drwav_init_file_status = drwav_init_file(&input_file, input_path, NULL);

#endif

    if (!drwav_init_file_status) {
        fprintf(stderr, "Failed to open wav file at '%s'.", input_path);
        exit(EXIT_FAILURE);
    }

    if (input_file.sampleRate != (uint32_t) pv_sample_rate_func()) {
        fprintf(stderr, "audio sample rate should be %d\n.", pv_sample_rate_func());
        exit(EXIT_FAILURE);
    }

    if (input_file.bitsPerSample != 16) {
        fprintf(stderr, "audio format should be 16-bit\n.");
        exit(EXIT_FAILURE);
    }

    if (input_file.channels != 1) {
        fprintf(stderr, "audio should be single-channel.\n");
        exit(EXIT_FAILURE);
    }

    drwav output_file;
    drwav_data_format format;
    format.container = drwav_container_riff;
    format.format = DR_WAVE_FORMAT_PCM;
    format.channels = 1;
    format.sampleRate = 16000;
    format.bitsPerSample = 16;

#if defined(_WIN32) || defined(_WIN64)

    int output_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, output_path, NULL_TERMINATED, NULL, 0);
    wchar_t output_path_w[output_path_wchars_num];
    MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, output_path, NULL_TERMINATED, output_path_w, output_path_wchars_num);
    drwav_init_file_status = (int) drwav_init_file_write_w(&output_file, output_path_w, &format, NULL);

#else

    drwav_init_file_status = (int) drwav_init_file_write(&output_file, output_path, &format, NULL);

#endif

    if (!drwav_init_file_status) {
        fprintf(stderr, "Failed to open the output file at '%s'.", output_path);
        exit(EXIT_FAILURE);
    }

    const int32_t frame_length = pv_koala_frame_length_func();
    int32_t delay_samples = 0;
    koala_status = pv_koala_delay_sample_func(koala, &delay_samples);
    if (koala_status != PV_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to get delay sample with '%s'", pv_status_to_string_func(koala_status));
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
    int16_t *pcm_to_write = NULL;
    size_t pcm_to_write_length = 0;

    double total_cpu_time_usec = 0;
    double total_processed_time_usec = 0;

    fprintf(stdout, "Processing audio...\n");

    size_t total_samples = input_file.totalPCMFrameCount;

    int32_t start_sample = 0;
    while (start_sample < total_samples + delay_samples) {
        int32_t end_sample = start_sample + frame_length;

        memset(pcm, 0, frame_length * sizeof(int16_t));
        drwav_read_pcm_frames_s16(&input_file, frame_length, pcm);

        struct timeval before;
        gettimeofday(&before, NULL);

        koala_status = pv_koala_process_func(koala, pcm, enhanced_pcm);
        if (koala_status != PV_STATUS_SUCCESS) {
            fprintf(stderr, "'pv_koala_process' failed with '%s'\n", pv_status_to_string_func(koala_status));
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

        struct timeval after;
        gettimeofday(&after, NULL);

        total_cpu_time_usec +=
                (double) (after.tv_sec - before.tv_sec) * 1e6 + (double) (after.tv_usec - before.tv_usec);
        total_processed_time_usec += (frame_length * 1e6) / pv_sample_rate_func();

        pcm_to_write = enhanced_pcm;
        pcm_to_write_length = frame_length;
        if (end_sample > delay_samples) {
            if (end_sample > total_samples + delay_samples) {
                pcm_to_write_length = (total_samples + delay_samples - start_sample);
            }
            if (start_sample < delay_samples) {
                pcm_to_write += (delay_samples - start_sample);
                pcm_to_write_length -= (delay_samples - start_sample);
            }

            if ((int32_t) drwav_write_pcm_frames(&output_file, pcm_to_write_length, pcm_to_write) != pcm_to_write_length) {
                fprintf(stderr, "Failed to write to output file.\n");
                exit(EXIT_FAILURE);
            }
        }

        start_sample = end_sample;

        print_progress_bar(total_samples, end_sample);
    }

    const double real_time_factor = total_cpu_time_usec / total_processed_time_usec;
    fprintf(stdout, "\nReal time factor : %.3f\n", real_time_factor);

    fprintf(stdout, "\n");

    free(pcm);
    free(enhanced_pcm);
    drwav_uninit(&output_file);
    drwav_uninit(&input_file);
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
