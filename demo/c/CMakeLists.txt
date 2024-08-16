cmake_minimum_required(VERSION 3.4)
project(koala_demo_c)

set(CMAKE_C_STANDARD 99)
set(CMAKE_BUILD_TYPE Release)
add_subdirectory(pvrecorder)

set(COMMON_LIBS dl m)
include_directories("${PROJECT_SOURCE_DIR}/../../include")

add_executable(
        koala_demo_file
        koala_demo_file.c)
target_include_directories(koala_demo_file PRIVATE dr_libs)

add_executable(
        koala_demo_mic
        koala_demo_mic.c
        $<TARGET_OBJECTS:pv_recorder_object>)
target_include_directories(koala_demo_mic PRIVATE dr_libs pvrecorder/include)


if (NOT WIN32)
    target_link_libraries(
            koala_demo_mic
            pthread
            ${COMMON_LIBS})
    target_link_libraries(koala_demo_file ${COMMON_LIBS})
    if ((${CMAKE_SYSTEM_PROCESSOR} MATCHES "arm" OR ${CMAKE_SYSTEM_PROCESSOR} MATCHES "aarch64") AND (UNIX AND NOT APPLE))
        target_link_libraries(koala_demo_mic atomic)
    endif ()
endif ()
