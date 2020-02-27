#!/bin/sh
ionic cap copy
cd ../backend
cross build --target=aarch64-linux-android --release
cross build --target=arm-linux-androideabi --release
cross build --target=armv7-linux-androideabi --release
cross build --target=i686-linux-android --release
cross build --target=x86_64-linux-android --release
mv ./target/aarch64-linux-android/release/parlance ../frontend/android/app/src/main/assets/parlance-aarch64-linux-android
mv ./target/arm-linux-androideabi/release/parlance ../frontend/android/app/src/main/assets/parlance-arm-linux-androideabi
mv ./target/armv7-linux-androideabi/release/parlance ../frontend/android/app/src/main/assets/parlance-armv7-linux-androideabi
mv ./target/i686-linux-android/release/parlance ../frontend/android/app/src/main/assets/parlance-i686-linux-android
mv ./target/x86_64-linux-android/release/parlance ../frontend/android/app/src/main/assets/parlance-x86_64-linux-android
cd ../frontend
