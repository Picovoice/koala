/*
    Copyright 2023 Picovoice Inc.
    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.
    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

#include <getopt.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/time.h>

#if defined(_WIN32) || defined(_WIN64)

#include <windows.h>

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

    return GetProcAddress((HMODULE)handle, symbol);

#else

    return dlsym(handle, symbol);

#endif
}

static void close_dl(void *handle) {

#if defined(_WIN32) || defined(_WIN64)

    FreeLibrary((HMODULE)handle);

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

void print_usage(const char *program_name) {
    fprintf(stdout, "Usage: %s [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY -i INPUT_PATH -o OUTPUT_PATH]\n", program_name);
}

int picovoice_main(int argc, char *argv[]) {
    const char *library_path = NULL;
    const char *model_path = NULL;
    const char *access_key = NULL;
    const char *input_path = NULL;
    const char *output_path = NULL;

    int c;
    while ((c = getopt_long(argc, argv, "l:a:i:o:", long_options, NULL)) != -1) {
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
                exit(1);
        }
    }

    if (!library_path || !access_key || !input_path || !output_path) {
        print_usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    drwav_data_format format;
    format.container = drwav_container_riff;
    format.format = DR_WAVE_FORMAT_PCM;
    format.channels = 1;
    format.sampleRate = 16000;
    format.bitsPerSample = 16;

    drwav inf;

    if (!drwav_init_file_write(&inf, output_path, &format, NULL)) {
        fprintf(stderr, "failed to open the output wav file at '%s'.", output_path);
        exit(EXIT_FAILURE);
    }


    void *koala_library = open_dl(library_path);
    if (!koala_library) {
        fprintf(stderr, "failed to open library at '%s'.\n", library_path);
        exit(EXIT_FAILURE);
    }

    const char *(*pv_status_to_string_func)(pv_status_t) = load_symbol(koala_library, "pv_status_to_string");
    if (!pv_status_to_string_func) {
        print_dl_error("failed to load 'pv_status_to_string'");
        exit(EXIT_FAILURE);
    }

    int32_t(*pv_sample_rate_func)() = load_symbol(koala_library, "pv_sample_rate");
    if (!pv_sample_rate_func) {
        print_dl_error("failed to load 'pv_sample_rate'");
        exit(EXIT_FAILURE);
    }

    pv_status_t(*pv_koala_init_func)(
    const char *, const char *, pv_koala_t * *) = load_symbol(koala_library, "pv_koala_init");
    if (!pv_koala_init_func) {
        print_dl_error("failed to load 'pv_koala_init'");
        exit(EXIT_FAILURE);
    }

    void (*pv_koala_delete_func)(pv_koala_t *) = load_symbol(koala_library, "pv_koala_delete");
    if (!pv_koala_delete_func) {
        print_dl_error("failed to load 'pv_koala_delete'");
        exit(EXIT_FAILURE);
    }

    pv_status_t(*pv_koala_process_func)(pv_koala_t * ,
    const int16_t *, int16_t *) =
    load_symbol(koala_library, "pv_koala_process");
    if (!pv_koala_process_func) {
        print_dl_error("failed to load 'pv_koala_process'");
        exit(EXIT_FAILURE);
    }

    void (*pv_koala_reset_func)(pv_koala_t *) = load_symbol(koala_library, "pv_koala_reset");
    if (!pv_koala_reset_func) {
        print_dl_error("failed to load 'pv_koala_reset'");
        exit(EXIT_FAILURE);
    }

    int32_t(*pv_koala_frame_length_func)() = load_symbol(koala_library, "pv_koala_frame_length");
    if (!pv_koala_frame_length_func) {
        print_dl_error("failed to load 'pv_koala_frame_length'");
        exit(EXIT_FAILURE);
    }

    const char *(*pv_koala_version_func)() = load_symbol(koala_library, "pv_koala_version");
    if (!pv_koala_version_func) {
        print_dl_error("failed to load 'pv_koala_version'");
        exit(EXIT_FAILURE);
    }

    pv_koala_t *koala = NULL;
    pv_status_t koala_status = pv_koala_init_func(access_key, model_path, &koala);
    if (koala_status != PV_STATUS_SUCCESS) {
        fprintf(stderr, "failed to init with '%s'", pv_status_to_string_func(koala_status));
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "V%s\n\n", pv_koala_version_func());

    const int32_t frame_length = pv_koala_frame_length_func();
    drwav f;

    if (!drwav_init_file(&f, input_path, NULL)) {
        fprintf(stderr, "failed to open wav file at '%s'.", input_path);
        exit(EXIT_FAILURE);
    }

    if (f.sampleRate != (uint32_t) pv_sample_rate_func()) {
        fprintf(stderr, "audio sample rate should be %d\n.", pv_sample_rate_func());
        exit(EXIT_FAILURE);
    }

    if (f.bitsPerSample != 16) {
        fprintf(stderr, "audio format should be 16-bit\n.");
        exit(EXIT_FAILURE);
    }

    if (f.channels != 1) {
        fprintf(stderr, "audio should be single-channel.\n");
        exit(EXIT_FAILURE);
    }

    int16_t *pcm = malloc(frame_length * sizeof(int16_t));
    if (!pcm) {
        fprintf(stderr, "Failed to allocate pcm memory.\n");
        exit(EXIT_FAILURE);
    }

    int16_t *enhanced_pcm = malloc(frame_length * sizeof(int16_t));
    if (!enhanced_pcm) {
        fprintf(stderr, "Failed to allocate enhanced_pcm memory.\n");
        exit(EXIT_FAILURE);
    }

    double total_cpu_time_usec = 0;
    double total_processed_time_usec = 0;

    while ((int32_t) drwav_read_pcm_frames_s16(&f, frame_length, pcm) == frame_length) {
        struct timeval before;
        gettimeofday(&before, NULL);

        koala_status = pv_koala_process_func(koala, pcm, enhanced_pcm);
        if (koala_status != PV_STATUS_SUCCESS) {
            fprintf(stderr, "'pv_koala_process' failed with '%s'\n", pv_status_to_string_func(koala_status));
            exit(EXIT_FAILURE);
        }

        struct timeval after;
        gettimeofday(&after, NULL);

        total_cpu_time_usec +=
                (double) (after.tv_sec - before.tv_sec) * 1e6 + (double) (after.tv_usec - before.tv_usec);
        total_processed_time_usec += (frame_length * 1e6) / pv_sample_rate_func();
    }

    const double real_time_factor = total_cpu_time_usec / total_processed_time_usec;
    fprintf(stdout, "real time factor : %.3f\n", real_time_factor);

    fprintf(stdout, "\n");

    free(pcm);
    free(enhanced_pcm);
    drwav_uninit(&f);
    drwav_uninit(&inf);
    pv_koala_delete_func(koala);
    close_dl(koala_library);

    return EXIT_SUCCESS;
}

int main(int argc, char *argv[]) {

#if defined(_WIN32) || defined(_WIN64)

#define UTF8_COMPOSITION_FLAG (0)
#define NULL_TERMINATED (-1)

    LPWSTR *wargv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (wargv == NULL) {
        fprintf(stderr, "CommandLineToArgvW failed\n");
        exit(1);
    }

    char *utf8_argv[argc];

    for (int i = 0; i < argc; ++i) {
        // WideCharToMultiByte: https://docs.microsoft.com/en-us/windows/win32/api/stringapiset/nf-stringapiset-widechartomultibyte
        int arg_chars_num = WideCharToMultiByte(CP_UTF8, UTF8_COMPOSITION_FLAG, wargv[i], NULL_TERMINATED, NULL, 0, NULL, NULL);
        utf8_argv[i] = (char *)malloc(arg_chars_num * sizeof(char));
        if (!utf8_argv[i]) {
            fprintf(stderr, "failed to to allocate memory for converting args");
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
