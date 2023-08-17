if [ ! -d "./koala-test-app/src/androidTest/assets/test_resources/audio" ]
then
    echo "Creating test audio samples directory..."
    mkdir -p ./koala-test-app/src/androidTest/assets/test_resources/audio
fi

echo "Copying test audio samples..."
cp ../../../resources/audio_samples/test.wav ./koala-test-app/src/androidTest/assets/test_resources/audio/test.wav
cp ../../../resources/audio_samples/noise.wav ./koala-test-app/src/androidTest/assets/test_resources/audio/noise.wav
