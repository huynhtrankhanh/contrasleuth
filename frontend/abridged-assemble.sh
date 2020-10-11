#!/bin/sh
ionic cap copy
cd ../backend
cross build --target=aarch64-linux-android --release
mkdir -p ../frontend/android/app/src/main/jniLibs/arm64-v8a/
mv ./target/aarch64-linux-android/release/contrasleuth ../frontend/android/app/src/main/jniLibs/arm64-v8a/libcontrasleuth.so
cd ../quinn
cross build --target=aarch64-linux-android --release
mv ./target/aarch64-linux-android/release/quinn ../frontend/android/app/src/main/jniLibs/arm64-v8a/libquinn.so
cd ../frontend
