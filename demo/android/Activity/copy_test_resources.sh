if [ ! -d "./koala-activity-demo-app/src/androidTest/assets/test_resources/audio" ]
then
    echo "Creating test audio samples directory..."
    mkdir -p ./koala-activity-demo-app/src/androidTest/assets/test_resources/audio
fi

echo "Copying test audio samples..."
cp ../../../res/audio/test.wav ./koala-activity-demo-app/src/androidTest/assets/test_resources/audio/test.wav
cp ../../../res/audio/noise.wav ./koala-activity-demo-app/src/androidTest/assets/test_resources/audio/noise.wav
