#!/bin/sh
ionic cap copy
cd ../backend
cross build --target=aarch64-linux-android --release
cross build --target=arm-linux-androideabi --release
cross build --target=armv7-linux-androideabi --release
cross build --target=i686-linux-android --release
cross build --target=x86_64-linux-android --release
mv ./target/aarch64-linux-android/release/contrasleuth ../frontend/android/app/src/main/assets/contrasleuth-aarch64-linux-android
mv ./target/arm-linux-androideabi/release/contrasleuth ../frontend/android/app/src/main/assets/contrasleuth-arm-linux-androideabi
mv ./target/armv7-linux-androideabi/release/contrasleuth ../frontend/android/app/src/main/assets/contrasleuth-armv7-linux-androideabi
mv ./target/i686-linux-android/release/contrasleuth ../frontend/android/app/src/main/assets/contrasleuth-i686-linux-android
mv ./target/x86_64-linux-android/release/contrasleuth ../frontend/android/app/src/main/assets/contrasleuth-x86_64-linux-android
cd ../frontend
