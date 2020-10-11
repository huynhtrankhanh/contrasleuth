#!/bin/sh
ionic cap copy
cd ../backend
cross build --target=aarch64-linux-android --release
cross build --target=arm-linux-androideabi --release
cross build --target=armv7-linux-androideabi --release
cross build --target=i686-linux-android --release
cross build --target=x86_64-linux-android --release

mkdir -p ../frontend/android/app/src/main/jniLibs/arm64-v8a
mkdir -p ../frontend/android/app/src/main/jniLibs/armeabi
mkdir -p ../frontend/android/app/src/main/jniLibs/armeabi-v7a
mkdir -p ../frontend/android/app/src/main/jniLibs/x86
mkdir -p ../frontend/android/app/src/main/jniLibs/x86_64

mv ./target/aarch64-linux-android/release/contrasleuth ../frontend/android/app/src/main/jniLibs/arm64-v8a/libcontrasleuth.so
mv ./target/arm-linux-androideabi/release/contrasleuth ../frontend/android/app/src/main/jniLibs/armeabi/libcontrasleuth.so
mv ./target/armv7-linux-androideabi/release/contrasleuth ../frontend/android/app/src/main/jniLibs/armeabi-v7a/libcontrasleuth.so
mv ./target/i686-linux-android/release/contrasleuth ../frontend/android/app/src/main/jniLibs/x86/libcontrasleuth.so
mv ./target/x86_64-linux-android/release/contrasleuth ../frontend/android/app/src/main/jniLibs/x86_64/libcontrasleuth.so
cd ../frontend
